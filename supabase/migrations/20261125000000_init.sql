-- =====================================================================
-- Sistema de Escoltas — Migración inicial (Supabase / PostgreSQL 15+)
-- Proyecto: rznkopetlmitfxcixjcr
--
-- Migración ÚNICA e IDEMPOTENTE: se puede volver a ejecutar sin borrar
-- datos. No contiene DROP TABLE. Las políticas y los triggers se
-- reemplazan con DROP ... IF EXISTS + CREATE / CREATE OR REPLACE.
--
-- Convenciones:
--   * IDs uuid generados con gen_random_uuid().
--   * Timestamps: timestamptz NOT NULL DEFAULT now().
--   * Dinero: numeric(12,2) (el total calculado usa numeric(14,2)).
--   * Idioma de comentarios y mensajes: español.
-- =====================================================================

SET search_path = public, extensions;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;

-- ---------------------------------------------------------------------
-- 1. Funciones auxiliares
-- ---------------------------------------------------------------------

-- Actualiza automáticamente la columna updated_at.
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $fn$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$fn$;

-- Devuelve el rol del usuario autenticado leyendo su perfil.
-- SECURITY DEFINER + search_path fijo evita recursión en RLS: la consulta
-- interna a public.profiles se ejecuta como el dueño de la función, que
-- omite las políticas (los superusuarios y service_role siempre omiten RLS).
-- Se define en plpgsql, no en SQL: el cuerpo de una función SQL se valida
-- al crearla y estas tablas todavía no existen en este punto de la migración.
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_rol text;
BEGIN
  SELECT p.role INTO v_rol
  FROM public.profiles AS p
  WHERE p.id = auth.uid()
  LIMIT 1;
  RETURN COALESCE(v_rol, 'anon');
END;
$fn$;

-- Devuelve el id de la fila de "escoltas" vinculada al usuario actual,
-- o NULL si el usuario no tiene ficha de escolta. También usa plpgsql
-- para no exigir que la tabla exista antes de crear la función.
CREATE OR REPLACE FUNCTION public.get_my_escort_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_escolta_id uuid;
BEGIN
  SELECT e.id INTO v_escolta_id
  FROM public.escoltas AS e
  WHERE e.user_id = auth.uid()
  LIMIT 1;
  RETURN v_escolta_id;
END;
$fn$;

-- Atajos de rol. Se usan en las políticas para no repetir literales.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$ SELECT public.get_my_role() = 'admin'; $fn$;

CREATE OR REPLACE FUNCTION public.is_supervisor()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$ SELECT public.get_my_role() = 'supervisor'; $fn$;

CREATE OR REPLACE FUNCTION public.is_contador()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$ SELECT public.get_my_role() = 'contador'; $fn$;

-- Personal con acceso de lectura global: admin, supervisor y contador.
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$ SELECT public.get_my_role() IN ('admin', 'supervisor', 'contador'); $fn$;

CREATE OR REPLACE FUNCTION public.is_admin_or_supervisor()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$ SELECT public.get_my_role() IN ('admin', 'supervisor'); $fn$;

-- Permite al escolta ver únicamente los periodos en los que tiene un
-- detalle de nómina. Se implementa como función para evitar ambigüedad
-- de columnas dentro de una política RLS. plpgsql permite crearla antes
-- de las tablas que consulta.
CREATE OR REPLACE FUNCTION public.tengo_detalle_en_periodo(p_periodo_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_existe boolean := false;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.nomina_detalles AS nd
    WHERE nd.periodo_id = p_periodo_id
      AND nd.escolta_id = public.get_my_escort_id()
  ) INTO v_existe;
  RETURN COALESCE(v_existe, false);
END;
$fn$;

-- Alta automática de perfil cuando se crea un usuario en auth.users.
-- El rol por defecto es 'escolta'; el administrador se cambia después
-- desde SQL Editor (ver README.md).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role, avatar_url, phone, active)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data ->> 'full_name',
      NEW.raw_user_meta_data ->> 'name',
      split_part(NEW.email, '@', 1),
      'Usuario'
    ),
    NEW.email,
    'escolta',
    NEW.raw_user_meta_data ->> 'avatar_url',
    NEW.raw_user_meta_data ->> 'phone',
    true
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$fn$;

-- Auditoría genérica: guarda INSERT / UPDATE / DELETE de las tablas clave.
CREATE OR REPLACE FUNCTION public.audit_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_registro_id uuid;
  v_cambios jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_registro_id := OLD.id::uuid;
    v_cambios := jsonb_build_object('old', to_jsonb(OLD));
  ELSIF TG_OP = 'UPDATE' THEN
    v_registro_id := NEW.id::uuid;
    v_cambios := jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW));
  ELSE
    v_registro_id := NEW.id::uuid;
    v_cambios := jsonb_build_object('new', to_jsonb(NEW));
  END IF;

  INSERT INTO public.auditoria (tabla, operacion, registro_id, usuario_id, cambios)
  VALUES (TG_TABLE_NAME, TG_OP, v_registro_id, auth.uid(), v_cambios);

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$fn$;

-- Completa automáticamente quién y cuándo aprobó un permiso.
CREATE OR REPLACE FUNCTION public.validar_aprobacion_permiso()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.estado IN ('aprobado', 'rechazado') THEN
      NEW.aprobado_por := auth.uid();
      NEW.aprobado_at := now();
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.estado IS DISTINCT FROM OLD.estado
       AND NEW.estado IN ('aprobado', 'rechazado') THEN
      NEW.aprobado_por := auth.uid();
      NEW.aprobado_at := now();
    ELSIF NEW.estado = 'pendiente' AND OLD.estado IS DISTINCT FROM 'pendiente' THEN
      NEW.aprobado_por := NULL;
      NEW.aprobado_at := NULL;
      NEW.notas_revision := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$;

-- Un escolta no puede alterar la asignación, la fecha, el estado ni las
-- horas de una asistencia; sólo check_in / check_out / notas.
CREATE OR REPLACE FUNCTION public.proteger_asistencia_escolta()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
BEGIN
  IF public.get_my_role() = 'escolta' THEN
    NEW.id := OLD.id;
    NEW.created_at := OLD.created_at;
    NEW.escolta_id := OLD.escolta_id;
    NEW.asignacion_id := OLD.asignacion_id;
    NEW.fecha := OLD.fecha;
    NEW.estado := OLD.estado;
    -- Las horas siempre se derivan de los tiempos reales: el escolta no
    -- puede inventar horas, pero su check-out sí debe reflejarse.
    IF NEW.check_in IS NOT NULL AND NEW.check_out IS NOT NULL THEN
      NEW.horas := round(
        (extract(epoch FROM (NEW.check_out - NEW.check_in)) / 3600)::numeric,
        2
      );
    ELSE
      NEW.horas := 0;
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$;

-- Un escolta puede corregir su solicitud mientras esté pendiente, pero
-- nunca auto-aprobarla ni cambiar su tipo / fechas / solicitante.
CREATE OR REPLACE FUNCTION public.proteger_permiso_escolta()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
BEGIN
  IF public.get_my_role() = 'escolta' THEN
    NEW.id := OLD.id;
    NEW.created_at := OLD.created_at;
    NEW.escolta_id := OLD.escolta_id;
    NEW.tipo_id := OLD.tipo_id;
    NEW.fecha_inicio := OLD.fecha_inicio;
    NEW.fecha_fin := OLD.fecha_fin;
    NEW.solicitado_por := OLD.solicitado_por;
    NEW.estado := 'pendiente';
    NEW.aprobado_por := NULL;
    NEW.aprobado_at := NULL;
    NEW.notas_revision := NULL;
  END IF;
  RETURN NEW;
END;
$fn$;

-- ---------------------------------------------------------------------
-- 2. Tablas
-- ---------------------------------------------------------------------

-- Perfiles de usuario (espejo de auth.users).
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  full_name text,
  email text,
  role text NOT NULL DEFAULT 'escolta'
    CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'supervisor', 'contador', 'escolta')),
  avatar_url text,
  phone text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Catálogo de grados.
CREATE TABLE IF NOT EXISTS public.grados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL UNIQUE,
  nivel integer NOT NULL DEFAULT 0,
  activo boolean NOT NULL DEFAULT true
);

-- Fichas de escoltas.
CREATE TABLE IF NOT EXISTS public.escoltas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE REFERENCES public.profiles (id) ON DELETE SET NULL,
  codigo text NOT NULL UNIQUE,
  nombres text NOT NULL,
  apellidos text NOT NULL,
  cedula text NOT NULL UNIQUE,
  telefono text,
  direccion text,
  fecha_ingreso date DEFAULT CURRENT_DATE,
  grado_id uuid REFERENCES public.grados (id) ON DELETE SET NULL,
  estado text NOT NULL DEFAULT 'activo'
    CONSTRAINT escoltas_estado_check CHECK (estado IN ('activo', 'inactivo', 'suspendido', 'vacaciones')),
  foto_url text,
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Clientes para los cuales se prestan los servicios.
CREATE TABLE IF NOT EXISTS public.clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  ruc text UNIQUE,
  direccion text,
  contacto text,
  telefono text,
  activo boolean NOT NULL DEFAULT true,
  color text DEFAULT '#2563EB',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Catálogo de turnos.
CREATE TABLE IF NOT EXISTS public.turnos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL UNIQUE,
  hora_inicio time NOT NULL,
  hora_fin time NOT NULL,
  horas_base numeric(5,2) NOT NULL DEFAULT 8
    CONSTRAINT turnos_horas_check CHECK (horas_base > 0),
  activo boolean NOT NULL DEFAULT true
);

-- Asignaciones de escoltas a clientes / turnos.
CREATE TABLE IF NOT EXISTS public.asignaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escolta_id uuid NOT NULL REFERENCES public.escoltas (id) ON DELETE CASCADE,
  cliente_id uuid NOT NULL REFERENCES public.clientes (id) ON DELETE RESTRICT,
  turno_id uuid REFERENCES public.turnos (id) ON DELETE SET NULL,
  fecha_inicio date NOT NULL DEFAULT CURRENT_DATE,
  fecha_fin date,
  estado text NOT NULL DEFAULT 'planificada'
    CONSTRAINT asignaciones_estado_check CHECK (estado IN ('planificada', 'activa', 'finalizada', 'cancelada')),
  supervisor_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  notas text,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT asignaciones_fecha_check CHECK (fecha_fin IS NULL OR fecha_fin >= fecha_inicio)
);

-- Asistencia diaria (check_in / check_out).
CREATE TABLE IF NOT EXISTS public.asistencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escolta_id uuid NOT NULL REFERENCES public.escoltas (id) ON DELETE CASCADE,
  asignacion_id uuid REFERENCES public.asignaciones (id) ON DELETE SET NULL,
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  check_in timestamptz,
  check_out timestamptz,
  estado text NOT NULL DEFAULT 'presente'
    CONSTRAINT asistencias_estado_check CHECK (estado IN ('presente', 'ausente', 'tarde', 'justificada')),
  horas numeric(5,2) DEFAULT 0,
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT asistencias_escolta_asignacion_fecha_key UNIQUE (escolta_id, asignacion_id, fecha),
  CONSTRAINT asistencias_checkout_check CHECK (check_out IS NULL OR check_in IS NULL OR check_out >= check_in)
);

-- Catálogo de tipos de permiso.
CREATE TABLE IF NOT EXISTS public.tipos_permiso (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL UNIQUE,
  descripcion text,
  requiere_comprobante boolean NOT NULL DEFAULT false,
  activo boolean NOT NULL DEFAULT true
);

-- Solicitudes de permiso de los escoltas.
CREATE TABLE IF NOT EXISTS public.permisos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escolta_id uuid NOT NULL REFERENCES public.escoltas (id) ON DELETE CASCADE,
  tipo_id uuid NOT NULL REFERENCES public.tipos_permiso (id) ON DELETE RESTRICT,
  fecha_inicio date NOT NULL,
  fecha_fin date NOT NULL,
  motivo text NOT NULL,
  comprobante_url text,
  estado text NOT NULL DEFAULT 'pendiente'
    CONSTRAINT permisos_estado_check CHECK (estado IN ('pendiente', 'aprobado', 'rechazado')),
  solicitado_por uuid REFERENCES public.profiles (id) ON DELETE SET NULL DEFAULT auth.uid(),
  aprobado_por uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  aprobado_at timestamptz,
  notas_revision text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT permisos_fecha_check CHECK (fecha_fin >= fecha_inicio)
);

-- Periodos de nómina.
CREATE TABLE IF NOT EXISTS public.periodos_nomina (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL UNIQUE,
  fecha_inicio date NOT NULL,
  fecha_fin date NOT NULL,
  estado text NOT NULL DEFAULT 'abierto'
    CONSTRAINT periodos_nomina_estado_check CHECK (estado IN ('abierto', 'cerrado', 'pagado')),
  creado_por uuid REFERENCES public.profiles (id) ON DELETE SET NULL DEFAULT auth.uid(),
  cerrado_por uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  cerrado_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT periodos_nomina_fecha_check CHECK (fecha_fin >= fecha_inicio)
);

-- Detalle de nómina por escolta y periodo. El total es una columna
-- GENERATED STORED: no se puede insertar ni actualizar directamente.
CREATE TABLE IF NOT EXISTS public.nomina_detalles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  periodo_id uuid NOT NULL REFERENCES public.periodos_nomina (id) ON DELETE CASCADE,
  escolta_id uuid NOT NULL REFERENCES public.escoltas (id) ON DELETE CASCADE,
  dias_trabajados numeric(6,2) DEFAULT 0,
  horas_extras numeric(6,2) DEFAULT 0,
  sueldo_base numeric(12,2) DEFAULT 0,
  bonos numeric(12,2) DEFAULT 0,
  descuentos numeric(12,2) DEFAULT 0,
  total numeric(14,2) GENERATED ALWAYS AS
    (sueldo_base + bonos + horas_extras - descuentos) STORED,
  estado text NOT NULL DEFAULT 'pendiente'
    CONSTRAINT nomina_detalles_estado_check CHECK (estado IN ('pendiente', 'aprobado', 'pagado')),
  pagado_at timestamptz,
  pago_referencia text,
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nomina_detalles_periodo_escolta_key UNIQUE (periodo_id, escolta_id)
);

-- Registro de pagos realizados.
CREATE TABLE IF NOT EXISTS public.pagos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  periodo_id uuid NOT NULL REFERENCES public.periodos_nomina (id) ON DELETE CASCADE,
  escolta_id uuid NOT NULL REFERENCES public.escoltas (id) ON DELETE CASCADE,
  monto numeric(12,2) NOT NULL,
  fecha_pago date NOT NULL DEFAULT CURRENT_DATE,
  metodo text NOT NULL
    CONSTRAINT pagos_metodo_check CHECK (metodo IN ('transferencia', 'efectivo', 'cheque')),
  referencia text,
  comprobante_url text,
  estado text NOT NULL DEFAULT 'registrado'
    CONSTRAINT pagos_estado_check CHECK (estado IN ('registrado', 'confirmado', 'anulado')),
  registrado_por uuid REFERENCES public.profiles (id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Bitácora de cambios. La llena el trigger genérico, no los clientes.
CREATE TABLE IF NOT EXISTS public.auditoria (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tabla text NOT NULL,
  operacion text NOT NULL,
  registro_id uuid,
  usuario_id uuid,
  cambios jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 3. Resguardos de restricciones CHECK (por si una ejecución anterior
--    creó la tabla sin alguna de ellas). No elimina nada.
-- ---------------------------------------------------------------------
DO $do$
DECLARE
  v record;
BEGIN
  FOR v IN
    SELECT * FROM (VALUES
      ('profiles',          'profiles_role_check',            $expr$role IN ('admin', 'supervisor', 'contador', 'escolta')$expr$),
      ('grados',            'grados_nivel_check',             $expr$nivel >= 0$expr$),
      ('turnos',            'turnos_horas_check',             $expr$horas_base > 0$expr$),
      ('escoltas',          'escoltas_estado_check',          $expr$estado IN ('activo', 'inactivo', 'suspendido', 'vacaciones')$expr$),
      ('asignaciones',      'asignaciones_estado_check',      $expr$estado IN ('planificada', 'activa', 'finalizada', 'cancelada')$expr$),
      ('asignaciones',      'asignaciones_fecha_check',       $expr$fecha_fin IS NULL OR fecha_fin >= fecha_inicio$expr$),
      ('asistencias',       'asistencias_estado_check',       $expr$estado IN ('presente', 'ausente', 'tarde', 'justificada')$expr$),
      ('asistencias',       'asistencias_checkout_check',     $expr$check_out IS NULL OR check_in IS NULL OR check_out >= check_in$expr$),
      ('permisos',          'permisos_estado_check',          $expr$estado IN ('pendiente', 'aprobado', 'rechazado')$expr$),
      ('permisos',          'permisos_fecha_check',           $expr$fecha_fin >= fecha_inicio$expr$),
      ('periodos_nomina',   'periodos_nomina_estado_check',   $expr$estado IN ('abierto', 'cerrado', 'pagado')$expr$),
      ('periodos_nomina',   'periodos_nomina_fecha_check',    $expr$fecha_fin >= fecha_inicio$expr$),
      ('nomina_detalles',   'nomina_detalles_estado_check',   $expr$estado IN ('pendiente', 'aprobado', 'pagado')$expr$),
      ('pagos',             'pagos_metodo_check',             $expr$metodo IN ('transferencia', 'efectivo', 'cheque')$expr$),
      ('pagos',             'pagos_estado_check',             $expr$estado IN ('registrado', 'confirmado', 'anulado')$expr$)
    ) AS x(tabla, constraint_name, expr)
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint AS c
      WHERE c.conname = v.constraint_name
        AND c.conrelid = to_regclass('public.' || v.tabla)::oid
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (%s)',
                     v.tabla, v.constraint_name, v.expr);
    END IF;
  END LOOP;
END
$do$;

-- ---------------------------------------------------------------------
-- 4. Índices de claves foráneas y fechas más consultadas
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_profiles_role_active ON public.profiles (role) WHERE active;
CREATE INDEX IF NOT EXISTS idx_escoltas_grado ON public.escoltas (grado_id);
CREATE INDEX IF NOT EXISTS idx_escoltas_estado ON public.escoltas (estado);
CREATE INDEX IF NOT EXISTS idx_clientes_activo ON public.clientes (activo);
CREATE INDEX IF NOT EXISTS idx_asignaciones_escolta ON public.asignaciones (escolta_id);
CREATE INDEX IF NOT EXISTS idx_asignaciones_cliente ON public.asignaciones (cliente_id);
CREATE INDEX IF NOT EXISTS idx_asignaciones_turno ON public.asignaciones (turno_id);
CREATE INDEX IF NOT EXISTS idx_asignaciones_supervisor ON public.asignaciones (supervisor_id);
CREATE INDEX IF NOT EXISTS idx_asignaciones_fechas ON public.asignaciones (fecha_inicio, fecha_fin);
CREATE INDEX IF NOT EXISTS idx_asignaciones_estado ON public.asignaciones (estado);
CREATE INDEX IF NOT EXISTS idx_asistencias_escolta ON public.asistencias (escolta_id);
CREATE INDEX IF NOT EXISTS idx_asistencias_asignacion ON public.asistencias (asignacion_id);
CREATE INDEX IF NOT EXISTS idx_asistencias_fecha ON public.asistencias (fecha);
CREATE INDEX IF NOT EXISTS idx_asistencias_estado ON public.asistencias (estado);
CREATE INDEX IF NOT EXISTS idx_permisos_escolta ON public.permisos (escolta_id);
CREATE INDEX IF NOT EXISTS idx_permisos_tipo ON public.permisos (tipo_id);
CREATE INDEX IF NOT EXISTS idx_permisos_estado ON public.permisos (estado);
CREATE INDEX IF NOT EXISTS idx_permisos_fechas ON public.permisos (fecha_inicio, fecha_fin);
CREATE INDEX IF NOT EXISTS idx_permisos_solicitado_por ON public.permisos (solicitado_por);
CREATE INDEX IF NOT EXISTS idx_permisos_aprobado_por ON public.permisos (aprobado_por);
CREATE INDEX IF NOT EXISTS idx_periodos_estado ON public.periodos_nomina (estado);
CREATE INDEX IF NOT EXISTS idx_periodos_fechas ON public.periodos_nomina (fecha_inicio, fecha_fin);
CREATE INDEX IF NOT EXISTS idx_nomina_escolta ON public.nomina_detalles (escolta_id);
CREATE INDEX IF NOT EXISTS idx_nomina_estado ON public.nomina_detalles (estado);
CREATE INDEX IF NOT EXISTS idx_pagos_periodo ON public.pagos (periodo_id);
CREATE INDEX IF NOT EXISTS idx_pagos_escolta ON public.pagos (escolta_id);
CREATE INDEX IF NOT EXISTS idx_pagos_fecha ON public.pagos (fecha_pago);
CREATE INDEX IF NOT EXISTS idx_pagos_estado ON public.pagos (estado);
CREATE INDEX IF NOT EXISTS idx_auditoria_tabla_registro ON public.auditoria (tabla, registro_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_usuario ON public.auditoria (usuario_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_creado ON public.auditoria (created_at);

-- ---------------------------------------------------------------------
-- 5. Triggers
-- ---------------------------------------------------------------------

-- updated_at en todas las tablas que lo tienen (se recrean sin borrarlas).
DO $do$
DECLARE
  v_tabla text;
BEGIN
  FOREACH v_tabla IN ARRAY ARRAY[
    'profiles', 'escoltas', 'clientes', 'asignaciones', 'asistencias',
    'permisos', 'periodos_nomina', 'nomina_detalles', 'pagos'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_updated_at ON public.%I', v_tabla);
    EXECUTE format(
      'CREATE TRIGGER trg_updated_at BEFORE UPDATE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', v_tabla);
  END LOOP;
END
$do$;

-- Auditoría sobre las tablas clave (la tabla auditoria NO se audita a sí misma).
DO $do$
DECLARE
  v_tabla text;
BEGIN
  FOREACH v_tabla IN ARRAY ARRAY[
    'profiles', 'escoltas', 'clientes', 'asignaciones', 'asistencias',
    'permisos', 'periodos_nomina', 'nomina_detalles', 'pagos'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_auditoria ON public.%I', v_tabla);
    EXECUTE format(
      'CREATE TRIGGER trg_auditoria AFTER INSERT OR UPDATE OR DELETE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.audit_changes()', v_tabla);
  END LOOP;
END
$do$;

-- Perfil automático al crear usuarios en Auth.
DROP TRIGGER IF EXISTS trg_on_auth_user_created ON auth.users;
CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Aprobación de permisos: quién y cuándo.
DROP TRIGGER IF EXISTS trg_permiso_validar_aprobacion ON public.permisos;
CREATE TRIGGER trg_permiso_validar_aprobacion
  BEFORE INSERT OR UPDATE ON public.permisos
  FOR EACH ROW EXECUTE FUNCTION public.validar_aprobacion_permiso();

-- El guardián va antes (por orden alfabético de nombre) que el validador.
DROP TRIGGER IF EXISTS trg_permiso_guard_escolta ON public.permisos;
CREATE TRIGGER trg_permiso_guard_escolta
  BEFORE UPDATE ON public.permisos
  FOR EACH ROW EXECUTE FUNCTION public.proteger_permiso_escolta();

DROP TRIGGER IF EXISTS trg_asistencia_guard_escolta ON public.asistencias;
CREATE TRIGGER trg_asistencia_guard_escolta
  BEFORE UPDATE ON public.asistencias
  FOR EACH ROW EXECUTE FUNCTION public.proteger_asistencia_escolta();

-- ---------------------------------------------------------------------
-- 6. Row Level Security
--
-- FORCE se aplica para que ni siquiera el dueño de la tabla omita las
-- políticas. Los superusuarios (postgres) y service_role siguen omitiendo
-- RLS por diseño de PostgreSQL/Supabase, por lo que las migraciones y el
-- seed funcionan con normalidad.
-- ---------------------------------------------------------------------
ALTER TABLE public.profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles        FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.grados          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grados          FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.escoltas        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escoltas        FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.clientes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes        FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.turnos          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.turnos          FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.asignaciones    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asignaciones    FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.asistencias     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asistencias     FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.tipos_permiso   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tipos_permiso   FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.permisos        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permisos        FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.periodos_nomina ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.periodos_nomina FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.nomina_detalles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nomina_detalles FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.pagos           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagos           FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.auditoria       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditoria       FORCE  ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- 7. Políticas RLS
--
-- Todas las políticas son TO authenticated. anon no tiene ninguna
-- política, por lo que no ve filas aunque tenga privilegios de tabla.
-- service_role omite RLS.
-- ---------------------------------------------------------------------

-- 7.1 Catálogos y clientes: lectura para todo usuario autenticado,
--     escritura exclusiva del admin.
DROP POLICY IF EXISTS "catalogo_lectura_grados" ON public.grados;
CREATE POLICY "catalogo_lectura_grados" ON public.grados
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "admin_total_grados" ON public.grados;
CREATE POLICY "admin_total_grados" ON public.grados
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "catalogo_lectura_turnos" ON public.turnos;
CREATE POLICY "catalogo_lectura_turnos" ON public.turnos
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "admin_total_turnos" ON public.turnos;
CREATE POLICY "admin_total_turnos" ON public.turnos
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "catalogo_lectura_tipos_permiso" ON public.tipos_permiso;
CREATE POLICY "catalogo_lectura_tipos_permiso" ON public.tipos_permiso
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "admin_total_tipos_permiso" ON public.tipos_permiso;
CREATE POLICY "admin_total_tipos_permiso" ON public.tipos_permiso
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "catalogo_lectura_clientes" ON public.clientes;
CREATE POLICY "catalogo_lectura_clientes" ON public.clientes
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "admin_total_clientes" ON public.clientes;
CREATE POLICY "admin_total_clientes" ON public.clientes
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 7.2 Perfiles: el escolta sólo ve el suyo; staff ve todos; escribe admin.
DROP POLICY IF EXISTS "admin_total_profiles" ON public.profiles;
CREATE POLICY "admin_total_profiles" ON public.profiles
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "perfil_propio_o_staff" ON public.profiles;
CREATE POLICY "perfil_propio_o_staff" ON public.profiles
  FOR SELECT TO authenticated USING (public.is_staff() OR id = auth.uid());

-- 7.3 Escoltas: lectura global para staff y de la propia ficha para el escolta.
DROP POLICY IF EXISTS "admin_total_escoltas" ON public.escoltas;
CREATE POLICY "admin_total_escoltas" ON public.escoltas
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "escolta_lectura_segun_rol" ON public.escoltas;
CREATE POLICY "escolta_lectura_segun_rol" ON public.escoltas
  FOR SELECT TO authenticated USING (public.is_staff() OR user_id = auth.uid());

-- 7.4 Asignaciones: admin todo; supervisor lee, inserta y actualiza;
--     escolta lee las suyas; contador sólo lee.
DROP POLICY IF EXISTS "admin_total_asignaciones" ON public.asignaciones;
CREATE POLICY "admin_total_asignaciones" ON public.asignaciones
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "asignacion_lectura" ON public.asignaciones;
CREATE POLICY "asignacion_lectura" ON public.asignaciones
  FOR SELECT TO authenticated
  USING (public.is_staff() OR escolta_id = public.get_my_escort_id());
DROP POLICY IF EXISTS "supervisor_inserta_asignacion" ON public.asignaciones;
CREATE POLICY "supervisor_inserta_asignacion" ON public.asignaciones
  FOR INSERT TO authenticated WITH CHECK (public.is_supervisor());
DROP POLICY IF EXISTS "supervisor_actualiza_asignacion" ON public.asignaciones;
CREATE POLICY "supervisor_actualiza_asignacion" ON public.asignaciones
  FOR UPDATE TO authenticated
  USING (public.is_supervisor()) WITH CHECK (public.is_supervisor());

-- 7.5 Asistencias: admin todo; supervisor lee / inserta / actualiza;
--     escolta lee, registra su check_in y completa su check_out.
DROP POLICY IF EXISTS "admin_total_asistencias" ON public.asistencias;
CREATE POLICY "admin_total_asistencias" ON public.asistencias
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "asistencia_lectura" ON public.asistencias;
CREATE POLICY "asistencia_lectura" ON public.asistencias
  FOR SELECT TO authenticated
  USING (public.is_staff() OR escolta_id = public.get_my_escort_id());
DROP POLICY IF EXISTS "supervisor_inserta_asistencia" ON public.asistencias;
CREATE POLICY "supervisor_inserta_asistencia" ON public.asistencias
  FOR INSERT TO authenticated WITH CHECK (public.is_supervisor());
DROP POLICY IF EXISTS "supervisor_actualiza_asistencia" ON public.asistencias;
CREATE POLICY "supervisor_actualiza_asistencia" ON public.asistencias
  FOR UPDATE TO authenticated
  USING (public.is_supervisor()) WITH CHECK (public.is_supervisor());
DROP POLICY IF EXISTS "escolta_inserta_asistencia" ON public.asistencias;
CREATE POLICY "escolta_inserta_asistencia" ON public.asistencias
  FOR INSERT TO authenticated
  WITH CHECK (
    public.get_my_role() = 'escolta'
    AND escolta_id = public.get_my_escort_id()
    AND (
      asignacion_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.asignaciones AS a
        WHERE a.id = asignacion_id
          AND a.escolta_id = public.get_my_escort_id()
      )
    )
  );
DROP POLICY IF EXISTS "escolta_actualiza_asistencia" ON public.asistencias;
CREATE POLICY "escolta_actualiza_asistencia" ON public.asistencias
  FOR UPDATE TO authenticated
  USING (
    public.get_my_role() = 'escolta'
    AND escolta_id = public.get_my_escort_id()
    AND check_out IS NULL
  )
  WITH CHECK (
    public.get_my_role() = 'escolta'
    AND escolta_id = public.get_my_escort_id()
  );

-- 7.6 Permisos: admin todo; supervisor aprueba / rechaza;
--     escolta lee los suyos, los crea y sólo puede editarlos pendientes.
DROP POLICY IF EXISTS "admin_total_permisos" ON public.permisos;
CREATE POLICY "admin_total_permisos" ON public.permisos
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "permiso_lectura" ON public.permisos;
CREATE POLICY "permiso_lectura" ON public.permisos
  FOR SELECT TO authenticated
  USING (public.is_staff() OR escolta_id = public.get_my_escort_id());
DROP POLICY IF EXISTS "supervisor_aprueba_permiso" ON public.permisos;
CREATE POLICY "supervisor_aprueba_permiso" ON public.permisos
  FOR UPDATE TO authenticated
  USING (public.is_supervisor()) WITH CHECK (public.is_supervisor());
DROP POLICY IF EXISTS "escolta_inserta_permiso" ON public.permisos;
CREATE POLICY "escolta_inserta_permiso" ON public.permisos
  FOR INSERT TO authenticated
  WITH CHECK (
    public.get_my_role() = 'escolta'
    AND escolta_id = public.get_my_escort_id()
    AND estado = 'pendiente'
    AND solicitado_por = auth.uid()
  );
-- El supervisor también puede solicitar un permiso en nombre de un escolta.
DROP POLICY IF EXISTS "supervisor_inserta_permiso" ON public.permisos;
CREATE POLICY "supervisor_inserta_permiso" ON public.permisos
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_supervisor()
    AND solicitado_por = auth.uid()
    AND estado = 'pendiente'
  );
DROP POLICY IF EXISTS "escolta_edita_permiso_pendiente" ON public.permisos;
CREATE POLICY "escolta_edita_permiso_pendiente" ON public.permisos
  FOR UPDATE TO authenticated
  USING (
    public.get_my_role() = 'escolta'
    AND escolta_id = public.get_my_escort_id()
    AND estado = 'pendiente'
  )
  WITH CHECK (
    public.get_my_role() = 'escolta'
    AND escolta_id = public.get_my_escort_id()
    AND estado = 'pendiente'
  );

-- 7.7 Nómina: admin y contador gestionan; supervisor lee (no escribe);
--     escolta lee únicamente sus detalles y los periodos donde aparece.
DROP POLICY IF EXISTS "admin_total_periodos_nomina" ON public.periodos_nomina;
CREATE POLICY "admin_total_periodos_nomina" ON public.periodos_nomina
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "contador_gestiona_periodos" ON public.periodos_nomina;
CREATE POLICY "contador_gestiona_periodos" ON public.periodos_nomina
  FOR ALL TO authenticated USING (public.is_contador()) WITH CHECK (public.is_contador());
DROP POLICY IF EXISTS "periodo_lectura" ON public.periodos_nomina;
CREATE POLICY "periodo_lectura" ON public.periodos_nomina
  FOR SELECT TO authenticated
  USING (public.is_staff() OR public.tengo_detalle_en_periodo(id));

DROP POLICY IF EXISTS "admin_total_nomina_detalles" ON public.nomina_detalles;
CREATE POLICY "admin_total_nomina_detalles" ON public.nomina_detalles
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "contador_gestiona_nomina" ON public.nomina_detalles;
CREATE POLICY "contador_gestiona_nomina" ON public.nomina_detalles
  FOR ALL TO authenticated USING (public.is_contador()) WITH CHECK (public.is_contador());
DROP POLICY IF EXISTS "nomina_lectura" ON public.nomina_detalles;
CREATE POLICY "nomina_lectura" ON public.nomina_detalles
  FOR SELECT TO authenticated
  USING (public.is_staff() OR escolta_id = public.get_my_escort_id());

-- 7.8 Pagos: sólo admin y contador escriben; staff lee. El escolta no
--     tiene acceso a esta tabla (decisión de seguridad, ver README).
DROP POLICY IF EXISTS "admin_total_pagos" ON public.pagos;
CREATE POLICY "admin_total_pagos" ON public.pagos
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "contador_gestiona_pagos" ON public.pagos;
CREATE POLICY "contador_gestiona_pagos" ON public.pagos
  FOR ALL TO authenticated USING (public.is_contador()) WITH CHECK (public.is_contador());
DROP POLICY IF EXISTS "pagos_lectura_staff" ON public.pagos;
CREATE POLICY "pagos_lectura_staff" ON public.pagos
  FOR SELECT TO authenticated USING (public.is_staff());

-- 7.9 Auditoría: sólo el admin puede consultarla; la escriben los triggers.
DROP POLICY IF EXISTS "auditoria_solo_admin" ON public.auditoria;
CREATE POLICY "auditoria_solo_admin" ON public.auditoria
  FOR SELECT TO authenticated USING (public.is_admin());

-- ---------------------------------------------------------------------
-- 8. Vistas
--
-- security_invoker = true es imprescindible: obliga a evaluar el RLS de
-- las tablas base con el usuario que consulta la vista. Sin esta opción
-- la vista se ejecutaría como su dueño (postgres) y filtraría de menos.
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_escoltas_activos
WITH (security_invoker = true) AS
SELECT
  e.id,
  e.codigo,
  e.nombres,
  e.apellidos,
  concat_ws(' ', e.nombres, e.apellidos) AS nombre_completo,
  e.cedula,
  e.telefono,
  e.direccion,
  e.fecha_ingreso,
  g.nombre AS grado,
  e.estado,
  e.foto_url,
  e.user_id,
  p.full_name,
  p.email,
  p.avatar_url,
  p.phone
FROM public.escoltas AS e
LEFT JOIN public.profiles AS p ON p.id = e.user_id
LEFT JOIN public.grados AS g ON g.id = e.grado_id
WHERE e.estado = 'activo'
  AND COALESCE(p.active, true) = true;

CREATE OR REPLACE VIEW public.v_resumen_nomina
WITH (security_invoker = true) AS
SELECT
  pn.id AS periodo_id,
  pn.nombre,
  pn.fecha_inicio,
  pn.fecha_fin,
  pn.estado,
  COUNT(DISTINCT nd.escolta_id) AS total_escoltas,
  COALESCE(SUM(nd.total), 0)::numeric(14,2) AS total_a_pagar,
  COUNT(DISTINCT nd.escolta_id) FILTER (WHERE nd.estado = 'pagado') AS pagados,
  COUNT(DISTINCT nd.escolta_id) FILTER (WHERE nd.estado = 'pendiente') AS pendientes
FROM public.periodos_nomina AS pn
LEFT JOIN public.nomina_detalles AS nd ON nd.periodo_id = pn.id
GROUP BY pn.id, pn.nombre, pn.fecha_inicio, pn.fecha_fin, pn.estado;

CREATE OR REPLACE VIEW public.v_permisos_pendientes
WITH (security_invoker = true) AS
SELECT
  pe.id,
  pe.escolta_id,
  e.codigo,
  e.nombres,
  e.apellidos,
  tp.nombre AS tipo_permiso,
  pe.fecha_inicio,
  pe.fecha_fin,
  pe.motivo,
  pe.comprobante_url,
  pe.solicitado_por,
  s.full_name AS solicitado_por_nombre,
  pe.created_at
FROM public.permisos AS pe
JOIN public.escoltas AS e ON e.id = pe.escolta_id
JOIN public.tipos_permiso AS tp ON tp.id = pe.tipo_id
LEFT JOIN public.profiles AS s ON s.id = pe.solicitado_por
WHERE pe.estado = 'pendiente';

-- ---------------------------------------------------------------------
-- 9. Storage: buckets privados y políticas sobre storage.objects
--
-- Convención de carpetas: <uuid_del_usuario>/<archivo>. El primer
-- segmento de la ruta (split_part(name, '/', 1)) es el propietario.
-- El servicio genera URLs firmadas para mostrar las imágenes.
-- ---------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('fotos', 'fotos', false, 5242880,
   ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif']),
  ('comprobantes', 'comprobantes', false, 10485760,
   ARRAY['image/jpeg', 'image/png', 'application/pdf'])
ON CONFLICT DO NOTHING;

DROP POLICY IF EXISTS "se_fotos_select" ON storage.objects;
CREATE POLICY "se_fotos_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'fotos'
    AND (public.is_staff() OR split_part(name, '/', 1) = auth.uid()::text)
  );

DROP POLICY IF EXISTS "se_fotos_insert" ON storage.objects;
CREATE POLICY "se_fotos_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'fotos'
    AND (public.is_staff() OR split_part(name, '/', 1) = auth.uid()::text)
  );

DROP POLICY IF EXISTS "se_fotos_update" ON storage.objects;
CREATE POLICY "se_fotos_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'fotos'
    AND (public.is_staff() OR split_part(name, '/', 1) = auth.uid()::text)
  )
  WITH CHECK (
    bucket_id = 'fotos'
    AND (public.is_staff() OR split_part(name, '/', 1) = auth.uid()::text)
  );

DROP POLICY IF EXISTS "se_fotos_delete" ON storage.objects;
CREATE POLICY "se_fotos_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'fotos'
    AND (public.is_staff() OR split_part(name, '/', 1) = auth.uid()::text)
  );

DROP POLICY IF EXISTS "se_comprobantes_select" ON storage.objects;
CREATE POLICY "se_comprobantes_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'comprobantes'
    AND (public.is_staff() OR split_part(name, '/', 1) = auth.uid()::text)
  );

DROP POLICY IF EXISTS "se_comprobantes_insert" ON storage.objects;
CREATE POLICY "se_comprobantes_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'comprobantes'
    AND (public.is_staff() OR split_part(name, '/', 1) = auth.uid()::text)
  );

DROP POLICY IF EXISTS "se_comprobantes_update" ON storage.objects;
CREATE POLICY "se_comprobantes_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'comprobantes'
    AND (public.is_staff() OR split_part(name, '/', 1) = auth.uid()::text)
  )
  WITH CHECK (
    bucket_id = 'comprobantes'
    AND (public.is_staff() OR split_part(name, '/', 1) = auth.uid()::text)
  );

DROP POLICY IF EXISTS "se_comprobantes_delete" ON storage.objects;
CREATE POLICY "se_comprobantes_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'comprobantes'
    AND (public.is_staff() OR split_part(name, '/', 1) = auth.uid()::text)
  );

-- ---------------------------------------------------------------------
-- 10. Permisos y GRANTs
-- ---------------------------------------------------------------------

-- anon no consulta datos: se le quita cualquier privilegio heredado y
-- sólo se le deja USO del schema para que no fallen las funciones públicas.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

GRANT SELECT ON public.v_escoltas_activos TO authenticated;
GRANT SELECT ON public.v_resumen_nomina TO authenticated;
GRANT SELECT ON public.v_permisos_pendientes TO authenticated;

GRANT USAGE ON SCHEMA storage TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO authenticated;

-- Las funciones ayudantes no se exponen a PUBLIC; sólo a authenticated
-- (y a service_role para tareas de backend). Las de trigger se incluyen
-- para que la creación inicial de triggers nunca falle por falta de EXECUTE.
REVOKE EXECUTE ON FUNCTION public.get_my_role() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_my_escort_id() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_supervisor() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_contador() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_staff() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_admin_or_supervisor() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tengo_detalle_en_periodo(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.audit_changes() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.validar_aprobacion_permiso() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.proteger_asistencia_escolta() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.proteger_permiso_escolta() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_escort_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_supervisor() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_contador() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_staff() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin_or_supervisor() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.tengo_detalle_en_periodo(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_updated_at() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.audit_changes() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.validar_aprobacion_permiso() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.proteger_asistencia_escolta() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.proteger_permiso_escolta() TO authenticated, service_role;

-- Fin de la migración inicial.

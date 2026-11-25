-- Sistema de Escoltas: aplicar TODAS las migraciones en orden.
-- Pegar completo en Supabase SQL Editor y ejecutar una sola vez.

-- ===== 20261125000000_init.sql =====
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
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
  SELECT COALESCE(
    (SELECT p.role FROM public.profiles AS p WHERE p.id = auth.uid() LIMIT 1),
    'anon'
  );
$fn$;

-- Devuelve el id de la fila de "escoltas" vinculada al usuario actual,
-- o NULL si el usuario no tiene ficha de escolta.
CREATE OR REPLACE FUNCTION public.get_my_escort_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
  SELECT e.id
  FROM public.escoltas AS e
  WHERE e.user_id = auth.uid()
  LIMIT 1;
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
-- de columnas dentro de una política RLS.
CREATE OR REPLACE FUNCTION public.tengo_detalle_en_periodo(p_periodo_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
  SELECT EXISTS (
    SELECT 1
    FROM public.nomina_detalles AS nd
    WHERE nd.periodo_id = p_periodo_id
      AND nd.escolta_id = public.get_my_escort_id()
  );
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

-- ===== 20261125000100_realtime.sql =====
-- =====================================================================
-- Sistema de Escoltas — Tiempo real (Supabase Realtime)
-- Proyecto: rznkopetlmitfxcixjcr
--
-- Publica las tablas en `supabase_realtime` y ajusta la identidad de
-- replicación para que los eventos UPDATE/DELETE incluyan la fila anterior.
-- La seguridad NO se relaja: Realtime respeta las mismas políticas RLS
-- que ya están definidas en la migración inicial. Un escolta sigue
-- recibiendo únicamente eventos de sus propios registros.
--
-- Idempotente: se puede volver a ejecutar sin duplicar publicaciones.
-- Idioma de comentarios: español.
-- =====================================================================

DO $do$
DECLARE
  v_tabla text;
  v_tablas text[] := ARRAY[
    'profiles',
    'escoltas',
    'grados',
    'clientes',
    'turnos',
    'tipos_permiso',
    'asignaciones',
    'asistencias',
    'permisos',
    'periodos_nomina',
    'nomina_detalles',
    'pagos',
    'auditoria'
  ];
BEGIN
  -- En proyectos Supabase la publicación ya existe; la comprobación evita
  -- fallos si la migración se aplica en un Postgres vacío.
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH v_tabla IN ARRAY v_tablas LOOP
      IF NOT EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = v_tabla
      ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', v_tabla);
      END IF;
    END LOOP;
  END IF;
END
$do$;

-- Con REPLICA IDENTITY FULL, los eventos UPDATE y DELETE transportan la
-- fila completa anterior. Esto permite al frontend recalcular filtros y
-- al backend saber qué escolta tenía asignado un registro antes del cambio.
-- Se aplica solo a tablas operativas (no a catálogos pequeños ni auditoría).
ALTER TABLE public.asignaciones    REPLICA IDENTITY FULL;
ALTER TABLE public.asistencias     REPLICA IDENTITY FULL;
ALTER TABLE public.permisos        REPLICA IDENTITY FULL;
ALTER TABLE public.nomina_detalles REPLICA IDENTITY FULL;
ALTER TABLE public.pagos           REPLICA IDENTITY FULL;
ALTER TABLE public.escoltas        REPLICA IDENTITY FULL;

-- Los permisos de lectura ya existentes (SELECT para authenticated) son
-- suficientes para Realtime: no se crea ninguna política nueva aquí.
COMMENT ON TABLE public.asignaciones IS
  'Distribución de escoltas. Publicada en supabase_realtime; eventos filtrados por RLS.';
COMMENT ON TABLE public.permisos IS
  'Solicitudes de permiso. Realtime respeta RLS: el escolta solo ve las suyas.';
COMMENT ON TABLE public.pagos IS
  'Pagos de nómina. Realtime solo entrega filas permitidas por RLS (staff).';

-- ===== 20261125000200_usuarios_roles_ajustes.sql =====
-- =====================================================================
-- Sistema de Escoltas — Usuarios, roles granulares, permisos y ajustes
-- Proyecto: rznkopetlmitfxcixjcr
--
-- Completa la migración inicial con:
--   * catálogo de roles y permisos por módulo/acción;
--   * bandera de cambio obligatorio de contraseña en profiles;
--   * tabla de ajustes del sistema (incluye las claves iniciales);
--   * funciones SECURITY DEFINER para consultar permisos;
--   * RLS, auditoría, updated_at y publicación Realtime de las tablas nuevas.
--
-- Idempotente: se puede ejecutar más de una vez.
-- Las contraseñas NUNCA se guardan en texto plano en profiles: los valores
-- por defecto viven en `ajustes_sistema` (solo administradores) y se usan
-- al crear la cuenta en Supabase Auth desde el backend.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Catálogos
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL UNIQUE
    CONSTRAINT roles_nombre_check CHECK (nombre IN ('admin', 'supervisor', 'contador', 'escolta')),
  descripcion text,
  activo boolean NOT NULL DEFAULT true,
  es_sistema boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.permisos_sistema (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE,
  modulo text NOT NULL,
  accion text NOT NULL,
  descripcion text,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rol_permisos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rol_id uuid NOT NULL REFERENCES public.roles (id) ON DELETE CASCADE,
  permiso_id uuid NOT NULL REFERENCES public.permisos_sistema (id) ON DELETE CASCADE,
  concedido boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rol_id, permiso_id)
);

-- Matriz de módulos estilo GT: lectura / escritura / full por rol.
-- Se mantiene junto a `rol_permisos` para que el frontend pueda usar un
-- helper sencillo `puede_modulo(modulo, nivel)` y el backend códigos granulares.
CREATE TABLE IF NOT EXISTS public.roles_permisos (
  role text PRIMARY KEY REFERENCES public.roles (nombre) ON DELETE CASCADE,
  permisos jsonb NOT NULL DEFAULT '{}'::jsonb
    CONSTRAINT roles_permisos_objeto CHECK (jsonb_typeof(permisos) = 'object'),
  vistas_telefono jsonb NOT NULL DEFAULT '[]'::jsonb
    CONSTRAINT roles_permisos_vistas_arreglo CHECK (jsonb_typeof(vistas_telefono) = 'array'),
  solo_telefono boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.ajustes_sistema (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clave text NOT NULL UNIQUE,
  valor text,
  descripcion text,
  categoria text NOT NULL DEFAULT 'general',
  tipo text NOT NULL DEFAULT 'texto'
    CONSTRAINT ajustes_tipo_check CHECK (tipo IN ('texto', 'numero', 'booleano', 'color', 'url', 'secreto')),
  publico boolean NOT NULL DEFAULT true,
  editable boolean NOT NULL DEFAULT true,
  updated_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 2. profiles: banderas de seguridad
-- ---------------------------------------------------------------------

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT true;
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cambio_clave_at timestamptz;
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ultimo_acceso timestamptz;
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role_id uuid REFERENCES public.roles (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.profiles.must_change_password IS
  'true obliga a cambiar la contraseña en el primer ingreso; solo el backend service-role la desactiva.';

-- Alta de usuarios: respeta el rol enviado en metadata y fuerza el cambio de clave.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_rol text;
BEGIN
  v_rol := COALESCE(NEW.raw_user_meta_data ->> 'role', 'escolta');
  IF v_rol NOT IN ('admin', 'supervisor', 'contador', 'escolta') THEN
    v_rol := 'escolta';
  END IF;

  INSERT INTO public.profiles (
    id, full_name, email, role, role_id, avatar_url, phone, active, must_change_password
  )
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data ->> 'full_name',
      NEW.raw_user_meta_data ->> 'name',
      split_part(NEW.email, '@', 1),
      'Usuario'
    ),
    NEW.email,
    v_rol,
    (SELECT id FROM public.roles WHERE nombre = v_rol),
    NEW.raw_user_meta_data ->> 'avatar_url',
    NEW.raw_user_meta_data ->> 'phone',
    true,
    true
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$fn$;

-- ---------------------------------------------------------------------
-- 3. Permisos granulares
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_my_permissions()
RETURNS SETOF text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
  SELECT DISTINCT ps.codigo
  FROM public.profiles AS p
  JOIN public.roles AS r
    ON r.nombre = p.role AND r.activo
  JOIN public.rol_permisos AS rp
    ON rp.rol_id = r.id AND rp.concedido
  JOIN public.permisos_sistema AS ps
    ON ps.id = rp.permiso_id AND ps.activo
  WHERE p.id = auth.uid() AND p.active
$fn$;

CREATE OR REPLACE FUNCTION public.tiene_permiso(p_codigo text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM public.get_my_permissions() AS codigo WHERE codigo = p_codigo
  )
$fn$;

COMMENT ON FUNCTION public.get_my_permissions() IS
  'Devuelve los códigos de permiso vigentes del usuario actual según su rol.';

-- Compatibilidad con la base funcional GT: matriz por módulo y nivel.
CREATE OR REPLACE FUNCTION public.puede_modulo(p_modulo text, p_nivel text DEFAULT 'lectura')
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles AS p
    LEFT JOIN public.roles_permisos AS rp ON rp.role = p.role
    WHERE p.id = auth.uid()
      AND p.active
      AND (
        p.role = 'admin'
        OR COALESCE((rp.permisos -> p_modulo ->> p_nivel)::boolean, false)
        OR COALESCE((rp.permisos -> p_modulo ->> 'full')::boolean, false)
      )
  )
$fn$;

-- ---------------------------------------------------------------------
-- 3.1 Control de intentos de ingreso (base funcional GT)
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.intentos_login (
  email text PRIMARY KEY,
  intentos integer NOT NULL DEFAULT 0,
  bloqueado_hasta timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.auth_estado_bloqueo(p_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM public.intentos_login
    WHERE lower(email) = lower(p_email)
      AND bloqueado_hasta IS NOT NULL
      AND bloqueado_hasta > now()
  )
$fn$;

CREATE OR REPLACE FUNCTION public.auth_estado_inhabilitado(p_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE lower(email) = lower(p_email) AND active = false
  )
$fn$;

CREATE OR REPLACE FUNCTION public.auth_fallo_login(p_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_email text := lower(trim(p_email));
  v_intentos integer;
  v_bloqueado boolean := false;
  v_restantes integer;
BEGIN
  INSERT INTO public.intentos_login (email, intentos, updated_at)
  VALUES (v_email, 1, now())
  ON CONFLICT (email) DO UPDATE
    SET intentos = CASE
          WHEN public.intentos_login.bloqueado_hasta > now() THEN public.intentos_login.intentos
          ELSE public.intentos_login.intentos + 1
        END,
        updated_at = now();

  SELECT intentos INTO v_intentos FROM public.intentos_login WHERE email = v_email;

  IF v_intentos >= 3 THEN
    UPDATE public.intentos_login
       SET bloqueado_hasta = now() + interval '15 minutes', intentos = 0
     WHERE email = v_email;
    v_bloqueado := true;
    v_restantes := 0;
  ELSE
    v_restantes := 3 - v_intentos;
  END IF;

  RETURN jsonb_build_object(
    'bloqueado', v_bloqueado,
    'intentos', v_intentos,
    'restantes', v_restantes
  );
END;
$fn$;

CREATE OR REPLACE FUNCTION public.auth_reset_intentos()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_email text;
BEGIN
  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
  IF v_email IS NOT NULL THEN
    DELETE FROM public.intentos_login WHERE lower(email) = lower(v_email);
  END IF;
END;
$fn$;

-- ---------------------------------------------------------------------
-- 4. Datos base (re-ejecutables)
-- ---------------------------------------------------------------------

INSERT INTO public.roles (nombre, descripcion, activo, es_sistema)
VALUES
  ('admin', 'Acceso total al sistema, usuarios y ajustes.', true, true),
  ('supervisor', 'Distribución, asistencias y revisión de permisos.', true, true),
  ('contador', 'Nómina, pagos y reportes contables.', true, true),
  ('escolta', 'Sus asignaciones, asistencias, permisos y nómina.', true, true)
ON CONFLICT (nombre) DO UPDATE
  SET descripcion = EXCLUDED.descripcion,
      activo = EXCLUDED.activo,
      es_sistema = EXCLUDED.es_sistema,
      updated_at = now();

INSERT INTO public.permisos_sistema (codigo, modulo, accion, descripcion)
VALUES
  ('dashboard.ver', 'dashboard', 'ver', 'Ver el panel principal.'),
  ('escoltas.ver', 'escoltas', 'ver', 'Consultar fichas de escoltas.'),
  ('escoltas.crear', 'escoltas', 'crear', 'Registrar escoltas.'),
  ('escoltas.editar', 'escoltas', 'editar', 'Modificar fichas de escoltas.'),
  ('escoltas.eliminar', 'escoltas', 'eliminar', 'Eliminar fichas de escoltas.'),
  ('distribucion.ver', 'distribucion', 'ver', 'Consultar asignaciones.'),
  ('distribucion.crear', 'distribucion', 'crear', 'Asignar escoltas a turnos.'),
  ('distribucion.editar', 'distribucion', 'editar', 'Modificar asignaciones.'),
  ('permisos.ver', 'permisos', 'ver', 'Consultar solicitudes de permiso.'),
  ('permisos.crear', 'permisos', 'crear', 'Solicitar permisos.'),
  ('permisos.aprobar', 'permisos', 'aprobar', 'Aprobar o rechazar permisos.'),
  ('asistencias.ver', 'asistencias', 'ver', 'Consultar asistencias.'),
  ('asistencias.registrar', 'asistencias', 'registrar', 'Registrar check-in y check-out.'),
  ('nomina.ver', 'nomina', 'ver', 'Consultar nómina.'),
  ('nomina.editar', 'nomina', 'editar', 'Modificar detalles de nómina.'),
  ('nomina.cerrar', 'nomina', 'cerrar', 'Cerrar y pagar periodos.'),
  ('pagos.ver', 'pagos', 'ver', 'Consultar pagos.'),
  ('pagos.registrar', 'pagos', 'registrar', 'Registrar pagos.'),
  ('pagos.confirmar', 'pagos', 'confirmar', 'Confirmar o anular pagos.'),
  ('usuarios.ver', 'usuarios', 'ver', 'Consultar usuarios del sistema.'),
  ('usuarios.crear', 'usuarios', 'crear', 'Crear usuarios con clave inicial.'),
  ('usuarios.editar', 'usuarios', 'editar', 'Cambiar rol, estado o clave de usuarios.'),
  ('roles.ver', 'roles', 'ver', 'Consultar roles y permisos.'),
  ('roles.editar', 'roles', 'editar', 'Asignar permisos a los roles.'),
  ('ajustes.ver', 'ajustes', 'ver', 'Consultar ajustes públicos.'),
  ('ajustes.editar', 'ajustes', 'editar', 'Modificar ajustes del sistema.'),
  ('auditoria.ver', 'auditoria', 'ver', 'Consultar la bitácora de auditoría.'),
  ('tiempo_real.ver', 'tiempo_real', 'ver', 'Recibir eventos en tiempo real permitidos por RLS.')
ON CONFLICT (codigo) DO UPDATE
  SET modulo = EXCLUDED.modulo,
      accion = EXCLUDED.accion,
      descripcion = EXCLUDED.descripcion,
      activo = true,
      updated_at = now();

-- Matriz GT adaptada a los módulos del sistema de escoltas.
INSERT INTO public.roles_permisos (role, permisos, vistas_telefono, solo_telefono)
VALUES
  ('admin', jsonb_build_object(
    'dashboard', jsonb_build_object('lectura', true, 'escritura', true, 'full', true),
    'escoltas', jsonb_build_object('lectura', true, 'escritura', true, 'full', true),
    'distribucion', jsonb_build_object('lectura', true, 'escritura', true, 'full', true),
    'permisos', jsonb_build_object('lectura', true, 'escritura', true, 'full', true),
    'asistencias', jsonb_build_object('lectura', true, 'escritura', true, 'full', true),
    'nomina', jsonb_build_object('lectura', true, 'escritura', true, 'full', true),
    'pagos', jsonb_build_object('lectura', true, 'escritura', true, 'full', true),
    'usuarios', jsonb_build_object('lectura', true, 'escritura', true, 'full', true),
    'roles', jsonb_build_object('lectura', true, 'escritura', true, 'full', true),
    'ajustes', jsonb_build_object('lectura', true, 'escritura', true, 'full', true),
    'auditoria', jsonb_build_object('lectura', true, 'escritura', true, 'full', true),
    'ayuda', jsonb_build_object('lectura', true, 'escritura', true, 'full', true),
    'tiempo_real', jsonb_build_object('lectura', true, 'escritura', true, 'full', true)
  ), '[]'::jsonb, false),
  ('supervisor', jsonb_build_object(
    'dashboard', jsonb_build_object('lectura', true, 'escritura', false, 'full', false),
    'escoltas', jsonb_build_object('lectura', true, 'escritura', true, 'full', false),
    'distribucion', jsonb_build_object('lectura', true, 'escritura', true, 'full', true),
    'permisos', jsonb_build_object('lectura', true, 'escritura', true, 'full', true),
    'asistencias', jsonb_build_object('lectura', true, 'escritura', true, 'full', true),
    'ajustes', jsonb_build_object('lectura', true, 'escritura', false, 'full', false),
    'ayuda', jsonb_build_object('lectura', true, 'escritura', false, 'full', false),
    'tiempo_real', jsonb_build_object('lectura', true, 'escritura', false, 'full', false)
  ), '[]'::jsonb, false),
  ('contador', jsonb_build_object(
    'dashboard', jsonb_build_object('lectura', true, 'escritura', false, 'full', false),
    'escoltas', jsonb_build_object('lectura', true, 'escritura', false, 'full', false),
    'nomina', jsonb_build_object('lectura', true, 'escritura', true, 'full', true),
    'pagos', jsonb_build_object('lectura', true, 'escritura', true, 'full', true),
    'ajustes', jsonb_build_object('lectura', true, 'escritura', false, 'full', false),
    'ayuda', jsonb_build_object('lectura', true, 'escritura', false, 'full', false),
    'tiempo_real', jsonb_build_object('lectura', true, 'escritura', false, 'full', false)
  ), '[]'::jsonb, false),
  ('escolta', jsonb_build_object(
    'dashboard', jsonb_build_object('lectura', true, 'escritura', false, 'full', false),
    'escoltas', jsonb_build_object('lectura', true, 'escritura', false, 'full', false),
    'distribucion', jsonb_build_object('lectura', true, 'escritura', false, 'full', false),
    'permisos', jsonb_build_object('lectura', true, 'escritura', true, 'full', false),
    'asistencias', jsonb_build_object('lectura', true, 'escritura', true, 'full', false),
    'nomina', jsonb_build_object('lectura', true, 'escritura', false, 'full', false),
    'ajustes', jsonb_build_object('lectura', true, 'escritura', false, 'full', false),
    'ayuda', jsonb_build_object('lectura', true, 'escritura', false, 'full', false),
    'tiempo_real', jsonb_build_object('lectura', true, 'escritura', false, 'full', false)
  ), '[]'::jsonb, false)
ON CONFLICT (role) DO UPDATE
  SET permisos = EXCLUDED.permisos,
      vistas_telefono = EXCLUDED.vistas_telefono,
      solo_telefono = EXCLUDED.solo_telefono,
      updated_at = now();

-- Matriz por defecto. Se recalcula en cada ejecución para que un cambio de
-- migración se refleje sin dejar permisos huérfanos.
DO $do$
DECLARE
  v_rol text;
  v_permisos text[];
BEGIN
  DELETE FROM public.rol_permisos;

  FOR v_rol, v_permisos IN
    SELECT *
    FROM (VALUES
      ('admin', ARRAY[
        'dashboard.ver','escoltas.ver','escoltas.crear','escoltas.editar','escoltas.eliminar',
        'distribucion.ver','distribucion.crear','distribucion.editar',
        'permisos.ver','permisos.crear','permisos.aprobar',
        'asistencias.ver','asistencias.registrar',
        'nomina.ver','nomina.editar','nomina.cerrar',
        'pagos.ver','pagos.registrar','pagos.confirmar',
        'usuarios.ver','usuarios.crear','usuarios.editar',
        'roles.ver','roles.editar','ajustes.ver','ajustes.editar',
        'auditoria.ver','tiempo_real.ver'
      ]::text[]),
      ('supervisor', ARRAY[
        'dashboard.ver','escoltas.ver','escoltas.crear','escoltas.editar',
        'distribucion.ver','distribucion.crear','distribucion.editar',
        'permisos.ver','permisos.crear','permisos.aprobar',
        'asistencias.ver','asistencias.registrar','ajustes.ver','tiempo_real.ver'
      ]::text[]),
      ('contador', ARRAY[
        'dashboard.ver','escoltas.ver',
        'nomina.ver','nomina.editar','nomina.cerrar',
        'pagos.ver','pagos.registrar','pagos.confirmar',
        'ajustes.ver','tiempo_real.ver'
      ]::text[]),
      ('escolta', ARRAY[
        'dashboard.ver','escoltas.ver','distribucion.ver',
        'permisos.ver','permisos.crear',
        'asistencias.ver','asistencias.registrar',
        'nomina.ver','ajustes.ver','ayuda.ver','tiempo_real.ver'
      ]::text[])
    ) AS m(rol, permisos)
  LOOP
    INSERT INTO public.rol_permisos (rol_id, permiso_id, concedido)
    SELECT r.id, ps.id, true
    FROM public.roles AS r
    CROSS JOIN unnest(v_permisos) AS codigo
    JOIN public.permisos_sistema AS ps ON ps.codigo = codigo
    WHERE r.nombre = v_rol
    ON CONFLICT (rol_id, permiso_id) DO UPDATE SET concedido = true;
  END LOOP;
END
$do$;

-- La escolta también necesita ver la ayuda (el código se agregó arriba).
INSERT INTO public.permisos_sistema (codigo, modulo, accion, descripcion)
VALUES ('ayuda.ver', 'ayuda', 'ver', 'Consultar el centro de ayuda.')
ON CONFLICT (codigo) DO UPDATE SET activo = true, updated_at = now();

INSERT INTO public.rol_permisos (rol_id, permiso_id, concedido)
SELECT r.id, ps.id, true
FROM public.roles AS r
CROSS JOIN public.permisos_sistema AS ps
WHERE ps.codigo = 'ayuda.ver'
ON CONFLICT (rol_id, permiso_id) DO UPDATE SET concedido = true;

-- Ajustes: el color y el emblema salen del logo institucional.
INSERT INTO public.ajustes_sistema (clave, valor, descripcion, categoria, tipo, publico, editable)
VALUES
  ('empresa_nombre', 'Seguridad Escoltas', 'Nombre que se muestra en el sistema.', 'general', 'texto', true, true),
  ('logo_url', '/logo-escoltas.png', 'Ruta del emblema institucional.', 'apariencia', 'url', true, true),
  ('color_primario', '#FF7000', 'Color naranja principal del emblema.', 'apariencia', 'color', true, true),
  ('color_acento', '#FFB000', 'Color ámbar de acento del emblema.', 'apariencia', 'color', true, true),
  ('moneda', 'VES', 'Moneda para la nómina y los pagos.', 'general', 'texto', true, true),
  ('zona_horaria', 'America/Caracas', 'Zona horaria de asistencias y pagos.', 'general', 'texto', true, true),
  ('sesion_minutos', '480', 'Minutos de inactividad antes de cerrar sesión.', 'seguridad', 'numero', true, true),
  ('minimo_caracteres_clave', '8', 'Longitud mínima de la nueva contraseña.', 'seguridad', 'numero', true, true),
  ('permitir_recuperacion', 'true', 'Permite recuperar la contraseña por correo.', 'seguridad', 'booleano', true, true),
  ('tiempo_real_activo', 'true', 'Habilita las actualizaciones en tiempo real.', 'general', 'booleano', true, true),
  ('password_inicial_usuario', 'es-123', 'Contraseña temporal para usuarios nuevos; se debe cambiar en el primer ingreso.', 'seguridad', 'secreto', false, true),
  ('password_inicial_admin', '123456', 'Contraseña temporal del primer administrador; se debe cambiar en el primer ingreso.', 'seguridad', 'secreto', false, true)
ON CONFLICT (clave) DO UPDATE
  SET descripcion = EXCLUDED.descripcion,
      categoria = EXCLUDED.categoria,
      tipo = EXCLUDED.tipo,
      publico = EXCLUDED.publico,
      updated_at = now();

-- Sincroniza role_id de perfiles ya existentes.
UPDATE public.profiles AS p
SET role_id = r.id
FROM public.roles AS r
WHERE r.nombre = p.role AND p.role_id IS DISTINCT FROM r.id;

-- ---------------------------------------------------------------------
-- 5. Seguridad (RLS)
-- ---------------------------------------------------------------------

ALTER TABLE public.roles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles             FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.permisos_sistema  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permisos_sistema  FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.rol_permisos      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rol_permisos      FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.ajustes_sistema   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ajustes_sistema   FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.roles_permisos    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles_permisos    FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.intentos_login    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intentos_login    FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "roles_lectura" ON public.roles;
CREATE POLICY "roles_lectura" ON public.roles
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "roles_admin_total" ON public.roles;
CREATE POLICY "roles_admin_total" ON public.roles
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "permisos_sistema_lectura" ON public.permisos_sistema;
CREATE POLICY "permisos_sistema_lectura" ON public.permisos_sistema
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "permisos_sistema_admin_total" ON public.permisos_sistema;
CREATE POLICY "permisos_sistema_admin_total" ON public.permisos_sistema
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "rol_permisos_lectura" ON public.rol_permisos;
CREATE POLICY "rol_permisos_lectura" ON public.rol_permisos
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "rol_permisos_admin_total" ON public.rol_permisos;
CREATE POLICY "rol_permisos_admin_total" ON public.rol_permisos
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "ajustes_lectura" ON public.ajustes_sistema;
CREATE POLICY "ajustes_lectura" ON public.ajustes_sistema
  FOR SELECT TO authenticated USING (publico OR public.is_admin());
DROP POLICY IF EXISTS "ajustes_admin_total" ON public.ajustes_sistema;
CREATE POLICY "ajustes_admin_total" ON public.ajustes_sistema
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "roles_permisos_lectura" ON public.roles_permisos;
CREATE POLICY "roles_permisos_lectura" ON public.roles_permisos
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "roles_permisos_admin_total" ON public.roles_permisos;
CREATE POLICY "roles_permisos_admin_total" ON public.roles_permisos
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- intentos_login solo se manipula mediante funciones SECURITY DEFINER.
DROP POLICY IF EXISTS "intentos_login_solo_backend" ON public.intentos_login;
CREATE POLICY "intentos_login_solo_backend" ON public.intentos_login
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

-- El usuario puede leer su propio flag (ya cubierto por perfil_propio_o_staff),
-- pero NO puede desactivarlo: solo el backend con service-role lo hace.

-- ---------------------------------------------------------------------
-- 6. Triggers de auditoría y updated_at
-- ---------------------------------------------------------------------

DO $do$
DECLARE
  v_tabla text;
  v_con_auditoria text[] := ARRAY['roles', 'permisos_sistema', 'rol_permisos', 'ajustes_sistema'];
  v_solo_updated text[] := ARRAY['roles_permisos', 'intentos_login'];
BEGIN
  FOREACH v_tabla IN ARRAY v_con_auditoria LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_updated_at ON public.%I', v_tabla);
    EXECUTE format(
      'CREATE TRIGGER trg_updated_at BEFORE UPDATE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', v_tabla);

    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_changes ON public.%I', v_tabla);
    EXECUTE format(
      'CREATE TRIGGER trg_audit_changes AFTER INSERT OR UPDATE OR DELETE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.audit_changes()', v_tabla);
  END LOOP;

  FOREACH v_tabla IN ARRAY v_solo_updated LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_updated_at ON public.%I', v_tabla);
    EXECUTE format(
      'CREATE TRIGGER trg_updated_at BEFORE UPDATE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', v_tabla);
  END LOOP;
END
$do$;

-- ---------------------------------------------------------------------
-- 7. Permisos SQL y Realtime
-- ---------------------------------------------------------------------

REVOKE ALL ON public.roles FROM anon;
REVOKE ALL ON public.permisos_sistema FROM anon;
REVOKE ALL ON public.rol_permisos FROM anon;
REVOKE ALL ON public.ajustes_sistema FROM anon;
REVOKE ALL ON public.roles_permisos FROM anon;
REVOKE ALL ON public.intentos_login FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.roles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.permisos_sistema TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rol_permisos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ajustes_sistema TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.roles_permisos TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_my_permissions() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tiene_permiso(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.puede_modulo(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_permissions() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.tiene_permiso(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.puede_modulo(text, text) TO authenticated, service_role;

-- Estas RPC se llaman desde el login, antes de tener sesión (GT).
REVOKE EXECUTE ON FUNCTION public.auth_estado_bloqueo(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.auth_estado_inhabilitado(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.auth_fallo_login(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.auth_reset_intentos() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_estado_bloqueo(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.auth_estado_inhabilitado(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.auth_fallo_login(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.auth_reset_intentos() TO authenticated, service_role;

DO $do$
DECLARE
  v_tabla text;
  v_tablas text[] := ARRAY['roles', 'permisos_sistema', 'rol_permisos', 'roles_permisos', 'ajustes_sistema'];
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH v_tabla IN ARRAY v_tablas LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = v_tabla
      ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', v_tabla);
      END IF;
    END LOOP;
  END IF;
END
$do$;

ALTER TABLE public.rol_permisos    REPLICA IDENTITY FULL;
ALTER TABLE public.roles_permisos  REPLICA IDENTITY FULL;
ALTER TABLE public.ajustes_sistema REPLICA IDENTITY FULL;

COMMENT ON TABLE public.ajustes_sistema IS
  'Configuración del sistema. Las claves tipo secreto solo son visibles para administradores y el backend.';
COMMENT ON TABLE public.rol_permisos IS
  'Matriz de permisos por rol. Publicada en Realtime; RLS limita la lectura a usuarios autenticados.';

-- ===== 20261126000000_login_por_usuario.sql =====
-- Login por usuario visible (no por correo).
-- El correo sigue existiendo sólo como identificador interno de Supabase Auth.
-- Idempotente: se puede volver a ejecutar sin duplicar datos ni objetos.

-- ---------------------------------------------------------------------
-- 1. Usuario visible en profiles
-- ---------------------------------------------------------------------

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS usuario text;

-- Backfill desde el nombre visible; si no hay nombre, desde el correo interno.
UPDATE public.profiles
   SET usuario = COALESCE(
     NULLIF(btrim(full_name), ''),
     NULLIF(split_part(email, '@', 1), ''),
     'usuario-' || left(id::text, 8)
   )
 WHERE usuario IS NULL OR btrim(usuario) = '';

-- Si dos cuentas tenían el mismo nombre, les damos un sufijo antes de indexar.
WITH numerados AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY lower(btrim(usuario))
           ORDER BY created_at, id
         ) AS rn
    FROM public.profiles
   WHERE usuario IS NOT NULL
)
UPDATE public.profiles AS p
   SET usuario = p.usuario || '-' || numerados.rn::text
  FROM numerados
 WHERE p.id = numerados.id
   AND numerados.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_usuario_unique
  ON public.profiles (lower(btrim(usuario)))
 WHERE usuario IS NOT NULL;

COMMENT ON COLUMN public.profiles.usuario IS
  'Usuario visible para iniciar sesión; el correo permanece interno en Supabase Auth.';

-- ---------------------------------------------------------------------
-- 2. Alta de usuarios con usuario visible
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_rol text;
  v_usuario text;
BEGIN
  v_rol := COALESCE(NEW.raw_user_meta_data ->> 'role', 'escolta');
  IF v_rol NOT IN ('admin', 'supervisor', 'contador', 'escolta') THEN
    v_rol := 'escolta';
  END IF;

  v_usuario := COALESCE(
    NULLIF(btrim(NEW.raw_user_meta_data ->> 'usuario'), ''),
    NULLIF(btrim(NEW.raw_user_meta_data ->> 'full_name'), ''),
    NULLIF(btrim(NEW.raw_user_meta_data ->> 'name'), ''),
    NULLIF(split_part(NEW.email, '@', 1), ''),
    'usuario-' || left(NEW.id::text, 8)
  );

  INSERT INTO public.profiles (
    id, usuario, full_name, email, role, role_id, avatar_url, phone, active, must_change_password
  )
  VALUES (
    NEW.id,
    v_usuario,
    COALESCE(
      NEW.raw_user_meta_data ->> 'full_name',
      NEW.raw_user_meta_data ->> 'name',
      split_part(NEW.email, '@', 1),
      'Usuario'
    ),
    NEW.email,
    v_rol,
    (SELECT id FROM public.roles WHERE nombre = v_rol),
    NEW.raw_user_meta_data ->> 'avatar_url',
    NEW.raw_user_meta_data ->> 'phone',
    true,
    true
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$fn$;

-- ---------------------------------------------------------------------
-- 3. RPC pública usada por el login antes de tener sesión
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.auth_usuario_a_email(p_usuario text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
  SELECT email
    FROM public.profiles
   WHERE lower(btrim(usuario)) = lower(btrim(p_usuario))
   LIMIT 1
$fn$;

COMMENT ON FUNCTION public.auth_usuario_a_email(text) IS
  'Resuelve el usuario visible al correo interno de Supabase Auth. No revela otros perfiles.';

REVOKE EXECUTE ON FUNCTION public.auth_usuario_a_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_usuario_a_email(text) TO anon, authenticated, service_role;

-- profiles ya está publicado en supabase_realtime desde la migración de tiempo real.
ALTER TABLE public.profiles REPLICA IDENTITY FULL;

-- Fuerza a PostgREST a recargar el esquema para ver tablas/columnas nuevas de inmediato.
NOTIFY pgrst, 'reload schema';

-- Fin de la migración de login por usuario.

-- ===== 20261126010000_sesion_activa.sql =====
-- Opción "Mantener la sesión activa" del login.
-- El almacenamiento del token se decide en el cliente (localStorage vs sessionStorage).
-- Supabase Auth conserva sus políticas; RLS no se relaja.

-- Ajuste público que permite al administrador desactivar la casilla.
INSERT INTO public.ajustes_sistema (clave, valor, descripcion, categoria, tipo, publico, editable)
VALUES (
  'permitir_mantener_sesion',
  'true',
  'Muestra la opción "Mantener la sesión activa" en el login.',
  'seguridad',
  'booleano',
  true,
  true
)
ON CONFLICT (clave) DO UPDATE
SET descripcion = EXCLUDED.descripcion,
    categoria = EXCLUDED.categoria,
    tipo = EXCLUDED.tipo,
    publico = EXCLUDED.publico,
    editable = EXCLUDED.editable;
-- NO se sobrescribe `valor`: respeta lo que haya configurado el administrador.

COMMENT ON COLUMN public.ajustes_sistema.valor IS
  'Los ajustes públicos se entregan al login sólo mediante el backend /api/auth/configuracion-sesion; anon no tiene acceso directo a esta tabla.';

-- RLS: sin cambios. `ajustes_sistema` ya tiene lectura para authenticated
-- y FORCE ROW LEVEL SECURITY; `anon` sigue sin permisos sobre la tabla.
-- Realtime: la tabla ya está publicada en supabase_realtime desde la migración anterior.

NOTIFY pgrst, 'reload schema';

-- Fin de la migración de sesión activa.

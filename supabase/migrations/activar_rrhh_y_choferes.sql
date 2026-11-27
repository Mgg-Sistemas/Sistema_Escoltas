-- =====================================================================
-- Sistema de Escoltas — Estructura Completa Golden Touch (GT)
-- Módulos: USUARIOS, RRHH, CHOFERES, ROLES Y PERMISOS, AJUSTES
-- Migración idempotente: se puede aplicar múltiples veces sin romper datos.
-- =====================================================================

SET search_path = public, extensions;

-- =====================================================================
-- 0. AMPLIACIÓN DE RESTRICCIONES DE ROLES (COMPATIBILIDAD CON CHOFER Y RRHH)
-- =====================================================================

ALTER TABLE public.roles DROP CONSTRAINT IF EXISTS roles_nombre_check;
ALTER TABLE public.roles ADD CONSTRAINT roles_nombre_check CHECK (nombre IN ('admin', 'supervisor', 'contador', 'escolta', 'chofer', 'rrhh'));

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'supervisor', 'contador', 'escolta', 'chofer', 'rrhh'));

-- Insertar roles faltantes en public.roles para satisfacer la clave foránea roles_permisos_role_fkey
INSERT INTO public.roles (nombre, descripcion, activo, es_sistema)
VALUES
  ('admin', 'Administrador del sistema', true, true),
  ('supervisor', 'Supervisor de Operaciones', true, true),
  ('contador', 'Contabilidad y Finanzas', true, true),
  ('escolta', 'Personal de Seguridad y Escolta', true, true),
  ('chofer', 'Chofer y Conductor de Flota', true, true),
  ('rrhh', 'Recursos Humanos y Fichas', true, true)
ON CONFLICT (nombre) DO UPDATE SET
  descripcion = EXCLUDED.descripcion,
  activo = true;

-- =====================================================================
-- 1. ROLES Y PERMISOS (ESTRUCTURA GT)
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.custom_roles (
  key text PRIMARY KEY,
  label text NOT NULL,
  descripcion text,
  color text NOT NULL DEFAULT '#404040',
  sistema boolean NOT NULL DEFAULT false,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Roles base del sistema
INSERT INTO public.custom_roles (key, label, descripcion, color, sistema, created_by)
VALUES
  ('admin', 'Administrador', 'Control total y configuración global del sistema', '#cc4400', true, 'sistema'),
  ('supervisor', 'Supervisor de Operaciones', 'Control de escoltas, rutas, turnos y personal', '#2563eb', true, 'sistema'),
  ('contador', 'Contabilidad y Finanzas', 'Cálculo de nómina, viáticos, pagos y anticipos', '#16a34a', true, 'sistema'),
  ('escolta', 'Escolta / Seguridad', 'Personal operativo asignado a servicios de custodia', '#7c3aed', true, 'sistema'),
  ('chofer', 'Chofer / Conductor', 'Conductores de flota vehicular y transporte', '#ea580c', true, 'sistema'),
  ('rrhh', 'Recursos Humanos', 'Gestión de personal, expedientes, descansos y minutas', '#0891b2', true, 'sistema')
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label,
  descripcion = EXCLUDED.descripcion,
  color = EXCLUDED.color,
  sistema = EXCLUDED.sistema;

-- Matriz visual de permisos (roles_permisos)
CREATE TABLE IF NOT EXISTS public.roles_permisos (
  role text PRIMARY KEY,
  permisos jsonb NOT NULL DEFAULT '{}'::jsonb
    CONSTRAINT roles_permisos_objeto CHECK (jsonb_typeof(permisos) = 'object'),
  vistas_telefono jsonb NOT NULL DEFAULT '[]'::jsonb
    CONSTRAINT roles_permisos_vistas_arreglo CHECK (jsonb_typeof(vistas_telefono) = 'array'),
  solo_telefono boolean NOT NULL DEFAULT false,
  almacenes jsonb DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL
);

-- Semilla de matriz de permisos
INSERT INTO public.roles_permisos (role, permisos, vistas_telefono, solo_telefono)
VALUES
  ('admin', '{"dashboard":"full","escoltas":"full","distribucion":"full","permisos":"full","asistencias":"full","nomina":"full","pagos":"full","usuarios":"full","roles-permisos":"full","ajustes":"full","rrhh":"full","choferes":"full"}'::jsonb, '["dashboard","escoltas","distribucion","permisos","asistencias","nomina","pagos","usuarios","ajustes","rrhh","choferes"]'::jsonb, false),
  ('supervisor', '{"dashboard":"lectura","escoltas":"escritura","distribucion":"escritura","permisos":"escritura","asistencias":"escritura","nomina":"lectura","pagos":"lectura","usuarios":"ninguno","roles-permisos":"ninguno","ajustes":"lectura","rrhh":"escritura","choferes":"escritura"}'::jsonb, '["dashboard","escoltas","distribucion","asistencias","choferes"]'::jsonb, false),
  ('contador', '{"dashboard":"lectura","escoltas":"lectura","distribucion":"lectura","permisos":"lectura","asistencias":"lectura","nomina":"full","pagos":"full","usuarios":"ninguno","roles-permisos":"ninguno","ajustes":"lectura","rrhh":"full","choferes":"escritura"}'::jsonb, '["dashboard","nomina","pagos"]'::jsonb, false),
  ('escolta', '{"dashboard":"lectura","escoltas":"lectura","distribucion":"lectura","permisos":"escritura","asistencias":"escritura","nomina":"ninguno","pagos":"ninguno","usuarios":"ninguno","roles-permisos":"ninguno","ajustes":"ninguno","rrhh":"ninguno","choferes":"ninguno"}'::jsonb, '["dashboard","asistencias","permisos"]'::jsonb, true),
  ('chofer', '{"dashboard":"lectura","escoltas":"ninguno","distribucion":"ninguno","permisos":"ninguno","asistencias":"escritura","nomina":"ninguno","pagos":"ninguno","usuarios":"ninguno","roles-permisos":"ninguno","ajustes":"ninguno","rrhh":"ninguno","choferes":"escritura"}'::jsonb, '["dashboard","choferes"]'::jsonb, true),
  ('rrhh', '{"dashboard":"lectura","escoltas":"escritura","distribucion":"lectura","permisos":"escritura","asistencias":"escritura","nomina":"escritura","pagos":"lectura","usuarios":"lectura","roles-permisos":"ninguno","ajustes":"lectura","rrhh":"full","choferes":"lectura"}'::jsonb, '["dashboard","rrhh","asistencias"]'::jsonb, false)
ON CONFLICT (role) DO UPDATE SET
  permisos = EXCLUDED.permisos,
  vistas_telefono = EXCLUDED.vistas_telefono;

-- Usuarios Autorizados para aprobaciones
CREATE TABLE IF NOT EXISTS public.usuarios_autorizados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  modulo text NOT NULL,
  accion text NOT NULL DEFAULT 'aprobar',
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  CONSTRAINT usuarios_autorizados_uq UNIQUE (usuario_id, modulo, accion)
);

-- Registro de sesiones y actividad
CREATE TABLE IF NOT EXISTS public.sesiones_usuario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  ip text,
  user_agent text,
  actividad_reciente timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Vista de compatibilidad para consultas directas a "usuarios" estilo GT
CREATE OR REPLACE VIEW public.usuarios AS
  SELECT
    p.id,
    p.email,
    p.username,
    p.nombre_completo AS full_name,
    p.nombre_completo AS nombre,
    p.nombre_completo,
    p.role,
    p.activo,
    p.must_change_password,
    p.avatar_url,
    p.departamento,
    p.telefono,
    p.created_at,
    p.updated_at
  FROM public.profiles p;

-- =====================================================================
-- 2. RECURSOS HUMANOS (RRHH ESTILO GT)
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.rrhh_empresas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE,
  nombre text NOT NULL,
  rif text,
  direccion text,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.rrhh_empresas (codigo, nombre, rif, direccion)
VALUES
  ('GT', 'Golden Touch 1127 C.A.', 'J-50123456-7', 'Puerto Ordaz, Estado Bolívar'),
  ('MTO', 'Mantenimiento y Transporte Obrero C.A.', 'J-50123458-3', 'Ciudad Guayana, Estado Bolívar'),
  ('ESC', 'Servicios de Seguridad y Escoltas C.A.', 'J-50998877-1', 'Puerto Ordaz, Estado Bolívar')
ON CONFLICT (codigo) DO NOTHING;

-- Personal (Ficha de RRHH de GT)
CREATE TABLE IF NOT EXISTS public.personal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa text NOT NULL DEFAULT 'ESC',
  ficha_nro text,
  nombre text NOT NULL,
  apellido text NOT NULL,
  cedula text UNIQUE,
  rif text,
  cargo text,
  departamento text,
  sueldo_base numeric(12,2) NOT NULL DEFAULT 0,
  moneda_sueldo text NOT NULL DEFAULT 'USD',
  activo boolean NOT NULL DEFAULT true,
  fecha_ingreso date,
  fecha_nacimiento date,
  genero text CHECK (genero IN ('M', 'F', 'O')),
  estado_civil text,
  grupo_sanguineo text,
  nacionalidad text DEFAULT 'Venezolano(a)',
  direccion text,
  carnet_vence date,
  carnet_token text UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  telefono text,
  correo text,
  tiene_alergias boolean,
  alergias_detalle text,
  tiene_enfermedad boolean,
  enfermedad_detalle text,
  grado_instruccion text,
  titulo_obtenido text,
  foto_url text,
  encuadre_foto jsonb,
  datos_bancarios jsonb NOT NULL DEFAULT '[]'::jsonb,
  carga_familiar jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_personal_empresa ON public.personal(empresa);
CREATE INDEX IF NOT EXISTS idx_personal_activo ON public.personal(activo);
CREATE INDEX IF NOT EXISTS idx_personal_cedula ON public.personal(cedula);

-- Historial salarial
CREATE TABLE IF NOT EXISTS public.personal_sueldos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  personal_id uuid NOT NULL REFERENCES public.personal(id) ON DELETE CASCADE,
  sueldo_anterior numeric(12,2) NOT NULL DEFAULT 0,
  sueldo_nuevo numeric(12,2) NOT NULL DEFAULT 0,
  moneda text NOT NULL DEFAULT 'USD',
  motivo text NOT NULL,
  fecha_efectiva date NOT NULL DEFAULT current_date,
  creado_por text,
  actor_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Historial de cargos
CREATE TABLE IF NOT EXISTS public.personal_cargos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  personal_id uuid NOT NULL REFERENCES public.personal(id) ON DELETE CASCADE,
  cargo_anterior text,
  cargo_nuevo text NOT NULL,
  departamento_anterior text,
  departamento_nuevo text,
  motivo text,
  fecha_cambio date NOT NULL DEFAULT current_date,
  creado_por text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Documentos de personal
CREATE TABLE IF NOT EXISTS public.personal_documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  personal_id uuid NOT NULL REFERENCES public.personal(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  etiqueta text,
  path text NOT NULL,
  nombre text NOT NULL,
  mime text,
  tamano bigint,
  vence date,
  vigente boolean NOT NULL DEFAULT true,
  subido_por text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Carga familiar
CREATE TABLE IF NOT EXISTS public.personal_familiares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  personal_id uuid NOT NULL REFERENCES public.personal(id) ON DELETE CASCADE,
  nombres text NOT NULL,
  apellidos text NOT NULL,
  parentesco text NOT NULL,
  fecha_nacimiento date,
  cedula text,
  telefono text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Transferencias de empresa
CREATE TABLE IF NOT EXISTS public.rrhh_transferencias_empresa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  personal_id uuid NOT NULL REFERENCES public.personal(id) ON DELETE CASCADE,
  empresa_origen text NOT NULL,
  empresa_destino text NOT NULL,
  motivo text,
  fecha date NOT NULL DEFAULT current_date,
  creado_por text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Eventos de personal (permisos, licencias, suspensiones, etc.)
CREATE TABLE IF NOT EXISTS public.rrhh_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  personal_id uuid NOT NULL REFERENCES public.personal(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  fecha_desde date,
  fecha_hasta date,
  dias integer,
  monto numeric(12,2),
  descripcion text,
  estado text NOT NULL DEFAULT 'pendiente',
  procesada boolean NOT NULL DEFAULT false,
  nomina_renglon_id uuid,
  creado_por text,
  actor_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Descansos y vacaciones
CREATE TABLE IF NOT EXISTS public.rrhh_descansos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  personal_id uuid NOT NULL REFERENCES public.personal(id) ON DELETE CASCADE,
  anio integer NOT NULL DEFAULT extract(year from current_date),
  dias_correspondientes integer NOT NULL DEFAULT 15,
  dias_disfrutados integer NOT NULL DEFAULT 0,
  dias_pendientes integer NOT NULL DEFAULT 15,
  estado text NOT NULL DEFAULT 'pendiente',
  observaciones text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Tabulador salarial
CREATE TABLE IF NOT EXISTS public.rrhh_tabulador (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cargo text NOT NULL,
  nivel text NOT NULL DEFAULT 'I',
  sueldo_base numeric(12,2) NOT NULL DEFAULT 0,
  moneda text NOT NULL DEFAULT 'USD',
  vigencia_desde date NOT NULL DEFAULT current_date,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.rrhh_tabulador (cargo, nivel, sueldo_base, moneda)
VALUES
  ('Escolta de Seguridad', 'I', 350.00, 'USD'),
  ('Escolta de Seguridad', 'II', 450.00, 'USD'),
  ('Escolta Jefe de Equipo', 'III', 600.00, 'USD'),
  ('Chofer de Escolta', 'I', 300.00, 'USD'),
  ('Chofer de Flota Pesada', 'II', 400.00, 'USD'),
  ('Supervisor Operativo', 'III', 700.00, 'USD'),
  ('Operador de Monitoreo', 'I', 320.00, 'USD')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS public.rrhh_tabulador_historial (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tabulador_id uuid NOT NULL REFERENCES public.rrhh_tabulador(id) ON DELETE CASCADE,
  sueldo_anterior numeric(12,2) NOT NULL,
  sueldo_nuevo numeric(12,2) NOT NULL,
  moneda text NOT NULL DEFAULT 'USD',
  fecha_cambio timestamptz NOT NULL DEFAULT now(),
  usuario_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Anticipos y préstamos
CREATE TABLE IF NOT EXISTS public.anticipos_prestamos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  personal_id uuid NOT NULL REFERENCES public.personal(id) ON DELETE CASCADE,
  tipo text NOT NULL DEFAULT 'anticipo' CHECK (tipo IN ('anticipo', 'prestamo')),
  monto_total numeric(12,2) NOT NULL CHECK (monto_total > 0),
  cuotas integer NOT NULL DEFAULT 1 CHECK (cuotas >= 1),
  monto_cuota numeric(12,2) NOT NULL CHECK (monto_cuota > 0),
  saldo_pendiente numeric(12,2) NOT NULL,
  motivo text,
  estado text NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'pagado', 'anulado')),
  moneda text NOT NULL DEFAULT 'USD',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.anticipos_pagos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  anticipo_id uuid NOT NULL REFERENCES public.anticipos_prestamos(id) ON DELETE CASCADE,
  renglon_id uuid,
  monto numeric(12,2) NOT NULL CHECK (monto > 0),
  fecha date NOT NULL DEFAULT current_date,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Minutas de reuniones y acuerdos
CREATE TABLE IF NOT EXISTS public.minutas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  correlativo text UNIQUE,
  fecha date NOT NULL DEFAULT current_date,
  turno text NOT NULL DEFAULT 'Diurno',
  supervisor_id uuid REFERENCES public.profiles(id),
  supervisor_nombre text,
  asistentes jsonb NOT NULL DEFAULT '[]'::jsonb,
  temas jsonb NOT NULL DEFAULT '[]'::jsonb,
  acuerdos jsonb NOT NULL DEFAULT '[]'::jsonb,
  avances jsonb NOT NULL DEFAULT '[]'::jsonb,
  observaciones text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.minuta_adjuntos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  minuta_id uuid NOT NULL REFERENCES public.minutas(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  path text NOT NULL,
  mime text,
  tamano bigint,
  subido_por text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =====================================================================
-- 3. CHOFERES Y FLOTA (ESTILO GT)
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.vehiculos_catalogo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  placa text NOT NULL UNIQUE,
  alias text,
  tipo text NOT NULL DEFAULT 'camioneta',
  marca text,
  modelo text,
  anio integer,
  color text,
  serial_carroceria text,
  serial_motor text,
  estado_flota text NOT NULL DEFAULT 'operativo' CHECK (estado_flota IN ('operativo', 'taller', 'inactivo')),
  seguro_vence date,
  capacidad text,
  observacion text,
  notas text,
  activo boolean NOT NULL DEFAULT true,
  creado_por text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.vehiculos_catalogo (placa, alias, tipo, marca, modelo, anio, color, estado_flota)
VALUES
  ('A10BC2D', 'UNIDAD-01', 'camioneta', 'Toyota', 'Hilux 4x4 Blindada', 2023, 'Negro Metalizado', 'operativo'),
  ('A23DF4E', 'UNIDAD-02', 'camioneta', 'Toyota', 'Land Cruiser 200', 2022, 'Gris Grafito', 'operativo'),
  ('A88JK9M', 'UNIDAD-03', 'camioneta', 'Ford', 'F-250 Super Duty', 2021, 'Blanco Perla', 'operativo'),
  ('A45TY7U', 'UNIDAD-04', 'camion', 'Iveco', 'Trakker 380', 2020, 'Blanco', 'operativo'),
  ('A67OP8I', 'UNIDAD-05', 'van', 'Mercedes-Benz', 'Sprinter 515', 2022, 'Plata', 'operativo')
ON CONFLICT (placa) DO NOTHING;

-- Expediente de conductor
CREATE TABLE IF NOT EXISTS public.choferes_conductores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  personal_id uuid NOT NULL UNIQUE REFERENCES public.personal(id) ON DELETE CASCADE,
  licencia_grado text,
  licencia_numero text,
  licencia_vence date,
  certificado_medico_vence date,
  seguro_vence date,
  tarifa_viaje_usd numeric(12,2) NOT NULL DEFAULT 0 CHECK (tarifa_viaje_usd >= 0),
  vehiculo_asignado_id uuid REFERENCES public.vehiculos_catalogo(id) ON DELETE SET NULL,
  observaciones text,
  activo boolean NOT NULL DEFAULT true,
  created_by text,
  actor_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Catálogo de clasificaciones de viaje
CREATE TABLE IF NOT EXISTS public.choferes_clasificaciones_viaje (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clave text NOT NULL UNIQUE,
  nombre text NOT NULL,
  icono text NOT NULL DEFAULT '🚚',
  tarifa_usd numeric(12,2) NOT NULL DEFAULT 0 CHECK (tarifa_usd >= 0),
  activo boolean NOT NULL DEFAULT true,
  orden integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.choferes_clasificaciones_viaje (clave, nombre, icono, tarifa_usd, orden)
VALUES
  ('VIAJE CORTO', 'Viaje Corto (Urbano / Local)', '🚚', 25.00, 1),
  ('VIAJE LARGO', 'Viaje Largo (Interurbano / Troncal)', '🛣️', 50.00, 2),
  ('VIAJE INTERNO', 'Viaje Interno (Patio / Mina / Planta)', '🏭', 10.00, 3),
  ('ESCOLTA RUTA', 'Custodia y Escolta en Tránsito', '🛡️', 75.00, 4)
ON CONFLICT (clave) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  tarifa_usd = EXCLUDED.tarifa_usd;

-- Órdenes de ruta / Viajes
CREATE TABLE IF NOT EXISTS public.choferes_viajes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text UNIQUE,
  chofer_id uuid NOT NULL REFERENCES public.choferes_conductores(id) ON DELETE RESTRICT,
  vehiculo_id uuid REFERENCES public.vehiculos_catalogo(id) ON DELETE SET NULL,
  origen text NOT NULL,
  destino text NOT NULL,
  paradas jsonb NOT NULL DEFAULT '[]'::jsonb,
  carga text,
  fecha_salida timestamptz NOT NULL DEFAULT now(),
  llegada_prevista timestamptz,
  salida_real_at timestamptz,
  llegada_real_at timestamptz,
  km_salida numeric,
  km_llegada numeric,
  estado text NOT NULL DEFAULT 'programado' CHECK (estado IN ('programado', 'en_ruta', 'finalizado', 'cancelado')),
  categoria_viaje text NOT NULL DEFAULT 'VIAJE CORTO',
  tarifa_usd numeric(12,2) NOT NULL DEFAULT 0 CHECK (tarifa_usd >= 0),
  nota text,
  liquidado_at timestamptz,
  liquidado_por text,
  liquidacion jsonb,
  pago_id uuid,
  created_by text,
  actor_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Viáticos y gastos en ruta
CREATE TABLE IF NOT EXISTS public.choferes_viaticos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chofer_id uuid NOT NULL REFERENCES public.choferes_conductores(id) ON DELETE RESTRICT,
  viaje_id uuid REFERENCES public.choferes_viajes(id) ON DELETE SET NULL,
  tipo text NOT NULL CHECK (tipo IN ('anticipo', 'gasto', 'devolucion')),
  concepto text NOT NULL,
  monto_usd numeric(12,2) NOT NULL CHECK (monto_usd > 0),
  moneda text NOT NULL DEFAULT 'USD' CHECK (moneda IN ('USD', 'Bs')),
  monto_moneda numeric(14,2),
  tasa numeric(12,4),
  fecha date NOT NULL DEFAULT current_date,
  comprobante text,
  nota text,
  movimiento_caja_id uuid,
  created_by text,
  actor_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Recibos y pagos de viajes
CREATE TABLE IF NOT EXISTS public.choferes_pagos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text UNIQUE,
  chofer_id uuid NOT NULL REFERENCES public.choferes_conductores(id) ON DELETE RESTRICT,
  detalle jsonb NOT NULL DEFAULT '[]'::jsonb,
  tarifas_usd numeric(12,2) NOT NULL DEFAULT 0,
  reembolsos_usd numeric(12,2) NOT NULL DEFAULT 0,
  deducciones_usd numeric(12,2) NOT NULL DEFAULT 0,
  bonos_usd numeric(12,2) NOT NULL DEFAULT 0,
  otras_deducciones_usd numeric(12,2) NOT NULL DEFAULT 0,
  otras_deducciones_motivo text,
  neto_usd numeric(12,2) NOT NULL DEFAULT 0,
  tasa numeric(12,4),
  neto_bs numeric(14,2),
  estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'pagado', 'anulado')),
  pagado_at timestamptz,
  pagado_por text,
  metodo text,
  nota text,
  created_by text,
  actor_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Documentos y guías de choferes
CREATE TABLE IF NOT EXISTS public.choferes_documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chofer_id uuid NOT NULL REFERENCES public.choferes_conductores(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('licencia', 'certificado_medico', 'seguro', 'otro')),
  etiqueta text,
  path text NOT NULL,
  nombre text NOT NULL,
  mime text,
  tamano bigint,
  vence date,
  vigente boolean NOT NULL DEFAULT true,
  subido_por text,
  subido_por_nombre text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.choferes_guias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha date NOT NULL DEFAULT current_date,
  numero text,
  descripcion text NOT NULL,
  conductor_id uuid REFERENCES public.choferes_conductores(id) ON DELETE SET NULL,
  path text NOT NULL,
  filename text NOT NULL,
  mime text,
  size_bytes integer,
  nota text,
  actor text,
  actor_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Triggers de correlativos automáticos
CREATE OR REPLACE FUNCTION public.choferes_numero_viaje()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE v_anio text; v_n int;
BEGIN
  IF NEW.numero IS NULL OR btrim(NEW.numero) = '' THEN
    PERFORM pg_advisory_xact_lock(hashtext('choferes_viajes_numero'));
    v_anio := to_char(coalesce(NEW.fecha_salida, now()) AT TIME ZONE 'America/Caracas', 'YYYY');
    SELECT coalesce(max(substring(numero from '(\d+)$')::int), 0) + 1 INTO v_n
      FROM public.choferes_viajes WHERE numero LIKE 'VJ-' || v_anio || '-%';
    NEW.numero := 'VJ-' || v_anio || '-' || lpad(v_n::text, 4, '0');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_choferes_numero_viaje ON public.choferes_viajes;
CREATE TRIGGER trg_choferes_numero_viaje BEFORE INSERT ON public.choferes_viajes
  FOR EACH ROW EXECUTE FUNCTION public.choferes_numero_viaje();

CREATE OR REPLACE FUNCTION public.choferes_numero_pago()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE v_anio text; v_n int;
BEGIN
  IF NEW.numero IS NULL OR btrim(NEW.numero) = '' THEN
    PERFORM pg_advisory_xact_lock(hashtext('choferes_pagos_numero'));
    v_anio := to_char(now() AT TIME ZONE 'America/Caracas', 'YYYY');
    SELECT coalesce(max(substring(numero from '(\d+)$')::int), 0) + 1 INTO v_n
      FROM public.choferes_pagos WHERE numero LIKE 'RV-' || v_anio || '-%';
    NEW.numero := 'RV-' || v_anio || '-' || lpad(v_n::text, 4, '0');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_choferes_numero_pago ON public.choferes_pagos;
CREATE TRIGGER trg_choferes_numero_pago BEFORE INSERT ON public.choferes_pagos
  FOR EACH ROW EXECUTE FUNCTION public.choferes_numero_pago();

-- =====================================================================
-- 4. RPCs Y FUNCIONES DE NEGOCIO (GT COMPATIBLES)
-- =====================================================================

CREATE OR REPLACE FUNCTION public.cambiar_sueldo(
  p_personal_id uuid,
  p_nuevo_sueldo numeric,
  p_motivo text,
  p_moneda text DEFAULT 'USD',
  p_fecha_efectiva date DEFAULT current_date
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_sueldo_anterior numeric;
  v_historial_id uuid;
BEGIN
  SELECT sueldo_base INTO v_sueldo_anterior FROM public.personal WHERE id = p_personal_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Personal no encontrado';
  END IF;

  UPDATE public.personal
     SET sueldo_base = p_nuevo_sueldo,
         moneda_sueldo = p_moneda,
         updated_at = now()
   WHERE id = p_personal_id;

  INSERT INTO public.personal_sueldos (
    personal_id, sueldo_anterior, sueldo_nuevo, moneda, motivo, fecha_efectiva, creado_por
  ) VALUES (
    p_personal_id, coalesce(v_sueldo_anterior, 0), p_nuevo_sueldo, p_moneda, p_motivo, p_fecha_efectiva, auth.uid()::text
  ) RETURNING id INTO v_historial_id;

  RETURN v_historial_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.cambiar_cargo(
  p_personal_id uuid,
  p_nuevo_cargo text,
  p_nuevo_departamento text DEFAULT NULL,
  p_motivo text DEFAULT 'Cambio de funciones'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cargo_anterior text;
  v_dep_anterior text;
  v_historial_id uuid;
BEGIN
  SELECT cargo, departamento INTO v_cargo_anterior, v_dep_anterior
    FROM public.personal WHERE id = p_personal_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Personal no encontrado';
  END IF;

  UPDATE public.personal
     SET cargo = p_nuevo_cargo,
         departamento = coalesce(p_nuevo_departamento, departamento),
         updated_at = now()
   WHERE id = p_personal_id;

  INSERT INTO public.personal_cargos (
    personal_id, cargo_anterior, cargo_nuevo, departamento_anterior, departamento_nuevo, motivo, creado_por
  ) VALUES (
    p_personal_id, v_cargo_anterior, p_nuevo_cargo, v_dep_anterior, coalesce(p_nuevo_departamento, v_dep_anterior), p_motivo, auth.uid()::text
  ) RETURNING id INTO v_historial_id;

  RETURN v_historial_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_desbloquear_usuario(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.profiles
     SET activo = true,
         updated_at = now()
   WHERE id = p_user_id;

  DELETE FROM public.intentos_login WHERE user_id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.clear_must_change_password(user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.profiles
     SET must_change_password = false,
         updated_at = now()
   WHERE id = user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.choferes_pago_crear(p_pago jsonb, p_viaje_ids uuid[])
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.choferes_pagos (
    chofer_id, detalle, tarifas_usd, reembolsos_usd, deducciones_usd, bonos_usd,
    otras_deducciones_usd, otras_deducciones_motivo, neto_usd, tasa, neto_bs, nota, created_by
  ) VALUES (
    (p_pago->>'chofer_id')::uuid,
    coalesce(p_pago->'detalle', '[]'::jsonb),
    coalesce((p_pago->>'tarifas_usd')::numeric, 0),
    coalesce((p_pago->>'reembolsos_usd')::numeric, 0),
    coalesce((p_pago->>'deducciones_usd')::numeric, 0),
    coalesce((p_pago->>'bonos_usd')::numeric, 0),
    coalesce((p_pago->>'otras_deducciones_usd')::numeric, 0),
    p_pago->>'otras_deducciones_motivo',
    coalesce((p_pago->>'neto_usd')::numeric, 0),
    (p_pago->>'tasa')::numeric,
    (p_pago->>'neto_bs')::numeric,
    p_pago->>'nota',
    auth.uid()::text
  ) RETURNING id INTO v_id;

  IF array_length(p_viaje_ids, 1) > 0 THEN
    UPDATE public.choferes_viajes
       SET pago_id = v_id,
           liquidado_at = now(),
           liquidado_por = auth.uid()::text
     WHERE id = ANY(p_viaje_ids);
  END IF;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.choferes_pago_anular(p_pago_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.choferes_pagos
     SET estado = 'anulado',
         updated_at = now()
   WHERE id = p_pago_id;

  UPDATE public.choferes_viajes
     SET pago_id = NULL,
         liquidado_at = NULL,
         liquidado_por = NULL
   WHERE pago_id = p_pago_id;
END;
$$;

-- =====================================================================
-- 5. AJUSTES DEL SISTEMA Y TEMA OSCURO
-- =====================================================================

INSERT INTO public.ajustes_sistema (clave, valor, descripcion, categoria, tipo, publico)
VALUES
  ('tema_interfaz', 'oscuro', 'Tema visual de la aplicación: claro u oscuro', 'apariencia', 'texto', true),
  ('tema_paleta', 'grafito', 'Paleta oscura preferida: grafito, carbon, o noche', 'apariencia', 'texto', true),
  ('color_fondo_oscuro', '#0e1217', 'Color de fondo principal modo oscuro', 'apariencia', 'color', true),
  ('color_superficie_oscura', '#161b22', 'Color de tarjetas y barra lateral modo oscuro', 'apariencia', 'color', true),
  ('empresa_nombre', 'Golden Touch 1127 C.A. / Sistema de Escoltas', 'Razón social corporativa', 'empresa', 'texto', true),
  ('empresa_rif', 'J-50123456-7', 'Registro de información fiscal', 'empresa', 'texto', true),
  ('tasa_dolar_referencia', '60.00', 'Tasa referencial de cambio BCV USD/Bs', 'finanzas', 'numero', true),
  ('dias_descanso_semanal', '2', 'Días reglamentarios de descanso por ciclo', 'operaciones', 'numero', true),
  ('notificaciones_sonido', 'true', 'Sonido en alertas de ruta y cambios de turno', 'notificaciones', 'booleano', true)
ON CONFLICT (clave) DO UPDATE SET
  valor = EXCLUDED.valor,
  descripcion = EXCLUDED.descripcion,
  categoria = EXCLUDED.categoria;

-- =====================================================================
-- 6. HABILITAR ROW LEVEL SECURITY (RLS)
-- =====================================================================

ALTER TABLE public.custom_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles_permisos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios_autorizados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sesiones_usuario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rrhh_empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_sueldos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_cargos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_familiares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rrhh_transferencias_empresa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rrhh_eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rrhh_descansos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rrhh_tabulador ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rrhh_tabulador_historial ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anticipos_prestamos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anticipos_pagos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.minutas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.minuta_adjuntos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehiculos_catalogo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.choferes_conductores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.choferes_clasificaciones_viaje ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.choferes_viajes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.choferes_viaticos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.choferes_pagos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.choferes_documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.choferes_guias ENABLE ROW LEVEL SECURITY;

-- Políticas de lectura para autenticados
DO $$
DECLARE
  t text;
  tablas text[] := ARRAY[
    'custom_roles', 'roles_permisos', 'usuarios_autorizados', 'sesiones_usuario',
    'rrhh_empresas', 'personal', 'personal_sueldos', 'personal_cargos',
    'personal_documentos', 'personal_familiares', 'rrhh_transferencias_empresa',
    'rrhh_eventos', 'rrhh_descansos', 'rrhh_tabulador', 'rrhh_tabulador_historial',
    'anticipos_prestamos', 'anticipos_pagos', 'minutas', 'minuta_adjuntos',
    'vehiculos_catalogo', 'choferes_conductores', 'choferes_clasificaciones_viaje',
    'choferes_viajes', 'choferes_viaticos', 'choferes_pagos', 'choferes_documentos', 'choferes_guias'
  ];
BEGIN
  FOREACH t IN ARRAY tablas LOOP
    EXECUTE format('DROP POLICY IF EXISTS "%s_read_auth" ON public.%I', t, t);
    EXECUTE format('CREATE POLICY "%s_read_auth" ON public.%I FOR SELECT TO authenticated USING (true)', t, t);

    EXECUTE format('DROP POLICY IF EXISTS "%s_write_staff" ON public.%I', t, t);
    EXECUTE format('CREATE POLICY "%s_write_staff" ON public.%I FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff())', t, t);
  END LOOP;
END $$;

-- Publicación Realtime para sincronización en vivo
DO $$
DECLARE
  t text;
  tablas text[] := ARRAY[
    'roles_permisos', 'custom_roles', 'usuarios_autorizados',
    'personal', 'personal_sueldos', 'personal_cargos', 'rrhh_eventos', 'rrhh_descansos', 'anticipos_prestamos',
    'choferes_conductores', 'choferes_viajes', 'choferes_viaticos', 'choferes_pagos', 'vehiculos_catalogo',
    'ajustes_sistema'
  ];
BEGIN
  FOREACH t IN ARRAY tablas LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      BEGIN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END IF;
  END LOOP;
END $$;

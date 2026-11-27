-- =====================================================================
-- TABLAS ESENCIALES: RR. HH. Y CHOFERES (COMPATIBLE CON GT Y ESCOLTAS)
-- =====================================================================

SET search_path = public, extensions;

-- 1. Ampliación de restricciones de roles para admitir chofer y rrhh
ALTER TABLE public.roles DROP CONSTRAINT IF EXISTS roles_nombre_check;
ALTER TABLE public.roles ADD CONSTRAINT roles_nombre_check CHECK (nombre IN ('admin', 'supervisor', 'contador', 'escolta', 'chofer', 'rrhh'));

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'supervisor', 'contador', 'escolta', 'chofer', 'rrhh'));

INSERT INTO public.roles (nombre, descripcion, activo, es_sistema)
VALUES
  ('chofer', 'Chofer y Conductor de Flota', true, true),
  ('rrhh', 'Recursos Humanos y Fichas', true, true)
ON CONFLICT (nombre) DO UPDATE SET activo = true;

-- 2. Custom Roles y Roles Permisos
CREATE TABLE IF NOT EXISTS public.custom_roles (
  key text PRIMARY KEY,
  label text NOT NULL,
  descripcion text,
  color text NOT NULL DEFAULT '#404040',
  sistema boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.custom_roles (key, label, descripcion, color, sistema)
VALUES
  ('admin', 'Administrador', 'Control total', '#cc4400', true),
  ('supervisor', 'Supervisor de Operaciones', 'Control operativo', '#2563eb', true),
  ('contador', 'Contabilidad y Finanzas', 'Nómina y pagos', '#16a34a', true),
  ('escolta', 'Escolta / Seguridad', 'Seguridad operativa', '#7c3aed', true),
  ('chofer', 'Chofer / Conductor', 'Transporte y flota', '#ea580c', true),
  ('rrhh', 'Recursos Humanos', 'Personal y fichas', '#0891b2', true)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.roles_permisos (role, permisos, vistas_telefono, solo_telefono)
VALUES
  ('chofer', '{"dashboard":"lectura","choferes":"escritura","asistencias":"escritura"}'::jsonb, '["dashboard","choferes"]'::jsonb, true),
  ('rrhh', '{"dashboard":"lectura","rrhh":"full","escoltas":"escritura","nomina":"escritura","asistencias":"escritura","permisos":"escritura"}'::jsonb, '["dashboard","rrhh"]'::jsonb, false)
ON CONFLICT (role) DO UPDATE SET
  permisos = EXCLUDED.permisos,
  vistas_telefono = EXCLUDED.vistas_telefono;

-- 3. Módulo RRHH: Empresas y Personal
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
  ('MGG', 'Mineral Group Guayana C.A.', 'J-50123458-3', 'Ciudad Guayana, Estado Bolívar'),
  ('ESC', 'Servicios de Seguridad y Escoltas C.A.', 'J-50998877-1', 'Puerto Ordaz, Estado Bolívar')
ON CONFLICT (codigo) DO NOTHING;

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
  telefono text,
  correo text,
  datos_bancarios jsonb NOT NULL DEFAULT '[]'::jsonb,
  carga_familiar jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.anticipos_prestamos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  personal_id uuid NOT NULL REFERENCES public.personal(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('anticipo', 'prestamo')),
  monto numeric(12,2) NOT NULL CHECK (monto > 0),
  moneda text NOT NULL DEFAULT 'USD',
  cuotas integer NOT NULL DEFAULT 1,
  monto_cuota numeric(12,2) NOT NULL,
  saldo_pendiente numeric(12,2) NOT NULL,
  motivo text NOT NULL,
  estado text NOT NULL DEFAULT 'solicitado' CHECK (estado IN ('solicitado', 'aprobado', 'en_descuento', 'liquidado', 'rechazado')),
  fecha_solicitud date NOT NULL DEFAULT current_date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.minutas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text UNIQUE,
  titulo text NOT NULL,
  fecha date NOT NULL DEFAULT current_date,
  lugar text,
  asistentes jsonb NOT NULL DEFAULT '[]'::jsonb,
  temas_tratados text NOT NULL,
  acuerdos text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Módulo Choferes: Flota, Conductores y Viajes
CREATE TABLE IF NOT EXISTS public.vehiculos_catalogo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  placa text NOT NULL UNIQUE,
  alias text,
  tipo text NOT NULL DEFAULT 'camioneta',
  marca text,
  modelo text,
  anio integer,
  color text,
  estado_flota text NOT NULL DEFAULT 'operativo' CHECK (estado_flota IN ('operativo', 'taller', 'inactivo')),
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.vehiculos_catalogo (placa, alias, tipo, marca, modelo, anio, color, estado_flota)
VALUES
  ('A10BC2D', 'UNIDAD-01', 'camioneta', 'Toyota', 'Hilux 4x4 Blindada', 2023, 'Negro Metalizado', 'operativo'),
  ('A23DF4E', 'UNIDAD-02', 'camioneta', 'Toyota', 'Land Cruiser 200', 2022, 'Gris Grafito', 'operativo'),
  ('A88JK9M', 'UNIDAD-03', 'camioneta', 'Ford', 'F-250 Super Duty', 2021, 'Blanco Perla', 'operativo')
ON CONFLICT (placa) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.choferes_conductores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  personal_id uuid NOT NULL UNIQUE REFERENCES public.personal(id) ON DELETE CASCADE,
  licencia_grado text,
  licencia_numero text,
  licencia_vence date,
  tarifa_viaje_usd numeric(12,2) NOT NULL DEFAULT 0,
  vehiculo_asignado_id uuid REFERENCES public.vehiculos_catalogo(id) ON DELETE SET NULL,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

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
  estado text NOT NULL DEFAULT 'programado' CHECK (estado IN ('programado', 'en_ruta', 'finalizado', 'cancelado')),
  tarifa_usd numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.choferes_viaticos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  viaje_id uuid REFERENCES public.choferes_viajes(id) ON DELETE SET NULL,
  chofer_id uuid NOT NULL REFERENCES public.choferes_conductores(id) ON DELETE CASCADE,
  concepto text NOT NULL,
  monto numeric(12,2) NOT NULL CHECK (monto > 0),
  moneda text NOT NULL DEFAULT 'USD',
  fecha date NOT NULL DEFAULT current_date,
  estado text NOT NULL DEFAULT 'aprobado' CHECK (estado IN ('solicitado', 'aprobado', 'pagado', 'rechazado')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.choferes_pagos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text UNIQUE,
  chofer_id uuid NOT NULL REFERENCES public.choferes_conductores(id) ON DELETE RESTRICT,
  viaje_id uuid REFERENCES public.choferes_viajes(id) ON DELETE SET NULL,
  monto numeric(12,2) NOT NULL CHECK (monto >= 0),
  moneda text NOT NULL DEFAULT 'USD',
  fecha_pago date NOT NULL DEFAULT current_date,
  concepto text NOT NULL,
  estado text NOT NULL DEFAULT 'pagado' CHECK (estado IN ('pendiente', 'pagado', 'anulado')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 5. Habilitar RLS y Políticas de lectura/escritura
ALTER TABLE public.custom_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rrhh_empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anticipos_prestamos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.minutas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehiculos_catalogo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.choferes_conductores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.choferes_viajes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.choferes_viaticos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.choferes_pagos ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t text;
  tablas text[] := ARRAY[
    'custom_roles', 'rrhh_empresas', 'personal', 'anticipos_prestamos',
    'minutas', 'vehiculos_catalogo', 'choferes_conductores', 'choferes_viajes',
    'choferes_viaticos', 'choferes_pagos'
  ];
BEGIN
  FOREACH t IN ARRAY tablas LOOP
    EXECUTE format('DROP POLICY IF EXISTS "%s_read_auth" ON public.%I', t, t);
    EXECUTE format('CREATE POLICY "%s_read_auth" ON public.%I FOR SELECT TO authenticated USING (true)', t, t);

    EXECUTE format('DROP POLICY IF EXISTS "%s_write_staff" ON public.%I', t, t);
    EXECUTE format('CREATE POLICY "%s_write_staff" ON public.%I FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff())', t, t);
  END LOOP;
END $$;

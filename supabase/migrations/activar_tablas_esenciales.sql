-- =====================================================================
-- TABLAS ESENCIALES: RECURSOS HUMANOS (RR. HH.) Y SEGURIDAD
-- =====================================================================

SET search_path = public, extensions;

-- 1. Ampliación de restricciones de roles para admitir 'rrhh'
ALTER TABLE public.roles DROP CONSTRAINT IF EXISTS roles_nombre_check;
ALTER TABLE public.roles ADD CONSTRAINT roles_nombre_check CHECK (nombre IN ('admin', 'supervisor', 'contador', 'escolta', 'rrhh'));

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'supervisor', 'contador', 'escolta', 'rrhh'));

INSERT INTO public.roles (nombre, descripcion, activo, es_sistema)
VALUES
  ('rrhh', 'Recursos Humanos y Personal', true, true)
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
  ('rrhh', 'Recursos Humanos', 'Personal y fichas', '#0891b2', true)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.roles_permisos (role, permisos, vistas_telefono, solo_telefono)
VALUES
  ('rrhh', '{"dashboard":"lectura","rrhh":"full","escoltas":"escritura","nomina":"escritura","asistencias":"escritura","permisos":"escritura"}'::jsonb, '["dashboard","rrhh"]'::jsonb, false)
ON CONFLICT (role) DO UPDATE SET
  permisos = EXCLUDED.permisos,
  vistas_telefono = EXCLUDED.vistas_telefono;

-- 3. Módulo RRHH: Empresas, Personal, Historiales y Autorizados
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

CREATE TABLE IF NOT EXISTS public.personal_sueldos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  personal_id uuid NOT NULL REFERENCES public.personal(id) ON DELETE CASCADE,
  sueldo_anterior numeric(12,2) NOT NULL DEFAULT 0,
  sueldo_nuevo numeric(12,2) NOT NULL DEFAULT 0,
  moneda text NOT NULL DEFAULT 'USD',
  motivo text NOT NULL,
  fecha_efectiva date NOT NULL DEFAULT current_date,
  creado_por text,
  created_at timestamptz NOT NULL DEFAULT now()
);

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

CREATE TABLE IF NOT EXISTS public.rrhh_tabulador (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cargo text NOT NULL UNIQUE,
  nivel text NOT NULL DEFAULT 'I',
  departamento text DEFAULT 'Operaciones',
  sueldo_base numeric(12,2) NOT NULL DEFAULT 0,
  moneda text NOT NULL DEFAULT 'USD',
  vigencia_desde date NOT NULL DEFAULT current_date,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.rrhh_tabulador (cargo, nivel, departamento, sueldo_base, moneda)
VALUES
  ('Escolta VIP / Protección Cercana', 'I', 'Operaciones', 350, 'USD'),
  ('Escolta Conductor / Blindado', 'II', 'Operaciones', 400, 'USD'),
  ('Jefe de Seguridad / Supervisor', 'III', 'Supervisión', 500, 'USD'),
  ('Custodio de Valores / Guardia', 'I', 'Operaciones', 320, 'USD')
ON CONFLICT (cargo) DO UPDATE SET sueldo_base = EXCLUDED.sueldo_base;

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

-- 4. Habilitar RLS y Políticas de lectura/escritura (SQL declarativo directo)
ALTER TABLE public.custom_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles_permisos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios_autorizados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rrhh_empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_sueldos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_cargos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rrhh_tabulador ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anticipos_prestamos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.minutas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "custom_roles_read_auth" ON public.custom_roles;
CREATE POLICY "custom_roles_read_auth" ON public.custom_roles FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "custom_roles_write_staff" ON public.custom_roles;
CREATE POLICY "custom_roles_write_staff" ON public.custom_roles FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "roles_permisos_read_auth" ON public.roles_permisos;
CREATE POLICY "roles_permisos_read_auth" ON public.roles_permisos FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "roles_permisos_write_staff" ON public.roles_permisos;
CREATE POLICY "roles_permisos_write_staff" ON public.roles_permisos FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "usuarios_autorizados_read_auth" ON public.usuarios_autorizados;
CREATE POLICY "usuarios_autorizados_read_auth" ON public.usuarios_autorizados FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "usuarios_autorizados_write_staff" ON public.usuarios_autorizados;
CREATE POLICY "usuarios_autorizados_write_staff" ON public.usuarios_autorizados FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "rrhh_empresas_read_auth" ON public.rrhh_empresas;
CREATE POLICY "rrhh_empresas_read_auth" ON public.rrhh_empresas FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "rrhh_empresas_write_staff" ON public.rrhh_empresas;
CREATE POLICY "rrhh_empresas_write_staff" ON public.rrhh_empresas FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "personal_read_auth" ON public.personal;
CREATE POLICY "personal_read_auth" ON public.personal FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "personal_write_staff" ON public.personal;
CREATE POLICY "personal_write_staff" ON public.personal FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "personal_sueldos_read_auth" ON public.personal_sueldos;
CREATE POLICY "personal_sueldos_read_auth" ON public.personal_sueldos FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "personal_sueldos_write_staff" ON public.personal_sueldos;
CREATE POLICY "personal_sueldos_write_staff" ON public.personal_sueldos FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "personal_cargos_read_auth" ON public.personal_cargos;
CREATE POLICY "personal_cargos_read_auth" ON public.personal_cargos FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "personal_cargos_write_staff" ON public.personal_cargos;
CREATE POLICY "personal_cargos_write_staff" ON public.personal_cargos FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "rrhh_tabulador_read_auth" ON public.rrhh_tabulador;
CREATE POLICY "rrhh_tabulador_read_auth" ON public.rrhh_tabulador FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "rrhh_tabulador_write_staff" ON public.rrhh_tabulador;
CREATE POLICY "rrhh_tabulador_write_staff" ON public.rrhh_tabulador FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "anticipos_prestamos_read_auth" ON public.anticipos_prestamos;
CREATE POLICY "anticipos_prestamos_read_auth" ON public.anticipos_prestamos FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "anticipos_prestamos_write_staff" ON public.anticipos_prestamos;
CREATE POLICY "anticipos_prestamos_write_staff" ON public.anticipos_prestamos FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "minutas_read_auth" ON public.minutas;
CREATE POLICY "minutas_read_auth" ON public.minutas FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "minutas_write_staff" ON public.minutas;
CREATE POLICY "minutas_write_staff" ON public.minutas FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

-- =====================================================================
-- Migración: Módulos completos importados de Golden Touch (GT)
-- Choferes, RRHH, Usuarios, Roles y Permisos, Ajustes
-- Proyecto: rznkopetlmitfxcixjcr
-- =====================================================================

SET search_path = public, extensions;

-- ---------------------------------------------------------------------
-- 1. RRHH: Personal, Cargos, Anticipos y Eventos
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.personal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  apellido text NOT NULL DEFAULT '',
  cedula text UNIQUE,
  cargo text,
  departamento text,
  sueldo_base numeric(12,2) NOT NULL DEFAULT 0,
  fecha_ingreso date DEFAULT CURRENT_DATE,
  telefono text,
  correo text,
  direccion text,
  datos_pago jsonb DEFAULT '[]'::jsonb,
  activo boolean NOT NULL DEFAULT true,
  foto_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text
);

CREATE INDEX IF NOT EXISTS idx_personal_activo ON public.personal(activo);
CREATE INDEX IF NOT EXISTS idx_personal_cedula ON public.personal(cedula);

CREATE TABLE IF NOT EXISTS public.cargos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL UNIQUE,
  departamento text,
  sueldo_sugerido numeric(12,2) DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.anticipos_prestamos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  personal_id uuid NOT NULL REFERENCES public.personal(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('anticipo', 'prestamo')),
  monto_total numeric(12,2) NOT NULL CHECK (monto_total > 0),
  saldo numeric(12,2) NOT NULL,
  cuota_sugerida numeric(12,2) DEFAULT 0,
  estado text NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'saldado')),
  motivo text,
  creado_por text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_anticipos_personal ON public.anticipos_prestamos(personal_id);
CREATE INDEX IF NOT EXISTS idx_anticipos_estado ON public.anticipos_prestamos(estado);

CREATE TABLE IF NOT EXISTS public.rrhh_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  personal_id uuid NOT NULL REFERENCES public.personal(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('vacaciones', 'permiso', 'reposo', 'sancion', 'otro')),
  fecha_inicio date NOT NULL,
  fecha_fin date NOT NULL,
  dias integer DEFAULT 1,
  remunerado boolean NOT NULL DEFAULT true,
  descripcion text,
  estado text NOT NULL DEFAULT 'aprobado' CHECK (estado IN ('pendiente', 'aprobado', 'rechazado')),
  adjunto_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rrhh_eventos_personal ON public.rrhh_eventos(personal_id);

CREATE TABLE IF NOT EXISTS public.rrhh_descansos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  personal_id uuid NOT NULL REFERENCES public.personal(id) ON DELETE CASCADE,
  fecha date NOT NULL,
  tipo text DEFAULT 'rotativo',
  observaciones text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 2. Choferes: Conductores, Viajes, Guías, Viáticos y Pagos
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.choferes_conductores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  personal_id uuid REFERENCES public.personal(id) ON DELETE SET NULL,
  externo boolean NOT NULL DEFAULT false,
  nombre text NOT NULL,
  apellido text DEFAULT '',
  cedula text,
  telefono text,
  empresa_externa text,
  licencia_grado text,
  licencia_numero text,
  licencia_vence date,
  certificado_medico_vence date,
  seguro_vence date,
  tarifa_viaje_usd numeric(12,2) NOT NULL DEFAULT 0,
  tarifa_corto_usd numeric(12,2) DEFAULT 0,
  tarifa_largo_usd numeric(12,2) DEFAULT 0,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_choferes_activo ON public.choferes_conductores(activo);
CREATE INDEX IF NOT EXISTS idx_choferes_cedula ON public.choferes_conductores(cedula);

CREATE TABLE IF NOT EXISTS public.choferes_clasificaciones_viaje (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clave text NOT NULL UNIQUE,
  nombre text NOT NULL,
  tarifa_base_usd numeric(12,2) NOT NULL DEFAULT 0,
  descripcion text,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.choferes_viajes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text NOT NULL UNIQUE,
  conductor_id uuid REFERENCES public.choferes_conductores(id) ON DELETE SET NULL,
  conductor_nombre text NOT NULL,
  vehiculo_placa text,
  origen text NOT NULL,
  destino text NOT NULL,
  cliente text,
  fecha_salida date NOT NULL DEFAULT CURRENT_DATE,
  fecha_llegada date,
  viajes numeric NOT NULL DEFAULT 1 CHECK (viajes > 0),
  categoria_viaje text DEFAULT 'VIAJE CORTO',
  estado text NOT NULL DEFAULT 'programado' CHECK (estado IN ('programado', 'en_ruta', 'completado', 'liquidado', 'cancelado')),
  tarifa_usd numeric(12,2) NOT NULL DEFAULT 0,
  monto_total_usd numeric(12,2) NOT NULL DEFAULT 0,
  observaciones text,
  km_salida numeric,
  km_llegada numeric,
  pagado_at timestamptz,
  pago_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text
);

CREATE INDEX IF NOT EXISTS idx_choferes_viajes_conductor ON public.choferes_viajes(conductor_id);
CREATE INDEX IF NOT EXISTS idx_choferes_viajes_estado ON public.choferes_viajes(estado);
CREATE INDEX IF NOT EXISTS idx_choferes_viajes_pagado_at ON public.choferes_viajes(pagado_at);

CREATE TABLE IF NOT EXISTS public.choferes_guias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  viaje_id uuid NOT NULL REFERENCES public.choferes_viajes(id) ON DELETE CASCADE,
  numero_guia text NOT NULL,
  tipo_carga text,
  peso_kg numeric(12,2) DEFAULT 0,
  precintos text,
  observaciones text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.choferes_viaticos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  viaje_id uuid REFERENCES public.choferes_viajes(id) ON DELETE SET NULL,
  conductor_id uuid REFERENCES public.choferes_conductores(id) ON DELETE CASCADE,
  concepto text NOT NULL,
  monto_usd numeric(12,2) NOT NULL CHECK (monto_usd > 0),
  tipo text NOT NULL CHECK (tipo IN ('anticipo', 'gasto', 'reembolso', 'devolucion')),
  comprobante text,
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.choferes_pagos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text NOT NULL UNIQUE,
  conductor_id uuid REFERENCES public.choferes_conductores(id) ON DELETE SET NULL,
  conductor_nombre text NOT NULL,
  total_viajes numeric NOT NULL DEFAULT 0,
  total_usd numeric(12,2) NOT NULL DEFAULT 0,
  metodo_pago text DEFAULT 'transferencia',
  referencia text,
  estado text NOT NULL DEFAULT 'pagado' CHECK (estado IN ('pendiente', 'pagado', 'anulado')),
  fecha_pago date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text
);

CREATE TABLE IF NOT EXISTS public.choferes_documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conductor_id uuid NOT NULL REFERENCES public.choferes_conductores(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  nombre text NOT NULL,
  path text NOT NULL,
  vigente boolean NOT NULL DEFAULT true,
  vence date,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 3. Roles Personalizados y Ajustes Sistema
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.custom_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  label text NOT NULL,
  color text DEFAULT '#0f766e',
  descripcion text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Insertar roles base si no existen
INSERT INTO public.custom_roles (key, label, color, descripcion)
VALUES 
  ('admin', 'Administrador', '#dc2626', 'Control total de la plataforma'),
  ('supervisor', 'Supervisor', '#2563eb', 'Control operativo de escoltas y choferes'),
  ('contador', 'Contador / Finanzas', '#16a34a', 'Manejo de nómina, viáticos y pagos'),
  ('rrhh', 'Recursos Humanos', '#9333ea', 'Gestión de expedientes de personal y permisos'),
  ('escolta', 'Escolta', '#475569', 'Consulta de asignaciones y asistencias'),
  ('chofer', 'Chofer / Conductor', '#d97706', 'Consulta de viajes y viáticos asignados')
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.sesiones_usuario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  ip_address text,
  user_agent text,
  activo boolean NOT NULL DEFAULT true,
  ultima_actividad timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sesiones_user ON public.sesiones_usuario(user_id);

-- ---------------------------------------------------------------------
-- 4. HABILITAR ROW LEVEL SECURITY (RLS) Y POLÍTICAS
-- ---------------------------------------------------------------------

ALTER TABLE public.personal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cargos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anticipos_prestamos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rrhh_eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rrhh_descansos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.choferes_conductores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.choferes_clasificaciones_viaje ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.choferes_viajes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.choferes_guias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.choferes_viaticos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.choferes_pagos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.choferes_documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sesiones_usuario ENABLE ROW LEVEL SECURITY;

-- Políticas para lectura de usuarios autenticados
DO $$
DECLARE
  t text;
  tablas text[] := ARRAY[
    'personal', 'cargos', 'anticipos_prestamos', 'rrhh_eventos', 'rrhh_descansos',
    'choferes_conductores', 'choferes_clasificaciones_viaje', 'choferes_viajes',
    'choferes_guias', 'choferes_viaticos', 'choferes_pagos', 'choferes_documentos',
    'custom_roles', 'sesiones_usuario'
  ];
BEGIN
  FOREACH t IN ARRAY tablas LOOP
    EXECUTE format('DROP POLICY IF EXISTS "%s_select_auth" ON public.%I', t, t);
    EXECUTE format('CREATE POLICY "%s_select_auth" ON public.%I FOR SELECT TO authenticated USING (true)', t, t);

    EXECUTE format('DROP POLICY IF EXISTS "%s_modify_auth" ON public.%I', t, t);
    EXECUTE format('CREATE POLICY "%s_modify_auth" ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)', t, t);
  END LOOP;
END $$;

-- Triggers de actualización automática
DO $$
DECLARE
  t text;
  tablas_upd text[] := ARRAY['personal', 'choferes_conductores', 'choferes_viajes'];
BEGIN
  FOREACH t IN ARRAY tablas_upd LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_set_updated_at_%s ON public.%I', t, t);
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t AND column_name = 'updated_at') THEN
      EXECUTE format('CREATE TRIGGER trg_set_updated_at_%s BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t, t);
    END IF;
  END LOOP;
END $$;

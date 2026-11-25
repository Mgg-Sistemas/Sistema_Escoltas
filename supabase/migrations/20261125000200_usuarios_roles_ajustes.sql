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

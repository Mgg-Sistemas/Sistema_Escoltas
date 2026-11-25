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

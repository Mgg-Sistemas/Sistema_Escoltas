BEGIN;

-- Las claves personalizadas se habilitan en el catálogo antes de asignarse.
ALTER TABLE public.roles DROP CONSTRAINT IF EXISTS roles_nombre_check;
ALTER TABLE public.roles ADD CONSTRAINT roles_nombre_check
  CHECK (nombre ~ '^[a-z][a-z0-9_]{1,39}$');

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_rol_catalogo_fkey FOREIGN KEY (role) REFERENCES public.roles (nombre);

ALTER TABLE public.roles_permisos DROP CONSTRAINT IF EXISTS roles_permisos_role_check;

CREATE OR REPLACE FUNCTION public.preparar_rol_personalizado(p_clave text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid;
BEGIN
  -- La consulta de disponibilidad del servidor no crea filas.
  IF p_clave IS NULL THEN RETURN NULL; END IF;

  INSERT INTO public.roles (nombre, descripcion, es_sistema)
  SELECT key, COALESCE(descripcion, label), false
  FROM public.custom_roles
  WHERE key = p_clave AND sistema IS FALSE
    AND key NOT IN ('admin', 'supervisor', 'contador', 'escolta', 'rrhh', 'chofer')
  ON CONFLICT (nombre) DO NOTHING;

  SELECT r.id INTO v_id
  FROM public.roles AS r
  JOIN public.custom_roles AS c ON c.key = r.nombre
  WHERE r.nombre = p_clave AND r.activo AND NOT r.es_sistema AND NOT c.sistema;

  IF v_id IS NOT NULL THEN
    INSERT INTO public.roles_permisos (role) VALUES (p_clave)
    ON CONFLICT (role) DO NOTHING;
  END IF;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.preparar_rol_personalizado(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.preparar_rol_personalizado(text) TO service_role;

CREATE POLICY rol_personalizado_lee_escoltas ON public.escoltas FOR SELECT TO authenticated
  USING (public.get_my_role() NOT IN ('admin', 'supervisor', 'contador', 'escolta', 'rrhh', 'chofer')
    AND (public.puede_modulo('escoltas') OR public.puede_modulo('distribucion')
      OR public.puede_modulo('asistencias') OR public.puede_modulo('permisos')));
CREATE POLICY rol_personalizado_lee_asignaciones ON public.asignaciones FOR SELECT TO authenticated
  USING (public.get_my_role() NOT IN ('admin', 'supervisor', 'contador', 'escolta', 'rrhh', 'chofer')
    AND (public.puede_modulo('distribucion') OR public.puede_modulo('asistencias')));
CREATE POLICY rol_personalizado_lee_asistencias ON public.asistencias FOR SELECT TO authenticated
  USING (public.get_my_role() NOT IN ('admin', 'supervisor', 'contador', 'escolta', 'rrhh', 'chofer')
    AND public.puede_modulo('asistencias'));
CREATE POLICY rol_personalizado_lee_permisos ON public.permisos FOR SELECT TO authenticated
  USING (public.get_my_role() NOT IN ('admin', 'supervisor', 'contador', 'escolta', 'rrhh', 'chofer')
    AND public.puede_modulo('permisos'));
COMMIT;

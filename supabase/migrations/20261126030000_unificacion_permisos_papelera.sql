-- =====================================================================
-- Migración: 20261126030000_unificacion_permisos_papelera.sql
-- Descripción: Unificación relacional UUID de permisos, columnas de 
--              categoría (Escolta/Seguridad/Chofer) y soporte para Papelera (Soft-delete).
-- =====================================================================

-- 1. Soporte de Categoría y Papelera en `escoltas`
ALTER TABLE public.escoltas 
  ADD COLUMN IF NOT EXISTS categoria text DEFAULT 'escolta' 
    CONSTRAINT escoltas_categoria_check CHECK (categoria IN ('escolta', 'seguridad', 'chofer')),
  ADD COLUMN IF NOT EXISTS cargo text DEFAULT 'Escolta Operativo',
  ADD COLUMN IF NOT EXISTS area text DEFAULT 'Presidencia / Seguridad Operativa',
  ADD COLUMN IF NOT EXISTS turno text DEFAULT 'Diurno',
  ADD COLUMN IF NOT EXISTS eliminado boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS eliminado_at timestamptz;

-- 2. Soporte de Papelera en `asignaciones`
ALTER TABLE public.asignaciones 
  ADD COLUMN IF NOT EXISTS eliminado boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS eliminado_at timestamptz;

-- 3. Soporte de Papelera en `permisos`
ALTER TABLE public.permisos 
  ADD COLUMN IF NOT EXISTS eliminado boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS eliminado_at timestamptz;

-- 4. Unificación de permisos: Vinculación UUID en `roles_permisos`
ALTER TABLE public.roles_permisos
  ADD COLUMN IF NOT EXISTS role_id uuid REFERENCES public.roles(id) ON DELETE CASCADE;

-- Llenar `role_id` a partir de `roles.id`
UPDATE public.roles_permisos rp
SET role_id = r.id
FROM public.roles r
WHERE rp.role = r.nombre AND rp.role_id IS NULL;

-- 5. Catálogo granular de permiso para vaciar papelera
INSERT INTO public.permisos_sistema (codigo, modulo, accion, descripcion, activo)
VALUES ('papelera.vaciar', 'papelera', 'vaciar', 'Capacidad para vaciar y purgar permanentemente registros de la papelera.', true)
ON CONFLICT (codigo) DO NOTHING;

-- Asignar permiso de vaciar papelera al rol admin por defecto
INSERT INTO public.rol_permisos (rol_id, permiso_id, concedido)
SELECT r.id, p.id, true
FROM public.roles r, public.permisos_sistema p
WHERE r.nombre = 'admin' AND p.codigo = 'papelera.vaciar'
ON CONFLICT (rol_id, permiso_id) DO NOTHING;

-- 6. Trigger de Sincronización entre rol_permisos y roles_permisos
CREATE OR REPLACE FUNCTION public.fn_sync_rol_permisos_a_matriz()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rol_nombre text;
  v_modulo text;
  v_accion text;
BEGIN
  -- Obtener nombre del rol
  SELECT nombre INTO v_rol_nombre FROM public.roles WHERE id = COALESCE(NEW.rol_id, OLD.rol_id);
  IF v_rol_nombre IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Asegurar que exista la fila en roles_permisos
  INSERT INTO public.roles_permisos (role, permisos, updated_at)
  VALUES (v_rol_nombre, '{}'::jsonb, now())
  ON CONFLICT (role) DO NOTHING;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_rol_permisos ON public.rol_permisos;
CREATE TRIGGER trg_sync_rol_permisos
  AFTER INSERT OR UPDATE OR DELETE ON public.rol_permisos
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_sync_rol_permisos_a_matriz();

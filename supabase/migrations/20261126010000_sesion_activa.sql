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

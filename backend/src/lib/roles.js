import { supabase } from './supabase.js';
import { ApiError, mapSupabaseError } from './errors.js';

export const ROLES_BASE = ['admin', 'supervisor', 'contador', 'escolta', 'rrhh', 'chofer'];

export async function rolesPersonalizadosHabilitados() {
  const { error } = await supabase.rpc('preparar_rol_personalizado', {});
  if (error?.code === 'PGRST202') return false;
  if (error) throw mapSupabaseError(error, 'No fue posible verificar la asignación de roles.');
  return true;
}

export async function resolverRolAsignable(clave) {
  if (!ROLES_BASE.includes(clave)) {
    const { data, error } = await supabase.rpc('preparar_rol_personalizado', { p_clave: clave });
    if (error?.code === 'PGRST202') {
      throw new ApiError(503, 'La asignación de roles personalizados aún no está habilitada en la base de datos.', 'ROLES_NO_HABILITADOS');
    }
    if (error) throw mapSupabaseError(error, 'No fue posible preparar el rol personalizado.');
    if (!data) throw new ApiError(400, 'El rol no existe o está desactivado.', 'ROL_INVALIDO');
    return data;
  }

  const { data, error } = await supabase.from('roles').select('id').eq('nombre', clave).eq('activo', true).maybeSingle();
  if (error) throw mapSupabaseError(error, 'No fue posible consultar el rol.');
  if (!data) throw new ApiError(400, 'El rol no existe o está desactivado.', 'ROL_INVALIDO');
  return data.id;
}

import { supabase } from './supabase.js';
import { ApiError, mapSupabaseError } from './errors.js';

/** Devuelve el id de la fila de escoltas vinculada al usuario autenticado, o null. */
export async function escoltaIdDelUsuario(userId) {
  const { data, error } = await supabase
    .from('escoltas')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw mapSupabaseError(error, 'No fue posible resolver el escolta asociado al usuario.');
  return data?.id ?? null;
}

/** Igual que la anterior, pero falla con 403 si el usuario no tiene escolta asociado. */
export async function exigirEscolta(req) {
  const escoltaId = await escoltaIdDelUsuario(req.user.id);
  if (!escoltaId) {
    throw new ApiError(403, 'Tu usuario no está vinculado a ningún escolta.', 'PROHIBIDO');
  }
  return escoltaId;
}

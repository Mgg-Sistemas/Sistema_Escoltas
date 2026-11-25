import { supabase } from './supabase.js';

/** Lee los ajustes del sistema con service-role (incluye los secretos). */
export async function obtenerAjustes() {
  const { data, error } = await supabase
    .from('ajustes_sistema')
    .select('id,clave,valor,descripcion,categoria,tipo,publico,editable,updated_at')
    .order('categoria', { ascending: true })
    .order('clave', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

/** Devuelve un valor de ajuste o el fallback indicado. */
export async function valorAjuste(clave, fallback = null) {
  const { data } = await supabase
    .from('ajustes_sistema')
    .select('valor')
    .eq('clave', clave)
    .maybeSingle();
  return data?.valor ?? fallback;
}

export async function ajusteBooleano(clave, fallback = false) {
  const valor = await valorAjuste(clave, null);
  if (valor === null || valor === undefined) return fallback;
  return String(valor).toLowerCase() === 'true' || valor === '1';
}

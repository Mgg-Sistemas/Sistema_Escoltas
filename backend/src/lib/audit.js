import { supabase } from './supabase.js';

/** Inserta un registro en la tabla auditoria (columnas según la migración inicial). */
export async function audit({ tabla, operacion, registro_id, cambios, usuario_id }) {
  const { error } = await supabase.from('auditoria').insert({
    tabla,
    operacion,
    registro_id: registro_id ?? null,
    cambios: cambios ?? {},
    usuario_id: usuario_id ?? null,
  });

  if (error) {
    console.warn(
      `[AUDITORIA] No se pudo registrar "${operacion}" sobre "${tabla}" (registro ${registro_id ?? 'n/d'}): ${error.message}`
    );
    return false;
  }
  return true;
}

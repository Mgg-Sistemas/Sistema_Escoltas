import { supabase } from './supabase.js';

/** Tablas publicadas en supabase_realtime (migración 20261125000100). */
export const TABLAS_TIEMPO_REAL = [
  'profiles',
  'escoltas',
  'grados',
  'clientes',
  'turnos',
  'tipos_permiso',
  'asignaciones',
  'asistencias',
  'permisos',
  'periodos_nomina',
  'nomina_detalles',
  'pagos',
  'auditoria',
  'roles',
  'permisos_sistema',
  'rol_permisos',
  'roles_permisos',
  'ajustes_sistema',
];

/**
 * Crea un canal de Supabase Realtime para varias tablas.
 * Supabase aplica RLS a cada evento: el navegador nunca recibe filas que
 * el usuario no podría consultar con un SELECT normal.
 */
export function crearCanal({ nombre, tablas, onCambio }) {
  let canal = supabase.channel(nombre);

  for (const tabla of tablas) {
    canal = canal.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: tabla },
      (payload) =>
        onCambio({
          tabla,
          tipo: payload.eventType,
          nuevo: payload.new ?? null,
          anterior: payload.old ?? null,
          fecha: new Date().toISOString(),
        }),
    );
  }

  return canal;
}

export function cerrarCanal(canal) {
  if (!canal) return;
  supabase.removeChannel(canal).catch(() => {});
}

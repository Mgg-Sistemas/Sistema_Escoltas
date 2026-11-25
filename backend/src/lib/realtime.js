import { supabase } from './supabase.js';
import { publicarCambio } from './eventBus.js';

/** Tablas publicadas en supabase_realtime (ver migración 20261125000100). */
const TABLAS = [
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

let canal = null;
let iniciando = null;

/**
 * Suscribe el proceso backend a los cambios de la base de datos.
 * Es lazy: solo se abre cuando el primer cliente conecta al stream.
 * El cliente usa service-role, así que el backend vuelve a filtrar cada
 * evento según el rol del destinatario antes de reenviarlo.
 */
export function iniciarRealtime() {
  if (canal) return canal;
  if (iniciando) return iniciando;

  iniciando = new Promise((resolve) => {
    let resuelto = false;
    const terminar = (estado) => {
      if (resuelto) return;
      resuelto = true;
      resolve(estado);
    };

    // Si Supabase tarda en responder, no dejamos colgada la conexión SSE.
    const temporizador = setTimeout(() => terminar('TIEMPO_ESPERA'), 5_000);
    temporizador.unref?.();

    let suscripcion = supabase.channel('sistema-escoltas-backend-stream');

    for (const tabla of TABLAS) {
      suscripcion = suscripcion.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: tabla },
        (payload) => publicarCambio({ tabla, ...payload }),
      );
    }

    suscripcion.subscribe((estado) => {
      if (estado === 'SUBSCRIBED' || estado === 'CHANNEL_ERROR' || estado === 'TIMED_OUT') {
        clearTimeout(temporizador);
        console.log(`[Realtime] Estado del canal backend: ${estado}`);
        terminar(estado);
      }
    });

    canal = suscripcion;
  });

  return iniciando;
}

export function cerrarRealtime() {
  if (!canal) return;
  supabase.removeChannel(canal).catch(() => {});
  canal = null;
  iniciando = null;
}

export { TABLAS as TABLAS_TIEMPO_REAL };

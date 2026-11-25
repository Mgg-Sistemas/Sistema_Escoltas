import { EventEmitter } from 'node:events';

/**
 * Bus interno de eventos. Un único canal de Supabase Realtime alimenta
 * todos los clientes SSE conectados al backend, en lugar de abrir uno por
 * cliente (evita consumir conexiones y cuotas innecesariamente).
 */
export const eventBus = new EventEmitter();
eventBus.setMaxListeners(0);

export const EVENTO_CAMBIO = 'cambio-bd';

export function publicarCambio(payload) {
  eventBus.emit(EVENTO_CAMBIO, payload);
}

export function suscribirseACambios(listener) {
  eventBus.on(EVENTO_CAMBIO, listener);
  return () => eventBus.off(EVENTO_CAMBIO, listener);
}

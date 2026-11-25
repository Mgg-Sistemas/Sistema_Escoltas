import { useEffect, useRef } from 'react';
import { useRealtime } from '../context/RealtimeContext.jsx';

/**
 * Recarga una pantalla cuando llegan cambios de las tablas indicadas.
 * Agrupa eventos con un pequeño debounce para no disparar muchas consultas
 * cuando una operación escribe en varias tablas a la vez.
 *
 * @param {() => void|Promise<void>} recargar función `cargar` de la pantalla
 * @param {{ tablas?: string[], debounce?: number, enabled?: boolean }} opciones
 */
export function useRealtimeRecarga(recargar, { tablas = [], debounce = 350, enabled = true } = {}) {
  const { suscribirseCambios } = useRealtime();
  const recargarRef = useRef(recargar);
  recargarRef.current = recargar;

  const claveTablas = tablas.join('|');

  useEffect(() => {
    if (!enabled) return undefined;

    let temporizador;
    const unsubscribe = suscribirseCambios((evento) => {
      if (tablas.length && !tablas.includes(evento.tabla)) return;
      window.clearTimeout(temporizador);
      temporizador = window.setTimeout(() => {
        Promise.resolve(recargarRef.current?.()).catch(() => {});
      }, debounce);
    });

    return () => {
      window.clearTimeout(temporizador);
      unsubscribe();
    };
  }, [suscribirseCambios, claveTablas, debounce, enabled]);
}

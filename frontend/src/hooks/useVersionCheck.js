import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Hook para detección automática de versiones y despliegues en el Sistema de Escoltas.
 *
 * Consulta periódicamente /version.json. Si la versión remota difiere de la horneada
 * en el bundle (VITE_APP_VERSION) o si se detecta la bandera actualizando=true,
 * activa `hayActualizacion` para mostrar el banner global.
 */

const INTERVALO_POLL_MS = 25_000; // Consulta cada 25 segundos

export function useVersionCheck() {
  const versionHorneada = (import.meta.env.VITE_APP_VERSION ?? '').trim();
  const [hayActualizacion, setHayActualizacion] = useState(false);
  const [mensaje, setMensaje] = useState(
    'El sistema esta actualizandose, por favor haga click aca para tener la ultima version.'
  );
  const [versionNueva, setVersionNueva] = useState('');
  const detectadoRef = useRef(false);

  const chequear = useCallback(async () => {
    try {
      const baseUrl = import.meta.env.BASE_URL || '/';
      const url = `${baseUrl.endsWith('/') ? baseUrl : baseUrl + '/'}version.json?_t=${Date.now()}`;
      const respuesta = await fetch(url, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
        },
      });

      if (!respuesta.ok) return;

      const datos = await respuesta.json();
      const remota = (datos?.version ?? datos?.versionNueva ?? '').trim();
      const estaActualizando = Boolean(datos?.actualizando);

      if (datos?.mensaje) {
        setMensaje(datos.mensaje);
      }

      // Si el bot marcó que se está actualizando o si hay una versión diferente a la horneada
      if (estaActualizando || (remota && versionHorneada && remota !== versionHorneada && remota !== 'dev')) {
        detectadoRef.current = true;
        setHayActualizacion(true);
        setVersionNueva(remota);
      }
    } catch {
      // Ignorar fallas de red momentáneas
    }
  }, [versionHorneada]);

  const actualizarSistema = useCallback(async () => {
    try {
      // Limpiar caches del navegador para forzar la descarga de los nuevos bundles JS/CSS
      if ('caches' in window) {
        const claves = await caches.keys();
        await Promise.all(claves.map((clave) => caches.delete(clave)));
      }
    } catch {
      // Ignorar errores al vaciar caché
    }

    // Navegar con parámetro anti-caché y recargar la página completamente
    const url = new URL(window.location.href);
    url.searchParams.set('_v', Date.now().toString());
    window.location.href = url.toString();
  }, []);

  useEffect(() => {
    let temporizador;

    chequear();

    const loop = () => {
      chequear();
      temporizador = window.setTimeout(loop, INTERVALO_POLL_MS);
    };
    temporizador = window.setTimeout(loop, INTERVALO_POLL_MS);

    const alVolverFoco = () => {
      chequear();
    };

    window.addEventListener('focus', alVolverFoco);
    window.addEventListener('online', alVolverFoco);
    document.addEventListener('visibilitychange', alVolverFoco);

    return () => {
      if (temporizador) window.clearTimeout(temporizador);
      window.removeEventListener('focus', alVolverFoco);
      window.removeEventListener('online', alVolverFoco);
      document.removeEventListener('visibilitychange', alVolverFoco);
    };
  }, [chequear]);

  return {
    hayActualizacion,
    actualizarSistema,
    mensaje,
    versionNueva,
  };
}

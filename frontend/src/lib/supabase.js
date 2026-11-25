import { createClient } from '@supabase/supabase-js';

// Valores por defecto seguros: la URL pública del proyecto y un marcador de posición
// para la clave. Copia .env.example a .env con la clave anon real.
const URL_SUPABASE = import.meta.env.VITE_SUPABASE_URL || 'https://rznkopetlmitfxcixjcr.supabase.co';
const CLAVE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || 'anon-key-pendiente';

/**
 * "Mantener la sesión activa" se decide en el login, antes de crear la sesión.
 * Supabase guarda el token donde le indiquemos: si el usuario marcó la casilla,
 * en localStorage (sobrevive al cierre del navegador); si no, en sessionStorage
 * (sólo mientras la pestaña siga abierta).
 *
 * Si la marca no existe (instalaciones anteriores) se conserva el comportamiento
 * histórico: sesión persistente. Así nadie queda desconectado al actualizar.
 */
export const CLAVE_MANTENER_SESION = 'escoltas:mantener-sesion';

function almacenSesion() {
  try {
    const valor = window.sessionStorage.getItem(CLAVE_MANTENER_SESION);
    return valor === '0' ? window.sessionStorage : window.localStorage;
  } catch {
    return window.localStorage;
  }
}

const almacenDinamico = {
  getItem: (clave) => almacenSesion().getItem(clave),
  setItem: (clave, valor) => almacenSesion().setItem(clave, valor),
  removeItem: (clave) => {
    // Limpiar en ambos evita sesiones huérfanas al cambiar de modalidad.
    try {
      window.localStorage.removeItem(clave);
      window.sessionStorage.removeItem(clave);
    } catch {
      // Almacenamiento no disponible (modo privado estricto).
    }
  },
};

export const supabase = createClient(URL_SUPABASE, CLAVE_ANON, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: almacenDinamico,
  },
});

export const supabaseConfigurado = Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY);

/** Estado inicial de la casilla del login. */
export function mantenerSesionActiva() {
  try {
    return window.sessionStorage.getItem(CLAVE_MANTENER_SESION) !== '0';
  } catch {
    return true;
  }
}

/**
 * Configura el almacenamiento antes de iniciar sesión y descarta tokens de la
 * modalidad anterior para que no quede una sesión oculta en el otro almacén.
 */
export function configurarMantenerSesion(activar) {
  try {
    window.sessionStorage.setItem(CLAVE_MANTENER_SESION, activar ? '1' : '0');
  } catch {
    // Sin sessionStorage no se puede distinguir la modalidad; se mantiene localStorage.
  }

  try {
    for (const almacen of [window.localStorage, window.sessionStorage]) {
      Object.keys(almacen)
        .filter((clave) => clave.startsWith('sb-'))
        .forEach((clave) => almacen.removeItem(clave));
    }
  } catch {
    // Almacenamiento bloqueado: Supabase seguirá con sesión en memoria.
  }
}

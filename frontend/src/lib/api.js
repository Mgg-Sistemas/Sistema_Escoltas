import { supabase } from './supabase.js';

const origenConfigurado = (import.meta.env.VITE_API_URL || '').trim();
const esPlantilla = !origenConfigurado || /tu-dominio|REEMPLAZAR/i.test(origenConfigurado);
const esOrigenLocal = (valor) =>
  /^https?:\/\/(?:localhost|127\.0\.0\.1|\d{1,3}(?:\.\d{1,3}){3})(?::\d+)?\/?$/i.test(valor);

// Si el frontend se abre desde otro equipo (por ejemplo, un celular),
// `localhost` apunta a ese dispositivo. Se deriva el backend del mismo host
// siempre que la configuración sea local, aunque haya cambiado la IP de la PC.
const navegador = typeof window === 'undefined' ? null : window;
const mismoHost = Boolean(
  navegador
    && navegador.location.protocol === 'http:'
    && navegador.location.hostname !== 'localhost'
    && !/^127\./.test(navegador.location.hostname),
);
const origenDerivado = navegador
  ? `http://${navegador.location.hostname}:4000`
  : 'http://localhost:4000';
const origenEfectivo = esPlantilla || (mismoHost && esOrigenLocal(origenConfigurado))
  ? origenDerivado
  : origenConfigurado || origenDerivado;

export const API_URL = origenEfectivo.replace(/\/$/, '');

export class ApiError extends Error {
  constructor(message, code, status) {
    super(message);
    this.name = 'ApiError';
    this.code = code || null;
    this.status = status || null;
  }
}

async function obtenerToken() {
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token || null;
}

/**
 * Cliente único para el backend Node. Todas las respuestas esperadas son
 * { ok: true, data } o { ok: false, error: { message, code } }.
 */
export async function apiFetch(ruta, { method = 'GET', body, senal } = {}) {
  const token = await obtenerToken();
  const headers = { Accept: 'application/json' };

  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  // Las lecturas y la confirmación de clave son idempotentes: se reintentan
  // ante una caída breve del backend. Nunca se reintentan pagos ni altas.
  const reintentable = method === 'GET' || method === 'HEAD'
    || (method === 'POST' && ruta === '/auth/clave-confirmada');
  const intentos = reintentable ? 3 : 1;
  let respuesta;

  for (let intento = 0; intento < intentos; intento += 1) {
    try {
      respuesta = await fetch(`${API_URL}/api${ruta}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: senal,
      });
      break;
    } catch (error) {
      if (error?.name === 'AbortError') throw error;
      if (intento + 1 === intentos) break;
      await new Promise((resolver) => setTimeout(resolver, 350 * (intento + 1)));
    }
  }

  if (!respuesta) {
    throw new ApiError(
      `No se pudo conectar con el servidor (${API_URL}). Revisa que el backend esté activo y la URL configurada.`,
      'RED_NO_DISPONIBLE',
    );
  }

  let resultado = null;
  try {
    resultado = await respuesta.json();
  } catch {
    throw new ApiError('El servidor devolvió una respuesta inesperada.', 'RESPUESTA_INVALIDA', respuesta.status);
  }

  if (!respuesta.ok || resultado?.ok === false) {
    const mensaje = resultado?.error?.message;
    throw new ApiError(
      mensaje || `Error del servidor (${respuesta.status}). Intenta nuevamente.`,
      resultado?.error?.code,
      respuesta.status,
    );
  }

  return resultado?.data ?? null;
}

export const api = {
  resumenDashboard: () => apiFetch('/dashboard/resumen'),
  quienSoy: () => apiFetch('/me'),
  revisarPermiso: (id, estado, notasRevision = '') =>
    apiFetch(`/permisos/${id}/revision`, {
      method: 'PATCH',
      body: { estado, notas_revision: notasRevision },
    }),
  cerrarPeriodo: (id) => apiFetch(`/nominas/periodos/${id}/cerrar`, { method: 'POST' }),
  pagarPeriodo: (id) => apiFetch(`/nominas/periodos/${id}/pagar`, { method: 'POST' }),
  registrarPago: (pago) => apiFetch('/pagos', { method: 'POST', body: pago }),
  actualizarPago: (id, cambios) => apiFetch(`/pagos/${id}`, { method: 'PATCH', body: cambios }),
  // Usuarios, roles y ajustes (operaciones privilegiadas del backend).
  listarUsuarios: () => apiFetch('/usuarios'),
  crearUsuario: (datos) => apiFetch('/usuarios', { method: 'POST', body: datos }),
  actualizarUsuario: (id, cambios) => apiFetch(`/usuarios/${id}`, { method: 'PATCH', body: cambios }),
  restablecerClaveUsuario: (id) => apiFetch(`/usuarios/${id}/restablecer-clave`, { method: 'POST' }),
  desbloquearUsuario: (id) => apiFetch(`/usuarios/${id}/desbloquear`, { method: 'POST' }),
  obtenerRoles: () => apiFetch('/roles'),
  guardarPermisosRol: (datos) => apiFetch('/roles/permisos', { method: 'PUT', body: datos }),
  listarAjustes: () => apiFetch('/ajustes'),
  guardarAjustes: (cambios) => apiFetch('/ajustes', { method: 'PATCH', body: { cambios } }),
  cambiarClave: (clave, confirmacion) =>
    apiFetch('/auth/cambiar-clave', { method: 'POST', body: { clave, confirmacion } }),
};

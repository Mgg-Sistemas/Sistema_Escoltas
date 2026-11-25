import { supabase } from './supabase.js';

const origenConfigurado = (import.meta.env.VITE_API_URL || '').trim();
// Los valores de plantilla no sirven en local: si el frontend se abre desde
// otra IP de la red, `localhost` apunta a ese dispositivo y no a este servidor.
const esOrigenPlantilla = !origenConfigurado || /tu-dominio|REEMPLAZAR/i.test(origenConfigurado);
const origenLocal = typeof window === 'undefined'
  ? 'http://localhost:4000'
  : `http://${window.location.hostname}:4000`;

export const API_URL = (esOrigenPlantilla ? origenLocal : origenConfigurado).replace(/\/$/, '');

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

  let respuesta;
  try {
    respuesta = await fetch(`${API_URL}/api${ruta}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: senal,
    });
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
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

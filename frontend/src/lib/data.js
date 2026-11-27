import { supabase } from './supabase.js';

export const TABLAS = {
  perfiles: 'profiles',
  escoltas: 'escoltas',
  clientes: 'clientes',
  turnos: 'turnos',
  grados: 'grados',
  asignaciones: 'asignaciones',
  asistencias: 'asistencias',
  permisos: 'permisos',
  tiposPermiso: 'tipos_permiso',
  periodosNomina: 'periodos_nomina',
  detallesNomina: 'nomina_detalles',
  pagos: 'pagos',
  personal: 'personal',
  cargos: 'cargos',
  anticipos: 'anticipos_prestamos',
  eventosRrhh: 'rrhh_eventos',
  conductores: 'choferes_conductores',
  viajes: 'choferes_viajes',
  guias: 'choferes_guias',
  viaticos: 'choferes_viaticos',
  pagosChoferes: 'choferes_pagos',
  customRoles: 'custom_roles',
};

/** Traduce errores comunes de Postgres/Supabase a mensajes comprensibles. */
export function mensajeError(error) {
  if (!error) return 'Ocurrió un error inesperado.';
  if (typeof error === 'string') return error;
  const codigo = error.code || '';
  if (codigo === '42501') return 'No tienes permiso para realizar esta acción.';
  if (codigo === '23505') return 'Ya existe un registro con esos datos. Revisa cédula, código o referencia.';
  if (codigo === '23503') return 'No se puede completar la acción porque el registro está relacionado con otros datos.';
  if (codigo === '23502') return 'Faltan campos obligatorios. Revisa el formulario.';
  if (codigo === 'PGRST116') return 'No se encontró el registro solicitado.';
  return error.message || 'Ocurrió un error inesperado. Intenta de nuevo.';
}

function aplicarFiltros(query, filtros) {
  const lista = Array.isArray(filtros)
    ? filtros
    : Object.entries(filtros || {}).map(([column, value]) => ({ column, value, op: 'eq' }));

  return lista.reduce((q, filtro) => {
    const { column, op = 'eq', value } = filtro || {};
    if (!column || value === undefined || value === null || value === '') return q;

    switch (op) {
      case 'in':
        return Array.isArray(value) && value.length ? q.in(column, value) : q;
      case 'ilike':
        return q.ilike(column, `%${value}%`);
      case 'gte':
        return q.gte(column, value);
      case 'lte':
        return q.lte(column, value);
      case 'gt':
        return q.gt(column, value);
      case 'lt':
        return q.lt(column, value);
      case 'neq':
        return q.neq(column, value);
      case 'is':
        return q.is(column, value);
      default:
        return q.eq(column, value);
    }
  }, query);
}

/** Lista registros de cualquier tabla con filtros, orden y límite opcionales. */
export async function listar(tabla, { select = '*', filtros, ordenarPor, ascendente = true, limite } = {}) {
  let query = supabase.from(tabla).select(select);
  query = aplicarFiltros(query, filtros);
  if (ordenarPor) query = query.order(ordenarPor, { ascending: ascendente });
  if (limite) query = query.limit(limite);

  const { data, error } = await query;
  if (error) throw new Error(mensajeError(error));
  return data || [];
}

/** Obtiene un registro por id. Devuelve null cuando no existe. */
export async function obtenerUno(tabla, id, select = '*') {
  const { data, error } = await supabase.from(tabla).select(select).eq('id', id).maybeSingle();
  if (error) throw new Error(mensajeError(error));
  return data;
}

export async function crear(tabla, valores) {
  const { data, error } = await supabase.from(tabla).insert(valores).select().single();
  if (error) throw new Error(mensajeError(error));
  return data;
}

export async function actualizar(tabla, id, cambios) {
  const { data, error } = await supabase.from(tabla).update(cambios).eq('id', id).select().single();
  if (error) throw new Error(mensajeError(error));
  return data;
}

export async function eliminar(tabla, id) {
  const { error } = await supabase.from(tabla).delete().eq('id', id);
  if (error) throw new Error(mensajeError(error));
  return true;
}

export async function contar(tabla, filtros) {
  let query = supabase.from(tabla).select('id', { count: 'exact', head: true });
  query = aplicarFiltros(query, filtros);
  const { count, error } = await query;
  if (error) throw new Error(mensajeError(error));
  return count || 0;
}

// ---------- Formateo ----------

const LOCALE = 'es-VE';

function fechaLocal(valor) {
  if (!valor) return null;
  if (valor instanceof Date) return valor;
  // Las fechas sin hora (YYYY-MM-DD) se interpretan en hora local para evitar desfases.
  if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    const [anio, mes, dia] = valor.split('-').map(Number);
    return new Date(anio, mes - 1, dia);
  }
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

export function formatearFecha(valor, opciones = { day: '2-digit', month: 'short', year: 'numeric' }) {
  const fecha = fechaLocal(valor);
  if (!fecha) return '—';
  return new Intl.DateTimeFormat(LOCALE, opciones).format(fecha);
}

export function formatearFechaHora(valor) {
  const fecha = fechaLocal(valor);
  if (!fecha) return '—';
  return new Intl.DateTimeFormat(LOCALE, {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(fecha);
}

export function formatearHora(valor) {
  if (!valor) return '—';
  const texto = String(valor).slice(0, 5);
  const partes = texto.split(':').map(Number);
  if (partes.length < 2 || partes.some(Number.isNaN)) return texto;
  return `${String(partes[0]).padStart(2, '0')}:${String(partes[1]).padStart(2, '0')}`;
}

export function formatearMoneda(valor, moneda = 'USD') {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return '—';
  if (moneda === 'USD' || moneda === '$') {
    return `$ ${numero.toLocaleString(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (moneda === 'VES' || moneda === 'Bs' || moneda === 'Bs.') {
    return `Bs. ${numero.toLocaleString(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  try {
    return new Intl.NumberFormat(LOCALE, { style: 'currency', currency: moneda }).format(numero);
  } catch {
    return `$ ${new Intl.NumberFormat(LOCALE, { minimumFractionDigits: 2 }).format(numero)}`;
  }
}

export function formatearNumero(valor, decimales = 2) {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return '—';
  return new Intl.NumberFormat(LOCALE, { minimumFractionDigits: decimales, maximumFractionDigits: decimales }).format(numero);
}

export const formatoFecha = formatearFecha;
export const formatoDinero = (m) => Number(m || 0).toLocaleString(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Devuelve YYYY-MM-DD usando la fecha local del dispositivo. */
export function aISOFecha(fecha = new Date()) {
  const year = fecha.getFullYear();
  const month = String(fecha.getMonth() + 1).padStart(2, '0');
  const day = String(fecha.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function hoyISO() {
  return aISOFecha(new Date());
}

/**
 * Convierte una fecha YYYY-MM-DD y una hora "HH:MM" del dispositivo a un
 * timestamptz ISO (UTC). La base guarda check_in / check_out como timestamptz.
 */
export function aTimestampLocal(fechaISO, hora) {
  if (!fechaISO || !hora) return null;
  const [anio, mes, dia] = String(fechaISO).split('-').map(Number);
  const [horas, minutos] = String(hora).slice(0, 5).split(':').map(Number);
  if (!anio || !mes || !dia || Number.isNaN(horas) || Number.isNaN(minutos)) return null;
  const fecha = new Date(anio, mes - 1, dia, horas, minutos, 0, 0);
  return Number.isNaN(fecha.getTime()) ? null : fecha.toISOString();
}

export function inicioDeSemana(fecha = new Date()) {
  const copia = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
  const dia = copia.getDay(); // 0 = domingo
  const desplazamiento = dia === 0 ? -6 : 1 - dia;
  copia.setDate(copia.getDate() + desplazamiento);
  return copia;
}

export function diasDeSemana(fecha = new Date()) {
  const inicio = inicioDeSemana(fecha);
  return Array.from({ length: 7 }, (_, indice) => {
    const dia = new Date(inicio);
    dia.setDate(inicio.getDate() + indice);
    return dia;
  });
}

/** Horas decimales entre dos horas "HH:MM" o "HH:MM:SS". */
export function calcularHoras(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0;
  const aHoras = (valor) => {
    const [h = 0, m = 0] = String(valor).split(':').map(Number);
    return h + m / 60;
  };
  const diferencia = aHoras(checkOut) - aHoras(checkIn);
  if (!Number.isFinite(diferencia) || diferencia < 0) return 0;
  return Math.round(diferencia * 100) / 100;
}

export function formatearHoras(horas) {
  const numero = Number(horas);
  if (!Number.isFinite(numero) || numero <= 0) return '0 h';
  const enteras = Math.floor(numero);
  const minutos = Math.round((numero - enteras) * 60);
  return minutos ? `${enteras} h ${minutos} min` : `${enteras} h`;
}

export function nombreCompleto(registro) {
  if (!registro) return 'Sin nombre';
  return [registro.nombres, registro.apellidos].filter(Boolean).join(' ').trim() || registro.full_name || 'Sin nombre';
}

export function iniciales(registro) {
  const texto = nombreCompleto(registro);
  return texto
    .split(/\s+/)
    .slice(0, 2)
    .map((palabra) => palabra[0]?.toUpperCase() || '')
    .join('');
}

export function totalNomina(detalle) {
  const base = Number(detalle?.sueldo_base) || 0;
  const bonos = Number(detalle?.bonos) || 0;
  const extras = Number(detalle?.horas_extras) || 0;
  const descuentos = Number(detalle?.descuentos) || 0;
  return Math.round((base + bonos + extras - descuentos) * 100) / 100;
}

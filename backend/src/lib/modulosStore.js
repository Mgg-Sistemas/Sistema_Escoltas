import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../data');
const DATA_FILE = path.join(DATA_DIR, 'modulos_store.json');

const SEED_DATA = {
  rrhh_empresas: [
    { id: '1', codigo: 'GT', nombre: 'Golden Touch 1127 CA', rif: 'J-501234567' },
    { id: '2', codigo: 'MGG', nombre: 'Mineral Group Guayana', rif: 'J-509876543' },
  ],
  rrhh_tabulador: [
    { id: '1', cargo: 'Escolta VIP / Protección Cercana', nivel: 'I', sueldo_base: 350, moneda: 'USD', vigencia_desde: '2026-01-01' },
    { id: '2', cargo: 'Escolta Conductor / Flota', nivel: 'II', sueldo_base: 400, moneda: 'USD', vigencia_desde: '2026-01-01' },
    { id: '3', cargo: 'Jefe de Seguridad / Supervisor', nivel: 'III', sueldo_base: 500, moneda: 'USD', vigencia_desde: '2026-01-01' },
    { id: '4', cargo: 'Chofer de Apoyo / Logística', nivel: 'I', sueldo_base: 300, moneda: 'USD', vigencia_desde: '2026-01-01' },
    { id: '5', cargo: 'Custodio de Valores / Guardia', nivel: 'I', sueldo_base: 320, moneda: 'USD', vigencia_desde: '2026-01-01' },
  ],
  personal: [],
  personal_sueldos: [],
  personal_cargos: [],
  anticipos_prestamos: [],
  choferes_conductores: [],
  choferes_viajes: [],
  choferes_viaticos: [],
  choferes_pagos: [],
  choferes_flota: [],
  custom_roles: [],
  autorizados: [],
};

function asegurarDirectorio() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function leerAlmacen() {
  asegurarDirectorio();
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(SEED_DATA, null, 2), 'utf8');
    return { ...SEED_DATA };
  }
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return { ...SEED_DATA, ...JSON.parse(raw) };
  } catch {
    return { ...SEED_DATA };
  }
}

function guardarAlmacen(datos) {
  asegurarDirectorio();
  fs.writeFileSync(DATA_FILE, JSON.stringify(datos, null, 2), 'utf8');
}

export const modulosStore = {
  listar(tabla, filtroFn) {
    const datos = leerAlmacen();
    const items = datos[tabla] || [];
    return typeof filtroFn === 'function' ? items.filter(filtroFn) : items;
  },

  obtenerPorId(tabla, id) {
    const datos = leerAlmacen();
    const items = datos[tabla] || [];
    return items.find((item) => String(item.id) === String(id)) || null;
  },

  insertar(tabla, registro) {
    const datos = leerAlmacen();
    if (!datos[tabla]) datos[tabla] = [];
    const nuevo = {
      id: registro.id || `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...registro,
    };
    datos[tabla].push(nuevo);
    guardarAlmacen(datos);
    return nuevo;
  },

  actualizar(tabla, id, cambios) {
    const datos = leerAlmacen();
    const items = datos[tabla] || [];
    const idx = items.findIndex((item) => String(item.id) === String(id));
    if (idx === -1) return null;
    items[idx] = { ...items[idx], ...cambios, updated_at: new Date().toISOString() };
    datos[tabla] = items;
    guardarAlmacen(datos);
    return items[idx];
  },

  eliminar(tabla, id) {
    const datos = leerAlmacen();
    const items = datos[tabla] || [];
    const filtrados = items.filter((item) => String(item.id) !== String(id));
    datos[tabla] = filtrados;
    guardarAlmacen(datos);
    return true;
  },

  esErrorTablaInexistente(error) {
    if (!error) return false;
    const codigo = String(error.code || '');
    const mensaje = String(error.message || '').toLowerCase();
    return (
      codigo === 'PGRST205' ||
      codigo === '42P01' ||
      mensaje.includes('could not find the table') ||
      mensaje.includes('schema cache') ||
      mensaje.includes('relation') && mensaje.includes('does not exist')
    );
  },
};

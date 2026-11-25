import { crearRouterCrud } from '../lib/crud.js';
import {
  esquemaClienteCrear,
  esquemaClienteActualizar,
  esquemaTurnoCrear,
  esquemaTurnoActualizar,
  esquemaGradoCrear,
  esquemaGradoActualizar,
  esquemaTipoPermisoCrear,
  esquemaTipoPermisoActualizar,
} from '../schemas.js';

const rolesLectura = ['admin', 'supervisor', 'contador'];

export const clientesRouter = crearRouterCrud({
  tabla: 'clientes',
  esquemaCrear: esquemaClienteCrear,
  esquemaActualizar: esquemaClienteActualizar,
  filtros: {
    nombre: { tipo: 'ilike' },
    ruc: { tipo: 'eq' },
    activo: { tipo: 'bool' },
  },
  busqueda: ['nombre', 'ruc', 'contacto'],
  orden: { columna: 'nombre', ascendente: true, permitidas: ['nombre', 'ruc'] },
  rolesLeer: rolesLectura,
  rolesEscritura: ['admin'],
});

export const turnosRouter = crearRouterCrud({
  tabla: 'turnos',
  esquemaCrear: esquemaTurnoCrear,
  esquemaActualizar: esquemaTurnoActualizar,
  filtros: {
    nombre: { tipo: 'ilike' },
    activo: { tipo: 'bool' },
  },
  busqueda: ['nombre'],
  orden: { columna: 'nombre', ascendente: true, permitidas: ['nombre', 'hora_inicio', 'hora_fin'] },
  rolesLeer: rolesLectura,
  rolesEscritura: ['admin'],
});

export const gradosRouter = crearRouterCrud({
  tabla: 'grados',
  esquemaCrear: esquemaGradoCrear,
  esquemaActualizar: esquemaGradoActualizar,
  filtros: {
    nombre: { tipo: 'ilike' },
    activo: { tipo: 'bool' },
  },
  busqueda: ['nombre'],
  orden: { columna: 'nombre', ascendente: true, permitidas: ['nombre', 'nivel'] },
  rolesLeer: rolesLectura,
  rolesEscritura: ['admin'],
});

// Catálogo auxiliar usado por /api/permisos (tipo_id).
export const tiposPermisoRouter = crearRouterCrud({
  tabla: 'tipos_permiso',
  esquemaCrear: esquemaTipoPermisoCrear,
  esquemaActualizar: esquemaTipoPermisoActualizar,
  filtros: {
    nombre: { tipo: 'ilike' },
    activo: { tipo: 'bool' },
  },
  busqueda: ['nombre', 'descripcion'],
  orden: { columna: 'nombre', ascendente: true, permitidas: ['nombre'] },
  rolesLeer: rolesLectura,
  rolesEscritura: ['admin'],
});

import { crearRouterCrud } from '../lib/crud.js';
import {
  esquemaEscoltaCrear,
  esquemaEscoltaActualizar,
} from '../schemas.js';

export default crearRouterCrud({
  tabla: 'escoltas',
  esquemaCrear: esquemaEscoltaCrear,
  esquemaActualizar: esquemaEscoltaActualizar,
  filtros: {
    user_id: { tipo: 'eq' },
    codigo: { tipo: 'ilike' },
    nombres: { tipo: 'ilike' },
    apellidos: { tipo: 'ilike' },
    cedula: { tipo: 'ilike' },
    telefono: { tipo: 'ilike' },
    grado_id: { tipo: 'eq' },
    estado: { tipo: 'eq' },
    fecha_ingreso_desde: { tipo: 'gte', columna: 'fecha_ingreso' },
    fecha_ingreso_hasta: { tipo: 'lte', columna: 'fecha_ingreso' },
  },
  busqueda: ['codigo', 'nombres', 'apellidos', 'cedula', 'telefono'],
  orden: {
    columna: 'codigo',
    ascendente: true,
    permitidas: ['codigo', 'nombres', 'apellidos', 'fecha_ingreso', 'estado'],
  },
  rolesLeer: ['admin', 'supervisor', 'contador'],
  rolesEscritura: ['admin'],
});

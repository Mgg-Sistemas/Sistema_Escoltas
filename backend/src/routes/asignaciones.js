import { crearRouterCrud } from '../lib/crud.js';
import {
  esquemaAsignacionCrear,
  esquemaAsignacionActualizar,
} from '../schemas.js';

export default crearRouterCrud({
  tabla: 'asignaciones',
  esquemaCrear: esquemaAsignacionCrear,
  esquemaActualizar: esquemaAsignacionActualizar,
  filtros: {
    escolta_id: { tipo: 'eq' },
    cliente_id: { tipo: 'eq' },
    turno_id: { tipo: 'eq' },
    supervisor_id: { tipo: 'eq' },
    estado: { tipo: 'eq' },
    fecha_inicio_desde: { tipo: 'gte', columna: 'fecha_inicio' },
    fecha_inicio_hasta: { tipo: 'lte', columna: 'fecha_inicio' },
    fecha_fin_desde: { tipo: 'gte', columna: 'fecha_fin' },
    fecha_fin_hasta: { tipo: 'lte', columna: 'fecha_fin' },
  },
  busqueda: ['notas'],
  orden: {
    columna: 'fecha_inicio',
    ascendente: false,
    permitidas: ['fecha_inicio', 'fecha_fin', 'estado'],
  },
  rolesLeer: ['admin', 'supervisor', 'contador'],
  rolesEscritura: ['admin', 'supervisor'],
  antesCrear: async (datos, req) => ({ ...datos, created_by: req.user.id }),
});

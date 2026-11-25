import { crearRouterCrud } from '../lib/crud.js';
import {
  esquemaAsistenciaCrear,
  esquemaAsistenciaActualizar,
  esquemaAsistenciaEscoltaCrear,
  esquemaAsistenciaEscoltaActualizar,
} from '../schemas.js';

/** El escolta solo ve y modifica sus propias asistencias. */
function scopeAsistencias(consulta, req) {
  if (req.user.role === 'escolta') {
    return consulta.eq('escolta_id', req.user.escolta_id);
  }
  return consulta;
}

export default crearRouterCrud({
  tabla: 'asistencias',
  esquemaCrear: (req) =>
    req.user.role === 'escolta' ? esquemaAsistenciaEscoltaCrear : esquemaAsistenciaCrear,
  esquemaActualizar: (req) =>
    req.user.role === 'escolta' ? esquemaAsistenciaEscoltaActualizar : esquemaAsistenciaActualizar,
  filtros: {
    escolta_id: { tipo: 'eq' },
    asignacion_id: { tipo: 'eq' },
    estado: { tipo: 'eq' },
    fecha_desde: { tipo: 'gte', columna: 'fecha' },
    fecha_hasta: { tipo: 'lte', columna: 'fecha' },
  },
  busqueda: ['notas'],
  orden: {
    columna: 'fecha',
    ascendente: false,
    permitidas: ['fecha', 'check_in', 'check_out', 'estado', 'horas'],
  },
  rolesLeer: ['admin', 'supervisor', 'contador', 'escolta'],
  rolesCrear: ['admin', 'supervisor', 'escolta'],
  rolesActualizar: ['admin', 'supervisor', 'escolta'],
  rolesEliminar: ['admin', 'supervisor'],
  scope: scopeAsistencias,
  antesCrear: (datos, req) => {
    if (req.user.role === 'escolta') {
      return {
        ...datos,
        escolta_id: req.user.escolta_id,
        fecha: datos.fecha ?? new Date().toISOString().slice(0, 10),
        check_in: datos.check_in ?? new Date().toISOString(),
        estado: 'presente',
      };
    }
    return datos;
  },
  antesActualizar: async (datos, req, anterior) => {
    if (datos.check_out && datos.horas === undefined && anterior?.check_in) {
      const diferencia = Date.parse(datos.check_out) - Date.parse(anterior.check_in);
      if (Number.isFinite(diferencia) && diferencia >= 0) {
        return { ...datos, horas: Number((diferencia / 3_600_000).toFixed(2)) };
      }
    }
    return datos;
  },
});

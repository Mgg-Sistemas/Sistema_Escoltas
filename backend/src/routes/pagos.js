import { crearRouterCrud } from '../lib/crud.js';
import { esquemaPagoCrear, esquemaPagoActualizar } from '../schemas.js';

export default crearRouterCrud({
  tabla: 'pagos',
  esquemaCrear: esquemaPagoCrear,
  esquemaActualizar: esquemaPagoActualizar,
  filtros: {
    periodo_id: { tipo: 'eq' },
    escolta_id: { tipo: 'eq' },
    registrado_por: { tipo: 'eq' },
    metodo: { tipo: 'eq' },
    estado: { tipo: 'eq' },
    referencia: { tipo: 'ilike' },
    fecha_pago_desde: { tipo: 'gte', columna: 'fecha_pago' },
    fecha_pago_hasta: { tipo: 'lte', columna: 'fecha_pago' },
  },
  busqueda: ['referencia'],
  orden: {
    columna: 'fecha_pago',
    ascendente: false,
    permitidas: ['fecha_pago', 'monto', 'estado', 'metodo'],
  },
  rolesLeer: ['admin', 'supervisor', 'contador'],
  rolesEscritura: ['admin', 'contador'],
  metodos: { eliminar: false },
  antesCrear: (datos, req) => ({
    ...datos,
    fecha_pago: datos.fecha_pago ?? new Date().toISOString().slice(0, 10),
    estado: datos.estado ?? 'registrado',
    registrado_por: req.user.id,
  }),
});

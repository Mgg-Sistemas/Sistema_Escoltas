import { crearRouterCrud } from '../lib/crud.js';
import { supabase } from '../lib/supabase.js';
import { requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler, ok } from '../lib/http.js';
import { mapSupabaseError, noEncontrado } from '../lib/errors.js';
import { audit } from '../lib/audit.js';
import {
  esquemaId,
  esquemaPermisoCrear,
  esquemaPermisoActualizar,
  esquemaPermisoEscoltaCrear,
  esquemaRevisionPermiso,
} from '../schemas.js';

/** El escolta solo ve sus propios permisos. */
function scopePermisos(consulta, req) {
  if (req.user.role === 'escolta') {
    return consulta.eq('escolta_id', req.user.escolta_id);
  }
  return consulta;
}

function rutasExtra(router) {
  router.patch(
    '/:id/revision',
    requireRole('admin', 'supervisor'),
    validate(esquemaId, 'params'),
    validate(esquemaRevisionPermiso),
    asyncHandler(async (req, res) => {
      const { data: permiso, error: errorLectura } = await supabase
        .from('permisos')
        .select('*')
        .eq('id', req.params.id)
        .single();

      if (errorLectura?.code === 'PGRST116') throw noEncontrado('No se encontró el permiso indicado.');
      if (errorLectura) throw mapSupabaseError(errorLectura, 'No fue posible consultar el permiso.');

      const { data, error } = await supabase
        .from('permisos')
        .update({
          estado: req.body.estado,
          notas_revision: req.body.notas_revision ?? null,
          aprobado_por: req.user.id,
          aprobado_at: new Date().toISOString(),
        })
        .eq('id', req.params.id)
        .select('*')
        .single();

      if (error) throw mapSupabaseError(error, 'No fue posible revisar el permiso.');

      await audit({
        tabla: 'permisos',
        operacion: 'revision',
        registro_id: data.id,
        cambios: {
          anterior: { estado: permiso.estado, notas_revision: permiso.notas_revision },
          nuevo: { estado: req.body.estado, notas_revision: req.body.notas_revision ?? null },
        },
        usuario_id: req.user.id,
      });

      return ok(res, data);
    })
  );
}

const router = crearRouterCrud({
  tabla: 'permisos',
  esquemaCrear: (req) =>
    req.user.role === 'escolta' ? esquemaPermisoEscoltaCrear : esquemaPermisoCrear,
  esquemaActualizar: esquemaPermisoActualizar,
  filtros: {
    escolta_id: { tipo: 'eq' },
    tipo_id: { tipo: 'eq' },
    estado: { tipo: 'eq' },
    solicitado_por: { tipo: 'eq' },
    aprobado_por: { tipo: 'eq' },
    fecha_inicio_desde: { tipo: 'gte', columna: 'fecha_inicio' },
    fecha_inicio_hasta: { tipo: 'lte', columna: 'fecha_inicio' },
    fecha_fin_desde: { tipo: 'gte', columna: 'fecha_fin' },
    fecha_fin_hasta: { tipo: 'lte', columna: 'fecha_fin' },
  },
  busqueda: ['motivo', 'notas_revision'],
  orden: {
    columna: 'fecha_inicio',
    ascendente: false,
    permitidas: ['fecha_inicio', 'fecha_fin', 'estado'],
  },
  rolesLeer: ['admin', 'supervisor', 'contador', 'escolta'],
  rolesCrear: ['admin', 'supervisor', 'escolta'],
  rolesActualizar: ['admin', 'supervisor'],
  rolesEliminar: ['admin'],
  scope: scopePermisos,
  antesCrear: (datos, req) => {
    const base = {
      ...datos,
      estado: datos.estado ?? 'pendiente',
      solicitado_por: datos.solicitado_por ?? req.user.id,
    };
    if (req.user.role === 'escolta') {
      return { ...base, escolta_id: req.user.escolta_id };
    }
    return base;
  },
  rutasExtra,
});

export default router;

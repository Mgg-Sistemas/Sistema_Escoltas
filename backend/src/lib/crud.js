import { Router } from 'express';
import { supabase } from './supabase.js';
import { requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler, created, ok, parsear } from './http.js';
import { mapSupabaseError, noEncontrado } from './errors.js';
import { applyFilters, applyOrderAndRange, applySearch } from './query.js';
import { limpiarPayload } from './payload.js';
import { audit } from './audit.js';
import { esquemaId } from '../schemas.js';

/**
 * Fábrica de routers CRUD sobre una tabla de Supabase.
 * Las opciones permiten ajustar roles, filtros, búsqueda, ámbito (scope) y
 * transformaciones previas a crear/actualizar según las reglas de negocio.
 */
export function crearRouterCrud(opciones) {
  const { tabla, esquemaCrear, esquemaActualizar } = opciones;
  const seleccion = opciones.seleccion ?? '*';
  const filtros = opciones.filtros ?? {};
  const busqueda = opciones.busqueda ?? [];
  const orden = opciones.orden ?? { columna: 'id', ascendente: false };
  const rolesLeer = opciones.rolesLeer ?? ['admin', 'supervisor', 'contador'];
  const rolesCrear = opciones.rolesCrear ?? opciones.rolesEscritura ?? ['admin'];
  const rolesActualizar = opciones.rolesActualizar ?? rolesCrear;
  const rolesEliminar = opciones.rolesEliminar ?? opciones.rolesEscritura ?? ['admin'];
  const metodos = { listar: true, obtener: true, crear: true, actualizar: true, eliminar: true, ...(opciones.metodos ?? {}) };

  const resolverEsquema = (esquema, req, accion) =>
    typeof esquema === 'function' ? esquema(req, accion) : esquema;

  // Sincrónico a propósito: el constructor de consultas de Supabase es "thenable"
  // y devolverlo desde una función async ejecutaría la consulta antes de continuar.
  const aplicarScope = (consulta, req, accion) =>
    opciones.scope ? opciones.scope(consulta, req, accion) : consulta;

  const registrar = async (operacion, fila, cambios, req) => {
    if (opciones.auditoria === false) return;
    await audit({
      tabla,
      operacion,
      registro_id: fila?.id ?? req.params?.id ?? null,
      cambios,
      usuario_id: req.user.id,
    });
  };

  const router = Router();

  if (metodos.listar) {
    router.get('/', requireRole(...rolesLeer), asyncHandler(async (req, res) => {
      let consulta = supabase.from(tabla).select(seleccion, { count: 'exact' });
      consulta = applyFilters(consulta, req.query, filtros);
      consulta = applySearch(consulta, req.query.q, busqueda);
      consulta = aplicarScope(consulta, req, 'leer');
      consulta = applyOrderAndRange(consulta, req.query, orden);

      const { data, error, count } = await consulta;
      if (error) throw mapSupabaseError(error, `No fue posible listar los registros de ${tabla}.`);
      return ok(res, data, count ?? data.length);
    }));
  }

  if (metodos.obtener) {
    router.get('/:id', requireRole(...rolesLeer), validate(esquemaId, 'params'), asyncHandler(async (req, res) => {
      let consulta = supabase.from(tabla).select(seleccion).eq('id', req.params.id);
      consulta = aplicarScope(consulta, req, 'leer');

      const { data, error } = await consulta.single();
      if (error?.code === 'PGRST116') throw noEncontrado();
      if (error) throw mapSupabaseError(error, `No fue posible consultar el registro de ${tabla}.`);
      return ok(res, data);
    }));
  }

  if (metodos.crear) {
    router.post('/', requireRole(...rolesCrear), asyncHandler(async (req, res) => {
      const esquema = resolverEsquema(esquemaCrear, req, 'crear');
      const datos = parsear(esquema, req.body ?? {});
      const preparados = opciones.antesCrear ? await opciones.antesCrear(datos, req) : datos;

      const { data, error } = await supabase
        .from(tabla)
        .insert(limpiarPayload(preparados))
        .select(seleccion)
        .single();

      if (error) throw mapSupabaseError(error, `No fue posible crear el registro en ${tabla}.`);
      await registrar('crear', data, preparados, req);
      return created(res, data);
    }));
  }

  if (metodos.actualizar) {
    router.patch('/:id', requireRole(...rolesActualizar), validate(esquemaId, 'params'), asyncHandler(async (req, res) => {
      let consultaAnterior = supabase.from(tabla).select('*').eq('id', req.params.id);
      consultaAnterior = aplicarScope(consultaAnterior, req, 'escribir');

      const { data: anterior, error: errorLectura } = await consultaAnterior.single();
      if (errorLectura?.code === 'PGRST116') throw noEncontrado();
      if (errorLectura) throw mapSupabaseError(errorLectura, `No fue posible consultar el registro de ${tabla}.`);

      const esquema = resolverEsquema(esquemaActualizar, req, 'actualizar');
      const datos = parsear(esquema, req.body ?? {});
      const preparados = opciones.antesActualizar
        ? await opciones.antesActualizar(datos, req, anterior)
        : datos;

      let consulta = supabase
        .from(tabla)
        .update(limpiarPayload(preparados))
        .eq('id', req.params.id);
      consulta = aplicarScope(consulta, req, 'escribir');

      const { data, error } = await consulta.select(seleccion).single();
      if (error?.code === 'PGRST116') throw noEncontrado();
      if (error) throw mapSupabaseError(error, `No fue posible actualizar el registro de ${tabla}.`);

      await registrar('actualizar', data, { anterior, nuevo: preparados }, req);
      return ok(res, data);
    }));
  }

  if (metodos.eliminar) {
    router.delete('/:id', requireRole(...rolesEliminar), validate(esquemaId, 'params'), asyncHandler(async (req, res) => {
      let consultaAnterior = supabase.from(tabla).select('*').eq('id', req.params.id);
      consultaAnterior = aplicarScope(consultaAnterior, req, 'escribir');

      const { data: anterior, error: errorLectura } = await consultaAnterior.single();
      if (errorLectura?.code === 'PGRST116') throw noEncontrado();
      if (errorLectura) throw mapSupabaseError(errorLectura, `No fue posible consultar el registro de ${tabla}.`);

      let consulta = supabase.from(tabla).delete().eq('id', req.params.id);
      consulta = aplicarScope(consulta, req, 'escribir');

      const { data, error } = await consulta.select(seleccion).single();
      if (error?.code === 'PGRST116') throw noEncontrado();
      if (error) throw mapSupabaseError(error, `No fue posible eliminar el registro de ${tabla}.`);

      await registrar('eliminar', data, anterior, req);
      return ok(res, data);
    }));
  }

  if (typeof opciones.rutasExtra === 'function') opciones.rutasExtra(router);

  return router;
}

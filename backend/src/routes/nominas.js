import { Router } from 'express';
import { supabase } from '../lib/supabase.js';
import { requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler, created, ok, parsear } from '../lib/http.js';
import { ApiError, mapSupabaseError, noEncontrado } from '../lib/errors.js';
import { applyFilters, applyOrderAndRange } from '../lib/query.js';
import { audit } from '../lib/audit.js';
import { exigirEscolta } from '../lib/scope.js';
import {
  esquemaId,
  esquemaPeriodoCrear,
  esquemaDetalleNominaActualizar,
  esquemaPagarPeriodo,
} from '../schemas.js';

const router = Router();
const rolesLectura = ['admin', 'supervisor', 'contador', 'escolta'];
const rolesNomina = ['admin', 'contador'];

router.get(
  '/periodos',
  requireRole(...rolesLectura),
  asyncHandler(async (req, res) => {
    let consulta = supabase.from('periodos_nomina').select('*', { count: 'exact' });
    consulta = applyFilters(consulta, req.query, {
      nombre: { tipo: 'ilike' },
      estado: { tipo: 'eq' },
      fecha_inicio_desde: { tipo: 'gte', columna: 'fecha_inicio' },
      fecha_inicio_hasta: { tipo: 'lte', columna: 'fecha_inicio' },
      fecha_fin_desde: { tipo: 'gte', columna: 'fecha_fin' },
      fecha_fin_hasta: { tipo: 'lte', columna: 'fecha_fin' },
    });

    if (req.user.role === 'escolta') {
      const escoltaId = await exigirEscolta(req);
      const { data: detalles, error: errorDetalles } = await supabase
        .from('nomina_detalles')
        .select('periodo_id')
        .eq('escolta_id', escoltaId);

      if (errorDetalles) throw mapSupabaseError(errorDetalles, 'No fue posible consultar tus periodos de nómina.');

      const periodos = [...new Set(detalles.map((detalle) => detalle.periodo_id))];
      if (periodos.length === 0) return ok(res, [], 0);
      consulta = consulta.in('id', periodos);
    }

    consulta = applyOrderAndRange(consulta, req.query, {
      columna: 'fecha_inicio',
      ascendente: false,
      permitidas: ['nombre', 'fecha_inicio', 'fecha_fin', 'estado'],
    });

    const { data, error, count } = await consulta;
    if (error) throw mapSupabaseError(error, 'No fue posible listar los periodos de nómina.');
    return ok(res, data, count ?? data.length);
  })
);

router.post(
  '/periodos',
  requireRole(...rolesNomina),
  asyncHandler(async (req, res) => {
    const datos = parsear(esquemaPeriodoCrear, req.body ?? {});

    const { data: abierto, error: errorAbierto } = await supabase
      .from('periodos_nomina')
      .select('id')
      .eq('estado', 'abierto')
      .limit(1)
      .maybeSingle();

    if (errorAbierto) throw mapSupabaseError(errorAbierto, 'No fue posible consultar los periodos de nómina.');
    if (abierto) {
      throw new ApiError(
        409,
        'Ya existe un periodo de nómina abierto. Ciérrelo antes de crear uno nuevo.',
        'PERIODO_ABIERTO_EXISTENTE'
      );
    }

    const { data, error } = await supabase
      .from('periodos_nomina')
      .insert({ ...datos, estado: 'abierto', creado_por: req.user.id })
      .select('*')
      .single();

    if (error) throw mapSupabaseError(error, 'No fue posible crear el periodo de nómina.');

    await audit({
      tabla: 'periodos_nomina',
      operacion: 'crear',
      registro_id: data.id,
      cambios: datos,
      usuario_id: req.user.id,
    });

    return created(res, data);
  })
);

router.get(
  '/periodos/:id/detalles',
  requireRole(...rolesLectura),
  validate(esquemaId, 'params'),
  asyncHandler(async (req, res) => {
    const { data: periodo, error: errorPeriodo } = await supabase
      .from('periodos_nomina')
      .select('id, nombre, estado')
      .eq('id', req.params.id)
      .single();

    if (errorPeriodo?.code === 'PGRST116') throw noEncontrado('No se encontró el periodo de nómina indicado.');
    if (errorPeriodo) throw mapSupabaseError(errorPeriodo, 'No fue posible consultar el periodo de nómina.');

    let consulta = supabase.from('nomina_detalles').select('*', { count: 'exact' }).eq('periodo_id', req.params.id);
    consulta = applyFilters(consulta, req.query, {
      escolta_id: { tipo: 'eq' },
      estado: { tipo: 'eq' },
      pago_referencia: { tipo: 'ilike' },
    });

    if (req.user.role === 'escolta') {
      const escoltaId = await exigirEscolta(req);
      consulta = consulta.eq('escolta_id', escoltaId);
    }

    consulta = applyOrderAndRange(consulta, req.query, {
      columna: 'escolta_id',
      ascendente: true,
      permitidas: ['escolta_id', 'total', 'estado', 'dias_trabajados'],
    });

    const { data, error, count } = await consulta;
    if (error) throw mapSupabaseError(error, 'No fue posible listar los detalles de la nómina.');

    return ok(res, { periodo, detalles: data }, count ?? data.length);
  })
);

router.patch(
  '/detalles/:id',
  requireRole(...rolesNomina),
  validate(esquemaId, 'params'),
  asyncHandler(async (req, res) => {
    const datos = parsear(esquemaDetalleNominaActualizar, req.body ?? {});

    const { data: detalle, error: errorDetalle } = await supabase
      .from('nomina_detalles')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (errorDetalle?.code === 'PGRST116') throw noEncontrado('No se encontró el detalle de nómina indicado.');
    if (errorDetalle) throw mapSupabaseError(errorDetalle, 'No fue posible consultar el detalle de nómina.');

    const { data: periodo, error: errorPeriodo } = await supabase
      .from('periodos_nomina')
      .select('id, estado')
      .eq('id', detalle.periodo_id)
      .single();

    if (errorPeriodo) throw mapSupabaseError(errorPeriodo, 'No fue posible consultar el periodo del detalle.');
    if (periodo?.estado === 'pagado') {
      throw new ApiError(409, 'No es posible modificar un detalle de un periodo ya pagado.', 'DETALLE_PAGADO');
    }

    const { data, error } = await supabase
      .from('nomina_detalles')
      .update(datos)
      .eq('id', req.params.id)
      .select('*')
      .single();

    if (error) throw mapSupabaseError(error, 'No fue posible actualizar el detalle de nómina.');

    await audit({
      tabla: 'nomina_detalles',
      operacion: 'actualizar',
      registro_id: data.id,
      cambios: { anterior: detalle, nuevo: datos },
      usuario_id: req.user.id,
    });

    return ok(res, data);
  })
);

router.post(
  '/periodos/:id/cerrar',
  requireRole(...rolesNomina),
  validate(esquemaId, 'params'),
  asyncHandler(async (req, res) => {
    const { data: periodo, error: errorLectura } = await supabase
      .from('periodos_nomina')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (errorLectura?.code === 'PGRST116') throw noEncontrado('No se encontró el periodo de nómina indicado.');
    if (errorLectura) throw mapSupabaseError(errorLectura, 'No fue posible consultar el periodo de nómina.');

    if (periodo.estado !== 'abierto') {
      throw new ApiError(
        409,
        `El periodo se encuentra "${periodo.estado}" y solo se puede cerrar uno abierto.`,
        'PERIODO_NO_ABIERTO'
      );
    }

    const { data, error } = await supabase
      .from('periodos_nomina')
      .update({
        estado: 'cerrado',
        cerrado_por: req.user.id,
        cerrado_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .select('*')
      .single();

    if (error) throw mapSupabaseError(error, 'No fue posible cerrar el periodo de nómina.');

    await audit({
      tabla: 'periodos_nomina',
      operacion: 'cerrar',
      registro_id: data.id,
      cambios: { anterior: { estado: periodo.estado }, nuevo: { estado: 'cerrado' } },
      usuario_id: req.user.id,
    });

    return ok(res, data);
  })
);

router.post(
  '/periodos/:id/pagar',
  requireRole(...rolesNomina),
  validate(esquemaId, 'params'),
  asyncHandler(async (req, res) => {
    const opciones = parsear(esquemaPagarPeriodo, req.body ?? {});

    const { data: periodo, error: errorLectura } = await supabase
      .from('periodos_nomina')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (errorLectura?.code === 'PGRST116') throw noEncontrado('No se encontró el periodo de nómina indicado.');
    if (errorLectura) throw mapSupabaseError(errorLectura, 'No fue posible consultar el periodo de nómina.');

    if (periodo.estado === 'pagado') {
      throw new ApiError(409, 'El periodo de nómina ya fue pagado.', 'PERIODO_YA_PAGADO');
    }
    if (periodo.estado !== 'cerrado') {
      throw new ApiError(
        409,
        'El periodo debe estar cerrado antes de registrar los pagos.',
        'PERIODO_NO_CERRADO'
      );
    }

    const { data: detalles, error: errorDetalles } = await supabase
      .from('nomina_detalles')
      .select('*')
      .eq('periodo_id', req.params.id);

    if (errorDetalles) throw mapSupabaseError(errorDetalles, 'No fue posible consultar los detalles de la nómina.');

    const pendientes = detalles.filter((detalle) => detalle.estado !== 'pagado');
    // fecha_pago es date en "pagos"; pagado_at es timestamptz en "nomina_detalles".
    const fechaPago = opciones.fecha_pago ?? new Date().toISOString().slice(0, 10);
    const pagadoEn = new Date().toISOString();
    // 1. Intentar ejecución atómica en PostgreSQL si la RPC está disponible
    try {
      const { data: rpcPago, error: rpcErr } = await supabase.rpc('registrar_pago_nomina_periodo', {
        p_periodo_id: req.params.id,
        p_metodo: opciones.metodo ?? 'transferencia',
        p_referencia: opciones.referencia ?? null,
        p_fecha_pago: fechaPago,
        p_user_id: req.user.id,
      });

      if (!rpcErr && rpcPago && typeof rpcPago.pagos_registrados === 'number') {
        await audit({
          tabla: 'periodos_nomina',
          operacion: 'PAGO_NOMINA_BATCH',
          registro_id: req.params.id,
          cambios: rpcPago,
          usuario_id: req.user.id,
        });

        const { data: periodoActualizado } = await supabase
          .from('periodos_nomina')
          .select('*')
          .eq('id', req.params.id)
          .single();

        return ok(res, {
          periodo: periodoActualizado,
          pagos_creados: rpcPago.pagos_registrados,
          total_pagado: Number(Number(rpcPago.total_pagado ?? 0).toFixed(2)),
          metodo_atomico: true,
        });
      }
    } catch {}

    const pagosCreados = [];
    const estadosAnteriores = new Map();
    let periodoActualizado = null;

    try {
      for (const detalle of pendientes) {
        estadosAnteriores.set(detalle.id, {
          estado: detalle.estado,
          pagado_at: detalle.pagado_at ?? null,
          pago_referencia: detalle.pago_referencia ?? null,
        });

        // Verificación de idempotencia: evitar registros duplicados ante fallos parciales o reintentos
        const { data: pagoExistente } = await supabase
          .from('pagos')
          .select('id')
          .eq('periodo_id', req.params.id)
          .eq('escolta_id', detalle.escolta_id)
          .maybeSingle();

        if (pagoExistente) {
          // Si ya existe el pago en la tabla, asegurar estado de detalle consistente y omitir inserción duplicada
          const { error: errorDetalle } = await supabase
            .from('nomina_detalles')
            .update({
              estado: 'pagado',
              pagado_at: pagadoEn,
              pago_referencia: opciones.referencia ?? null,
            })
            .eq('id', detalle.id);

          if (errorDetalle) throw mapSupabaseError(errorDetalle, 'No fue posible marcar el detalle como pagado.');
          continue;
        }

        const { data: pago, error: errorPago } = await supabase
          .from('pagos')
          .insert({
            periodo_id: req.params.id,
            escolta_id: detalle.escolta_id,
            monto: Number(detalle.total ?? 0),
            fecha_pago: fechaPago,
            metodo: opciones.metodo ?? 'transferencia',
            referencia: opciones.referencia ?? null,
            estado: opciones.estado ?? 'registrado',
            registrado_por: req.user.id,
          })
          .select('*')
          .single();

        if (errorPago) throw mapSupabaseError(errorPago, 'No fue posible registrar el pago de un escolta.');
        pagosCreados.push(pago.id);

        const { error: errorDetalle } = await supabase
          .from('nomina_detalles')
          .update({
            estado: 'pagado',
            pagado_at: pagadoEn,
            pago_referencia: opciones.referencia ?? null,
          })
          .eq('id', detalle.id);

        if (errorDetalle) throw mapSupabaseError(errorDetalle, 'No fue posible marcar un detalle como pagado.');
      }

      const { data: actualizado, error: errorPeriodo } = await supabase
        .from('periodos_nomina')
        .update({ estado: 'pagado' })
        .eq('id', req.params.id)
        .select('*')
        .single();

      if (errorPeriodo) throw mapSupabaseError(errorPeriodo, 'No fue posible actualizar el estado del periodo.');
      periodoActualizado = actualizado;
    } catch (error) {
      // Compensación: se revierten los cambios parciales para no dejar la nómina incoherente.
      if (periodoActualizado) {
        await supabase.from('periodos_nomina').update({ estado: 'cerrado' }).eq('id', req.params.id);
      }
      if (pagosCreados.length > 0) {
        await supabase.from('pagos').delete().in('id', pagosCreados);
      }
      for (const [detalleId, anterior] of estadosAnteriores) {
        await supabase.from('nomina_detalles').update(anterior).eq('id', detalleId);
      }
      throw error;
    }

    await audit({
      tabla: 'periodos_nomina',
      operacion: 'pagar',
      registro_id: req.params.id,
      cambios: {
        anterior: { estado: periodo.estado },
        nuevo: { estado: 'pagado', fecha_pago: fechaPago, pagos_creados: pagosCreados.length },
      },
      usuario_id: req.user.id,
    });

    const totalPagado = pendientes.reduce((suma, detalle) => suma + Number(detalle.total ?? 0), 0);

    return ok(res, {
      periodo: periodoActualizado,
      pagos_creados: pagosCreados.length,
      total_pagado: Number(totalPagado.toFixed(2)),
    });
  })
);

export default router;

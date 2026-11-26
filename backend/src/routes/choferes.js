import { Router } from 'express';
import { supabase } from '../lib/supabase.js';
import { audit } from '../lib/audit.js';
import { ApiError, mapSupabaseError, noEncontrado } from '../lib/errors.js';
import { asyncHandler, ok, creado, sinContenido } from '../lib/http.js';
import { requireRole } from '../middleware/auth.js';
import { modulosStore } from '../lib/modulosStore.js';

const router = Router();

// =====================================================================
// CONDUCTORES / EXPEDIENTES (ESCOLTAS CONDUCTORES Y LOGÍSTICA)
// =====================================================================

router.get(
  '/conductores',
  asyncHandler(async (req, res) => {
    const { activo } = req.query;
    let query = supabase
      .from('choferes_conductores')
      .select('*, personal:personal(*), vehiculo:vehiculos_catalogo(*)')
      .order('created_at', { ascending: false });

    if (activo !== undefined && activo !== '') {
      query = query.eq('activo', activo === 'true');
    }

    const { data, error } = await query;
    if (error) {
      if (modulosStore.esErrorTablaInexistente(error)) {
        return ok(res, modulosStore.listar('choferes_conductores'));
      }
      throw mapSupabaseError(error, 'No fue posible listar los conductores.');
    }

    return ok(res, data ?? []);
  })
);

router.post(
  '/conductores',
  requireRole('admin', 'supervisor'),
  asyncHandler(async (req, res) => {
    const { personal_id, licencia_grado, licencia_numero, licencia_vence, certificado_medico_vence, seguro_vence, tarifa_viaje_usd, vehiculo_asignado_id, observaciones } = req.body;
    if (!personal_id) throw new ApiError(400, 'Debe seleccionar una ficha de personal.');

    const payload = {
      personal_id,
      licencia_grado: licencia_grado || '5to Grado',
      licencia_numero: licencia_numero || 'LIC-000000',
      licencia_vence: licencia_vence || null,
      certificado_medico_vence: certificado_medico_vence || null,
      seguro_vence: seguro_vence || null,
      tarifa_viaje_usd: Number(tarifa_viaje_usd) || 0,
      vehiculo_asignado_id: vehiculo_asignado_id || null,
      observaciones: observaciones || '',
      activo: true,
      created_by: req.user.id,
      actor_name: req.user.full_name || req.user.email || 'Sistema',
    };

    const { data, error } = await supabase
      .from('choferes_conductores')
      .insert(payload)
      .select('*, personal:personal(*), vehiculo:vehiculos_catalogo(*)')
      .single();

    if (error) {
      if (modulosStore.esErrorTablaInexistente(error)) {
        const item = modulosStore.insertar('choferes_conductores', payload);
        return creado(res, item);
      }
      throw mapSupabaseError(error, 'No fue posible registrar el expediente del chofer.');
    }

    await audit({
      tabla: 'choferes_conductores',
      operacion: 'INSERT',
      registro_id: data.id,
      cambios: { personal_id, licencia_numero },
      usuario_id: req.user.id,
    });

    return creado(res, data);
  })
);

router.put(
  '/conductores/:id',
  requireRole('admin', 'supervisor'),
  asyncHandler(async (req, res) => {
    const payload = { ...req.body };
    delete payload.id;
    delete payload.personal_id;
    delete payload.created_at;
    delete payload.personal;
    delete payload.vehiculo;
    payload.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('choferes_conductores')
      .update(payload)
      .eq('id', req.params.id)
      .select('*, personal:personal(*), vehiculo:vehiculos_catalogo(*)')
      .single();

    if (error) {
      if (modulosStore.esErrorTablaInexistente(error)) {
        const item = modulosStore.actualizar('choferes_conductores', req.params.id, payload);
        return ok(res, item || { id: req.params.id, ...payload });
      }
      throw mapSupabaseError(error, 'No fue posible actualizar el expediente.');
    }

    return ok(res, data);
  })
);

// =====================================================================
// RUTAS Y VIAJES
// =====================================================================

router.get(
  '/viajes',
  asyncHandler(async (req, res) => {
    const { chofer_id, estado, fecha_desde, fecha_hasta } = req.query;

    let query = supabase
      .from('choferes_viajes')
      .select('*, chofer:choferes_conductores(*, personal:personal(*)), vehiculo:vehiculos_catalogo(*)')
      .order('fecha_salida', { ascending: false });

    if (chofer_id) query = query.eq('chofer_id', chofer_id);
    if (estado) query = query.eq('estado', estado);
    if (fecha_desde) query = query.gte('fecha_salida', fecha_desde);
    if (fecha_hasta) query = query.lte('fecha_salida', fecha_hasta);

    const { data, error } = await query;
    if (error) {
      if (modulosStore.esErrorTablaInexistente(error)) {
        return ok(res, modulosStore.listar('choferes_viajes'));
      }
      throw mapSupabaseError(error, 'No fue posible listar los viajes.');
    }

    return ok(res, data ?? []);
  })
);

router.post(
  '/viajes',
  requireRole('admin', 'supervisor'),
  asyncHandler(async (req, res) => {
    const { chofer_id, vehiculo_id, origen, destino, paradas = [], carga, fecha_salida, km_salida, categoria_viaje = 'VIAJE CORTO', tarifa_usd = 0, nota } = req.body;

    if (!chofer_id || !origen || !destino) {
      throw new ApiError(400, 'Chofer, origen y destino son obligatorios.');
    }

    const payload = {
      chofer_id,
      vehiculo_id: vehiculo_id || null,
      origen,
      destino,
      paradas,
      carga,
      fecha_salida: fecha_salida || new Date().toISOString(),
      km_salida: km_salida ? Number(km_salida) : null,
      estado: 'programado',
      categoria_viaje,
      tarifa_usd: Number(tarifa_usd),
      nota,
      created_by: req.user.id,
      actor_name: req.user.full_name || req.user.email || 'Sistema',
    };

    const { data, error } = await supabase
      .from('choferes_viajes')
      .insert(payload)
      .select('*, chofer:choferes_conductores(*, personal:personal(*)), vehiculo:vehiculos_catalogo(*)')
      .single();

    if (error) {
      if (modulosStore.esErrorTablaInexistente(error)) {
        const item = modulosStore.insertar('choferes_viajes', payload);
        return creado(res, item);
      }
      throw mapSupabaseError(error, 'No fue posible registrar la orden de ruta / viaje.');
    }

    return creado(res, data);
  })
);

router.patch(
  '/viajes/:id/estado',
  requireRole('admin', 'supervisor'),
  asyncHandler(async (req, res) => {
    const { estado, km_salida, km_llegada, nota } = req.body;
    if (!['programado', 'en_ruta', 'finalizado', 'cancelado'].includes(estado)) {
      throw new ApiError(400, 'Estado no válido.');
    }

    const payload = {
      estado,
      updated_at: new Date().toISOString(),
    };

    if (estado === 'en_ruta') {
      payload.salida_real_at = new Date().toISOString();
      if (km_salida !== undefined) payload.km_salida = Number(km_salida);
    } else if (estado === 'finalizado') {
      payload.llegada_real_at = new Date().toISOString();
      if (km_llegada !== undefined) payload.km_llegada = Number(km_llegada);
    }
    if (nota !== undefined) payload.nota = nota;

    const { data, error } = await supabase
      .from('choferes_viajes')
      .update(payload)
      .eq('id', req.params.id)
      .select('*, chofer:choferes_conductores(*, personal:personal(*)), vehiculo:vehiculos_catalogo(*)')
      .single();

    if (error) {
      if (modulosStore.esErrorTablaInexistente(error)) {
        const item = modulosStore.actualizar('choferes_viajes', req.params.id, payload);
        return ok(res, item || { id: req.params.id, ...payload });
      }
      throw mapSupabaseError(error, 'No fue posible actualizar el estado del viaje.');
    }

    return ok(res, data);
  })
);

// =====================================================================
// VIÁTICOS
// =====================================================================

router.get(
  '/viaticos',
  asyncHandler(async (req, res) => {
    const { chofer_id, viaje_id } = req.query;
    let query = supabase
      .from('choferes_viaticos')
      .select('*, chofer:choferes_conductores(*, personal:personal(*)), viaje:choferes_viajes(*)')
      .order('fecha', { ascending: false });

    if (chofer_id) query = query.eq('chofer_id', chofer_id);
    if (viaje_id) query = query.eq('viaje_id', viaje_id);

    const { data, error } = await query;
    if (error) {
      if (modulosStore.esErrorTablaInexistente(error)) {
        return ok(res, modulosStore.listar('choferes_viaticos'));
      }
      throw mapSupabaseError(error, 'No fue posible listar los viáticos.');
    }

    return ok(res, data ?? []);
  })
);

router.post(
  '/viaticos',
  requireRole('admin', 'supervisor', 'contador'),
  asyncHandler(async (req, res) => {
    const { chofer_id, viaje_id, tipo = 'anticipo', concepto, monto_usd, moneda = 'USD', tasa, monto_moneda, fecha, comprobante, nota } = req.body;
    if (!chofer_id || !concepto || !monto_usd || Number(monto_usd) <= 0) {
      throw new ApiError(400, 'Chofer, concepto y monto positivo son obligatorios.');
    }

    const payload = {
      chofer_id,
      viaje_id: viaje_id || null,
      tipo,
      concepto,
      monto_usd: Number(monto_usd),
      moneda,
      tasa: tasa ? Number(tasa) : null,
      monto_moneda: monto_moneda ? Number(monto_moneda) : null,
      fecha: fecha || new Date().toISOString().split('T')[0],
      comprobante: comprobante || null,
      nota: nota || '',
      created_by: req.user.id,
      actor_name: req.user.full_name || req.user.email || 'Sistema',
    };

    const { data, error } = await supabase
      .from('choferes_viaticos')
      .insert(payload)
      .select('*')
      .single();

    if (error) {
      if (modulosStore.esErrorTablaInexistente(error)) {
        const item = modulosStore.insertar('choferes_viaticos', payload);
        return creado(res, item);
      }
      throw mapSupabaseError(error, 'No fue posible registrar el viático.');
    }

    return creado(res, data);
  })
);

// =====================================================================
// PAGOS / RECIBOS DE VIAJE
// =====================================================================

router.get(
  '/pagos',
  asyncHandler(async (req, res) => {
    const { chofer_id, estado } = req.query;
    let query = supabase
      .from('choferes_pagos')
      .select('*, chofer:choferes_conductores(*, personal:personal(*))')
      .order('created_at', { ascending: false });

    if (chofer_id) query = query.eq('chofer_id', chofer_id);
    if (estado) query = query.eq('estado', estado);

    const { data, error } = await query;
    if (error) {
      if (modulosStore.esErrorTablaInexistente(error)) {
        return ok(res, modulosStore.listar('choferes_pagos'));
      }
      throw mapSupabaseError(error, 'No fue posible listar los pagos de choferes.');
    }

    return ok(res, data ?? []);
  })
);

router.post(
  '/pagos',
  requireRole('admin', 'contador'),
  asyncHandler(async (req, res) => {
    const { chofer_id, detalle = [], tarifas_usd = 0, reembolsos_usd = 0, deducciones_usd = 0, bonos_usd = 0, otras_deducciones_usd = 0, otras_deducciones_motivo, tasa, nota, viaje_ids = [] } = req.body;

    if (!chofer_id) throw new ApiError(400, 'Debe especificar el chofer.');

    const netoUsd = Number(tarifas_usd) + Number(reembolsos_usd) + Number(bonos_usd) - Number(deducciones_usd) - Number(otras_deducciones_usd);
    const netoBs = tasa ? Number((netoUsd * Number(tasa)).toFixed(2)) : null;

    const payload = {
      chofer_id,
      detalle,
      tarifas_usd: Number(tarifas_usd),
      reembolsos_usd: Number(reembolsos_usd),
      deducciones_usd: Number(deducciones_usd),
      bonos_usd: Number(bonos_usd),
      otras_deducciones_usd: Number(otras_deducciones_usd),
      otras_deducciones_motivo,
      neto_usd: netoUsd,
      tasa: tasa ? Number(tasa) : null,
      neto_bs: netoBs,
      estado: 'pendiente',
      nota,
      created_by: req.user.id,
      actor_name: req.user.full_name || req.user.email || 'Sistema',
    };

    const { data, error } = await supabase
      .from('choferes_pagos')
      .insert(payload)
      .select('*')
      .single();

    if (error) {
      if (modulosStore.esErrorTablaInexistente(error)) {
        const item = modulosStore.insertar('choferes_pagos', payload);
        return creado(res, item);
      }
      throw mapSupabaseError(error, 'No fue posible crear el recibo de pago.');
    }

    if (viaje_ids && viaje_ids.length > 0) {
      await supabase
        .from('choferes_viajes')
        .update({
          pago_id: data.id,
          liquidado_at: new Date().toISOString(),
          liquidado_por: req.user.id,
        })
        .in('id', viaje_ids)
        .catch(() => {});
    }

    return creado(res, data);
  })
);

// =====================================================================
// FLOTA / VEHÍCULOS
// =====================================================================

router.get(
  '/flota',
  asyncHandler(async (req, res) => {
    const { data, error } = await supabase
      .from('vehiculos_catalogo')
      .select('*')
      .order('placa');

    if (error) {
      if (modulosStore.esErrorTablaInexistente(error)) {
        return ok(res, modulosStore.listar('choferes_flota'));
      }
      throw mapSupabaseError(error, 'No fue posible listar la flota.');
    }
    return ok(res, data ?? []);
  })
);

router.post(
  '/flota',
  requireRole('admin', 'supervisor'),
  asyncHandler(async (req, res) => {
    const payload = { ...req.body };
    delete payload.id;

    const { data, error } = await supabase
      .from('vehiculos_catalogo')
      .insert(payload)
      .select('*')
      .single();

    if (error) {
      if (modulosStore.esErrorTablaInexistente(error)) {
        const item = modulosStore.insertar('choferes_flota', payload);
        return creado(res, item);
      }
      throw mapSupabaseError(error, 'No fue posible registrar la unidad.');
    }
    return creado(res, data);
  })
);

router.put(
  '/flota/:id',
  requireRole('admin', 'supervisor'),
  asyncHandler(async (req, res) => {
    const payload = { ...req.body };
    delete payload.id;
    payload.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('vehiculos_catalogo')
      .update(payload)
      .eq('id', req.params.id)
      .select('*')
      .single();

    if (error) {
      if (modulosStore.esErrorTablaInexistente(error)) {
        const item = modulosStore.actualizar('choferes_flota', req.params.id, payload);
        return ok(res, item || { id: req.params.id, ...payload });
      }
      throw mapSupabaseError(error, 'No fue posible actualizar la unidad.');
    }
    return ok(res, data);
  })
);

// =====================================================================
// CLASIFICACIONES DE VIAJE
// =====================================================================

router.get(
  '/clasificaciones',
  asyncHandler(async (req, res) => {
    const { data, error } = await supabase
      .from('choferes_clasificaciones_viaje')
      .select('*')
      .order('orden');

    if (error) {
      return ok(res, [
        { id: '1', nombre: 'Traslado VIP Escolta', orden: 1 },
        { id: '2', nombre: 'Comisión de Custodia y Vigilancia', orden: 2 },
        { id: '3', nombre: 'Ruta de Guardia Operativa', orden: 3 },
        { id: '4', nombre: 'Traslado Interurbano / Foráneo', orden: 4 },
      ]);
    }
    return ok(res, data ?? []);
  })
);

export default router;

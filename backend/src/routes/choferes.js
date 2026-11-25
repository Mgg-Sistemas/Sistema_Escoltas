import { Router } from 'express';
import { supabase } from '../lib/supabase.js';
import { ApiError, mapSupabaseError } from '../lib/errors.js';
import { asyncHandler, ok, created } from '../lib/http.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();

// Conductores
router.get(
  '/conductores',
  asyncHandler(async (req, res) => {
    const { data, error } = await supabase
      .from('choferes_conductores')
      .select('*')
      .order('nombre', { ascending: true });
    if (error) throw mapSupabaseError(error, 'Error al listar conductores');
    return ok(res, data ?? []);
  })
);

router.post(
  '/conductores',
  requireRole(['admin', 'supervisor']),
  asyncHandler(async (req, res) => {
    const { nombre, apellido, cedula, telefono, externo, empresa_externa, tarifa_viaje_usd, tarifa_corto_usd, tarifa_largo_usd, licencia_vence, certificado_medico_vence, seguro_vence } = req.body;
    if (!nombre?.trim()) throw new ApiError('El nombre es obligatorio', 'VALIDACION', 400);

    const { data, error } = await supabase
      .from('choferes_conductores')
      .insert({
        nombre: nombre.trim(),
        apellido: (apellido || '').trim(),
        cedula: cedula?.trim() || null,
        telefono: telefono?.trim() || null,
        externo: Boolean(externo),
        empresa_externa: empresa_externa?.trim() || null,
        tarifa_viaje_usd: Number(tarifa_viaje_usd) || 0,
        tarifa_corto_usd: Number(tarifa_corto_usd) || 0,
        tarifa_largo_usd: Number(tarifa_largo_usd) || 0,
        licencia_vence: licencia_vence || null,
        certificado_medico_vence: certificado_medico_vence || null,
        seguro_vence: seguro_vence || null,
      })
      .select()
      .single();

    if (error) throw mapSupabaseError(error, 'Error al crear conductor');
    return created(res, data);
  })
);

router.put(
  '/conductores/:id',
  requireRole(['admin', 'supervisor']),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('choferes_conductores')
      .update(req.body)
      .eq('id', id)
      .select()
      .single();
    if (error) throw mapSupabaseError(error, 'Error al actualizar conductor');
    return ok(res, data);
  })
);

router.patch(
  '/conductores/:id/activo',
  requireRole(['admin', 'supervisor']),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { activo } = req.body;
    const { data, error } = await supabase
      .from('choferes_conductores')
      .update({ activo: Boolean(activo) })
      .eq('id', id)
      .select()
      .single();
    if (error) throw mapSupabaseError(error, 'Error al cambiar estado de conductor');
    return ok(res, data);
  })
);

// Viajes
router.get(
  '/viajes',
  asyncHandler(async (req, res) => {
    const { data, error } = await supabase
      .from('choferes_viajes')
      .select('*, choferes_conductores(*)')
      .order('created_at', { ascending: false });
    if (error) throw mapSupabaseError(error, 'Error al listar viajes');
    return ok(res, data ?? []);
  })
);

router.post(
  '/viajes',
  requireRole(['admin', 'supervisor']),
  asyncHandler(async (req, res) => {
    const { conductor_id, conductor_nombre, vehiculo_placa, origen, destino, cliente, fecha_salida, categoria_viaje, viajes = 1, tarifa_usd = 0, observaciones } = req.body;
    if (!origen?.trim() || !destino?.trim()) throw new ApiError('Origen y destino son obligatorios', 'VALIDACION', 400);

    const numero = `VJ-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const cantViajes = Number(viajes) || 1;
    const tarifa = Number(tarifa_usd) || 0;
    const total = cantViajes * tarifa;

    const { data, error } = await supabase
      .from('choferes_viajes')
      .insert({
        numero,
        conductor_id: conductor_id || null,
        conductor_nombre: (conductor_nombre || 'Sin asignar').trim(),
        vehiculo_placa: vehiculo_placa?.trim() || null,
        origen: origen.trim(),
        destino: destino.trim(),
        cliente: cliente?.trim() || null,
        fecha_salida: fecha_salida || new Date().toISOString().split('T')[0],
        categoria_viaje: categoria_viaje || 'VIAJE CORTO',
        viajes: cantViajes,
        tarifa_usd: tarifa,
        monto_total_usd: total,
        observaciones: observaciones?.trim() || null,
        estado: 'programado',
      })
      .select()
      .single();

    if (error) throw mapSupabaseError(error, 'Error al registrar viaje');
    return created(res, data);
  })
);

router.patch(
  '/viajes/:id/estado',
  requireRole(['admin', 'supervisor']),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { estado } = req.body;
    const { data, error } = await supabase
      .from('choferes_viajes')
      .update({ estado })
      .eq('id', id)
      .select()
      .single();
    if (error) throw mapSupabaseError(error, 'Error al cambiar estado del viaje');
    return ok(res, data);
  })
);

// Viáticos
router.get(
  '/viaticos',
  asyncHandler(async (req, res) => {
    const { data, error } = await supabase
      .from('choferes_viaticos')
      .select('*')
      .order('fecha', { ascending: false });
    if (error) throw mapSupabaseError(error, 'Error al listar viáticos');
    return ok(res, data ?? []);
  })
);

router.post(
  '/viaticos',
  requireRole(['admin', 'supervisor', 'contador']),
  asyncHandler(async (req, res) => {
    const { conductor_id, viaje_id, concepto, monto_usd, tipo = 'anticipo', comprobante, fecha } = req.body;
    if (!conductor_id || !concepto?.trim() || !monto_usd) {
      throw new ApiError('Conductor, concepto y monto son obligatorios', 'VALIDACION', 400);
    }

    const { data, error } = await supabase
      .from('choferes_viaticos')
      .insert({
        conductor_id,
        viaje_id: viaje_id || null,
        concepto: concepto.trim(),
        monto_usd: Number(monto_usd),
        tipo,
        comprobante: comprobante?.trim() || null,
        fecha: fecha || new Date().toISOString().split('T')[0],
      })
      .select()
      .single();

    if (error) throw mapSupabaseError(error, 'Error al registrar viático');
    return created(res, data);
  })
);

// Pagos / Liquidación de viajes
router.get(
  '/pagos',
  asyncHandler(async (req, res) => {
    const { data, error } = await supabase
      .from('choferes_pagos')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw mapSupabaseError(error, 'Error al listar pagos');
    return ok(res, data ?? []);
  })
);

router.post(
  '/pagos',
  requireRole(['admin', 'contador']),
  asyncHandler(async (req, res) => {
    const { conductor_id, conductor_nombre, total_viajes, total_usd, metodo_pago, referencia } = req.body;
    const numero = `RV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const { data, error } = await supabase
      .from('choferes_pagos')
      .insert({
        numero,
        conductor_id,
        conductor_nombre,
        total_viajes: Number(total_viajes) || 0,
        total_usd: Number(total_usd) || 0,
        metodo_pago: metodo_pago || 'transferencia',
        referencia: referencia?.trim() || null,
        estado: 'pagado',
        fecha_pago: new Date().toISOString().split('T')[0],
      })
      .select()
      .single();

    if (error) throw mapSupabaseError(error, 'Error al registrar pago');
    return created(res, data);
  })
);

// Resumen Dashboard
router.get(
  '/resumen',
  asyncHandler(async (req, res) => {
    const [cRes, vRes] = await Promise.all([
      supabase.from('choferes_conductores').select('id, activo, externo'),
      supabase.from('choferes_viajes').select('id, estado, monto_total_usd, pagado_at'),
    ]);

    const conductores = cRes.data ?? [];
    const viajes = vRes.data ?? [];

    const totalConductores = conductores.length;
    const activos = conductores.filter((c) => c.activo).length;
    const enRuta = viajes.filter((v) => v.estado === 'en_ruta').length;
    const completados = viajes.filter((v) => v.estado === 'completado').length;
    const montoTotal = viajes.reduce((acc, v) => acc + (Number(v.monto_total_usd) || 0), 0);

    return ok(res, {
      totalConductores,
      activos,
      enRuta,
      completados,
      montoTotal,
    });
  })
);

export default router;

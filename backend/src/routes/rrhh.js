import { Router } from 'express';
import { supabase } from '../lib/supabase.js';
import { ApiError, mapSupabaseError } from '../lib/errors.js';
import { asyncHandler, ok, created } from '../lib/http.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();

// Personal
router.get(
  '/personal',
  asyncHandler(async (req, res) => {
    const { data, error } = await supabase
      .from('personal')
      .select('*')
      .order('nombre', { ascending: true });
    if (error) throw mapSupabaseError(error, 'Error al listar personal');
    return ok(res, data ?? []);
  })
);

router.post(
  '/personal',
  requireRole(['admin', 'rrhh']),
  asyncHandler(async (req, res) => {
    const { nombre, apellido, cedula, cargo, departamento, sueldo_base, telefono, correo, direccion, fecha_ingreso } = req.body;
    if (!nombre?.trim()) throw new ApiError('El nombre es obligatorio', 'VALIDACION', 400);

    const { data, error } = await supabase
      .from('personal')
      .insert({
        nombre: nombre.trim(),
        apellido: (apellido || '').trim(),
        cedula: cedula?.trim() || null,
        cargo: cargo?.trim() || null,
        departamento: departamento?.trim() || null,
        sueldo_base: Number(sueldo_base) || 0,
        telefono: telefono?.trim() || null,
        correo: correo?.trim() || null,
        direccion: direccion?.trim() || null,
        fecha_ingreso: fecha_ingreso || new Date().toISOString().split('T')[0],
      })
      .select()
      .single();

    if (error) throw mapSupabaseError(error, 'Error al registrar empleado');
    return created(res, data);
  })
);

router.put(
  '/personal/:id',
  requireRole(['admin', 'rrhh']),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('personal')
      .update(req.body)
      .eq('id', id)
      .select()
      .single();
    if (error) throw mapSupabaseError(error, 'Error al actualizar personal');
    return ok(res, data);
  })
);

router.patch(
  '/personal/:id/activo',
  requireRole(['admin', 'rrhh']),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { activo } = req.body;
    const { data, error } = await supabase
      .from('personal')
      .update({ activo: Boolean(activo) })
      .eq('id', id)
      .select()
      .single();
    if (error) throw mapSupabaseError(error, 'Error al cambiar estado');
    return ok(res, data);
  })
);

// Cargos
router.get(
  '/cargos',
  asyncHandler(async (req, res) => {
    const { data, error } = await supabase
      .from('cargos')
      .select('*')
      .order('nombre', { ascending: true });
    if (error) throw mapSupabaseError(error, 'Error al listar cargos');
    return ok(res, data ?? []);
  })
);

router.post(
  '/cargos',
  requireRole(['admin', 'rrhh']),
  asyncHandler(async (req, res) => {
    const { nombre, departamento, sueldo_sugerido } = req.body;
    if (!nombre?.trim()) throw new ApiError('El nombre del cargo es obligatorio', 'VALIDACION', 400);

    const { data, error } = await supabase
      .from('cargos')
      .insert({
        nombre: nombre.trim(),
        departamento: departamento?.trim() || null,
        sueldo_sugerido: Number(sueldo_sugerido) || 0,
      })
      .select()
      .single();

    if (error) throw mapSupabaseError(error, 'Error al crear cargo');
    return created(res, data);
  })
);

// Anticipos y Préstamos
router.get(
  '/anticipos',
  asyncHandler(async (req, res) => {
    const { data, error } = await supabase
      .from('anticipos_prestamos')
      .select('*, personal(id, nombre, apellido, cedula)')
      .order('created_at', { ascending: false });
    if (error) throw mapSupabaseError(error, 'Error al listar anticipos y préstamos');
    return ok(res, data ?? []);
  })
);

router.post(
  '/anticipos',
  requireRole(['admin', 'rrhh', 'contador']),
  asyncHandler(async (req, res) => {
    const { personal_id, tipo = 'anticipo', monto_total, cuota_sugerida, motivo } = req.body;
    if (!personal_id || !monto_total) throw new ApiError('Empleado y monto son obligatorios', 'VALIDACION', 400);

    const monto = Number(monto_total);
    const { data, error } = await supabase
      .from('anticipos_prestamos')
      .insert({
        personal_id,
        tipo,
        monto_total: monto,
        saldo: monto,
        cuota_sugerida: Number(cuota_sugerida) || 0,
        motivo: motivo?.trim() || null,
        estado: 'activo',
      })
      .select()
      .single();

    if (error) throw mapSupabaseError(error, 'Error al registrar anticipo o préstamo');
    return created(res, data);
  })
);

router.patch(
  '/anticipos/:id/abonar',
  requireRole(['admin', 'rrhh', 'contador']),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { monto_abono } = req.body;
    const abono = Number(monto_abono);
    if (!abono || abono <= 0) throw new ApiError('El monto a abonar debe ser mayor a 0', 'VALIDACION', 400);

    const { data: ant, error: errAnt } = await supabase
      .from('anticipos_prestamos')
      .select('*')
      .eq('id', id)
      .single();

    if (errAnt || !ant) throw new ApiError('Registro no encontrado', 'NO_ENCONTRADO', 404);

    const nuevoSaldo = Math.max(0, Number(ant.saldo) - abono);
    const nuevoEstado = nuevoSaldo === 0 ? 'saldado' : 'activo';

    const { data, error } = await supabase
      .from('anticipos_prestamos')
      .update({ saldo: nuevoSaldo, estado: nuevoEstado })
      .eq('id', id)
      .select()
      .single();

    if (error) throw mapSupabaseError(error, 'Error al registrar abono');
    return ok(res, data);
  })
);

// Eventos / Permisos laborales / Vacaciones
router.get(
  '/eventos',
  asyncHandler(async (req, res) => {
    const { data, error } = await supabase
      .from('rrhh_eventos')
      .select('*, personal(id, nombre, apellido, cedula)')
      .order('fecha_inicio', { ascending: false });
    if (error) throw mapSupabaseError(error, 'Error al listar eventos de RRHH');
    return ok(res, data ?? []);
  })
);

router.post(
  '/eventos',
  requireRole(['admin', 'rrhh']),
  asyncHandler(async (req, res) => {
    const { personal_id, tipo = 'permiso', fecha_inicio, fecha_fin, dias = 1, remunerado = true, descripcion } = req.body;
    if (!personal_id || !fecha_inicio || !fecha_fin) {
      throw new ApiError('Empleado y fechas son obligatorios', 'VALIDACION', 400);
    }

    const { data, error } = await supabase
      .from('rrhh_eventos')
      .insert({
        personal_id,
        tipo,
        fecha_inicio,
        fecha_fin,
        dias: Number(dias) || 1,
        remunerado: Boolean(remunerado),
        descripcion: descripcion?.trim() || null,
        estado: 'aprobado',
      })
      .select()
      .single();

    if (error) throw mapSupabaseError(error, 'Error al registrar evento');
    return created(res, data);
  })
);

export default router;

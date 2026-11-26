import { Router } from 'express';
import { supabase } from '../lib/supabase.js';
import { audit } from '../lib/audit.js';
import { ApiError, mapSupabaseError, noEncontrado } from '../lib/errors.js';
import { asyncHandler, ok, creado, sinContenido } from '../lib/http.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();

// =====================================================================
// PERSONAL (FICHAS RRHH)
// =====================================================================

/** Listar personal con filtros de empresa, estado activo y búsqueda */
router.get(
  '/personal',
  asyncHandler(async (req, res) => {
    const { empresa, activo, q } = req.query;

    let query = supabase
      .from('personal')
      .select('*')
      .order('ficha_nro', { ascending: true, nullsFirst: false })
      .order('apellido', { ascending: true });

    if (empresa) query = query.eq('empresa', empresa);
    if (activo !== undefined && activo !== '') query = query.eq('activo', activo === 'true');
    if (q) {
      query = query.or(
        `nombre.ilike.%${q}%,apellido.ilike.%${q}%,cedula.ilike.%${q}%,ficha_nro.ilike.%${q}%,cargo.ilike.%${q}%`
      );
    }

    const { data, error } = await query;
    if (error) throw mapSupabaseError(error, 'No fue posible listar el personal.');

    return ok(res, data ?? []);
  })
);

/** Obtener ficha individual de personal */
router.get(
  '/personal/:id',
  asyncHandler(async (req, res) => {
    const { data, error } = await supabase
      .from('personal')
      .select('*, sueldos:personal_sueldos(*), cargos:personal_cargos(*), documentos:personal_documentos(*), familiares:personal_familiares(*)')
      .eq('id', req.params.id)
      .single();

    if (error?.code === 'PGRST116') throw noEncontrado('Personal no encontrado.');
    if (error) throw mapSupabaseError(error, 'No fue posible consultar la ficha de personal.');

    return ok(res, data);
  })
);

/** Crear nuevo registro de personal */
router.post(
  '/personal',
  requireRole('admin', 'supervisor', 'contador'),
  asyncHandler(async (req, res) => {
    const payload = { ...req.body };
    delete payload.id;
    delete payload.created_at;
    delete payload.updated_at;

    const { data, error } = await supabase
      .from('personal')
      .insert(payload)
      .select('*')
      .single();

    if (error) throw mapSupabaseError(error, 'No fue posible crear la ficha de personal.');

    await audit({
      tabla: 'personal',
      operacion: 'INSERT',
      registro_id: data.id,
      cambios: { nombre: data.nombre, apellido: data.apellido, cedula: data.cedula },
      usuario_id: req.user.id,
    });

    return creado(res, data);
  })
);

/** Actualizar ficha de personal */
router.put(
  '/personal/:id',
  requireRole('admin', 'supervisor', 'contador'),
  asyncHandler(async (req, res) => {
    const payload = { ...req.body };
    delete payload.id;
    delete payload.created_at;
    payload.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('personal')
      .update(payload)
      .eq('id', req.params.id)
      .select('*')
      .single();

    if (error) throw mapSupabaseError(error, 'No fue posible actualizar la ficha de personal.');

    await audit({
      tabla: 'personal',
      operacion: 'UPDATE',
      registro_id: data.id,
      cambios: payload,
      usuario_id: req.user.id,
    });

    return ok(res, data);
  })
);

/** Cambio de sueldo con registro histórico obligatorio */
router.post(
  '/personal/:id/sueldo',
  requireRole('admin', 'contador'),
  asyncHandler(async (req, res) => {
    const { nuevo_sueldo, motivo, moneda = 'USD', fecha_efectiva } = req.body;
    if (!nuevo_sueldo || Number(nuevo_sueldo) <= 0) {
      throw new ApiError(400, 'El nuevo sueldo debe ser mayor a 0.');
    }
    if (!motivo) {
      throw new ApiError(400, 'Debe especificar el motivo del cambio de sueldo.');
    }

    const { data: anterior, error: errAnt } = await supabase
      .from('personal')
      .select('sueldo_base, moneda_sueldo')
      .eq('id', req.params.id)
      .single();

    if (errAnt) throw mapSupabaseError(errAnt, 'No fue posible consultar el sueldo actual.');

    const { error: errUpdate } = await supabase
      .from('personal')
      .update({
        sueldo_base: nuevo_sueldo,
        moneda_sueldo: moneda,
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id);

    if (errUpdate) throw mapSupabaseError(errUpdate, 'No fue posible actualizar el sueldo.');

    const { data: hist, error: errHist } = await supabase
      .from('personal_sueldos')
      .insert({
        personal_id: req.params.id,
        sueldo_anterior: anterior.sueldo_base || 0,
        sueldo_nuevo: nuevo_sueldo,
        moneda,
        motivo,
        fecha_efectiva: fecha_efectiva || new Date().toISOString().split('T')[0],
        creado_por: req.user.id,
        actor_name: req.user.nombre_completo,
      })
      .select('*')
      .single();

    if (errHist) throw mapSupabaseError(errHist, 'No fue posible registrar el histórico salarial.');

    return ok(res, hist);
  })
);

/** Cambio de cargo o departamento con registro histórico */
router.post(
  '/personal/:id/cargo',
  requireRole('admin', 'supervisor'),
  asyncHandler(async (req, res) => {
    const { nuevo_cargo, nuevo_departamento, motivo } = req.body;
    if (!nuevo_cargo) throw new ApiError(400, 'Debe especificar el nuevo cargo.');

    const { data: anterior, error: errAnt } = await supabase
      .from('personal')
      .select('cargo, departamento')
      .eq('id', req.params.id)
      .single();

    if (errAnt) throw mapSupabaseError(errAnt, 'No fue posible consultar el cargo actual.');

    const { error: errUpdate } = await supabase
      .from('personal')
      .update({
        cargo: nuevo_cargo,
        departamento: nuevo_departamento || anterior.departamento,
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id);

    if (errUpdate) throw mapSupabaseError(errUpdate, 'No fue posible actualizar el cargo.');

    const { data: hist, error: errHist } = await supabase
      .from('personal_cargos')
      .insert({
        personal_id: req.params.id,
        cargo_anterior: anterior.cargo,
        cargo_nuevo: nuevo_cargo,
        departamento_anterior: anterior.departamento,
        departamento_nuevo: nuevo_departamento || anterior.departamento,
        motivo: motivo || 'Cambio organizacional',
        creado_por: req.user.id,
      })
      .select('*')
      .single();

    if (errHist) throw mapSupabaseError(errHist, 'No fue posible registrar el histórico de cargo.');

    return ok(res, hist);
  })
);

// =====================================================================
// ANTICIPOS Y PRÉSTAMOS
// =====================================================================

router.get(
  '/anticipos',
  asyncHandler(async (req, res) => {
    const { personal_id, estado } = req.query;
    let query = supabase
      .from('anticipos_prestamos')
      .select('*, personal:personal(id, nombre, apellido, cedula, ficha_nro, empresa)')
      .order('created_at', { ascending: false });

    if (personal_id) query = query.eq('personal_id', personal_id);
    if (estado) query = query.eq('estado', estado);

    const { data, error } = await query;
    if (error) throw mapSupabaseError(error, 'No fue posible listar los anticipos.');

    return ok(res, data ?? []);
  })
);

router.post(
  '/anticipos',
  requireRole('admin', 'contador'),
  asyncHandler(async (req, res) => {
    const { personal_id, tipo = 'anticipo', monto_total, cuotas = 1, motivo } = req.body;
    if (!personal_id || !monto_total || Number(monto_total) <= 0) {
      throw new ApiError(400, 'Personal y monto válido son obligatorios.');
    }

    const nCuotas = Math.max(1, parseInt(cuotas, 10));
    const montoCuota = Number((Number(monto_total) / nCuotas).toFixed(2));

    const { data, error } = await supabase
      .from('anticipos_prestamos')
      .insert({
        personal_id,
        tipo,
        monto_total,
        cuotas: nCuotas,
        monto_cuota: montoCuota,
        saldo_pendiente: monto_total,
        motivo,
        estado: 'activo',
        moneda: 'USD',
      })
      .select('*')
      .single();

    if (error) throw mapSupabaseError(error, 'No fue posible registrar el anticipo/préstamo.');

    return creado(res, data);
  })
);

// =====================================================================
// EMPRESAS, TABULADOR, DESCANSOS Y MINUTAS
// =====================================================================

router.get(
  '/empresas',
  asyncHandler(async (req, res) => {
    const { data, error } = await supabase
      .from('rrhh_empresas')
      .select('*')
      .order('codigo');

    if (error) throw mapSupabaseError(error, 'No fue posible listar las empresas.');
    return ok(res, data ?? []);
  })
);

router.get(
  '/tabulador',
  asyncHandler(async (req, res) => {
    const { data, error } = await supabase
      .from('rrhh_tabulador')
      .select('*')
      .order('cargo')
      .order('nivel');

    if (error) throw mapSupabaseError(error, 'No fue posible consultar el tabulador.');
    return ok(res, data ?? []);
  })
);

router.post(
  '/tabulador',
  requireRole('admin', 'contador'),
  asyncHandler(async (req, res) => {
    const { cargo, nivel = 'I', sueldo_base, moneda = 'USD' } = req.body;
    const { data, error } = await supabase
      .from('rrhh_tabulador')
      .upsert({ cargo, nivel, sueldo_base, moneda, vigencia_desde: new Date().toISOString().split('T')[0] })
      .select('*')
      .single();

    if (error) throw mapSupabaseError(error, 'No fue posible guardar en tabulador.');
    return ok(res, data);
  })
);

router.get(
  '/minutas',
  asyncHandler(async (req, res) => {
    const { data, error } = await supabase
      .from('minutas')
      .select('*')
      .order('fecha', { ascending: false });

    if (error) throw mapSupabaseError(error, 'No fue posible listar las minutas.');
    return ok(res, data ?? []);
  })
);

router.post(
  '/minutas',
  requireRole('admin', 'supervisor'),
  asyncHandler(async (req, res) => {
    const { fecha, turno, temas = [], acuerdos = [], avances = [], observaciones } = req.body;
    const correlativo = `MIN-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;

    const { data, error } = await supabase
      .from('minutas')
      .insert({
        correlativo,
        fecha: fecha || new Date().toISOString().split('T')[0],
        turno: turno || 'Diurno',
        supervisor_id: req.user.id,
        supervisor_nombre: req.user.nombre_completo,
        temas,
        acuerdos,
        avances,
        observaciones,
      })
      .select('*')
      .single();

    if (error) throw mapSupabaseError(error, 'No fue posible registrar la minuta.');
    return creado(res, data);
  })
);

export default router;

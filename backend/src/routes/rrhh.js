import { Router } from 'express';
import { supabase } from '../lib/supabase.js';
import { audit } from '../lib/audit.js';
import { ApiError, mapSupabaseError, noEncontrado } from '../lib/errors.js';
import { asyncHandler, ok, creado, sinContenido } from '../lib/http.js';
import { esquemaFichaPersonalCrear, esquemaFichaPersonalActualizar } from '../schemas.js';
import { validate } from '../middleware/validate.js';
import { requireRole } from '../middleware/auth.js';
import { modulosStore } from '../lib/modulosStore.js';

const router = Router();
router.use(requireRole('admin', 'supervisor', 'contador', 'rrhh'));

// =====================================================================
// PERSONAL (FICHAS RRHH - ESCOLTAS Y SEGURIDAD)
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
    if (error) {
      if (modulosStore.esErrorTablaInexistente(error)) {
        let locales = modulosStore.listar('personal');
        if (locales.length === 0) {
          // Traer escoltas de la tabla escoltas para que ya aparezcan con ficha de personal
          try {
            const { data: escoltas } = await supabase.from('escoltas').select('*');
            if (escoltas?.length) {
              locales = escoltas.map((esc) => ({
                id: esc.id,
                nombre: esc.nombres || 'Escolta',
                apellido: esc.apellidos || '',
                cedula: esc.cedula || 'V-0000000',
                ficha_nro: esc.codigo || `ESC-${esc.id.slice(0, 4)}`,
                cargo: 'Escolta de Seguridad',
                departamento: 'Operaciones',
                empresa: 'Golden Touch 1127 CA',
                sueldo_base: 350,
                moneda_sueldo: 'USD',
                activo: esc.estado === 'activo',
                telefono: esc.telefono || '',
                direccion: esc.direccion || '',
              }));
            }
          } catch {}
        }
        return ok(res, locales);
      }
      throw mapSupabaseError(error, 'No fue posible listar el personal.');
    }

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

    if (error) {
      if (modulosStore.esErrorTablaInexistente(error)) {
        const local = modulosStore.obtenerPorId('personal', req.params.id);
        if (!local) throw noEncontrado('Personal no encontrado.');
        return ok(res, { ...local, sueldos: [], cargos: [], documentos: [], familiares: [] });
      }
      if (error?.code === 'PGRST116') throw noEncontrado('Personal no encontrado.');
      throw mapSupabaseError(error, 'No fue posible consultar la ficha de personal.');
    }

    return ok(res, data);
  })
);

/** Crear nuevo registro de personal */
router.post(
  '/personal',
  requireRole('admin', 'supervisor', 'contador'),
  validate(esquemaFichaPersonalCrear),
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

    if (error) {
      if (modulosStore.esErrorTablaInexistente(error)) {
        const nuevo = modulosStore.insertar('personal', payload);
        return creado(res, nuevo);
      }
      throw mapSupabaseError(error, 'No fue posible crear la ficha de personal.');
    }

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
  validate(esquemaFichaPersonalActualizar),
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

    if (error) {
      if (modulosStore.esErrorTablaInexistente(error)) {
        const actualizado = modulosStore.actualizar('personal', req.params.id, payload);
        return ok(res, actualizado || { id: req.params.id, ...payload });
      }
      throw mapSupabaseError(error, 'No fue posible actualizar la ficha de personal.');
    }

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

/** Cambio de sueldo con registro histórico */
router.post(
  '/personal/:id/sueldo',
  requireRole('admin', 'contador'),
  asyncHandler(async (req, res) => {
    const { nuevo_sueldo, motivo, moneda = 'USD', fecha_efectiva } = req.body;
    if (!Number.isFinite(Number(nuevo_sueldo)) || Number(nuevo_sueldo) <= 0 || Number(nuevo_sueldo) > 1_000_000_000) {
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

    if (errAnt && !modulosStore.esErrorTablaInexistente(errAnt)) {
      throw mapSupabaseError(errAnt, 'No fue posible consultar el sueldo actual.');
    }

    const { error: errUpdate } = await supabase
      .from('personal')
      .update({
        sueldo_base: nuevo_sueldo,
        moneda_sueldo: moneda,
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id);

    if (errUpdate && !modulosStore.esErrorTablaInexistente(errUpdate)) {
      throw mapSupabaseError(errUpdate, 'No fue posible actualizar el sueldo.');
    }

    const regHist = {
      id: `sueldo-${Date.now()}`,
      personal_id: req.params.id,
      sueldo_anterior: anterior?.sueldo_base || 0,
      sueldo_nuevo: nuevo_sueldo,
      moneda,
      motivo,
      fecha_efectiva: fecha_efectiva || new Date().toISOString().split('T')[0],
      creado_por: req.user.id,
      actor_name: req.user.full_name || req.user.email || 'Sistema',
    };

    const { data: hist, error: errHist } = await supabase
      .from('personal_sueldos')
      .insert(regHist)
      .select('*')
      .single();

    if (errHist) {
      if (modulosStore.esErrorTablaInexistente(errHist)) {
        modulosStore.actualizar('personal', req.params.id, { sueldo_base: nuevo_sueldo, moneda_sueldo: moneda });
        return ok(res, regHist);
      }
      throw mapSupabaseError(errHist, 'No fue posible registrar el histórico salarial.');
    }

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

    if (errAnt && !modulosStore.esErrorTablaInexistente(errAnt)) {
      throw mapSupabaseError(errAnt, 'No fue posible consultar el cargo actual.');
    }

    const { error: errUpdate } = await supabase
      .from('personal')
      .update({
        cargo: nuevo_cargo,
        departamento: nuevo_departamento || anterior?.departamento || 'Operaciones',
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id);

    if (errUpdate && !modulosStore.esErrorTablaInexistente(errUpdate)) {
      throw mapSupabaseError(errUpdate, 'No fue posible actualizar el cargo.');
    }

    const regCargo = {
      id: `cargo-${Date.now()}`,
      personal_id: req.params.id,
      cargo_anterior: anterior?.cargo || 'Escolta',
      cargo_nuevo: nuevo_cargo,
      departamento_anterior: anterior?.departamento || 'Operaciones',
      departamento_nuevo: nuevo_departamento || anterior?.departamento || 'Operaciones',
      motivo: motivo || 'Cambio organizacional',
      creado_por: req.user.id,
    };

    const { data: hist, error: errHist } = await supabase
      .from('personal_cargos')
      .insert(regCargo)
      .select('*')
      .single();

    if (errHist) {
      if (modulosStore.esErrorTablaInexistente(errHist)) {
        modulosStore.actualizar('personal', req.params.id, { cargo: nuevo_cargo, departamento: nuevo_departamento });
        return ok(res, regCargo);
      }
      throw mapSupabaseError(errHist, 'No fue posible registrar el histórico de cargo.');
    }

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
    if (error) {
      if (modulosStore.esErrorTablaInexistente(error)) {
        return ok(res, modulosStore.listar('anticipos_prestamos'));
      }
      throw mapSupabaseError(error, 'No fue posible listar los anticipos.');
    }

    return ok(res, data ?? []);
  })
);

router.post(
  '/anticipos',
  requireRole('admin', 'contador'),
  asyncHandler(async (req, res) => {
    const { personal_id, tipo = 'anticipo', monto_total, cuotas = 1, motivo } = req.body;
    if (!personal_id || !Number.isFinite(Number(monto_total)) || Number(monto_total) <= 0 || Number(monto_total) > 1_000_000_000) {
      throw new ApiError(400, 'Personal y monto válido son obligatorios.');
    }

    const nCuotas = Number(cuotas);
    if (!Number.isInteger(nCuotas) || nCuotas < 1 || nCuotas > 120) {
      throw new ApiError(400, 'El número de cuotas debe estar entre 1 y 120.');
    }
    const montoCuota = Number((Number(monto_total) / nCuotas).toFixed(2));

    const nuevoAnticipo = {
      personal_id,
      tipo,
      monto_total: Number(monto_total),
      cuotas: nCuotas,
      monto_cuota: montoCuota,
      saldo_pendiente: Number(monto_total),
      motivo: motivo || 'Anticipo solicitado',
      estado: 'activo',
      moneda: 'USD',
    };

    const { data, error } = await supabase
      .from('anticipos_prestamos')
      .insert(nuevoAnticipo)
      .select('*')
      .single();

    if (error) {
      if (modulosStore.esErrorTablaInexistente(error)) {
        const item = modulosStore.insertar('anticipos_prestamos', nuevoAnticipo);
        return creado(res, item);
      }
      throw mapSupabaseError(error, 'No fue posible registrar el anticipo/préstamo.');
    }

    return creado(res, data);
  })
);

// =====================================================================
// EMPRESAS, TABULADOR Y DESCANSOS
// =====================================================================

router.get(
  '/empresas',
  asyncHandler(async (req, res) => {
    const { data, error } = await supabase
      .from('rrhh_empresas')
      .select('*')
      .order('codigo');

    if (error) {
      if (modulosStore.esErrorTablaInexistente(error)) {
        return ok(res, modulosStore.listar('rrhh_empresas'));
      }
      throw mapSupabaseError(error, 'No fue posible listar las empresas.');
    }
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

    if (error) {
      if (modulosStore.esErrorTablaInexistente(error)) {
        return ok(res, modulosStore.listar('rrhh_tabulador'));
      }
      throw mapSupabaseError(error, 'No fue posible consultar el tabulador.');
    }
    return ok(res, data ?? []);
  })
);

router.post(
  '/tabulador',
  requireRole('admin', 'contador'),
  asyncHandler(async (req, res) => {
    const { cargo, nivel = 'I', sueldo_base, moneda = 'USD' } = req.body;
    const registro = {
      cargo,
      nivel,
      sueldo_base: Number(sueldo_base),
      moneda,
      vigencia_desde: new Date().toISOString().split('T')[0],
    };

    const { data, error } = await supabase
      .from('rrhh_tabulador')
      .upsert(registro)
      .select('*')
      .single();

    if (error) {
      if (modulosStore.esErrorTablaInexistente(error)) {
        const item = modulosStore.insertar('rrhh_tabulador', registro);
        return ok(res, item);
      }
      throw mapSupabaseError(error, 'No fue posible guardar en tabulador.');
    }
    return ok(res, data);
  })
);

export default router;

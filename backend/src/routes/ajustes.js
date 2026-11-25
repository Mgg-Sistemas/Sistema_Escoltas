import { Router } from 'express';
import { supabase } from '../lib/supabase.js';
import { audit } from '../lib/audit.js';
import { mapSupabaseError } from '../lib/errors.js';
import { asyncHandler, ok } from '../lib/http.js';
import { requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { esquemaAjustesActualizar } from '../schemas.js';

const router = Router();

/** Lectura: cualquier usuario autenticado ve los ajustes públicos. */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    let consulta = supabase
      .from('ajustes_sistema')
      .select('id,clave,valor,descripcion,categoria,tipo,publico,editable,updated_at')
      .order('categoria', { ascending: true })
      .order('clave', { ascending: true });

    if (req.user.role !== 'admin') consulta = consulta.eq('publico', true);

    const { data, error } = await consulta;
    if (error) throw mapSupabaseError(error, 'No fue posible consultar los ajustes.');
    return ok(res, data ?? []);
  }),
);

/** Escritura: solo administrador y solo ajustes marcados como editables. */
router.patch(
  '/',
  requireRole('admin'),
  validate(esquemaAjustesActualizar),
  asyncHandler(async (req, res) => {
    const cambios = req.body.cambios;
    const claves = cambios.map((item) => item.clave);

    const { data: existentes, error: consultaError } = await supabase
      .from('ajustes_sistema')
      .select('id,clave,editable')
      .in('clave', claves);
    if (consultaError) throw mapSupabaseError(consultaError, 'No fue posible validar los ajustes.');

    const porClave = new Map((existentes ?? []).map((item) => [item.clave, item]));
    const noEditables = cambios.filter((item) => {
      const actual = porClave.get(item.clave);
      return !actual || actual.editable === false;
    });
    if (noEditables.length > 0) {
      throw mapSupabaseError(
        { code: '42501', message: 'Uno o más ajustes no existen o no se pueden modificar.' },
        'No fue posible guardar los ajustes.',
      );
    }

    for (const item of cambios) {
      const { error } = await supabase
        .from('ajustes_sistema')
        .update({ valor: item.valor ?? '', updated_by: req.user.id })
        .eq('clave', item.clave);
      if (error) throw mapSupabaseError(error, `No fue posible guardar el ajuste ${item.clave}.`);
    }

    await audit({
      tabla: 'ajustes_sistema',
      operacion: 'UPDATE',
      registro_id: porClave.get(cambios[0].clave).id,
      cambios: Object.fromEntries(cambios.map((item) => [item.clave, item.valor ?? ''])),
      usuario_id: req.user.id,
    });

    return ok(res, { guardados: claves.length });
  }),
);

export default router;

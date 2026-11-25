import { Router } from 'express';
import { supabase } from '../lib/supabase.js';
import { requireRole } from '../middleware/auth.js';
import { asyncHandler, ok } from '../lib/http.js';
import { mapSupabaseError } from '../lib/errors.js';
import { applyFilters } from '../lib/query.js';

const router = Router();

router.get(
  '/',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const limite = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 100, 1), 500);
    const desplazamiento = Math.max(Number.parseInt(req.query.offset, 10) || 0, 0);

    let consulta = supabase.from('auditoria').select('*', { count: 'exact' });
    consulta = applyFilters(consulta, req.query, {
      tabla: { tipo: 'ilike' },
      operacion: { tipo: 'eq' },
      registro_id: { tipo: 'eq' },
      usuario_id: { tipo: 'eq' },
      fecha_desde: { tipo: 'gte', columna: 'created_at' },
      fecha_hasta: { tipo: 'lte', columna: 'created_at' },
    });
    consulta = consulta.order('id', { ascending: false }).range(desplazamiento, desplazamiento + limite - 1);

    const { data, error, count } = await consulta;
    if (error) throw mapSupabaseError(error, 'No fue posible consultar la auditoría.');

    return ok(res, data, count ?? data.length);
  })
);

export default router;

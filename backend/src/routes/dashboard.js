import { Router } from 'express';
import { supabase } from '../lib/supabase.js';
import { requireRole } from '../middleware/auth.js';
import { asyncHandler, ok } from '../lib/http.js';
import { mapSupabaseError } from '../lib/errors.js';

const router = Router();

async function contar(tabla, filtros) {
  let consulta = supabase.from(tabla).select('id', { count: 'exact', head: true });
  for (const [columna, valor] of Object.entries(filtros)) consulta = consulta.eq(columna, valor);

  const { count, error } = await consulta;
  if (error) throw mapSupabaseError(error, `No fue posible contar los registros de ${tabla}.`);
  return count ?? 0;
}

router.get(
  '/resumen',
  requireRole('admin', 'supervisor', 'contador'),
  asyncHandler(async (req, res) => {
    const [escoltasActivos, asignacionesActivas, permisosPendientes, periodo] = await Promise.all([
      contar('escoltas', { estado: 'activo' }),
      contar('asignaciones', { estado: 'activa' }),
      contar('permisos', { estado: 'pendiente' }),
      supabase
        .from('periodos_nomina')
        .select('id, nombre, fecha_inicio, fecha_fin, estado')
        .eq('estado', 'abierto')
        .maybeSingle(),
    ]);

    if (periodo.error) {
      throw mapSupabaseError(periodo.error, 'No fue posible consultar el periodo de nómina abierto.');
    }

    let totalNomina = 0;
    if (periodo.data?.id) {
      const { data: detalles, error: errorDetalles } = await supabase
        .from('nomina_detalles')
        .select('total')
        .eq('periodo_id', periodo.data.id);

      if (errorDetalles) throw mapSupabaseError(errorDetalles, 'No fue posible calcular el total de la nómina.');
      totalNomina = detalles.reduce((suma, detalle) => suma + Number(detalle.total ?? 0), 0);
    }

    return ok(res, {
      escoltas_activos: escoltasActivos,
      asignaciones_activas: asignacionesActivas,
      permisos_pendientes: permisosPendientes,
      periodo_abierto: periodo.data ?? null,
      total_nomina_periodo: Number(totalNomina.toFixed(2)),
    });
  })
);

export default router;

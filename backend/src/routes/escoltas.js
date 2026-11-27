import { Router } from 'express';
import { supabase } from '../lib/supabase.js';
import { audit } from '../lib/audit.js';
import { ApiError, mapSupabaseError } from '../lib/errors.js';
import { asyncHandler, ok } from '../lib/http.js';
import { requireRole } from '../middleware/auth.js';
import { crearRouterCrud } from '../lib/crud.js';
import {
  esquemaEscoltaCrear,
  esquemaEscoltaActualizar,
} from '../schemas.js';

const routerCrud = crearRouterCrud({
  tabla: 'escoltas',
  esquemaCrear: esquemaEscoltaCrear,
  esquemaActualizar: esquemaEscoltaActualizar,
  filtros: {
    user_id: { tipo: 'eq' },
    codigo: { tipo: 'ilike' },
    nombres: { tipo: 'ilike' },
    apellidos: { tipo: 'ilike' },
    cedula: { tipo: 'ilike' },
    telefono: { tipo: 'ilike' },
    grado_id: { tipo: 'eq' },
    estado: { tipo: 'eq' },
    fecha_ingreso_desde: { tipo: 'gte', columna: 'fecha_ingreso' },
    fecha_ingreso_hasta: { tipo: 'lte', columna: 'fecha_ingreso' },
  },
  busqueda: ['codigo', 'nombres', 'apellidos', 'cedula', 'telefono'],
  orden: {
    columna: 'codigo',
    ascendente: true,
    permitidas: ['codigo', 'nombres', 'apellidos', 'fecha_ingreso', 'estado'],
  },
  rolesLeer: ['admin', 'supervisor', 'contador'],
  rolesEscritura: ['admin'],
});

const router = Router();

// Endpoint seguro atómico para vaciado de papelera protegiendo historial en el backend
router.post(
  '/vaciar-papelera',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    // 1. Obtener registros marcados en papelera
    const { data: candidatos, error: errCandidatos } = await supabase
      .from('escoltas')
      .select('id, codigo, nombres, apellidos, notas')
      .ilike('notas', '%[PAPELERA:true]%');

    if (errCandidatos) throw mapSupabaseError(errCandidatos, 'Error consultando papelera.');

    let purgados = 0;
    let protegidos = 0;
    const idsPurgados = [];

    for (const item of candidatos || []) {
      // 2. Verificar todas las dependencias foráneas de forma estricta
      const [asig, nom, asis, perm, pag] = await Promise.all([
        supabase.from('asignaciones').select('id').eq('escolta_id', item.id).limit(1),
        supabase.from('nomina_detalles').select('id').eq('escolta_id', item.id).limit(1),
        supabase.from('asistencias').select('id').eq('escolta_id', item.id).limit(1),
        supabase.from('permisos').select('id').eq('escolta_id', item.id).limit(1),
        supabase.from('pagos').select('id').eq('escolta_id', item.id).limit(1),
      ]);

      const tieneDependencias =
        (asig.data && asig.data.length > 0) ||
        (nom.data && nom.data.length > 0) ||
        (asis.data && asis.data.length > 0) ||
        (perm.data && perm.data.length > 0) ||
        (pag.data && pag.data.length > 0) ||
        asig.error || nom.error || asis.error || perm.error || pag.error; // Fail-safe si hay error

      if (tieneDependencias) {
        protegidos++;
        continue;
      }

      // Eliminar de forma segura
      const { error: errDel } = await supabase.from('escoltas').delete().eq('id', item.id);
      if (!errDel) {
        purgados++;
        idsPurgados.push(item.id);
      } else {
        protegidos++;
      }
    }

    if (purgados > 0) {
      await audit({
        tabla: 'escoltas',
        operacion: 'DELETE_PAPELERA_BATCH',
        registro_id: req.user.id,
        cambios: { purgados, protegidos, ids: idsPurgados },
        usuario_id: req.user.id,
      });
    }

    return ok(res, {
      mensaje: `Papelera procesada: ${purgados} purgado(s), ${protegidos} protegido(s) por historial laboral/financiero.`,
      purgados,
      protegidos,
    });
  }),
);

// Montar router CRUD
router.use('/', routerCrud);

export default router;

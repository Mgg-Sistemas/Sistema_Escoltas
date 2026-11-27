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
const PREFIJO_CATEGORIA = 'personal.categoria.';
const CATEGORIAS_RESERVADAS = new Set([
  'todos', 'escolta', 'escolta-vip', 'seguridad', 'seguridad-y-vigilancia', 'chofer', 'choferes-de-seguridad',
]);

router.get('/categorias', asyncHandler(async (req, res) => {
  const { data, error } = await supabase.from('ajustes_sistema')
    .select('clave,valor').like('clave', PREFIJO_CATEGORIA + '%').order('valor');
  if (error) throw mapSupabaseError(error, 'No fue posible consultar las categorías.');
  return ok(res, (data ?? []).map(({ clave, valor }) => ({
    id: clave.slice(PREFIJO_CATEGORIA.length), label: valor,
  })));
}));

router.post('/categorias', requireRole('admin'), asyncHandler(async (req, res) => {
  const nombre = typeof req.body?.nombre === 'string' ? req.body.nombre.trim().replace(/\s+/g, ' ') : '';
  if (!nombre || nombre.length > 60 || !/^[\p{L}\p{M}0-9 /-]+$/u.test(nombre)) {
    throw new ApiError(400, 'Escribe un nombre de hasta 60 caracteres para la categoría.', 'VALIDACION');
  }
  const id = nombre.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (!id) throw new ApiError(400, 'El nombre necesita al menos una letra o un número.', 'VALIDACION');
  if (CATEGORIAS_RESERVADAS.has(id)) {
    throw new ApiError(409, 'Ya existe una categoría con ese nombre.', 'CONFLICTO');
  }
  const { error } = await supabase.from('ajustes_sistema').insert({
    clave: PREFIJO_CATEGORIA + id,
    valor: nombre,
    categoria: 'categorias_personal',
    tipo: 'texto',
    publico: false,
    editable: false,
    updated_by: req.user.id,
  });
  if (error?.code === '23505') throw new ApiError(409, 'Ya existe una categoría con ese nombre.', 'CONFLICTO');
  if (error) throw mapSupabaseError(error, 'No fue posible crear la categoría.');
  return res.status(201).json({ ok: true, data: { id, label: nombre } });
}));

// Endpoint seguro atómico para vaciado de papelera protegiendo historial en el backend
router.post(
  '/vaciar-papelera',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    // 1. Intentar primero mediante la función atómica en PostgreSQL si está disponible
    try {
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('vaciar_papelera_escoltas', {
        p_actor_id: req.user.id,
      });
      if (!rpcErr && rpcRes && typeof rpcRes.purgados === 'number') {
        if (rpcRes.purgados > 0) {
          await audit({
            tabla: 'escoltas',
            operacion: 'DELETE_PAPELERA_BATCH',
            registro_id: req.user.id,
            cambios: rpcRes,
            usuario_id: req.user.id,
          });
        }
        return ok(res, {
          mensaje: `Papelera procesada: ${rpcRes.purgados} purgado(s), ${rpcRes.protegidos} protegido(s) por historial laboral/financiero.`,
          purgados: rpcRes.purgados,
          protegidos: rpcRes.protegidos,
        });
      }
    } catch {}

    // 2. Fallback de protección estricta en el servidor
    const { data: candidatos, error: errCandidatos } = await supabase
      .from('escoltas')
      .select('id, codigo, cedula, nombres, apellidos, notas')
      .ilike('notas', '%[PAPELERA:true]%');

    if (errCandidatos) throw mapSupabaseError(errCandidatos, 'Error consultando papelera.');

    let purgados = 0;
    let protegidos = 0;
    const idsPurgados = [];

    for (const item of candidatos || []) {
      // Verificar todas las dependencias foráneas de forma estricta (operativas y financieras)
      const checks = [
        supabase.from('asignaciones').select('id').eq('escolta_id', item.id).limit(1),
        supabase.from('nomina_detalles').select('id').eq('escolta_id', item.id).limit(1),
        supabase.from('asistencias').select('id').eq('escolta_id', item.id).limit(1),
        supabase.from('permisos').select('id').eq('escolta_id', item.id).limit(1),
        supabase.from('pagos').select('id').eq('escolta_id', item.id).limit(1),
      ];

      // Si existen módulos de RRHH o Choferes, verificar referencias
      try {
        checks.push(supabase.from('personal').select('id').eq('cedula', item.cedula).limit(1));
        checks.push(supabase.from('choferes_conductores').select('id').eq('personal_id', item.id).limit(1));
      } catch {}

      const resultados = await Promise.all(checks);
      const tieneDependencias = resultados.some(r => (r.data && r.data.length > 0) || r.error);

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

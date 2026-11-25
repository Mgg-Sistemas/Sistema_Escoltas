import { Router } from 'express';
import { supabase } from '../lib/supabase.js';
import { audit } from '../lib/audit.js';
import { ApiError, mapSupabaseError } from '../lib/errors.js';
import { asyncHandler, ok } from '../lib/http.js';
import { requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { esquemaRolPermisos } from '../schemas.js';

const router = Router();

router.use(requireRole('admin'));

/** Devuelve catálogos, matriz estilo GT y códigos granulares. */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const [roles, permisos, matriz, asignados] = await Promise.all([
      supabase.from('roles').select('id,nombre,descripcion,activo,es_sistema').order('nombre'),
      supabase
        .from('permisos_sistema')
        .select('id,codigo,modulo,accion,descripcion,activo')
        .order('codigo'),
      supabase
        .from('roles_permisos')
        .select('role,permisos,vistas_telefono,solo_telefono,updated_at')
        .order('role'),
      supabase.from('rol_permisos').select('rol_id,permiso_id,concedido'),
    ]);

    const error = roles.error || permisos.error || matriz.error || asignados.error;
    if (error) throw mapSupabaseError(error, 'No fue posible consultar roles y permisos.');

    return ok(res, {
      roles: roles.data ?? [],
      permisos: permisos.data ?? [],
      matriz: matriz.data ?? [],
      asignados: asignados.data ?? [],
    });
  }),
);

/** Guarda la matriz por módulo y sincroniza los códigos granulares. */
router.put(
  '/permisos',
  validate(esquemaRolPermisos),
  asyncHandler(async (req, res) => {
    const { role, permisos, vistas_telefono, solo_telefono } = req.body;

    const { error: matrixError } = await supabase
      .from('roles_permisos')
      .update({
        permisos,
        vistas_telefono: vistas_telefono ?? [],
        solo_telefono: solo_telefono ?? false,
        updated_by: req.user.id,
      })
      .eq('role', role);
    if (matrixError) throw mapSupabaseError(matrixError, 'No fue posible guardar la matriz de permisos.');

    // Sincroniza códigos granulares usados por el backend.
    const { data: catalogo } = await supabase
      .from('permisos_sistema')
      .select('id,codigo,modulo')
      .eq('activo', true);
    const { data: roleRow } = await supabase.from('roles').select('id').eq('nombre', role).maybeSingle();
    if (!roleRow) throw new ApiError(404, 'No se encontró el rol indicado.', 'NO_ENCONTRADO');

    const codigos = new Set();
    for (const [modulo, niveles] of Object.entries(permisos)) {
      if (!niveles.lectura && !niveles.escritura && !niveles.full) continue;
      for (const permiso of catalogo ?? []) {
        if (permiso.modulo !== modulo) continue;
        const esLectura = permiso.codigo.endsWith('.ver');
        if (niveles.full || (esLectura && niveles.lectura) || (!esLectura && niveles.escritura)) {
          codigos.add(permiso.id);
        }
      }
    }

    await supabase.from('rol_permisos').delete().eq('rol_id', roleRow.id).eq('concedido', true);
    if (codigos.size > 0) {
      const { error: granularError } = await supabase.from('rol_permisos').upsert(
        [...codigos].map((permiso_id) => ({ rol_id: roleRow.id, permiso_id, concedido: true })),
        { onConflict: 'rol_id,permiso_id' },
      );
      if (granularError) {
        throw mapSupabaseError(granularError, 'No fue posible sincronizar los permisos granulares.');
      }
    }

    await audit({
      tabla: 'roles_permisos',
      operacion: 'UPDATE',
      registro_id: roleRow.id,
      cambios: { role, modulos: Object.keys(permisos) },
      usuario_id: req.user.id,
    });

    return ok(res, { role, permisos });
  }),
);

export default router;

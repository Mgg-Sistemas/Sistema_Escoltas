import { Router } from 'express';
import { supabase } from '../lib/supabase.js';
import { audit } from '../lib/audit.js';
import { ApiError, mapSupabaseError } from '../lib/errors.js';
import { asyncHandler, ok } from '../lib/http.js';
import { requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { esquemaRolPermisos } from '../schemas.js';
import { modulosStore } from '../lib/modulosStore.js';

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

/** Listar roles personalizados (custom_roles) */
router.get(
  '/custom',
  asyncHandler(async (req, res) => {
    const { data, error } = await supabase
      .from('custom_roles')
      .select('*')
      .order('created_at');

    if (error) {
      if (modulosStore.esErrorTablaInexistente(error)) {
        return ok(res, modulosStore.listar('custom_roles'));
      }
      throw mapSupabaseError(error, 'No fue posible consultar roles personalizados.');
    }
    return ok(res, data ?? []);
  }),
);

/** Crear o actualizar rol personalizado */
router.post(
  '/custom',
  asyncHandler(async (req, res) => {
    const { key, label, descripcion, color } = req.body;
    if (!key || !label) throw new ApiError(400, 'Clave y etiqueta son obligatorias.');

    const claveLimpa = key.trim().toLowerCase().replace(/\s+/g, '_');
    const rolObj = {
      key: claveLimpa,
      label: label.trim(),
      descripcion: descripcion?.trim() || null,
      color: color || '#cc4400',
      sistema: false,
      created_by: req.user.id,
    };

    const { data, error } = await supabase
      .from('custom_roles')
      .upsert(rolObj)
      .select('*')
      .single();

    if (error) {
      if (modulosStore.esErrorTablaInexistente(error)) {
        const item = modulosStore.insertar('custom_roles', rolObj);
        return ok(res, item);
      }
      throw mapSupabaseError(error, 'No fue posible guardar el rol personalizado.');
    }

    // Asegura registro en roles_permisos
    await supabase
      .from('roles_permisos')
      .upsert({
        role: claveLimpa,
        permisos: {},
        vistas_telefono: [],
        solo_telefono: false,
      })
      .catch(() => {});

    return ok(res, data);
  }),
);

/** Eliminar rol personalizado no de sistema */
router.delete(
  '/custom/:key',
  asyncHandler(async (req, res) => {
    const { key } = req.params;
    const { data: role } = await supabase.from('custom_roles').select('*').eq('key', key).single();
    if (role?.sistema) throw new ApiError(400, 'No se pueden eliminar roles base del sistema.');

    await supabase.from('roles_permisos').delete().eq('role', key).catch(() => {});
    const { error } = await supabase.from('custom_roles').delete().eq('key', key);
    if (error && !modulosStore.esErrorTablaInexistente(error)) {
      throw mapSupabaseError(error, 'No fue posible eliminar el rol.');
    }
    modulosStore.eliminar('custom_roles', key);

    return ok(res, { mensaje: 'Rol eliminado con éxito.' });
  }),
);

/** Listar usuarios autorizados para aprobaciones de módulos */
router.get(
  '/autorizados',
  asyncHandler(async (req, res) => {
    const { data, error } = await supabase
      .from('usuarios_autorizados')
      .select('*, usuario:profiles(id, full_name, email, role, usuario)')
      .order('created_at');

    if (error) {
      if (modulosStore.esErrorTablaInexistente(error)) {
        return ok(res, modulosStore.listar('autorizados'));
      }
      throw mapSupabaseError(error, 'No fue posible consultar autorizados.');
    }
    return ok(res, data ?? []);
  }),
);

/** Registrar usuario autorizado */
router.post(
  '/autorizados',
  asyncHandler(async (req, res) => {
    const { usuario_id, modulo, accion = 'aprobar' } = req.body;
    if (!usuario_id || !modulo) throw new ApiError(400, 'Usuario y módulo requeridos.');

    const autorizObj = {
      usuario_id,
      modulo,
      accion,
      activo: true,
      created_by: req.user.id,
    };

    const { data, error } = await supabase
      .from('usuarios_autorizados')
      .upsert(autorizObj)
      .select('*, usuario:profiles(id, full_name, email, role, usuario)')
      .single();

    if (error) {
      if (modulosStore.esErrorTablaInexistente(error)) {
        const item = modulosStore.insertar('autorizados', autorizObj);
        return ok(res, item);
      }
      throw mapSupabaseError(error, 'No fue posible autorizar al usuario.');
    }
    return ok(res, data);
  }),
);

/** Revocar usuario autorizado */
router.delete(
  '/autorizados/:id',
  asyncHandler(async (req, res) => {
    const { error } = await supabase.from('usuarios_autorizados').delete().eq('id', req.params.id);
    if (error) throw mapSupabaseError(error, 'No fue posible revocar la autorización.');
    return ok(res, { mensaje: 'Autorización revocada.' });
  }),
);

export default router;

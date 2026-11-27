import { Router } from 'express';
import { supabase } from '../lib/supabase.js';
import { audit } from '../lib/audit.js';
import { ApiError, mapSupabaseError } from '../lib/errors.js';
import { asyncHandler, ok } from '../lib/http.js';
import { rolesPersonalizadosHabilitados, resolverRolAsignable, ROLES_BASE } from '../lib/roles.js';
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
    const rolId = await resolverRolAsignable(role);

    const { error: matrixError } = await supabase
      .from('roles_permisos')
      .upsert(
        {
          role,
          permisos,
          vistas_telefono: vistas_telefono ?? [],
          solo_telefono: solo_telefono ?? false,
          updated_by: req.user.id,
        },
        { onConflict: 'role' },
      );
    if (matrixError) throw mapSupabaseError(matrixError, 'No fue posible guardar la matriz de permisos.');

    // Sincroniza códigos granulares usados por el backend.
    const { data: catalogo } = await supabase
      .from('permisos_sistema')
      .select('id,codigo,modulo')
      .eq('activo', true);

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

    await supabase.from('rol_permisos').delete().eq('rol_id', rolId).eq('concedido', true);
    if (codigos.size > 0) {
      const { error: granularError } = await supabase.from('rol_permisos').upsert(
        [...codigos].map((permiso_id) => ({ rol_id: rolId, permiso_id, concedido: true })),
        { onConflict: 'rol_id,permiso_id' },
      );
      if (granularError) {
        throw mapSupabaseError(granularError, 'No fue posible sincronizar los permisos granulares.');
      }
    }

    await audit({
      tabla: 'roles_permisos',
      operacion: 'UPDATE',
      registro_id: rolId,
      cambios: { role, modulos: Object.keys(permisos) },
      usuario_id: req.user.id,
    });

    return ok(res, { role, permisos });
  }),
);

router.get('/custom/asignables', asyncHandler(async (req, res) => {
  if (!await rolesPersonalizadosHabilitados()) return ok(res, { habilitado: false, roles: [] });
  const { data, error } = await supabase.from('custom_roles')
    .select('key,label,descripcion').eq('sistema', false).order('label');
  if (error) throw mapSupabaseError(error, 'No fue posible consultar los roles asignables.');
  return ok(res, { habilitado: true, roles: (data ?? []).filter(({ key }) =>
    /^[a-z][a-z0-9_]{1,39}$/.test(key) && !ROLES_BASE.includes(key),
  ) });
}));

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

/** Registra un nuevo rol en el catálogo. */
router.post(
  '/custom',
  asyncHandler(async (req, res) => {
    const { key, label, descripcion } = req.body ?? {};
    const clave = typeof key === 'string' ? key.trim().toLowerCase() : '';
    const etiqueta = typeof label === 'string' ? label.trim() : '';
    const detalle = typeof descripcion === 'string' ? descripcion.trim() : '';

    if (!/^[a-z][a-z0-9_]{1,39}$/.test(clave) || !etiqueta || etiqueta.length > 120 || detalle.length > 500) {
      throw new ApiError(400, 'Indica una clave de 2 a 40 caracteres y un nombre de hasta 120 caracteres.');
    }
    if (ROLES_BASE.includes(clave)) {
      throw new ApiError(409, 'Esa clave está reservada para un rol del sistema.');
    }

    const { data, error } = await supabase
      .from('custom_roles')
      .insert({ key: clave, label: etiqueta, descripcion: detalle || null })
      .select('key,label,descripcion')
      .single();
    if (error) throw mapSupabaseError(error, 'No fue posible crear el rol.');
    return ok(res, data);
  }),
);

router.delete(
  '/custom/:key',
  asyncHandler(async (req, res) => {
    const { key } = req.params;
    const { data: role } = await supabase.from('custom_roles').select('*').eq('key', key).single();
    if (role?.sistema || ROLES_BASE.includes(key)) throw new ApiError(400, 'No se pueden eliminar roles base del sistema.');
    if (await rolesPersonalizadosHabilitados()) {
      throw new ApiError(409, 'La eliminación de roles requiere revisar sus asignaciones.', 'ROL_PROTEGIDO');
    }

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

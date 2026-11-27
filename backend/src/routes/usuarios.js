import { Router } from 'express';
import { config } from '../config.js';
import { supabase } from '../lib/supabase.js';
import { supabaseAnon } from '../lib/supabaseAnon.js';
import { resolverRolAsignable } from '../lib/roles.js';
import { valorAjuste } from '../lib/ajustes.js';
import { audit } from '../lib/audit.js';
import { ApiError, mapSupabaseError } from '../lib/errors.js';
import { asyncHandler, created, ok } from '../lib/http.js';
import { requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { esquemaUsuarioCrear, esquemaUsuarioActualizar } from '../schemas.js';

const router = Router();

router.use(requireRole('admin'));

const SELECCION =
  'id,usuario,full_name,email,role,active,must_change_password,phone,role_id,avatar_url,created_at,cambio_clave_at,ultimo_acceso';

/** Genera un correo interno válido a partir del usuario visible. */
function correoInternoDesdeUsuario(usuario) {
  const local = String(usuario)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9._-]+/g, '.')
    .replace(/\.{2,}/g, '.')
    .replace(/^\.|\.$/g, '');
  return `${local || `usuario-${Date.now()}`}@escoltas.local`;
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { data, error } = await supabase
      .from('profiles')
      .select(SELECCION)
      .order('full_name', { ascending: true });

    if (error) throw mapSupabaseError(error, 'No fue posible listar los usuarios.');
    return ok(res, data ?? []);
  }),
);

router.post(
  '/',
  validate(esquemaUsuarioCrear),
  asyncHandler(async (req, res) => {
    const {
      usuario,
      correo,
      nombre,
      apellido,
      telefono,
      role,
      escolta_id: escoltaId,
    } = req.body;
    const rolId = await resolverRolAsignable(role);
    const usuarioVisible = usuario.trim();
    const nombreCompleto = [nombre, apellido].filter(Boolean).join(' ').trim();
    const email = correo?.trim().toLowerCase() || correoInternoDesdeUsuario(usuarioVisible);
    const claveTemporal =
      (await valorAjuste('password_inicial_usuario', null)) || config.passwordInicialUsuario;

    const { data: creado, error: crearError } = await supabase.auth.admin.createUser({
      email,
      password: claveTemporal,
      email_confirm: true,
      user_metadata: {
        usuario: usuarioVisible,
        full_name: nombreCompleto,
        role,
        phone: telefono ?? null,
      },
    });

    if (crearError) {
      if (/already registered|already exists|duplicate/i.test(crearError.message)) {
        throw new ApiError(409, 'Ya existe una cuenta con ese usuario o correo interno.', 'CONFLICTO');
      }
      throw new ApiError(400, crearError.message, 'VALIDACION');
    }

    const id = creado.user.id;

    const { error: perfilError } = await supabase
      .from('profiles')
      .update({
        usuario: usuarioVisible,
        full_name: nombreCompleto,
        email,
        role,
        role_id: rolId,
        phone: telefono ?? null,
        active: true,
        must_change_password: true,
      })
      .eq('id', id);
    if (perfilError) throw mapSupabaseError(perfilError, 'No fue posible completar el perfil del usuario.');

    if (escoltaId) {
      const { error: vincularError } = await supabase
        .from('escoltas')
        .update({ user_id: id })
        .eq('id', escoltaId);
      if (vincularError) {
        throw mapSupabaseError(vincularError, 'El usuario se creó pero no se pudo vincular al escolta.');
      }
    }

    await audit({
      tabla: 'profiles',
      operacion: 'INSERT',
      registro_id: id,
      cambios: { usuario: usuarioVisible, email, role, must_change_password: true },
      usuario_id: req.user.id,
    });

    return created(res, {
      id,
      usuario: usuarioVisible,
      role,
      clave_temporal: claveTemporal,
      mensaje: 'Usuario creado. Debe cambiar la contraseña en su primer ingreso.',
    });
  }),
);

router.patch(
  '/:id',
  validate(esquemaUsuarioActualizar),
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    if (id === req.user.id) {
      throw new ApiError(400, 'No puedes cambiar tu propio rol o estado desde esta pantalla.', 'PROHIBIDO');
    }

    const { escolta_id: escoltaId, ...cambios } = req.body;
    const metadata = {};
    if (cambios.role) {
      cambios.role_id = await resolverRolAsignable(cambios.role);
      metadata.role = cambios.role;
    }
    if (cambios.usuario) metadata.usuario = cambios.usuario;
    const { data, error } = await supabase
      .from('profiles')
      .update(cambios)
      .eq('id', id)
      .select(SELECCION)
      .maybeSingle();
    if (error) throw mapSupabaseError(error, 'No fue posible actualizar el usuario.');
    if (!data) throw new ApiError(404, 'No se encontró el usuario indicado.', 'NO_ENCONTRADO');

    if (Object.keys(metadata).length > 0) {
      await supabase.auth.admin.updateUserById(id, { user_metadata: metadata });
    }

    if (escoltaId !== undefined) {
      if (escoltaId) {
        await supabase.from('escoltas').update({ user_id: id }).eq('id', escoltaId);
      } else {
        await supabase.from('escoltas').update({ user_id: null }).eq('user_id', id);
      }
    }

    await audit({
      tabla: 'profiles',
      operacion: 'UPDATE',
      registro_id: id,
      cambios,
      usuario_id: req.user.id,
    });

    return ok(res, data);
  }),
);

/** Envía el correo de restablecimiento y vuelve a exigir cambio de clave. */
router.post(
  '/:id/restablecer-clave',
  asyncHandler(async (req, res) => {
    const { data: perfil, error } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', req.params.id)
      .maybeSingle();
    if (error) throw mapSupabaseError(error, 'No fue posible consultar el usuario.');
    if (!perfil) throw new ApiError(404, 'No se encontró el usuario indicado.', 'NO_ENCONTRADO');

    const redirectTo = `${config.appUrl}/restablecer-clave?origen=recuperacion`;
    const { error: envioError } = await supabaseAnon.auth.resetPasswordForEmail(perfil.email, {
      redirectTo,
    });

    await supabase
      .from('profiles')
      .update({ must_change_password: true })
      .eq('id', req.params.id);

    await audit({
      tabla: 'profiles',
      operacion: 'RESET_CLAVE',
      registro_id: req.params.id,
      cambios: { enviado_a: perfil.email },
      usuario_id: req.user.id,
    });

    if (envioError) {
      throw new ApiError(
        502,
        'No se pudo enviar el correo. Contacta al administrador del sistema.',
        'CORREO_NO_ENVIADO',
      );
    }

    return ok(res, { message: 'Se envió el enlace de restablecimiento al correo del usuario.' });
  }),
);

/** Desbloquea una cuenta tras 3 intentos fallidos (flujo GT). */
router.post(
  '/:id/desbloquear',
  asyncHandler(async (req, res) => {
    const { data: perfil } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', req.params.id)
      .maybeSingle();

    if (perfil?.email) {
      await supabase.from('intentos_login').delete().eq('email', perfil.email.toLowerCase());
    }

    await audit({
      tabla: 'profiles',
      operacion: 'DESBLOQUEAR',
      registro_id: req.params.id,
      cambios: { email: perfil?.email ?? null },
      usuario_id: req.user.id,
    });

    return ok(res, { message: 'Intentos de ingreso reiniciados.' });
  }),
);

export default router;

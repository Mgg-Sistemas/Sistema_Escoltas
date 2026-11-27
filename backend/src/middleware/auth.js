import { supabase } from '../lib/supabase.js';
import { ApiError, mapSupabaseError } from '../lib/errors.js';
import { asyncHandler } from '../lib/http.js';
import { ROLES_BASE } from '../lib/roles.js';
import { escoltaIdDelUsuario } from '../lib/scope.js';

/** Verifica el JWT de Supabase y carga el perfil con su rol usando service-role. */
export const authenticate = asyncHandler(async (req, res, next) => {
  const cabecera = req.get('Authorization') ?? '';
  const coincidencia = /^Bearer\s+(.+)$/i.exec(cabecera.trim());

  if (!coincidencia) {
    throw new ApiError(401, 'Se requiere un token de autenticación con formato Bearer.', 'NO_AUTENTICADO');
  }

  const token = coincidencia[1].trim();
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data?.user) {
    throw new ApiError(401, 'El token de autenticación no es válido o ha expirado.', 'NO_AUTENTICADO');
  }

  const { data: perfil, error: errorPerfil } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, active, must_change_password')
    .eq('id', data.user.id)
    .maybeSingle();

  if (errorPerfil) {
    throw mapSupabaseError(errorPerfil, 'No fue posible consultar el perfil del usuario.');
  }
  if (!perfil) {
    throw new ApiError(403, 'No existe un perfil asociado a este usuario.', 'PERFIL_NO_ENCONTRADO');
  }
  if (!perfil.active) {
    throw new ApiError(403, 'El usuario se encuentra inactivo.', 'USUARIO_INACTIVO');
  }

  req.user = {
    id: perfil.id,
    email: perfil.email ?? data.user.email ?? null,
    role: perfil.role,
    full_name: perfil.full_name ?? null,
    must_change_password: perfil.must_change_password !== false,
  };

  // Mientras la clave sea temporal solo se permite confirmar el cambio.
  const rutasPermitidas = ['/auth/clave-confirmada', '/auth/cambiar-clave', '/me'];
  if (req.user.must_change_password && !rutasPermitidas.some((ruta) => req.path.startsWith(ruta))) {
    throw new ApiError(
      403,
      'Debes cambiar tu contraseña temporal antes de usar el sistema.',
      'CAMBIO_DE_CLAVE_REQUERIDO',
    );
  }

  // Los roles personalizados no heredan rutas privilegiadas de los roles del sistema.
  if (!ROLES_BASE.includes(req.user.role) && !rutasPermitidas.includes(req.path)) {
    throw new ApiError(403, 'Este rol no tiene acceso a esta operación.', 'PROHIBIDO');
  }

  if (req.user.role === 'escolta') {
    const escoltaId = await escoltaIdDelUsuario(req.user.id);
    if (!escoltaId) {
      throw new ApiError(403, 'Tu usuario no está vinculado a ningún escolta.', 'PROHIBIDO');
    }
    req.user.escolta_id = escoltaId;
  }

  next();
});

/** Restringe una ruta a los roles indicados. */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new ApiError(401, 'Se requiere autenticación para acceder a este recurso.', 'NO_AUTENTICADO'));
    }
    if (!roles.includes(req.user.role)) {
      return next(
        new ApiError(
          403,
          `Esta operación requiere uno de los siguientes roles: ${roles.join(', ')}.`,
          'PROHIBIDO'
        )
      );
    }
    return next();
  };
}

/**
 * Restringe una ruta por la matriz de permisos estilo GT
 * (`roles_permisos.permisos`). Admin siempre pasa.
 */
export function requirePermission(modulo, nivel = 'lectura') {
  return asyncHandler(async (req, res, next) => {
    if (!req.user) {
      throw new ApiError(401, 'Se requiere autenticación para acceder a este recurso.', 'NO_AUTENTICADO');
    }
    if (req.user.role === 'admin') return next();

    const { data, error } = await supabase
      .from('roles_permisos')
      .select('permisos')
      .eq('role', req.user.role)
      .maybeSingle();

    if (error) throw mapSupabaseError(error, 'No fue posible consultar los permisos del rol.');
    const permisos = data?.permisos ?? {};
    const delModulo = permisos[modulo] ?? {};
    let permitido = delModulo.full === true || delModulo[nivel] === true;

    // Conciliación de respaldo: si no se encontró en roles_permisos, verificar en rol_permisos por UUID
    if (!permitido) {
      try {
        const codigoBuscado = nivel === 'lectura' ? `${modulo}.ver` : `${modulo}.${nivel}`;
        const { data: granular } = await supabase
          .from('rol_permisos')
          .select('concedido, roles!inner(nombre), permisos_sistema!inner(codigo, modulo)')
          .eq('roles.nombre', req.user.role)
          .eq('concedido', true);

        permitido = (granular || []).some((g) => {
          const cod = g.permisos_sistema?.codigo;
          const mod = g.permisos_sistema?.modulo;
          return mod === modulo && (cod === codigoBuscado || cod === `${modulo}.crear` || cod === `${modulo}.editar`);
        });
      } catch {}
    }

    if (!permitido) {
      throw new ApiError(
        403,
        `Tu rol no tiene el permiso "${nivel}" sobre el módulo ${modulo}.`,
        'PROHIBIDO',
      );
    }
    return next();
  });
}

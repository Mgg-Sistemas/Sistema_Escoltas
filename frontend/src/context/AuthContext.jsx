import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { configurarMantenerSesion, supabase } from '../lib/supabase.js';
import { apiFetch } from '../lib/api.js';
import { mensajeError } from '../lib/data.js';
import { ROLES_LABELS, ROLES_POR_MODULO } from '../lib/constants.js';

const AuthContext = createContext(null);

const BLOQUEADO_MSG =
  'Tu cuenta está bloqueada por 3 intentos fallidos. Pídele al administrador que la desbloquee.';
const INHABILITADO_MSG = 'Tu cuenta está deshabilitada. Contacta al administrador para que la reactive.';

function perfilFallback(user, claveCambiada = false) {
  return {
    id: user?.id,
    usuario: user?.user_metadata?.usuario || user?.user_metadata?.full_name || user?.email?.split('@')?.[0] || 'Usuario',
    full_name: user?.user_metadata?.full_name || user?.email?.split('@')?.[0] || 'Usuario',
    email: user?.email || '',
    role: user?.user_metadata?.role || 'escolta',
    active: true,
    must_change_password: !claveCambiada,
  };
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const idCargadoRef = useRef(null);
  // Evita volver a exigir el cambio de clave si la tabla de perfiles aún no existe.
  const claveCambiadaRef = useRef(false);

  const cargarPerfil = useCallback(async (user) => {
    try {
      const { data, error: dbError } = await supabase
        .from('profiles')
        .select('id,usuario,full_name,email,role,active,phone,must_change_password,cambio_clave_at,role_id')
        .eq('id', user.id)
        .maybeSingle();

      if (dbError) throw dbError;
      setProfile(
        data
          ? {
              ...data,
              must_change_password: data.must_change_password !== false && !claveCambiadaRef.current,
            }
          : perfilFallback(user, claveCambiadaRef.current),
      );
    } catch (dbError) {
      setError(mensajeError(dbError));
      setProfile(perfilFallback(user, claveCambiadaRef.current));
    } finally {
      setLoading(false);
    }
  }, []);

  const sincronizar = useCallback(
    (nuevaSesion) => {
      setSession(nuevaSesion);
      const user = nuevaSesion?.user;

      if (!user) {
        idCargadoRef.current = null;
        claveCambiadaRef.current = false;
        setProfile(null);
        setLoading(false);
        return;
      }

      if (idCargadoRef.current === user.id) return;
      idCargadoRef.current = user.id;
      setLoading(true);
      setError(null);
      cargarPerfil(user);
    },
    [cargarPerfil],
  );

  useEffect(() => {
    let activo = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (activo) sincronizar(data?.session || null);
      })
      .catch(() => {
        if (activo) setLoading(false);
      });

    const { data: authData } = supabase.auth.onAuthStateChange((_evento, nuevaSesion) => {
      if (activo) sincronizar(nuevaSesion);
    });

    return () => {
      activo = false;
      authData.subscription?.unsubscribe();
    };
  }, [sincronizar]);

  /** Convierte el usuario visible en el correo interno que usa Supabase Auth. */
  const resolverEmail = useCallback(async (usuario) => {
    const nombre = String(usuario || '').trim();
    if (!nombre) return null;

    try {
      const { data, error: rpcError } = await supabase.rpc('auth_usuario_a_email', {
        p_usuario: nombre,
      });
      if (!rpcError && data) return String(data).trim().toLowerCase();
    } catch {
      // Si la migración aún no está aplicada, se intenta con el backend.
    }

    try {
      const resultado = await apiFetch('/auth/resolver-usuario', {
        method: 'POST',
        body: { usuario: nombre },
      });
      return resultado?.email ? String(resultado.email).trim().toLowerCase() : null;
    } catch {
      return null;
    }
  }, []);

  const signIn = useCallback(async ({ usuario, password, mantenerSesion = true }) => {
    setError(null);
    claveCambiadaRef.current = false;
    configurarMantenerSesion(mantenerSesion !== false);
    const nombreUsuario = String(usuario || '').trim();
    const clave = String(password || '');

    if (!nombreUsuario || !clave) {
      const mensaje = 'Escribe tu usuario y tu contraseña para continuar.';
      setError(mensaje);
      throw new Error(mensaje);
    }

    const correo = await resolverEmail(nombreUsuario);
    if (!correo) {
      const mensaje = 'Usuario o contraseña incorrectos. Verifica tus datos e intenta de nuevo.';
      setError(mensaje);
      throw new Error(mensaje);
    }

    // Control de intentos heredado de la base funcional GT.
    try {
      const [{ data: bloqueado }, { data: inhabilitado }] = await Promise.all([
        supabase.rpc('auth_estado_bloqueo', { p_email: correo }),
        supabase.rpc('auth_estado_inhabilitado', { p_email: correo }),
      ]);
      if (bloqueado === true) throw new Error(BLOQUEADO_MSG);
      if (inhabilitado === true) throw new Error(INHABILITADO_MSG);
    } catch (errorEstado) {
      if ([BLOQUEADO_MSG, INHABILITADO_MSG].includes(errorEstado.message)) throw errorEstado;
      // Si las RPC aún no están aplicadas, continúa con el login normal.
    }

    const { data, error: loginError } = await supabase.auth.signInWithPassword({
      email: correo,
      password: clave,
    });

    if (loginError) {
      let mensaje = loginError.message?.toLowerCase().includes('invalid login credentials')
        ? 'Usuario o contraseña incorrectos. Verifica tus datos e intenta de nuevo.'
        : mensajeError(loginError);

      try {
        const { data: resultado } = await supabase.rpc('auth_fallo_login', { p_email: correo });
        if (resultado?.bloqueado === true) mensaje = BLOQUEADO_MSG;
        else if (Number(resultado?.restantes) > 0) {
          mensaje = `Clave incorrecta. Te queda(n) ${resultado.restantes} intento(s) antes de que se bloquee la cuenta.`;
        }
      } catch {
        // Mensaje genérico si la RPC no está disponible.
      }

      setError(mensaje);
      throw new Error(mensaje);
    }

    try {
      await supabase.rpc('auth_reset_intentos');
    } catch {
      // Best-effort: no bloquea el ingreso si falla el reinicio de intentos.
    }

    setSession(data);
    idCargadoRef.current = data.user.id;
    await cargarPerfil(data.user);
    return data;
  }, [cargarPerfil, resolverEmail]);

  const signOut = useCallback(async () => {
    const { error: salidaError } = await supabase.auth.signOut();
    if (salidaError) throw new Error(mensajeError(salidaError));
    setProfile(null);
    setSession(null);
    idCargadoRef.current = null;
  }, []);

  const recargarPerfil = useCallback(async () => {
    const user = session?.user;
    if (!user) return;
    idCargadoRef.current = null;
    await cargarPerfil(user);
    idCargadoRef.current = user.id;
  }, [cargarPerfil, session]);

  /**
   * Envía el enlace usando el usuario visible. El correo interno nunca se pide
   * en pantalla y la respuesta es neutra para no revelar si existe la cuenta.
   */
  const recuperarClave = useCallback(async (usuario) => {
    setError(null);
    const nombre = String(usuario || '').trim();
    if (!nombre) throw new Error('Escribe tu usuario para continuar.');

    const email = await resolverEmail(nombre);
    if (email) {
      try {
        await apiFetch('/auth/recuperar', { method: 'POST', body: { correo: email } });
      } catch {
        // Respaldo si el backend no está levantado: Supabase también envía el correo.
        const { error: recoveryError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/restablecer-clave?origen=recuperacion`,
        });
        if (recoveryError) throw new Error(mensajeError(recoveryError));
      }
    }

    return 'Si el usuario existe en el sistema, recibirás las instrucciones para restablecer tu contraseña.';
  }, [resolverEmail]);

  /**
   * Cambia la contraseña validando dos veces. Funciona tanto para el primer
   * ingreso con clave temporal como para el enlace de restablecimiento.
   */
  const cambiarClave = useCallback(
    async (clave, confirmacion) => {
      setError(null);
      if (clave !== confirmacion) throw new Error('Las contraseñas no coinciden. Vuelve a intentarlo.');
      if (String(clave).length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres.');

      const { error: updateError } = await supabase.auth.updateUser({ password: clave });
      if (updateError) throw new Error(mensajeError(updateError));

      await apiFetch('/auth/clave-confirmada', { method: 'POST' });
      claveCambiadaRef.current = true;
      await recargarPerfil();
      return 'Contraseña actualizada. Ya puedes usar el sistema.';
    },
    [recargarPerfil],
  );

  const role = profile?.role || 'escolta';
  const puede = useCallback(
    (modulo) => Boolean(ROLES_POR_MODULO[modulo]?.includes(role)),
    [role],
  );

  const valor = useMemo(
    () => ({
      session,
      user: session?.user || null,
      profile,
      role,
      roleLabel: ROLES_LABELS[role] || role,
      loading,
      error,
      signIn,
      signOut,
      recargarPerfil,
      puede,
      autenticado: Boolean(session),
      debeCambiarClave: Boolean(profile?.must_change_password),
      recuperarClave,
      cambiarClave,
    }),
    [
      session, profile, role, loading, error, signIn, signOut, recargarPerfil, puede,
      recuperarClave, cambiarClave,
    ],
  );

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const contexto = useContext(AuthContext);
  if (!contexto) throw new Error('useAuth debe usarse dentro de AuthProvider.');
  return contexto;
}

import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Info, LockKeyhole, ShieldCheck } from 'lucide-react';
import { Button, Input } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { apiFetch } from '../lib/api.js';
import { mantenerSesionActiva, supabaseConfigurado } from '../lib/supabase.js';

function Emblema({ className = 'h-16 w-16' }) {
  return (
    <img
      src="/logo-escoltas.png"
      alt="Emblema de Seguridad Escoltas"
      className={`${className} object-contain`}
    />
  );
}

export default function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [usuario, setUsuario] = useState('');
  const [clave, setClave] = useState('');
  const [mostrarClave, setMostrarClave] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [mantenerSesion, setMantenerSesion] = useState(mantenerSesionActiva);
  const [permitirMantener, setPermitirMantener] = useState(true);

  useEffect(() => {
    let activo = true;
    apiFetch('/auth/configuracion-sesion')
      .then((datos) => {
        if (activo) setPermitirMantener(datos?.permitir_mantener_sesion !== false);
      })
      .catch(() => {
        // Sin backend no bloqueamos el ingreso: se aplica la configuración local.
      });
    return () => {
      activo = false;
    };
  }, []);

  const enviar = async (evento) => {
    evento.preventDefault();
    setError('');

    if (!usuario.trim() || !clave) {
      setError('Escribe tu usuario y tu contraseña para continuar.');
      return;
    }

    try {
      setCargando(true);
      await signIn({ usuario, password: clave, mantenerSesion });
      navigate('/', { replace: true });
    } catch (errorIngreso) {
      setError(errorIngreso.message || 'No se pudo iniciar sesión. Intenta de nuevo.');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 lg:grid lg:grid-cols-[1.05fr_1fr]">
      {/* Panel institucional / escritorio */}
      <div className="relative hidden overflow-hidden bg-ink-950 px-12 py-14 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -right-32 -top-40 h-[28rem] w-[28rem] rounded-full bg-brand-500/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-48 -left-32 h-[30rem] w-[30rem] rounded-full bg-brand-700/30 blur-3xl" />
        <div className="relative flex items-center gap-4">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20">
            <Emblema className="h-14 w-14" />
          </div>
          <div>
            <p className="text-lg font-extrabold tracking-tight">Sistema de Escoltas</p>
            <p className="text-xs uppercase tracking-[0.2em] text-brand-300">Seguridad institucional</p>
          </div>
        </div>

        <div className="relative max-w-xl">
          <h1 className="text-4xl font-extrabold leading-tight text-emblem-gray xl:text-5xl">
            Control total de tus escoltas, en un solo lugar
          </h1>
          <p className="mt-5 text-base leading-relaxed text-slate-300">
            Registra personal, distribuye turnos, revisa permisos, controla la asistencia y cierra la
            nómina con claridad y trazabilidad. Los cambios se ven al instante en todos los dispositivos.
          </p>
          <ul className="mt-9 space-y-4 text-sm text-slate-200">
            {[
              'Fichas y asignaciones siempre actualizadas',
              'Permisos con aprobación guiada y alertas',
              'Nómina y pagos con totales automáticos',
              'Acceso por rol y contraseñas temporales',
            ].map((texto) => (
              <li key={texto} className="flex items-center gap-3">
                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-500 text-xs font-bold text-white">
                  ✓
                </span>
                {texto}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-slate-400">
          Uso autorizado exclusivamente para el equipo · Datos protegidos por rol
        </p>
      </div>

      {/* Formulario */}
      <div className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-8 lg:min-h-0">
        <div className="w-full max-w-md">
          <div className="mb-8 flex flex-col items-center gap-3 text-center lg:hidden">
            <Emblema className="h-20 w-20" />
            <div>
              <p className="text-lg font-extrabold text-slate-900">Sistema de Escoltas</p>
              <p className="text-xs text-slate-500">Acceso seguro</p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-panel sm:p-8">
            <div className="mb-6 flex items-center gap-2 lg:hidden">
              <span className="h-1 w-10 rounded-full bg-brand-500" aria-hidden="true" />
              <p className="text-xs font-bold uppercase tracking-widest text-brand-700">Bienvenido</p>
            </div>

            <h2 className="text-2xl font-bold text-slate-900">Inicia sesión</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              Ingresa con el usuario que te dio el administrador, sin correo. Si es tu primera vez,
              te pediremos cambiar la contraseña temporal.
            </p>

            {!supabaseConfigurado && (
              <div className="mt-5 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <p>
                  Falta configurar <strong>VITE_SUPABASE_ANON_KEY</strong>. Copia <code>.env.example</code>{' '}
                  a <code>.env</code> y reinicia el servidor para poder ingresar.
                </p>
              </div>
            )}

            {error && (
              <div role="alert" className="mt-5 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-800">
                <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <p>{error}</p>
              </div>
            )}

            <form onSubmit={enviar} className="mt-6 space-y-5">
              <Input
                label="Usuario"
                type="text"
                autoComplete="username"
                inputMode="text"
                placeholder="ADMINISTRADOR"
                value={usuario}
                onChange={(evento) => setUsuario(evento.target.value)}
                required
                disabled={cargando}
              />
              <div className="relative">
                <Input
                  label="Contraseña"
                  type={mostrarClave ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Tu contraseña"
                  value={clave}
                  onChange={(evento) => setClave(evento.target.value)}
                  required
                  disabled={cargando}
                  className="pr-12"
                />
                <button
                  type="button"
                  onClick={() => setMostrarClave((valor) => !valor)}
                  aria-label={mostrarClave ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  className="absolute right-2 top-[30px] inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                >
                  {mostrarClave ? <EyeOff className="h-5 w-5" aria-hidden="true" /> : <Eye className="h-5 w-5" aria-hidden="true" />}
                </button>
              </div>

              {permitirMantener && (
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <input
                    type="checkbox"
                    checked={mantenerSesion}
                    onChange={(evento) => setMantenerSesion(evento.target.checked)}
                    disabled={cargando}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-brand-600 accent-brand-600 focus:ring-brand-500"
                  />
                  <span className="text-sm leading-relaxed text-slate-600">
                    <span className="font-semibold text-slate-800">Mantener la sesión activa</span>
                    <span className="block text-xs text-slate-500">
                      No vuelvas a escribir tu clave en este dispositivo. Si lo desactivas, la sesión
                      termina al cerrar el navegador.
                    </span>
                  </span>
                </label>
              )}

              <div className="flex items-center justify-end">
                <Link
                  to="/recuperar-clave"
                  className="text-sm font-semibold text-brand-700 hover:text-brand-800 hover:underline"
                >
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>

              <Button type="submit" size="lg" fullWidth loading={cargando} leftIcon={LockKeyhole}>
                {cargando ? 'Verificando datos…' : 'Entrar al sistema'}
              </Button>
            </form>

            <div className="mt-6 rounded-xl border border-brand-100 bg-brand-50 p-4 text-sm text-brand-900">
              <p className="flex items-start gap-2 font-bold">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                ¿Es tu primera vez?
              </p>
              <p className="mt-1.5 pl-6 leading-relaxed text-brand-900/80">
                El administrador crea tu usuario con una clave temporal. Al entrar deberás crear una
                nueva y confirmarla dos veces. Tu menú se mostrará según tu rol.
              </p>
            </div>
          </div>
          <p className="mt-6 text-center text-xs text-slate-400">
            Al ingresar aceptas usar la información únicamente para fines operativos autorizados.
          </p>
        </div>
      </div>
    </div>
  );
}

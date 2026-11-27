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
    <div className="min-h-screen bg-[#0e1217] lg:grid lg:grid-cols-[1.05fr_1fr]">
      {/* Panel institucional / escritorio */}
      <div className="relative hidden overflow-hidden bg-metal-oscuro px-12 py-14 text-white ring-1 ring-white/10 lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -right-32 -top-40 h-[28rem] w-[28rem] rounded-full bg-gold-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-48 -left-32 h-[30rem] w-[30rem] rounded-full bg-brand-500/20 blur-3xl" />
        <div className="relative flex items-center gap-4">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20 shadow-lg">
            <Emblema className="h-14 w-14" />
          </div>
          <div>
            <p className="text-xl font-extrabold tracking-tight text-metalico">ESCOLTAS</p>
            <p className="text-xs uppercase tracking-[0.2em] text-oro">Seguridad y Vigilancia</p>
          </div>
        </div>

        <div className="relative max-w-xl">
          <div className="inline-flex items-center gap-2 rounded-full badge-cromo px-3 py-1 text-xs font-semibold text-slate-200 mb-4">
            <span className="h-2 w-2 rounded-full bg-[#ff8a00]" />
            Control de Personal · Servicios · Nómina
          </div>
          <h1 className="text-4xl font-extrabold leading-tight text-emblem-gray xl:text-5xl text-metalico">
            Control integral de escoltas y seguridad
          </h1>
          <p className="mt-5 text-base leading-relaxed text-slate-300">
            Centraliza el control de personal, expedientes digitales, turnos, descansos reglamentarios,
            servicios de vigilancia y nómina en bolívares y dólares con total trazabilidad.
          </p>
          <ul className="mt-9 space-y-4 text-sm text-slate-200">
            {[
              'Expediente individual y distribución en tiempo real',
              'Gestión de descansos acumulados y rotaciones',
              'Cálculo automático de nómina en Bs y USD (Tasa BCV)',
              'Acceso administrativo PC y portal ágil móvil',
            ].map((texto) => (
              <li key={texto} className="flex items-center gap-3">
                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#ff8a00] text-xs font-bold text-white shadow">
                  ✓
                </span>
                {texto}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-slate-400">
          ESCOLTAS · Seguridad y Vigilancia · Acceso restringido por rol
        </p>
      </div>

      {/* Formulario */}
      <div className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-8 lg:min-h-0">
        <div className="w-full max-w-md">
          <div className="mb-8 flex flex-col items-center gap-3 text-center lg:hidden">
            <Emblema className="h-20 w-20" />
            <div>
              <p className="text-lg font-extrabold text-metalico">ESCOLTAS</p>
              <p className="text-xs text-slate-400">Seguridad & Vigilancia Operativa</p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-700/60 bg-[#161b22] p-6 shadow-panel sm:p-8">
            <div className="mb-6 flex items-center gap-2 lg:hidden">
              <span className="h-1 w-10 rounded-full bg-brand-500" aria-hidden="true" />
              <p className="text-xs font-bold uppercase tracking-widest text-brand-400">Bienvenido</p>
            </div>

            <h2 className="text-2xl font-bold text-slate-100">Inicia sesión</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              Ingresa con el usuario que te dio el administrador, sin correo. Si es tu primera vez,
              te pediremos cambiar la contraseña temporal.
            </p>

            {!supabaseConfigurado && (
              <div className="mt-5 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-950/40 p-3 text-sm text-amber-200">
                <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <p>
                  El acceso no está disponible en este momento. Contacta al administrador del sistema.
                </p>
              </div>
            )}

            {error && (
              <div role="alert" className="mt-5 flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-950/40 p-3 text-sm font-medium text-rose-300">
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
                  className="absolute right-2 top-[30px] inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800"
                >
                  {mostrarClave ? <EyeOff className="h-5 w-5" aria-hidden="true" /> : <Eye className="h-5 w-5" aria-hidden="true" />}
                </button>
              </div>

              {permitirMantener && (
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-700/60 bg-[#0e1217]/60 p-3">
                  <input
                    type="checkbox"
                    checked={mantenerSesion}
                    onChange={(evento) => setMantenerSesion(evento.target.checked)}
                    disabled={cargando}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-600 bg-slate-800 text-brand-600 accent-brand-600 focus:ring-brand-500"
                  />
                  <span className="text-sm leading-relaxed text-slate-300">
                    <span className="font-semibold text-slate-100">Mantener la sesión activa</span>
                    <span className="block text-xs text-slate-400">
                      No vuelvas a escribir tu clave en este dispositivo. Si lo desactivas, la sesión
                      termina al cerrar el navegador.
                    </span>
                  </span>
                </label>
              )}

              <div className="flex items-center justify-end">
                <Link
                  to="/recuperar-clave"
                  className="text-sm font-semibold text-brand-400 hover:text-brand-300 hover:underline"
                >
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>

              <Button type="submit" size="lg" fullWidth loading={cargando} leftIcon={LockKeyhole}>
                {cargando ? 'Verificando datos…' : 'Entrar al sistema'}
              </Button>
            </form>

            <div className="mt-6 rounded-xl border border-brand-500/20 bg-brand-950/30 p-4 text-sm text-brand-200">
              <p className="flex items-start gap-2 font-bold">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                ¿Es tu primera vez?
              </p>
              <p className="mt-1.5 pl-6 leading-relaxed text-brand-200/80">
                El administrador crea tu usuario con una clave temporal. Al entrar deberás crear una
                nueva y confirmarla dos veces. Tu menú se mostrará según tu rol.
              </p>
            </div>
          </div>
          <p className="mt-6 text-center text-xs text-slate-500">
            Al ingresar aceptas usar la información únicamente para fines operativos autorizados.
          </p>
        </div>
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Info, KeyRound, LogOut, ShieldCheck } from 'lucide-react';
import { Button, Input, useToast } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';

function CampoClave({ etiqueta, valor, onChange, deshabilitado, autoComplete }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input
        label={etiqueta}
        type={visible ? 'text' : 'password'}
        autoComplete={autoComplete}
        placeholder="Mínimo 8 caracteres"
        value={valor}
        onChange={onChange}
        required
        disabled={deshabilitado}
        className="pr-12"
      />
      <button
        type="button"
        onClick={() => setVisible((actual) => !actual)}
        aria-label={visible ? `Ocultar ${etiqueta}` : `Mostrar ${etiqueta}`}
        className="absolute right-2 top-[30px] inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
      >
        {visible ? <EyeOff className="h-5 w-5" aria-hidden="true" /> : <Eye className="h-5 w-5" aria-hidden="true" />}
      </button>
    </div>
  );
}

export default function CambiarClave() {
  const { cambiarClave, debeCambiarClave, signOut } = useAuth();
  const navegar = useNavigate();
  const ubicacion = useLocation();
  const toast = useToast();
  const desdeCorreo = new URLSearchParams(ubicacion.search).get('origen') === 'recuperacion';

  const [clave, setClave] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [lista, setLista] = useState(false);

  const enviar = async (evento) => {
    evento.preventDefault();
    setError('');

    if (clave.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (clave !== confirmacion) {
      setError('Las contraseñas no coinciden. Revisa el campo de confirmación.');
      return;
    }

    try {
      setCargando(true);
      const mensaje = await cambiarClave(clave, confirmacion);
      toast.success('Contraseña actualizada', mensaje);
      navegar('/', { replace: true });
    } catch (errorCambio) {
      setError(errorCambio.message || 'No se pudo actualizar la contraseña. Intenta de nuevo.');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <img
            src="/logo-escoltas.png"
            alt="Emblema de Seguridad Escoltas"
            className="h-20 w-20 object-contain"
          />
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-700">Seguridad de la cuenta</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-panel sm:p-8">
          <h1 className="text-2xl font-bold text-slate-900">
            {desdeCorreo ? 'Restablece tu contraseña' : 'Cambia tu contraseña'}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            {debeCambiarClave
              ? 'Estás usando una contraseña temporal. Crea una nueva para continuar; este paso es obligatorio.'
              : 'Elige una contraseña nueva y confírmala para asegurarte de que escribiste correctamente.'}
          </p>

          {(debeCambiarClave || desdeCorreo) && (
            <div className="mt-5 flex items-start gap-2 rounded-xl border border-brand-200 bg-brand-50 p-3 text-sm text-brand-900">
              <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <p>Escribe la contraseña dos veces: una en cada campo. Deben coincidir exactamente.</p>
            </div>
          )}

          {error && (
            <div role="alert" className="mt-5 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-800">
              <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <p>{error}</p>
            </div>
          )}

          <form onSubmit={enviar} className="mt-6 space-y-5">
            <CampoClave
              etiqueta="Nueva contraseña"
              valor={clave}
              onChange={(evento) => {
                setClave(evento.target.value);
                setLista(true);
              }}
              deshabilitado={cargando}
              autoComplete="new-password"
            />
            <CampoClave
              etiqueta="Confirma la nueva contraseña"
              valor={confirmacion}
              onChange={(evento) => setConfirmacion(evento.target.value)}
              deshabilitado={cargando}
              autoComplete="new-password"
            />

            {lista && (
              <ul className="space-y-1 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
                <li className={clave.length >= 8 ? 'font-semibold text-emerald-700' : ''}>
                  {clave.length >= 8 ? '✓' : '•'} Al menos 8 caracteres
                </li>
                <li className={clave && clave === confirmacion ? 'font-semibold text-emerald-700' : ''}>
                  {clave && clave === confirmacion ? '✓' : '•'} Las contraseñas coinciden
                </li>
              </ul>
            )}

            <Button type="submit" size="lg" fullWidth loading={cargando} leftIcon={KeyRound}>
              {cargando ? 'Guardando contraseña…' : 'Guardar nueva contraseña'}
            </Button>
          </form>

          <div className="mt-6 flex flex-col items-center gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-between">
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
              <ShieldCheck className="h-4 w-4 text-brand-700" aria-hidden="true" />
              No compartas tu contraseña
            </span>
            {debeCambiarClave && (
              <button
                type="button"
                onClick={() => signOut().then(() => navegar('/login', { replace: true }))}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-brand-700"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                Cerrar sesión
              </button>
            )}
            {!debeCambiarClave && (
              <Link to="/" className="text-xs font-semibold text-brand-700 hover:underline">
                Volver al inicio
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

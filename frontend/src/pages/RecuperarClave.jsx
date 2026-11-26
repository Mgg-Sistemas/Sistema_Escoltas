import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Info, MailCheck, Send } from 'lucide-react';
import { Button, Input } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function RecuperarClave() {
  const { recuperarClave } = useAuth();
  const [usuario, setUsuario] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [enviado, setEnviado] = useState(false);

  const enviar = async (evento) => {
    evento.preventDefault();
    setError('');
    if (!usuario.trim()) {
      setError('Escribe tu usuario para continuar.');
      return;
    }
    try {
      setCargando(true);
      const mensaje = await recuperarClave(usuario);
      setEnviado(true);
      setError(mensaje);
    } catch (errorEnvio) {
      setError(errorEnvio.message || 'No se pudo enviar el correo. Intenta nuevamente.');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0e1217] px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <img
            src="/logo-escoltas.png"
            alt="Emblema de Seguridad Escoltas"
            className="h-20 w-20 object-contain"
          />
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-400">Recuperación</p>
        </div>

        <div className="rounded-2xl border border-slate-700/60 bg-[#161b22] p-6 shadow-panel sm:p-8">
          <h1 className="text-2xl font-bold text-slate-100">Recupera tu contraseña</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            Escribe el usuario con el que ingresas. Te enviaremos un enlace seguro a tu correo
            interno para crear una contraseña nueva. Por seguridad, siempre se te pedirá confirmarla
            dos veces.
          </p>

          {enviado ? (
            <div className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-950/40 p-4 text-sm text-emerald-200">
              <p className="flex items-start gap-2 font-bold text-emerald-100">
                <MailCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                Revisa tu correo
              </p>
              <p className="mt-1.5 pl-6 leading-relaxed">
                {error || 'Si la cuenta existe, ya enviamos las instrucciones. El enlace puede tardar un par de minutos.'}
              </p>
            </div>
          ) : (
            <form onSubmit={enviar} className="mt-6 space-y-5">
              {error && (
                <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-950/40 p-3 text-sm font-medium text-rose-300">
                  <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <p>{error}</p>
                </div>
              )}
              <Input
                label="Usuario"
                type="text"
                autoComplete="username"
                placeholder="ADMINISTRADOR"
                value={usuario}
                onChange={(evento) => setUsuario(evento.target.value)}
                required
                disabled={cargando}
              />
              <Button type="submit" size="lg" fullWidth loading={cargando} leftIcon={Send}>
                {cargando ? 'Enviando enlace…' : 'Enviar enlace de recuperación'}
              </Button>
            </form>
          )}

          <Link
            to="/login"
            className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-brand-400 hover:text-brand-300 hover:underline"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Volver al inicio de sesión
          </Link>
        </div>
      </div>
    </div>
  );
}

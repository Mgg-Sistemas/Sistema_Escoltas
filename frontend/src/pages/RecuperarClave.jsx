import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Info, MailCheck, Send } from 'lucide-react';
import { Button, Input } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function RecuperarClave() {
  const { recuperarClave } = useAuth();
  const [correo, setCorreo] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [enviado, setEnviado] = useState(false);

  const enviar = async (evento) => {
    evento.preventDefault();
    setError('');
    if (!correo.trim()) {
      setError('Escribe tu correo electrónico para continuar.');
      return;
    }
    try {
      setCargando(true);
      const mensaje = await recuperarClave(correo);
      setEnviado(true);
      setError(mensaje);
    } catch (errorEnvio) {
      setError(errorEnvio.message || 'No se pudo enviar el correo. Intenta nuevamente.');
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
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-700">Recuperación</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-panel sm:p-8">
          <h1 className="text-2xl font-bold text-slate-900">Recupera tu contraseña</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            Escribe el correo con el que ingresas. Te enviaremos un enlace seguro para crear una
            contraseña nueva. Por seguridad, siempre se te pedirá confirmarla dos veces.
          </p>

          {enviado ? (
            <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
              <p className="flex items-start gap-2 font-bold">
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
                <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-800">
                  <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <p>{error}</p>
                </div>
              )}
              <Input
                label="Correo electrónico"
                type="email"
                autoComplete="email"
                placeholder="nombre@empresa.com"
                value={correo}
                onChange={(evento) => setCorreo(evento.target.value)}
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
            className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-brand-700 hover:underline"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Volver al inicio de sesión
          </Link>
        </div>
      </div>
    </div>
  );
}

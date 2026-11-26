import React, { useState } from 'react';
import { RefreshCw, Sparkles } from 'lucide-react';
import { useVersionCheck } from '../hooks/useVersionCheck.js';

/**
 * Banner superior global de actualización.
 * Aparece en la parte de arriba del sistema cuando el bot o Git publica una nueva versión.
 * Todo el banner es clickeable para aplicar la actualización al instante.
 */
export default function BannerActualizacion() {
  const { hayActualizacion, actualizarSistema, mensaje, versionNueva } = useVersionCheck();
  const [recargando, setRecargando] = useState(false);

  if (!hayActualizacion) return null;

  const handleClick = async () => {
    if (recargando) return;
    setRecargando(true);
    await actualizarSistema();
  };

  const handleKeyDown = (evento) => {
    if (evento.key === 'Enter' || evento.key === ' ') {
      evento.preventDefault();
      handleClick();
    }
  };

  return (
    <div
      role="alert"
      aria-live="assertive"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      title="Haga clic aquí para actualizar y cargar la última versión del sistema"
      className="sticky top-0 z-[100] w-full cursor-pointer border-b border-amber-400/40 bg-gradient-to-r from-amber-600 via-brand-600 to-amber-700 px-4 py-2.5 text-white shadow-2xl transition-all hover:brightness-110 active:brightness-95 animate-in fade-in slide-in-from-top-4 duration-300"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 text-xs sm:text-sm">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="relative flex h-3 w-3 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-amber-200" />
          </span>

          <RefreshCw
            className={`h-4 w-4 shrink-0 text-amber-100 ${recargando ? 'animate-spin' : 'animate-spin'}`}
            style={{ animationDuration: recargando ? '0.7s' : '3s' }}
            aria-hidden="true"
          />

          <p className="font-bold tracking-wide truncate">
            {recargando
              ? 'Actualizando sistema a la última versión… por favor espere.'
              : mensaje || 'El sistema esta actualizandose, por favor haga click aca para tener la ultima version.'}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {versionNueva && (
            <span className="hidden md:inline-flex rounded-full bg-black/30 px-2.5 py-0.5 text-[11px] font-mono text-amber-200 border border-white/10">
              v{versionNueva}
            </span>
          )}
          <span className="inline-flex items-center gap-1 rounded-lg bg-white/20 px-3 py-1 font-extrabold text-xs uppercase tracking-wider shadow-sm backdrop-blur-md hover:bg-white/30 transition-colors">
            <Sparkles className="h-3 w-3" aria-hidden="true" />
            {recargando ? 'Recargando…' : 'Actualizar ahora'}
          </span>
        </div>
      </div>
    </div>
  );
}

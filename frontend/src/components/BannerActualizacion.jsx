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
      className="sticky top-0 z-[100] w-full cursor-pointer border-b border-[#8c5e26]/50 bg-gradient-to-r from-[#261f18] via-[#312519] to-[#221a14] px-4 py-2 text-[#f5ede3] shadow-lg transition-all hover:bg-[#382b1d] active:brightness-95 duration-200"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 text-xs sm:text-sm">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#ffd54a] opacity-50" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#ffd54a]" />
          </span>

          <RefreshCw
            className={`h-4 w-4 shrink-0 text-[#ffd54a]/90 ${recargando ? 'animate-spin' : 'animate-spin'}`}
            style={{ animationDuration: recargando ? '0.7s' : '4s' }}
            aria-hidden="true"
          />

          <p className="font-medium tracking-wide truncate text-[#f2e6d8]">
            {recargando
              ? 'Actualizando sistema a la última versión… por favor espere.'
              : mensaje || 'Nueva versión disponible. Haz clic para actualizar el sistema al instante.'}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {versionNueva && (
            <span className="hidden md:inline-flex rounded-full bg-black/40 px-2 py-0.5 text-[11px] font-mono text-[#ffd54a] border border-[#8c5e26]/30">
              v{versionNueva}
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#ff8a00]/20 hover:bg-[#ff8a00]/30 px-3 py-1 font-bold text-xs uppercase tracking-wider text-[#ffd54a] border border-[#ff8a00]/30 shadow-sm transition-colors">
            <Sparkles className="h-3 w-3 text-[#ffd54a]" aria-hidden="true" />
            {recargando ? 'Recargando…' : 'Actualizar ahora'}
          </span>
        </div>
      </div>
    </div>
  );
}

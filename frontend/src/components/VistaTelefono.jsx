import React from 'react';
import { Link } from 'react-router-dom';
import { Menu, ShieldCheck } from 'lucide-react';

const ETIQUETAS = [
  ['/distribucion', 'Turnos'],
  ['/asistencias', 'Asistencia'],
  ['/permisos', 'Permisos'],
  ['/escoltas', 'Personal'],
  ['/nomina', 'Nómina'],
];

const claseAcceso =
  'flex min-h-24 w-full flex-col items-start justify-center gap-2 rounded-2xl border border-slate-800 bg-[#161a22] p-4 text-left text-sm font-bold text-white hover:border-[#ff8a00] hover:bg-[#1c222b] transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ff8a00] shadow-md';

export default function VistaTelefono({ items = [], alNavegar, alAbrirMenu }) {
  // Filtra los accesos basándose estrictamente en los módulos autorizados para el rol actual
  const accesos = ETIQUETAS.flatMap(([ruta, etiqueta]) => {
    const item = items.find(({ to }) => to === ruta);
    return item ? [{ ...item, etiqueta }] : [];
  });

  return (
    <section className="mx-auto w-full max-w-md rounded-3xl border border-slate-800 bg-[#0e1217] p-5 sm:p-6 shadow-2xl select-none" aria-label="Inicio para teléfono">
      <header className="mb-6 flex items-center gap-3 border-b border-slate-800 pb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#ff8a00] to-[#ffd54a] p-0.5 shadow-md">
          <div className="flex h-full w-full items-center justify-center rounded-[10px] bg-[#14171c]">
            <ShieldCheck className="h-5 w-5 text-[#ff8a00]" aria-hidden="true" />
          </div>
        </div>
        <div>
          <h1 className="text-lg font-black tracking-tight text-white leading-none">
            ESCOLTAS
          </h1>
          <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#ff8a00] mt-0.5">
            Seguridad y Vigilancia
          </p>
        </div>
      </header>

      {/* Grid oficial de 6 botones limpios (accesos permitidos + Más) */}
      <nav aria-label="Accesos principales" className="grid grid-cols-2 gap-3.5">
        {accesos.map(({ to, etiqueta, icon: Icono }) => (
          <Link key={to} to={to} onClick={alNavegar} className={claseAcceso}>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-800 border border-slate-700/60 text-[#ff8a00]">
              <Icono className="h-5 w-5" aria-hidden="true" />
            </div>
            <span className="text-sm font-black text-slate-100">{etiqueta}</span>
          </Link>
        ))}

        {/* Botón 6: Más (abre el menú lateral completo con el resto de opciones permitidas) */}
        <button type="button" onClick={alAbrirMenu} className={claseAcceso}>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-800 border border-slate-700/60 text-[#ffd54a]">
            <Menu className="h-5 w-5" aria-hidden="true" />
          </div>
          <span className="text-sm font-black text-slate-100">Más</span>
        </button>
      </nav>
    </section>
  );
}

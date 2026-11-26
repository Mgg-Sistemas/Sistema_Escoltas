import React from 'react';
import { ChevronRight } from 'lucide-react';
import { EmptyState, Skeleton } from './ui.jsx';

function valorCelda(columna, fila) {
  if (typeof columna.render === 'function') return columna.render(fila);
  const clave = columna.key || columna.clave;
  const valor = fila?.[clave];
  return valor === null || valor === undefined || valor === '' ? '—' : valor;
}

/**
 * Tabla adaptativa para escritorio y lista de tarjetas táctiles en móvil.
 * Soporta columns/data y columnas/filas (compatibilidad GT).
 */
export default function DataTable({
  columns = [],
  data = [],
  columnas = [],
  filas = [],
  loading = false,
  cargando = false,
  keyField = 'id',
  onRowClick,
  actions,
  emptyTitle,
  mensajeVacio,
  emptyDescription = 'Cuando existan datos aparecerán aquí.',
  emptyActionLabel,
  onEmptyAction,
  emptyIcon,
}) {
  const effectiveColumns = columns.length > 0
    ? columns
    : columnas.map((c) => ({
        key: c.clave || c.key,
        label: c.encabezado || c.label,
        render: c.render,
        primary: c.primario || c.primary,
        mobile: c.movil !== undefined ? c.movil : c.mobile,
        className: c.className,
      }));

  const effectiveData = data.length > 0 ? data : filas;
  const isLoading = loading || cargando;
  const emptyText = emptyTitle || mensajeVacio || 'Aún no hay registros';

  const columnasPrincipales = effectiveColumns.filter((columna) => columna.primary);
  const principal = columnasPrincipales[0] || effectiveColumns[0];
  const columnasMovil = effectiveColumns.filter(
    (columna) => columna !== principal && columna.mobile !== false,
  );

  if (isLoading) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Cargando datos">
        {Array.from({ length: 5 }, (_, indice) => (
          <div key={indice} className="flex items-center gap-4 rounded-xl border border-slate-800 bg-[#161b22] p-4">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="hidden h-6 w-20 sm:block" />
          </div>
        ))}
      </div>
    );
  }

  if (!effectiveData.length) {
    return (
      <EmptyState
        title={emptyText}
        description={emptyDescription}
        actionLabel={emptyActionLabel}
        onAction={onEmptyAction}
        icon={emptyIcon}
      />
    );
  }

  return (
    <>
      {/* Vista móvil: tarjetas oscuras de alto contraste */}
      <div className="space-y-3 md:hidden">
        {effectiveData.map((fila, idx) => (
          <div
            key={fila[keyField] || idx}
            role={onRowClick ? 'button' : undefined}
            tabIndex={onRowClick ? 0 : undefined}
            onClick={onRowClick ? () => onRowClick(fila) : undefined}
            onKeyDown={onRowClick ? (evento) => {
              if (evento.key === 'Enter' || evento.key === ' ') {
                evento.preventDefault();
                onRowClick(fila);
              }
            } : undefined}
            className={`rounded-2xl border border-slate-700/60 bg-[#161b22] p-4 shadow-card ${onRowClick ? 'cursor-pointer transition-colors hover:border-brand-500' : ''}`}
          >
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                {principal && (
                  <div className={`text-sm font-bold text-slate-100 ${principal.className || ''}`}>
                    {valorCelda(principal, fila)}
                  </div>
                )}
                {columnasMovil.length > 0 && (
                  <dl className="mt-3 grid grid-cols-1 gap-x-3 gap-y-2">
                    {columnasMovil.map((columna) => (
                      <div key={columna.key || columna.label} className="flex min-w-0 items-center justify-between gap-3 text-sm">
                        <dt className="shrink-0 text-xs font-medium text-slate-400">{columna.label}</dt>
                        <dd className={`min-w-0 truncate text-right font-medium text-slate-200 ${columna.className || ''}`}>
                          {valorCelda(columna, fila)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
              {onRowClick && <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />}
            </div>
            {actions && (
              <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-800 pt-3" onClick={(evento) => evento.stopPropagation()}>
                {actions(fila)}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Vista escritorio: tabla oscura profesional y descansada con scroll horizontal si es necesario */}
      <div className="hidden overflow-x-auto rounded-xl border border-slate-700/60 bg-[#161b22] md:block shadow-sm">
        <table className="min-w-full divide-y divide-slate-800 text-left text-sm">
          <thead className="bg-slate-800/80">
            <tr>
              {effectiveColumns.map((columna) => (
                <th
                  key={columna.key || columna.label}
                  scope="col"
                  className="whitespace-nowrap px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-400"
                >
                  {columna.label}
                </th>
              ))}
              {actions && (
                <th
                  scope="col"
                  className="whitespace-nowrap px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-400 min-w-[150px] w-[160px]"
                >
                  Acción
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80">
            {effectiveData.map((fila, idx) => (
              <tr
                key={fila[keyField] || idx}
                onClick={onRowClick ? () => onRowClick(fila) : undefined}
                className={onRowClick ? 'cursor-pointer transition-colors hover:bg-slate-800/50' : 'hover:bg-slate-800/40'}
              >
                {effectiveColumns.map((columna) => (
                  <td key={columna.key || columna.label} className={`whitespace-nowrap px-4 py-3.5 text-slate-200 ${columna.className || ''}`}>
                    {valorCelda(columna, fila)}
                  </td>
                ))}
                {actions && (
                  <td className="whitespace-nowrap px-4 py-3.5 text-right min-w-[130px]" onClick={(evento) => evento.stopPropagation()}>
                    <div className="inline-flex items-center justify-end gap-1.5">{actions(fila)}</div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

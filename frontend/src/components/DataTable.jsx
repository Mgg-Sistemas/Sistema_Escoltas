import React from 'react';
import { ChevronRight } from 'lucide-react';
import { EmptyState, Skeleton } from './ui.jsx';

function valorCelda(columna, fila) {
  if (typeof columna.render === 'function') return columna.render(fila);
  const valor = fila?.[columna.key];
  return valor === null || valor === undefined || valor === '' ? '—' : valor;
}

/**
 * Tabla en escritorio y lista de tarjetas en móvil.
 * columnas: [{ key, label, render, primary, mobile, className }]
 */
export default function DataTable({
  columns = [],
  data = [],
  loading = false,
  keyField = 'id',
  onRowClick,
  actions,
  emptyTitle = 'Aún no hay registros',
  emptyDescription = 'Cuando existan datos aparecerán aquí. Puedes crear el primero con el botón de acción.',
  emptyActionLabel,
  onEmptyAction,
  emptyIcon,
}) {
  const columnasPrincipales = columns.filter((columna) => columna.primary);
  const principal = columnasPrincipales[0] || columns[0];
  const columnasMovil = columns.filter(
    (columna) => columna !== principal && columna.mobile !== false,
  );

  if (loading) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Cargando datos">
        {Array.from({ length: 5 }, (_, indice) => (
          <div key={indice} className="flex items-center gap-4 rounded-xl border border-slate-100 p-4">
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

  if (!data.length) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        actionLabel={emptyActionLabel}
        onAction={onEmptyAction}
        icon={emptyIcon}
      />
    );
  }

  return (
    <>
      {/* Vista móvil: tarjetas grandes y táctiles */}
      <div className="space-y-3 md:hidden">
        {data.map((fila) => (
          <div
            key={fila[keyField]}
            role={onRowClick ? 'button' : undefined}
            tabIndex={onRowClick ? 0 : undefined}
            onClick={onRowClick ? () => onRowClick(fila) : undefined}
            onKeyDown={onRowClick ? (evento) => {
              if (evento.key === 'Enter' || evento.key === ' ') {
                evento.preventDefault();
                onRowClick(fila);
              }
            } : undefined}
            className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-card ${onRowClick ? 'cursor-pointer transition-colors hover:border-brand-200' : ''}`}
          >
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                {principal && (
                  <div className={`text-sm font-bold text-slate-900 ${principal.className || ''}`}>
                    {valorCelda(principal, fila)}
                  </div>
                )}
                {columnasMovil.length > 0 && (
                  <dl className="mt-3 grid grid-cols-1 gap-x-3 gap-y-2">
                    {columnasMovil.map((columna) => (
                      <div key={columna.key || columna.label} className="flex min-w-0 items-center justify-between gap-3 text-sm">
                        <dt className="shrink-0 text-xs font-medium text-slate-500">{columna.label}</dt>
                        <dd className={`min-w-0 truncate text-right font-medium text-slate-700 ${columna.className || ''}`}>
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
              <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3" onClick={(evento) => evento.stopPropagation()}>
                {actions(fila)}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Vista escritorio */}
      <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white md:block">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead className="bg-slate-50">
            <tr>
              {columns.map((columna) => (
                <th
                  key={columna.key || columna.label}
                  scope="col"
                  className="whitespace-nowrap px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500"
                >
                  {columna.label}
                </th>
              ))}
              {actions && <th scope="col" className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-500">Acciones</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.map((fila) => (
              <tr
                key={fila[keyField]}
                onClick={onRowClick ? () => onRowClick(fila) : undefined}
                className={onRowClick ? 'cursor-pointer transition-colors hover:bg-slate-50' : 'hover:bg-slate-50/60'}
              >
                {columns.map((columna) => (
                  <td key={columna.key || columna.label} className={`whitespace-nowrap px-4 py-3 text-slate-700 ${columna.className || ''}`}>
                    {valorCelda(columna, fila)}
                  </td>
                ))}
                {actions && (
                  <td className="whitespace-nowrap px-4 py-3 text-right" onClick={(evento) => evento.stopPropagation()}>
                    <div className="inline-flex flex-wrap justify-end gap-2">{actions(fila)}</div>
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

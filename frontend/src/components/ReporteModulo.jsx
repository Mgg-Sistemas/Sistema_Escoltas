import React, { useState } from 'react';
import { FileText } from 'lucide-react';
import { Button, Modal, useToast } from './ui.jsx';

export default function ReporteModulo({ titulo, archivo, columnas, filas, indicadores = [], pdfPersonalizado, deshabilitado = false }) {
  const toast = useToast();
  const [abierto, setAbierto] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const permiteExportar = !deshabilitado && filas.length > 0;
  const vistaPrevia = abierto ? filas.slice(0, 8) : [];
  const fecha = new Intl.DateTimeFormat('es-VE', { dateStyle: 'short', timeZone: 'America/Caracas' }).format(new Date());
  const tarjetas = [['Registros', filas.length], ...indicadores, ['Emitido', fecha]];
  const mensaje = ['ESCOLTAS | ' + titulo, ...tarjetas.map(([etiqueta, valor]) => etiqueta + ': ' + valor)].join('\n');

  const exportar = async (formato) => {
    setProcesando(true);
    try {
      if (formato === 'pdf' && pdfPersonalizado) {
        await pdfPersonalizado();
        return;
      }
      const { generarPdf, generarCsv, generarExcel, descargarArchivo } = await import('../lib/reportes.js');
      if (formato === 'pdf') {
        const pdf = await generarPdf({ titulo, columnas, filas, tarjetas });
        pdf.save(archivo + '.pdf');
      } else if (formato === 'xlsx') {
        descargarArchivo(await generarExcel(columnas, filas), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', archivo + '.xlsx');
      } else {
        descargarArchivo(generarCsv(columnas, filas), 'text/csv;charset=utf-8', archivo + '.csv');
      }
    } catch {
      toast.error('No se pudo descargar el reporte. Intenta nuevamente.');
    } finally {
      setProcesando(false);
    }
  };

  return (
    <>
      <Button type="button" size="sm" variant="outline" leftIcon={FileText} aria-haspopup="dialog" onClick={() => setAbierto(true)}>
        Reporte
      </Button>

      <Modal
        open={abierto}
        onClose={() => setAbierto(false)}
        title={titulo}
        description="Vista previa del reporte del módulo"
        size="lg"
        footer={(
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" variant="primary" disabled={!permiteExportar || procesando} onClick={() => exportar('pdf')}>
              Descargar PDF
            </Button>
            {[['xlsx', 'Excel'], ['csv', 'CSV']].map(([formato, etiqueta]) => (
              <Button key={formato} type="button" size="sm" variant="outline" disabled={!permiteExportar || procesando} onClick={() => exportar(formato)}>
                {etiqueta}
              </Button>
            ))}
            {permiteExportar && (
              <a className="inline-flex min-h-10 items-center rounded-lg border border-emerald-500/40 px-3 text-sm font-semibold text-emerald-300" href={'https://wa.me/?text=' + encodeURIComponent(mensaje)} target="_blank" rel="noopener noreferrer">
                Preparar WhatsApp
              </a>
            )}
          </div>
        )}
      >
        {deshabilitado ? (
          <p role="status" className="text-sm text-chrome-200">Cargando los datos del reporte…</p>
        ) : !filas.length ? (
          <p role="status" className="text-sm text-chrome-200">No hay registros para este reporte.</p>
        ) : (
          <div className="space-y-4">
            <dl className="flex flex-wrap gap-2">
              {tarjetas.map(([etiqueta, valor]) => (
                <div key={etiqueta} className="min-w-24 rounded-lg border border-brand-500/20 bg-brand-950/40 px-3 py-2">
                  <dt className="text-xs text-chrome-200">{etiqueta}</dt>
                  <dd className="font-semibold text-brand-300">{valor}</dd>
                </div>
              ))}
            </dl>
            <div className="overflow-x-auto rounded-lg border border-chrome-700" tabIndex={0} role="region" aria-label="Tabla de vista previa">
              <table className="w-full text-left text-sm">
                <thead className="bg-chrome-800 text-chrome-100">
                  <tr>{columnas.map((columna) => <th key={columna} scope="col" className="px-3 py-2">{columna}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-chrome-700">
                  {vistaPrevia.map((fila, indice) => (
                    <tr key={indice}>
                      {fila.map((valor, columna) => <td key={columna} className="break-words px-3 py-2">{valor ?? '—'}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filas.length > vistaPrevia.length && (
              <p className="text-xs text-chrome-200">Se muestran {vistaPrevia.length} de {filas.length} registros. Las descargas incluyen todos los registros del reporte.</p>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}

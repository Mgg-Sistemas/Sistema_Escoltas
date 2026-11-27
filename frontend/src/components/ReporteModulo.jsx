import React, { useState } from 'react';
import { Download } from 'lucide-react';
import { Button, useToast } from './ui.jsx';

export default function ReporteModulo({ titulo, archivo, columnas, filas, indicadores = [], pdfPersonalizado, deshabilitado = false }) {
  const toast = useToast();
  const [procesando, setProcesando] = useState(false);
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
    <details className="rounded-xl border border-chrome-700 bg-chrome-800 px-4">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-sm font-semibold text-chrome-100">
        <Download className="h-4 w-4 text-brand-400" aria-hidden="true" /> Exportar reporte
      </summary>
      <div className="flex flex-wrap items-center gap-2 pb-3">
        {[['pdf', 'PDF'], ['xlsx', 'Excel'], ['csv', 'CSV']].map(([formato, etiqueta]) => (
          <Button key={formato} type="button" size="sm" variant="outline" disabled={deshabilitado || procesando || !filas.length} onClick={() => exportar(formato)}>
            {etiqueta}
          </Button>
        ))}
        {!deshabilitado && filas.length > 0 && (
          <a className="inline-flex min-h-10 items-center rounded-lg border border-emerald-500/40 px-3 text-sm font-semibold text-emerald-300" href={'https://wa.me/?text=' + encodeURIComponent(mensaje)} target="_blank" rel="noopener noreferrer">
            Preparar WhatsApp
          </a>
        )}
      </div>
    </details>
  );
}

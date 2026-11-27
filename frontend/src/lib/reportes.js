import { MARGEN_PDF, MARGENES_TABLA_PDF, anchoUtilPdf, pdfSafe, obtenerLogoDataUrl } from './pdfLogo.js';

const COLORES_TARJETAS = ['#D97706', '#166534', '#2563EB', '#7C3AED'];
const FONDOS_TARJETAS = ['#FFFBEB', '#F0FDF4', '#EFF6FF', '#F5F3FF'];
const BORDES_TARJETAS = ['#FDE68A', '#BBF7D0', '#BFDBFE', '#DDD6FE'];

const fecha = () =>
  new Intl.DateTimeFormat('es-VE', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Caracas',
  }).format(new Date());

export async function generarPdf({ titulo, columnas, filas, tarjetas = [], firmas = [] }) {
  const [{ jsPDF }, { default: autoTable }, logoDataUrl] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
    obtenerLogoDataUrl(),
  ]);

  const pdf = new jsPDF({
    unit: 'pt',
    format: 'letter',
    orientation: columnas.length > 6 ? 'landscape' : 'portrait',
  });

  const ancho = pdf.internal.pageSize.getWidth();
  const alto = pdf.internal.pageSize.getHeight();
  const margen = MARGEN_PDF; // 56.7 pt (2 cm estrictos según regla GT)
  const disponible = anchoUtilPdf(ancho);

  pdf.setProperties({ title: titulo, author: 'SISTEMA ESCOLTAS' });

  // Encabezado institucional estilo Golden Touch con colores del sistema
  const headerY = margen;
  const altoLogo = 46;
  const anchoLogo = 46;

  if (logoDataUrl) {
    try {
      pdf.addImage(logoDataUrl, 'PNG', margen, headerY, anchoLogo, altoLogo);
    } catch {}
  }

  const textoX = logoDataUrl ? margen + anchoLogo + 14 : margen;
  const textoAncho = disponible - (logoDataUrl ? anchoLogo + 14 : 0);

  // Subtítulo institucional con naranja de marca
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8.5);
  pdf.setTextColor('#FF8A00');
  pdf.text('SISTEMA ESCOLTAS  ·  SEGURIDAD Y VIGILANCIA', textoX, headerY + 11);

  // Título principal del documento
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  pdf.setTextColor('#1E232B');
  pdf.text(pdfSafe(titulo), textoX, headerY + 28, { maxWidth: textoAncho });

  // Fecha y carácter oficial
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8.5);
  pdf.setTextColor('#64748B');
  pdf.text(`Emitido el ${fecha()}  ·  Documento Oficial`, textoX, headerY + 42);

  // Línea divisoria naranja (acento GT)
  const separadorY = headerY + 54;
  pdf.setDrawColor('#FF8A00');
  pdf.setLineWidth(1.5);
  pdf.line(margen, separadorY, ancho - margen, separadorY);

  let siguienteY = separadorY + 16;

  // Tarjetas KPI / Indicadores clave
  if (tarjetas && tarjetas.length > 0) {
    const anchoTarjeta = (disponible - (tarjetas.length - 1) * 10) / tarjetas.length;
    const altoTarjeta = 44;
    tarjetas.forEach(([etiqueta, valor], i) => {
      const x = margen + i * (anchoTarjeta + 10);
      const colorTexto = COLORES_TARJETAS[i % COLORES_TARJETAS.length];
      const fondo = FONDOS_TARJETAS[i % FONDOS_TARJETAS.length];
      const borde = BORDES_TARJETAS[i % BORDES_TARJETAS.length];

      pdf.setFillColor(fondo);
      pdf.setDrawColor(borde);
      pdf.setLineWidth(0.75);
      pdf.roundedRect(x, siguienteY, anchoTarjeta, altoTarjeta, 6, 6, 'FD');

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      pdf.setTextColor('#64748B');
      pdf.text(pdfSafe(etiqueta), x + 10, siguienteY + 16);

      pdf.setFontSize(12);
      pdf.setTextColor(colorTexto);
      pdf.text(pdfSafe(valor), x + 10, siguienteY + 34, { maxWidth: anchoTarjeta - 20 });
    });
    siguienteY += altoTarjeta + 16;
  }

  // Tabla principal con márgenes y diseño GT
  autoTable(pdf, {
    startY: siguienteY,
    margin: MARGENES_TABLA_PDF,
    head: [columnas.map(pdfSafe)],
    body: filas.map((fila) => fila.map(pdfSafe)),
    rowPageBreak: 'avoid',
    styles: {
      font: 'helvetica',
      fontSize: 8.5,
      cellPadding: 6,
      overflow: 'linebreak',
      textColor: '#1E293B',
      lineColor: '#E2E8F0',
      lineWidth: 0.5,
    },
    headStyles: {
      fillColor: '#1E232B',
      textColor: '#FFFFFF',
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'left',
    },
    alternateRowStyles: {
      fillColor: '#F8FAFC',
    },
  });

  // Firmas de validación
  if (firmas && firmas.length > 0) {
    let y = pdf.lastAutoTable.finalY + 36;
    if (y > alto - margen - 60) {
      pdf.addPage();
      y = margen + 40;
    }
    const anchoFirma = (disponible - (firmas.length - 1) * 20) / firmas.length;
    pdf.setDrawColor('#94A3B8');
    pdf.setLineWidth(0.75);
    pdf.setTextColor('#334155');
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.5);
    firmas.forEach((firma, indice) => {
      const x = margen + indice * (anchoFirma + 20);
      pdf.line(x, y, x + anchoFirma, y);
      pdf.text(pdfSafe(firma), x + anchoFirma / 2, y + 14, { align: 'center' });
    });
  }

  // Pie de página estricto de 2 cm en todas las páginas
  const totalPaginas = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPaginas; i++) {
    pdf.setPage(i);
    const pieY = alto - margen;
    pdf.setDrawColor('#E2E8F0');
    pdf.setLineWidth(0.75);
    pdf.line(margen, pieY, ancho - margen, pieY);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    pdf.setTextColor('#64748B');
    pdf.text('SISTEMA ESCOLTAS  ·  SEGURIDAD Y VIGILANCIA  |  Documento Oficial', margen, pieY + 12);
    pdf.text(`Página ${i} de ${totalPaginas}`, ancho - margen, pieY + 12, { align: 'right' });
  }

  return pdf;
}

export function generarCsv(columnas, filas) {
  const escapar = (valor) => {
    let texto = String(valor ?? '');
    if (typeof valor === 'string' && /^[\s\uFEFF]*[=+\-@]/u.test(texto)) texto = "'" + texto;
    return '"' + texto.replaceAll('"', '""') + '"';
  };
  return '\uFEFF' + [columnas, ...filas].map((fila) => fila.map(escapar).join(',')).join('\r\n');
}

export async function generarExcel(columnas, filas) {
  const { default: ExcelJS } = await import('exceljs');
  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet('Reporte', { views: [{ state: 'frozen', ySplit: 1 }] });
  hoja.columns = columnas.map((header) => ({ header, width: Math.max(17, Math.min(36, header.length + 6)) }));
  const cabecera = hoja.getRow(1);
  cabecera.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  cabecera.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E232B' } };
  hoja.addRows(filas);
  hoja.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columnas.length } };
  return libro.xlsx.writeBuffer();
}

export function descargarArchivo(datos, mime, nombre) {
  const url = URL.createObjectURL(new Blob([datos], { type: mime }));
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  enlace.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const COLORES = ['#CC4400', '#166534', '#854D0E'];
const FONDOS = ['#FFF1E8', '#ECFDF3', '#FFF8DB'];
const fecha = () => new Intl.DateTimeFormat('es-VE', { dateStyle: 'short', timeZone: 'America/Caracas' }).format(new Date());
const textoPdf = (valor) => String(valor ?? '').replace(/[^\x20-\xFF]/g, ' ');

export async function generarPdf({ titulo, columnas, filas, tarjetas }) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const pdf = new jsPDF({ unit: 'pt', format: 'letter', orientation: columnas.length > 6 ? 'landscape' : 'portrait' });
  const ancho = pdf.internal.pageSize.getWidth();
  const alto = pdf.internal.pageSize.getHeight();
  const margen = 40;
  const disponible = ancho - margen * 2;
  pdf.setProperties({ title: titulo, author: 'ESCOLTAS' });
  pdf.setFillColor('#25282B');
  pdf.roundedRect(margen, 36, disponible, 76, 8, 8, 'F');
  pdf.setFillColor('#FF6600');
  pdf.rect(margen + 12, 50, 4, 48, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor('#FFB800');
  pdf.setFontSize(9);
  pdf.text('ESCOLTAS  /  SEGURIDAD Y VIGILANCIA', margen + 26, 58);
  pdf.setTextColor('#FFFFFF');
  pdf.setFontSize(20);
  pdf.text(textoPdf(titulo), margen + 26, 82);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.text('Emitido el ' + fecha(), margen + 26, 98);

  const anchoTarjeta = (disponible - (tarjetas.length - 1) * 10) / tarjetas.length;
  tarjetas.forEach(([etiqueta, valor], i) => {
    const x = margen + i * (anchoTarjeta + 10);
    pdf.setFillColor(FONDOS[i % FONDOS.length]);
    pdf.roundedRect(x, 128, anchoTarjeta, 52, 8, 8, 'F');
    pdf.setTextColor(COLORES[i % COLORES.length]);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.text(textoPdf(etiqueta), x + 12, 147);
    pdf.setFontSize(13);
    pdf.text(textoPdf(valor), x + 12, 167, { maxWidth: anchoTarjeta - 24 });
  });

  autoTable(pdf, {
    startY: 198,
    margin: { top: margen, left: margen, right: margen, bottom: 52 },
    head: [columnas.map(textoPdf)],
    body: filas.map((fila) => fila.map(textoPdf)),
    rowPageBreak: 'avoid',
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 7, overflow: 'linebreak' },
    headStyles: { fillColor: '#25282B', textColor: '#FFFFFF' },
    alternateRowStyles: { fillColor: '#F2F2F2' },
  });

  const paginas = pdf.getNumberOfPages();
  for (let i = 1; i <= paginas; i++) {
    pdf.setPage(i);
    pdf.setDrawColor('#D9D9D9');
    pdf.line(margen, alto - 37, ancho - margen, alto - 37);
    pdf.setTextColor('#404040');
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.text('ESCOLTAS | Uso interno', margen, alto - 23);
    pdf.text(i + ' / ' + paginas, ancho - margen, alto - 23, { align: 'right' });
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
  cabecera.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF25282B' } };
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

import { MARGEN_PDF, MARGENES_TABLA_PDF, anchoUtilPdf, pdfSafe, obtenerLogoDataUrl } from './pdfLogo.js';

const fechaPdf = new Intl.DateTimeFormat('es-VE', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'America/Caracas',
});

const montoPdf = new Intl.NumberFormat('es-VE', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const NARANJA = '#D97706';
const VERDE = '#166534';
const AZUL = '#2563EB';

function dinero(valor, moneda = 'USD') {
  return valor == null || valor === '' ? 'Sin dato' : moneda + ' ' + montoPdf.format(valor);
}

function fechaRegistro(valor) {
  const fecha = String(valor ?? '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha.split('-').reverse().join('/') : '-';
}

const TIPOS = { anticipo: 'Anticipo', prestamo: 'Préstamo' };

export async function construirAnticiposPdf(registros, { individual = false } = {}) {
  if (!registros.length) throw new Error('No hay registros para exportar.');

  const [{ jsPDF }, { default: autoTable }, logoDataUrl] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
    obtenerLogoDataUrl(),
  ]);

  const pdf = new jsPDF({ unit: 'pt', format: 'letter' });
  const ancho = pdf.internal.pageSize.getWidth();
  const alto = pdf.internal.pageSize.getHeight();
  const margen = MARGEN_PDF;
  const anchoUtil = anchoUtilPdf(ancho);
  const titulo = individual ? 'Ficha de Anticipo o Préstamo' : 'Relación de Anticipos y Préstamos';
  pdf.setProperties({ title: titulo, author: 'SISTEMA ESCOLTAS' });

  // Encabezado institucional estilo GT
  const headerY = margen;
  const altoLogo = 46;
  const anchoLogo = 46;

  if (logoDataUrl) {
    try {
      pdf.addImage(logoDataUrl, 'PNG', margen, headerY, anchoLogo, altoLogo);
    } catch {}
  }

  const textoX = logoDataUrl ? margen + anchoLogo + 14 : margen;
  const textoAncho = anchoUtil - (logoDataUrl ? anchoLogo + 14 : 0);

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8.5);
  pdf.setTextColor('#FF8A00');
  pdf.text('SISTEMA ESCOLTAS  ·  RECURSOS HUMANOS', textoX, headerY + 11);

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  pdf.setTextColor('#1E232B');
  pdf.text(pdfSafe(titulo), textoX, headerY + 28, { maxWidth: textoAncho });

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8.5);
  pdf.setTextColor('#64748B');
  pdf.text(`Emitido el ${fechaPdf.format(new Date())}  ·  Documento Oficial`, textoX, headerY + 42);

  const separadorY = headerY + 54;
  pdf.setDrawColor('#FF8A00');
  pdf.setLineWidth(1.5);
  pdf.line(margen, separadorY, ancho - margen, separadorY);

  let siguienteY = separadorY + 16;

  // Cálculo de totales
  const grupos = new Map();
  const totales = new Map();
  for (const registro of registros) {
    const persona = registro.personal;
    const clave = registro.personal_id || persona?.id || registro.id;
    if (!grupos.has(clave)) grupos.set(clave, { persona, registros: [] });
    grupos.get(clave).registros.push(registro);

    const moneda = registro.moneda || 'USD';
    if (!totales.has(moneda)) totales.set(moneda, { otorgado: 0, aplicado: 0, pendiente: 0 });
    const total = totales.get(moneda);
    const monto = Number(registro.monto_total ?? 0);
    total.otorgado += monto;
    const saldo = Number(registro.saldo_pendiente ?? monto);
    total.pendiente += saldo;
    total.aplicado += monto - saldo;
  }

  // Tarjetas de resumen
  const tarjetas = [
    ['Total Otorgado', 'otorgado', NARANJA, '#FFFBEB', '#FDE68A'],
    ['Total Descontado / Aplicado', 'aplicado', VERDE, '#F0FDF4', '#BBF7D0'],
    ['Saldo Total Pendiente', 'pendiente', AZUL, '#EFF6FF', '#BFDBFE'],
  ];
  const anchoTarjeta = (anchoUtil - 20) / 3;
  const altoTarjeta = 44 + (totales.size > 1 ? (totales.size - 1) * 12 : 0);

  tarjetas.forEach(([etiqueta, clave, color, fondo, borde], i) => {
    const x = margen + i * (anchoTarjeta + 10);
    pdf.setFillColor(fondo);
    pdf.setDrawColor(borde);
    pdf.setLineWidth(0.75);
    pdf.roundedRect(x, siguienteY, anchoTarjeta, altoTarjeta, 6, 6, 'FD');

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor('#64748B');
    pdf.text(etiqueta, x + 10, siguienteY + 16);

    let ty = siguienteY + 32;
    pdf.setFontSize(11);
    pdf.setTextColor(color);
    for (const [moneda, t] of totales.entries()) {
      pdf.text(dinero(t[clave], moneda), x + 10, ty);
      ty += 12;
    }
  });

  siguienteY += altoTarjeta + 18;

  // Preparar filas para la tabla
  const columnas = ['Personal / Ficha', 'Tipo', 'Fecha', 'Monto Total', 'Cuotas', 'Descontado', 'Saldo'];
  const filas = [];

  for (const { persona, registros: lista } of grupos.values()) {
    const nombre = [persona?.nombre, persona?.apellido].filter(Boolean).join(' ') || 'Sin nombre';
    const ficha = persona?.ficha_nro ? ` (${persona.ficha_nro})` : '';
    const personalTexto = `${nombre}${ficha}`;

    for (const reg of lista) {
      const moneda = reg.moneda || 'USD';
      const total = Number(reg.monto_total ?? 0);
      const saldo = Number(reg.saldo_pendiente ?? total);
      const amortizado = total - saldo;

      filas.push([
        pdfSafe(personalTexto),
        TIPOS[reg.tipo] || 'Anticipo',
        fechaRegistro(reg.fecha_solicitud || reg.created_at),
        dinero(total, moneda),
        reg.cuotas ? String(reg.cuotas) : '1',
        dinero(amortizado, moneda),
        dinero(saldo, moneda),
      ]);
    }
  }

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

  // Pie de página oficial de 2 cm
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

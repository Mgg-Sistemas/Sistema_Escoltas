const fechaPdf = new Intl.DateTimeFormat('es-VE', {
  dateStyle: 'short',
  timeZone: 'America/Caracas',
});

const montoPdf = new Intl.NumberFormat('es-VE', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const MARGEN = 40;
const TINTA = '#25282B';
const NARANJA = '#CC4400';
const VERDE = '#166534';
const DORADO = '#854D0E';

function textoSeguro(texto) {
  return String(texto ?? '').replace(/[^\u0020-\u00ff]/g, ' ').trim();
}

function monedaDe(registro) {
  return registro.moneda || 'USD';
}

function dinero(valor, moneda) {
  return valor == null || valor === '' ? 'Sin dato' : moneda + ' ' + montoPdf.format(valor);
}

function fechaRegistro(valor) {
  const fecha = String(valor ?? '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha.split('-').reverse().join('/') : '-';
}

const TIPOS = { anticipo: 'Anticipo', prestamo: 'Préstamo' };

export async function construirAnticiposPdf(registros, { individual = false } = {}) {
  if (!registros.length) throw new Error('No hay registros para exportar.');

  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

  const pdf = new jsPDF({ unit: 'pt', format: 'letter' });
  const ancho = pdf.internal.pageSize.getWidth();
  const alto = pdf.internal.pageSize.getHeight();
  const anchoUtil = ancho - MARGEN * 2;
  const titulo = individual ? 'Ficha de anticipo o préstamo' : 'Anticipos y préstamos';
  pdf.setProperties({ title: titulo, author: 'ESCOLTAS' });

  pdf.setFillColor(TINTA);
  pdf.roundedRect(MARGEN, 36, anchoUtil, 76, 8, 8, 'F');
  pdf.setFillColor('#FF6600');
  pdf.rect(MARGEN + 12, 50, 4, 48, 'F');
  pdf.setTextColor('#FFB800');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.text('ESCOLTAS  /  RECURSOS HUMANOS', MARGEN + 26, 58);
  pdf.setTextColor('#FFFFFF');
  pdf.setFontSize(21);
  pdf.text(titulo, MARGEN + 26, 81);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.text('Emitido el ' + fechaPdf.format(new Date()), MARGEN + 26, 98);

  const grupos = new Map();
  const totales = new Map();
  for (const registro of registros) {
    const persona = registro.personal;
    const clave = registro.personal_id || persona?.id || registro.id;
    if (!grupos.has(clave)) grupos.set(clave, { persona, registros: [] });
    grupos.get(clave).registros.push(registro);

    const moneda = monedaDe(registro);
    if (!totales.has(moneda)) totales.set(moneda, { otorgado: 0, aplicado: 0, pendiente: 0, incompleto: false });
    const total = totales.get(moneda);
    const monto = Number(registro.monto_total ?? 0);
    total.otorgado += monto;
    if (registro.saldo_pendiente == null || registro.saldo_pendiente === '') {
      total.incompleto = true;
    } else {
      const saldo = Number(registro.saldo_pendiente);
      total.pendiente += saldo;
      total.aplicado += monto - saldo;
    }
  }

  let y = 128;
  const tarjetas = [
    ['Otorgado', 'otorgado', NARANJA, '#FFF1E8'],
    ['Aplicado al saldo', 'aplicado', VERDE, '#ECFDF3'],
    ['Saldo pendiente', 'pendiente', DORADO, '#FFF8DB'],
  ];
  const anchoTarjeta = (anchoUtil - 20) / 3;
  const altoTarjeta = 38 + 15 * totales.size;
  tarjetas.forEach(([etiqueta, clave, color, fondo], i) => {
    const x = MARGEN + i * (anchoTarjeta + 10);
    pdf.setFillColor(fondo);
    pdf.roundedRect(x, y, anchoTarjeta, altoTarjeta, 8, 8, 'F');
    pdf.setTextColor(color);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.text(etiqueta, x + 12, y + 18);
    pdf.setFontSize(12);
    [...totales.entries()].forEach(([moneda, total], fila) => {
      const valor = total.incompleto && clave !== 'otorgado' ? moneda + ' | Sin dato completo' : dinero(total[clave], moneda);
      pdf.text(valor, x + 12, y + 38 + fila * 15, { maxWidth: anchoTarjeta - 24 });
    });
  });
  y += altoTarjeta + 20;

  for (const { persona, registros: registrosPersona } of grupos.values()) {
    if (y + 120 > alto - 52) {
      pdf.addPage();
      y = MARGEN;
    }
    const nombre = textoSeguro([persona?.nombre, persona?.apellido].filter(Boolean).join(' ')) || 'Personal sin ficha vinculada';
    pdf.setFillColor('#F2F2F2');
    pdf.roundedRect(MARGEN, y, anchoUtil, 42, 6, 6, 'F');
    pdf.setTextColor(TINTA);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.text(pdf.splitTextToSize(nombre, anchoUtil - 24)[0], MARGEN + 12, y + 17);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.text(textoSeguro(persona?.ficha_nro ? 'Ficha ' + persona.ficha_nro : 'Sin número de ficha'), MARGEN + 12, y + 31);

    autoTable(pdf, {
      startY: y + 49,
      margin: { top: MARGEN, left: MARGEN, right: MARGEN, bottom: 52 },
      rowPageBreak: 'avoid',
      head: [['Fecha y tipo', 'Motivo', 'Otorgado', 'Cuotas', 'Saldo', 'Estado']],
      body: [...registrosPersona].sort((a, b) =>
        String(a.fecha || a.created_at || '').localeCompare(String(b.fecha || b.created_at || '')),
      ).map((registro) => {
        const moneda = monedaDe(registro);
        return [
          fechaRegistro(registro.fecha || registro.created_at) + '\n' + (TIPOS[registro.tipo] || textoSeguro(registro.tipo) || '-'),
          textoSeguro(registro.motivo) || '-',
          dinero(registro.monto_total, moneda),
          registro.cuotas ? registro.cuotas + ' x ' + dinero(registro.monto_cuota, moneda) : '-',
          dinero(registro.saldo_pendiente, moneda),
          textoSeguro(registro.estado) || '-',
        ];
      }),
      styles: { font: 'helvetica', fontSize: 9, cellPadding: 7, textColor: TINTA, valign: 'middle' },
      headStyles: { fillColor: TINTA, textColor: '#FFFFFF' },
      alternateRowStyles: { fillColor: '#F7F7F7' },
      columnStyles: { 0: { cellWidth: 76 }, 2: { cellWidth: 85, halign: 'right' }, 3: { cellWidth: 92 }, 4: { cellWidth: 85, halign: 'right', textColor: DORADO, fontStyle: 'bold' } },
    });
    y = pdf.lastAutoTable.finalY + 18;
  }

  const paginas = pdf.getNumberOfPages();
  for (let pagina = 1; pagina <= paginas; pagina++) {
    pdf.setPage(pagina);
    pdf.setDrawColor('#D9D9D9');
    pdf.line(MARGEN, alto - 37, ancho - MARGEN, alto - 37);
    pdf.setTextColor('#404040');
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.text('ESCOLTAS | Uso interno', MARGEN, alto - 23);
    pdf.text(pagina + ' / ' + paginas, ancho - MARGEN, alto - 23, { align: 'right' });
  }
  return pdf;
}

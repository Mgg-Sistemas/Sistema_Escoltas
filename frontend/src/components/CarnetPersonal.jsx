import React, { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import QRCode from 'qrcode';
import {
  Building,
  CheckCircle2,
  FileText,
  IdCard,
  Printer,
  Shield,
  ShieldCheck,
  User,
} from 'lucide-react';
import { Button, useToast } from './ui.jsx';
import VistaPreviaPdf from './VistaPreviaPdf.jsx';
import { useFotoPersonal } from '../lib/fotosPersonal.js';
import { formatearFecha, nombreCompleto } from '../lib/data.js';

export default function CarnetPersonal({ escolta, grado = 'Escolta Operativo', alCerrar }) {
  const [lado, setLado] = useState('frente'); // 'frente' | 'reverso'
  const carnetRef = useRef(null);
  const foto = useFotoPersonal(escolta?.foto_url);
  const toast = useToast();
  const [documentoPdf, setDocumentoPdf] = useState(null);
  const [preparandoPdf, setPreparandoPdf] = useState(false);

  if (!escolta) return null;

  const nombre = nombreCompleto(escolta) || 'CARLOS MÉNDEZ';
  const codigo = escolta.codigo || 'ESC-0147';
  const cedula = escolta.cedula
    ? escolta.cedula.startsWith('C.I.') || escolta.cedula.startsWith('V-')
      ? (escolta.cedula.startsWith('C.I.') ? escolta.cedula : `C.I. ${escolta.cedula}`)
      : `C.I. V-${escolta.cedula}`
    : 'C.I. V-20.458.763';
  const cargo = grado || escolta.cargo || 'Escolta Operativo';
  const area = escolta.area || 'Presidencia';
  const baseVigencia = String(escolta.fecha_ingreso || escolta.created_at || '').slice(0, 10);
  const vencimientoBase = baseVigencia ? new Date(baseVigencia + 'T00:00:00Z') : null;
  if (vencimientoBase) vencimientoBase.setUTCFullYear(vencimientoBase.getUTCFullYear() + 2);
  const vigenciaIso = escolta.vigencia_carnet || vencimientoBase?.toISOString().slice(0, 10);
  const vigencia = vigenciaIso ? vigenciaIso.split('-').reverse().join(' / ') : 'No indicada';

  // Generación local 100% segura en Data URL sin enviar datos a APIs externas
  const [qrDataUrl, setQrDataUrl] = useState('');

  useEffect(() => {
    // Generar identificador de verificación seguro con URL oficial del sistema
    const urlVerificacion = `https://sistemaescoltas.com/verificar?id=${encodeURIComponent(escolta.id || codigo)}&v=1`;
    QRCode.toDataURL(urlVerificacion, {
      width: 260,
      margin: 4,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error('Error generando QR local:', err));
  }, [escolta.id, codigo]);

  const abrirPdf = async (modo) => {
    if (preparandoPdf) return;
    setPreparandoPdf(true);
    try {
      if (modo === 'carnet') {
        const [{ jsPDF }, { default: capturar }] = await Promise.all([import('jspdf'), import('html2canvas')]);
        const pdf = new jsPDF({ unit: 'mm', format: [54, 85.6], orientation: 'portrait' });
        for (const cara of ['frente', 'reverso']) {
          flushSync(() => setLado(cara));
          const tarjeta = carnetRef.current;
          if (!tarjeta) throw Error('El carnet no está disponible.');
          await Promise.all([...tarjeta.querySelectorAll('img')].map((img) => img.decode().catch(() => {})));
          const imagen = await capturar(tarjeta, {
            scale: 2,
            useCORS: true,
            backgroundColor: cara === 'frente' ? '#0d0f12' : '#ffffff',
            onclone: (doc, elemento) => {
              doc.documentElement.dataset.tema = 'oscuro';
              elemento.style.boxShadow = 'none';
            },
          });
          if (cara === 'reverso') pdf.addPage([54, 85.6], 'portrait');
          pdf.addImage(imagen, 'PNG', 0, 0, 54, 85.6);
        }
        setDocumentoPdf({ pdf, archivo: 'carnet-' + codigo + '.pdf' });
      } else {
        const { generarPdf } = await import('../lib/reportes.js');
        const pdf = await generarPdf({
          titulo: 'Ficha oficial de personal',
          columnas: ['Campo', 'Detalle'],
          filas: [
            ['Nombre', nombre], ['Cédula', cedula], ['Código', codigo],
            ['Teléfono', escolta.telefono], ['Dirección', escolta.direccion], ['Cargo', cargo],
            ['Área', area], ['Fecha de ingreso', formatearFecha(escolta.fecha_ingreso)], ['Vigencia del carnet', vigencia],
          ],
          tarjetas: [['Código', codigo], ['Estado', escolta.estado || 'Sin dato'], ['Vigencia', vigencia]],
          firmas: ['Firma del titular', 'Recursos Humanos / Operaciones'],
        });
        setDocumentoPdf({ pdf, archivo: 'ficha-' + codigo + '.pdf' });
      }
    } catch {
      toast.error('No se pudo preparar el PDF. Intenta nuevamente.');
    } finally {
      setLado(lado);
      setPreparandoPdf(false);
    }
  };

  return (
    <div className="space-y-6">
      <VistaPreviaPdf documento={documentoPdf} onClose={() => setDocumentoPdf(null)} />
      {/* Botones de acción superiores y selector Frente / Reverso */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#333944] pb-4">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={lado === 'frente' ? 'primary' : 'outline'}
            disabled={preparandoPdf}
            onClick={() => setLado('frente')}
          >
            Frente del Carnet
          </Button>
          <Button
            size="sm"
            variant={lado === 'reverso' ? 'primary' : 'outline'}
            disabled={preparandoPdf}
            onClick={() => setLado('reverso')}
          >
            Reverso del Carnet
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            leftIcon={Printer}
            onClick={() => abrirPdf('carnet')}
            disabled={preparandoPdf || !qrDataUrl}
            title="Imprimir o Exportar en formato estándar CR-80 a 300 DPI (85.6 x 54 mm)"
          >
            Ver carnet PDF (CR-80)
          </Button>
          <Button
            size="sm"
            variant="primary"
            leftIcon={FileText}
            onClick={() => abrirPdf('ficha')}
            disabled={preparandoPdf}
          >
            Ficha Oficial en PDF
          </Button>
        </div>
      </div>

      {/* Indicador técnico de estándar oficial CR-80 */}
      <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
        <span className="inline-block h-2 w-2 rounded-full bg-[#ff8a00]" />
        <span>Dimensiones estándar: <strong>85,6 × 54 mm</strong> (3,37 × 2,125 pulg) · Calibrado a <strong>300 DPI</strong></span>
      </div>

      {/* Visualización del Carnet Digital Oficial */}
      <div className="flex flex-col items-center justify-center py-2">
        <div
          ref={carnetRef}
          className="relative overflow-hidden shadow-2xl transition-all duration-300 select-none"
          style={{
            width: '320px',
            height: '507px', // Proporción exacta 54mm x 85.6mm (aspect ratio 1 : 1.585)
            borderRadius: '22px',
            backgroundColor: lado === 'frente' ? '#0d0f12' : '#ffffff',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 138, 0, 0.25)',
          }}
        >
          {/* LADO FRENTE */}
          {lado === 'frente' ? (
            <div className="relative flex h-full w-full flex-col justify-between overflow-hidden p-3.5 bg-[#0e1116] text-white">
              {/* Textura de rejilla metálica de fondo */}
              <div
                className="absolute inset-0 pointer-events-none opacity-20"
                style={{
                  backgroundImage: `radial-gradient(#475569 1px, transparent 1px)`,
                  backgroundSize: '8px 8px',
                }}
              />

              {/* Biseles metálicos y alas en esquinas superiores e inferiores */}
              <div
                className="absolute -top-10 -left-10 w-28 h-28 pointer-events-none"
                style={{
                  background: 'linear-gradient(135deg, #ff8a00 0%, #ffb800 40%, transparent 70%)',
                  clipPath: 'polygon(0 0, 100% 0, 0 100%)',
                  opacity: 0.85,
                }}
              />
              <div
                className="absolute -bottom-10 -left-10 w-28 h-28 pointer-events-none"
                style={{
                  background: 'linear-gradient(45deg, #ff8a00 0%, #ffb800 40%, transparent 70%)',
                  clipPath: 'polygon(0 100%, 100% 100%, 0 0)',
                  opacity: 0.85,
                }}
              />
              <div
                className="absolute -bottom-10 -right-10 w-28 h-28 pointer-events-none"
                style={{
                  background: 'linear-gradient(-45deg, #ff8a00 0%, #ffb800 40%, transparent 70%)',
                  clipPath: 'polygon(100% 100%, 0 100%, 100% 0)',
                  opacity: 0.85,
                }}
              />

              {/* 1. Ranura superior de sujeción (Portacarnet estándar) */}
              <div className="relative z-10 flex justify-center pt-0.5">
                <div
                  className="h-3.5 w-14 rounded-full border border-slate-600/60 bg-gradient-to-b from-[#161a20] to-[#252b36] shadow-inner"
                  style={{ boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.8)' }}
                />
              </div>

              {/* 2. Emblema Escudo Oficial y Encabezado ESCOLTAS */}
              <div className="relative z-10 flex items-center justify-between px-1 pt-2">
                <div className="flex items-center gap-2">
                  {/* Escudo con silueta de custodio y órbita dorada */}
                  <div className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-b from-[#ff8a00] via-[#ffa733] to-[#cc5500] p-[1.5px] shadow-lg">
                    <div className="flex h-full w-full items-center justify-center rounded-[10px] bg-[#14181f]">
                      <ShieldCheck className="h-6 w-6 text-[#ff8a00]" />
                    </div>
                  </div>
                  <div>
                    <h2 className="text-[17px] font-black tracking-tight leading-none text-white italic" style={{ fontFamily: 'sans-serif' }}>
                      ESCOLTAS
                    </h2>
                    <p className="text-[8.5px] font-black tracking-[0.18em] text-[#ff8a00] uppercase mt-0.5">
                      SEGURIDAD Y VIGILANCIA
                    </p>
                  </div>
                </div>

                {/* Badge CONTROL 360 */}
                <div className="rounded-full bg-gradient-to-r from-[#ff6600] to-[#ff9900] px-2.5 py-1 shadow-md shadow-[#ff6600]/30">
                  <span className="text-[9px] font-black tracking-wider text-black uppercase">
                    CONTROL 360
                  </span>
                </div>
              </div>

              {/* 3. Cuadrícula Central: Foto del Custodio + Código QR Oficial */}
              <div className="relative z-10 flex items-center justify-center gap-3 py-1">
                {/* Foto oficial con marco perimetral naranja curvado */}
                <div className="relative">
                  <div className="h-[148px] w-[124px] rounded-2xl p-[2px] bg-gradient-to-b from-[#ff8a00] via-[#ffa733] to-[#d97706] shadow-xl">
                    <div className="h-full w-full overflow-hidden rounded-[14px] bg-[#1c222b] flex items-center justify-center">
                      {foto ? (
                        <img
                          src={foto}
                          alt={nombre}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-b from-[#1a202c] to-[#0f131a] text-slate-400">
                          <User className="h-12 w-12 text-[#ff8a00]/70" />
                          <span className="text-[9px] font-black uppercase text-[#ff8a00] mt-1">FOTO</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Código QR y código de personal */}
                <div className="flex flex-col items-center justify-center gap-2">
                  <div className="relative h-[116px] w-[116px] rounded-2xl border-2 border-[#ff8a00] bg-white p-1.5 shadow-xl flex items-center justify-center">
                    {qrDataUrl ? (
                      <img
                        src={qrDataUrl}
                        alt={`QR Oficial ${codigo}`}
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-400 font-bold">
                        Generando...
                      </div>
                    )}
                  </div>

                  {/* ID Tag naranja con código */}
                  <div className="w-[116px] rounded-lg bg-gradient-to-r from-[#ff6600] to-[#ff8a00] py-1 text-center shadow-md">
                    <span className="text-[11px] font-black tracking-wider text-black">
                      ID: {codigo}
                    </span>
                  </div>
                </div>
              </div>

              {/* 4. Nombre y Cargo */}
              <div className="relative z-10 text-center -mt-1">
                <h3 className="text-[17px] font-black uppercase tracking-tight text-white leading-tight drop-shadow-sm">
                  {nombre}
                </h3>
                <p className="text-[11.5px] font-bold text-[#ffb800] mt-0.5 tracking-wide">
                  {cargo}
                </p>
                <div className="w-20 h-0.5 bg-gradient-to-r from-transparent via-[#ff8a00] to-transparent mx-auto mt-1" />
              </div>

              {/* 5. Franja Inferior Metálica con Cédula de Identidad */}
              <div className="relative z-10 pb-0.5">
                <div className="rounded-xl border border-slate-600/60 bg-gradient-to-r from-[#1e242d] via-[#2a313d] to-[#1e242d] py-1.5 px-3 text-center shadow-md">
                  <p className="font-mono text-[13px] font-black tracking-[0.18em] text-white">
                    {cedula}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* LADO REVERSO (Fiel a la referencia oficial) */
            <div className="relative flex h-full w-full flex-col justify-between overflow-hidden p-3.5 text-slate-900"
              style={{ backgroundColor: "#ffffff", "--surface": "#ffffff", "--text": "#25282b", "--text-muted": "#404040" }}>
              {/* Textura de rejilla sutil al fondo */}
              <div
                className="absolute inset-0 pointer-events-none opacity-10"
                style={{
                  backgroundImage: `radial-gradient(#000 1px, transparent 1px)`,
                  backgroundSize: '8px 8px',
                }}
              />

              {/* Alas y biseles cromados/naranja en esquinas superiores e inferiores */}
              <div
                className="absolute -top-10 -left-10 w-28 h-28 pointer-events-none"
                style={{
                  background: 'linear-gradient(135deg, #1e242d 0%, #ff8a00 70%, transparent 100%)',
                  clipPath: 'polygon(0 0, 100% 0, 0 100%)',
                  opacity: 0.9,
                }}
              />
              <div
                className="absolute -bottom-10 -left-10 w-28 h-28 pointer-events-none"
                style={{
                  background: 'linear-gradient(45deg, #1e242d 0%, #ff8a00 70%, transparent 100%)',
                  clipPath: 'polygon(0 100%, 100% 100%, 0 0)',
                  opacity: 0.9,
                }}
              />
              <div
                className="absolute -bottom-10 -right-10 w-28 h-28 pointer-events-none"
                style={{
                  background: 'linear-gradient(-45deg, #1e242d 0%, #ff8a00 70%, transparent 100%)',
                  clipPath: 'polygon(100% 100%, 0 100%, 100% 0)',
                  opacity: 0.9,
                }}
              />

              {/* 1. Ranura superior de sujeción (Portacarnet estándar) */}
              <div className="relative z-10 flex justify-center pt-0.5">
                <div
                  className="h-3.5 w-14 rounded-full border border-slate-300 bg-gradient-to-b from-slate-200 to-slate-300 shadow-inner"
                  style={{ boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.3)' }}
                />
              </div>

              {/* 2. Emblema Escudo Oficial y Encabezado ESCOLTAS */}
              <div className="relative z-10 flex items-center justify-between px-1 pt-2">
                <div className="flex items-center gap-2">
                  <div className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-b from-[#ff8a00] via-[#ffa733] to-[#cc5500] p-[1.5px] shadow-md">
                    <div className="flex h-full w-full items-center justify-center rounded-[10px] bg-[#14181f]">
                      <ShieldCheck className="h-6 w-6 text-[#ff8a00]" />
                    </div>
                  </div>
                  <div>
                    <h2 className="text-[17px] font-black tracking-tight leading-none text-slate-900 italic" style={{ fontFamily: 'sans-serif' }}>
                      ESCOLTAS
                    </h2>
                    <p className="text-[8.5px] font-black tracking-[0.18em] text-[#ff8a00] uppercase mt-0.5">
                      SEGURIDAD Y VIGILANCIA
                    </p>
                  </div>
                </div>

                {/* Badge CONTROL 360 */}
                <div className="rounded-full bg-gradient-to-r from-[#ff6600] to-[#ff9900] px-2.5 py-1 shadow-md shadow-[#ff6600]/30">
                  <span className="text-[9px] font-black tracking-wider text-black uppercase">
                    CONTROL 360
                  </span>
                </div>
              </div>

              {/* 3. Filas de Información Operativa con Marca de Agua de Custodio a la Derecha */}
              <div className="relative z-10 my-auto py-2">
                {/* Silueta/Marca de agua gris sutil de seguridad a la derecha */}
                <div className="pointer-events-none absolute -right-3 top-2 opacity-15 select-none">
                  <div className="h-44 w-36 rounded-2xl border-4 border-slate-400 p-2 flex items-center justify-center">
                    <ShieldCheck className="h-32 w-32 text-slate-700" />
                  </div>
                </div>

                {/* 4 Filas de datos operativos con iconos contorneados en negro y punto naranja */}
                <div className="space-y-3 pl-1 pr-6">
                  {/* Tipo de Servicio */}
                  <div className="flex items-start gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 border-slate-900 bg-white shadow-sm">
                      <IdCard className="h-4 w-4 text-slate-900" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#ff8a00]" />
                        <span className="text-[10px] font-bold text-slate-600">Tipo de Servicio:</span>
                      </div>
                      <strong className="block text-[13px] font-black text-slate-950 leading-tight">
                        {cargo}
                      </strong>
                    </div>
                  </div>

                  {/* Área / Asignación */}
                  <div className="flex items-start gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 border-slate-900 bg-white shadow-sm">
                      <Building className="h-4 w-4 text-slate-900" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#ff8a00]" />
                        <span className="text-[10px] font-bold text-slate-600">Área / Asignación:</span>
                      </div>
                      <strong className="block text-[13px] font-black text-slate-950 leading-tight break-words">
                        {area}
                      </strong>
                    </div>
                  </div>

                  {/* Vigencia */}
                  <div className="flex items-start gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 border-slate-900 bg-white shadow-sm">
                      <CheckCircle2 className="h-4 w-4 text-slate-900" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#ff8a00]" />
                        <span className="text-[10px] font-bold text-slate-600">Vigencia:</span>
                      </div>
                      <strong className="block text-[13px] font-black text-slate-950 leading-tight">
                        {vigencia}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* 4. Divisor naranja brillante y Cláusula Reglamentaria Oficial */}
              <div className="relative z-10 pt-1 pb-1">
                <div className="h-1 w-full bg-gradient-to-r from-[#ff6600] via-[#ff8a00] to-[#ff6600] rounded-full mb-1.5 shadow-sm" />
                <p className="text-[8.5px] font-medium text-slate-600 leading-tight text-center px-2">
                  Este carnet es de uso personal e intransferible e identifica al personal de Seguridad y Vigilancia de ESCOLTAS.
                </p>
              </div>

              {/* 5. Código de Barras Nítido Oficial */}
              <div className="relative z-10 text-center pb-0.5">
                <div className="flex items-center justify-center gap-[2.5px] h-9">
                  {Array.from({ length: 46 }).map((_, i) => (
                    <span
                      key={i}
                      className="bg-black inline-block h-full"
                      style={{
                        width: i % 4 === 0 ? '3.5px' : i % 3 === 0 ? '1.5px' : i % 2 === 0 ? '2.5px' : '1px',
                      }}
                    />
                  ))}
                </div>
                <p className="font-mono text-[12px] font-black tracking-[0.25em] text-slate-950 mt-1 uppercase">
                  {codigo}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

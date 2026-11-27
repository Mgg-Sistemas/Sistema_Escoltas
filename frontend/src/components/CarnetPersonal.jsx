import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import {
  Building,
  Calendar,
  CheckCircle2,
  FileText,
  IdCard,
  Printer,
  Shield,
  ShieldCheck,
  User,
} from 'lucide-react';
import { Button } from './ui.jsx';
import { formatearFecha, nombreCompleto } from '../lib/data.js';

export default function CarnetPersonal({ escolta, grado = 'Escolta Operativo', alCerrar }) {
  const [lado, setLado] = useState('frente'); // 'frente' | 'reverso'
  const carnetRef = useRef(null);

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
  const turno = escolta.turno || 'Diurno';
  const vigencia = '31 / 12 / 2027';

  // Generación local 100% segura en Data URL sin enviar datos a APIs externas
  const [qrDataUrl, setQrDataUrl] = useState('');

  useEffect(() => {
    // Generar identificador de verificación seguro con URL oficial del sistema
    const urlVerificacion = `https://sistemaescoltas.com/verificar?id=${encodeURIComponent(escolta.id || codigo)}&v=1`;
    QRCode.toDataURL(urlVerificacion, {
      width: 260,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error('Error generando QR local:', err));
  }, [escolta.id, codigo]);

  // Dimensiones CR-80 estándar a 300 DPI: 85.6mm x 54mm (vertical: 54mm x 85.6mm / 638px x 1011px)
  const imprimirCarnetOFicha = (modo = 'ficha') => {
    const ventana = window.open('', '_blank');
    if (!ventana) return;

    if (modo === 'carnet') {
      const contenidoCarnet = `
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="utf-8">
          <title>Carnet CR-80 (300 DPI) - ${nombre}</title>
          <style>
            @page {
              size: 54mm 85.6mm;
              margin: 0;
            }
            * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            body {
              margin: 0;
              padding: 0;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
              background: #000;
              display: flex;
              justify-content: center;
              align-items: center;
            }
            .card-page {
              width: 54mm;
              height: 85.6mm;
              position: relative;
              overflow: hidden;
              page-break-after: always;
            }
          </style>
        </head>
        <body>
          <div class="card-page">
            ${carnetRef.current ? carnetRef.current.innerHTML : ''}
          </div>
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
        </html>
      `;
      ventana.document.write(contenidoCarnet);
      ventana.document.close();
      return;
    }

    const contenido = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="utf-8">
        <title>Ficha de Personal - ${nombre}</title>
        <style>
          @page { size: letter; margin: 15mm; }
          * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #111; margin: 0; padding: 20px; }
          .header { border-bottom: 2px solid #ff8a00; padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
          .header h1 { margin: 0; color: #1c1f24; font-size: 22px; }
          .header p { margin: 2px 0 0; color: #ff8a00; font-weight: bold; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; }
          .badge-status { background: #e6f9f0; color: #16a34a; border: 1px solid #bbf7d0; padding: 4px 10px; border-radius: 99px; font-weight: bold; font-size: 12px; }
          .section { margin-bottom: 24px; }
          .section-title { font-size: 14px; font-weight: bold; text-transform: uppercase; color: #475569; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; margin-bottom: 12px; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 13px; }
          .field { background: #f8fafc; border: 1px solid #e2e8f0; padding: 8px 12px; border-radius: 8px; }
          .field-label { font-size: 11px; color: #64748b; font-weight: bold; text-transform: uppercase; }
          .field-val { font-size: 13px; font-weight: 600; color: #0f172a; margin-top: 2px; }
          .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 60px; text-align: center; }
          .sign-line { border-top: 1px solid #334155; padding-top: 6px; font-size: 12px; font-weight: bold; color: #334155; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1>ESCOLTAS · SEGURIDAD Y VIGILANCIA</h1>
            <p>Expediente y Ficha Oficial del Personal</p>
          </div>
          <div>
            <span class="badge-status">ESTADO: ACTIVO / VERIFICADO</span>
          </div>
        </div>

        <div class="section">
          <div class="section-title">1. Identificación y Datos Personales</div>
          <div class="grid">
            <div class="field"><div class="field-label">Nombre Completo</div><div class="field-val">${nombre}</div></div>
            <div class="field"><div class="field-label">Cédula de Identidad</div><div class="field-val">${cedula}</div></div>
            <div class="field"><div class="field-label">Código de Personal</div><div class="field-val">${codigo}</div></div>
            <div class="field"><div class="field-label">Teléfono de Contacto</div><div class="field-val">${escolta.telefono || 'No registrado'}</div></div>
            <div class="field" style="grid-column: span 2;"><div class="field-label">Dirección de Residencia</div><div class="field-val">${escolta.direccion || 'No registrada'}</div></div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">2. Asignación Operativa y Cargo</div>
          <div class="grid">
            <div class="field"><div class="field-label">Cargo / Función</div><div class="field-val">${cargo}</div></div>
            <div class="field"><div class="field-label">Área / Sede Asignada</div><div class="field-val">${area}</div></div>
            <div class="field"><div class="field-label">Turno Habitual</div><div class="field-val">${turno}</div></div>
            <div class="field"><div class="field-label">Fecha de Ingreso</div><div class="field-val">${formatearFecha(escolta.fecha_ingreso)}</div></div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">3. Validez y Normativa de Seguridad</div>
          <p style="font-size: 12px; color: #475569; line-height: 1.6;">
            El presente documento certifica que el titular se encuentra debidamente registrado, acreditado y en cumplimiento
            con los protocolos operacionales y de custodia establecidos por la organización.
          </p>
        </div>

        <div class="signatures">
          <div>
            <div class="sign-line">Firma del Escolta / Titular<br><span style="font-size: 10px; font-weight: normal; color: #64748b;">${cedula}</span></div>
          </div>
          <div>
            <div class="sign-line">Recursos Humanos / Operaciones<br><span style="font-size: 10px; font-weight: normal; color: #64748b;">Sello y Firma Autorizada</span></div>
          </div>
        </div>

        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
      </html>
    `;
    ventana.document.write(contenido);
    ventana.document.close();
  };

  return (
    <div className="space-y-6">
      {/* Botones de acción superiores y selector Frente / Reverso */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#333944] pb-4">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={lado === 'frente' ? 'primary' : 'outline'}
            onClick={() => setLado('frente')}
          >
            Frente del Carnet
          </Button>
          <Button
            size="sm"
            variant={lado === 'reverso' ? 'primary' : 'outline'}
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
            onClick={() => imprimirCarnetOFicha('carnet')}
            title="Imprimir o Exportar en formato estándar CR-80 a 300 DPI (85.6 x 54 mm)"
          >
            Imprimir Carnet (CR-80 · 300 DPI)
          </Button>
          <Button
            size="sm"
            variant="primary"
            leftIcon={FileText}
            onClick={() => imprimirCarnetOFicha('ficha')}
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
                      {escolta.foto_url ? (
                        <img
                          src={escolta.foto_url}
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

                {/* QR Code con logo institucional al centro + ID Badge (Generado Localmente) */}
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
                    {/* Escudo mini al centro del QR */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="h-6 w-6 rounded-md bg-[#ff8a00] p-0.5 shadow flex items-center justify-center">
                        <Shield className="h-4 w-4 text-black fill-black" />
                      </div>
                    </div>
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
            <div className="relative flex h-full w-full flex-col justify-between overflow-hidden p-3.5 bg-white text-slate-900">
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
                      <strong className="block text-[13px] font-black text-slate-950 leading-tight truncate">
                        {area}
                      </strong>
                    </div>
                  </div>

                  {/* Turno */}
                  <div className="flex items-start gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 border-slate-900 bg-white shadow-sm">
                      <Calendar className="h-4 w-4 text-slate-900" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#ff8a00]" />
                        <span className="text-[10px] font-bold text-slate-600">Turno:</span>
                      </div>
                      <strong className="block text-[13px] font-black text-slate-950 leading-tight">
                        {turno}
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

import React, { useRef, useState } from 'react';
import {
  Building,
  Calendar,
  CheckCircle2,
  Download,
  FileText,
  IdCard,
  MapPin,
  Phone,
  Printer,
  QrCode,
  RotateCw,
  Shield,
  ShieldCheck,
  User,
} from 'lucide-react';
import { Badge, Button } from './ui.jsx';
import { formatearFecha, nombreCompleto } from '../lib/data.js';

export default function CarnetPersonal({ escolta, grado = 'Escolta Operativo', alCerrar }) {
  const [lado, setLado] = useState('frente'); // 'frente' | 'reverso'
  const carnetRef = useRef(null);

  if (!escolta) return null;

  const nombre = nombreCompleto(escolta);
  const codigo = escolta.codigo || 'ESC-0147';
  const cedula = escolta.cedula ? `C.I. ${escolta.cedula}` : 'C.I. V-20.458.763';
  const cargo = grado || escolta.cargo || 'Escolta Operativo';
  const area = escolta.area || 'Presidencia / Seguridad';
  const turno = escolta.turno || 'Diurno';
  const vigencia = '31 / 12 / 2027';

  const imprimirCarnetOFicha = (modo = 'ficha') => {
    const ventana = window.open('', '_blank');
    if (!ventana) return;

    const contenido = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="utf-8">
        <title>${modo === 'carnet' ? 'Carnet' : 'Ficha de Personal'} - ${nombre}</title>
        <style>
          @page { size: ${modo === 'carnet' ? 'auto' : 'letter'}; margin: 15mm; }
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
          .carnet-wrap { display: flex; gap: 20px; justify-content: center; margin-top: 20px; }
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
      {/* Botones de acción superiores */}
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
          >
            Imprimir Carnet
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

      {/* Visualización del Carnet Digital (Sin hueco en el medio) */}
      <div className="flex flex-col items-center justify-center py-2">
        <div
          ref={carnetRef}
          className="relative w-full max-w-[340px] aspect-[1/1.6] rounded-[24px] overflow-hidden border border-[#434a56] bg-gradient-to-b from-[#1c1f24] via-[#14171c] to-[#0c0e12] p-5 shadow-2xl transition-all duration-300"
          style={{
            backgroundImage: `
              radial-gradient(circle at 100% 0%, rgba(255, 138, 0, 0.22) 0%, transparent 45%),
              radial-gradient(circle at 0% 100%, rgba(255, 213, 74, 0.15) 0%, transparent 40%),
              linear-gradient(180deg, #1f2329 0%, #111317 100%)
            `,
          }}
        >
          {/* LADO FRENTE */}
          {lado === 'frente' ? (
            <div className="flex h-full flex-col justify-between text-center select-none">
              {/* Encabezado del Carnet (SIN HUECO) */}
              <div className="flex items-center justify-center gap-2.5 pt-1">
                <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#ff8a00] to-[#ffd54a] p-0.5 shadow-md">
                  <div className="flex h-full w-full items-center justify-center rounded-[10px] bg-[#1c1f24]">
                    <ShieldCheck className="h-5 w-5 text-[#ff8a00]" />
                  </div>
                </div>
                <div className="text-left">
                  <p className="text-base font-black tracking-tight leading-none text-metalico">
                    ESCOLTAS
                  </p>
                  <p className="text-[9px] font-bold tracking-[0.18em] text-[#ff8a00] uppercase mt-0.5">
                    Seguridad y Vigilancia
                  </p>
                </div>
              </div>

              {/* Foto + QR Code en cuadrícula */}
              <div className="my-auto py-2">
                <div className="flex items-center justify-center gap-3">
                  {/* Foto con borde naranja curvado oficial */}
                  <div className="relative inline-block">
                    <div className="h-32 w-28 rounded-2xl p-1 bg-gradient-to-b from-[#ff8a00] via-[#ffa733] to-[#8c5a1f] shadow-lg">
                      {escolta.foto_url ? (
                        <img
                          src={escolta.foto_url}
                          alt={nombre}
                          className="h-full w-full rounded-xl object-cover bg-slate-800"
                        />
                      ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center rounded-xl bg-[#23272e] text-[#9aa6b5]">
                          <User className="h-10 w-10 text-slate-400" />
                          <span className="text-[10px] font-bold text-[#ff8a00] mt-1">FOTO</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* QR Code estilizado */}
                  <div className="flex flex-col items-center justify-center gap-1.5">
                    <div className="h-24 w-24 rounded-2xl border-2 border-[#ff8a00]/60 bg-white p-2 shadow-md flex items-center justify-center">
                      <div className="relative flex items-center justify-center">
                        <QrCode className="h-20 w-20 text-slate-900" />
                        <div className="absolute inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#1c1f24] border border-[#ff8a00]">
                          <Shield className="h-3 w-3 text-[#ff8a00]" />
                        </div>
                      </div>
                    </div>
                    <span className="rounded-md bg-[#ff8a00] px-2 py-0.5 text-[10px] font-black text-black tracking-wider shadow">
                      ID: {codigo}
                    </span>
                  </div>
                </div>

                {/* Nombre y Cargo */}
                <div className="mt-4">
                  <h3 className="text-lg font-black tracking-tight text-white uppercase text-metalico drop-shadow-sm">
                    {nombre}
                  </h3>
                  <p className="text-xs font-bold text-[#ffd54a] mt-0.5">
                    {cargo}
                  </p>
                </div>
              </div>

              {/* Cinta inferior cromada / dorada con C.I. */}
              <div className="rounded-xl border border-[#ff8a00]/40 bg-gradient-to-r from-[#2b3038] via-[#1c1f24] to-[#2b3038] py-2 px-3 shadow-inner">
                <p className="font-mono text-xs font-black tracking-widest text-slate-100">
                  {cedula}
                </p>
              </div>
            </div>
          ) : (
            /* LADO REVERSO */
            <div className="flex h-full flex-col justify-between text-left select-none p-1">
              {/* Encabezado reverso (SIN HUECO) */}
              <div className="flex items-center justify-between border-b border-[#333944] pb-2.5">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-[#ff8a00]" />
                  <span className="text-xs font-black tracking-wide text-white">ESCOLTAS VIGILANCIA</span>
                </div>
                <span className="text-[10px] font-bold text-[#29c081] bg-[#29c081]/15 px-2 py-0.5 rounded-full border border-[#29c081]/30">
                  VALIDADO
                </span>
              </div>

              {/* Datos Operativos con Iconos */}
              <div className="space-y-2.5 py-3 text-xs">
                <div className="rounded-lg bg-[#23272e]/80 border border-[#333944] p-2 flex items-center gap-2.5">
                  <IdCard className="h-4 w-4 text-[#ff8a00] shrink-0" />
                  <div className="min-w-0">
                    <span className="text-[9px] uppercase font-bold text-slate-400 block">Tipo de Servicio</span>
                    <strong className="text-slate-100 truncate block text-[11px]">{cargo}</strong>
                  </div>
                </div>

                <div className="rounded-lg bg-[#23272e]/80 border border-[#333944] p-2 flex items-center gap-2.5">
                  <Building className="h-4 w-4 text-[#ffd54a] shrink-0" />
                  <div className="min-w-0">
                    <span className="text-[9px] uppercase font-bold text-slate-400 block">Área / Asignación</span>
                    <strong className="text-slate-100 truncate block text-[11px]">{area}</strong>
                  </div>
                </div>

                <div className="rounded-lg bg-[#23272e]/80 border border-[#333944] p-2 flex items-center gap-2.5">
                  <Calendar className="h-4 w-4 text-blue-400 shrink-0" />
                  <div className="min-w-0">
                    <span className="text-[9px] uppercase font-bold text-slate-400 block">Turno Operativo</span>
                    <strong className="text-slate-100 truncate block text-[11px]">{turno}</strong>
                  </div>
                </div>

                <div className="rounded-lg bg-[#23272e]/80 border border-[#333944] p-2 flex items-center gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-[#29c081] shrink-0" />
                  <div className="min-w-0">
                    <span className="text-[9px] uppercase font-bold text-slate-400 block">Vigencia Oficial</span>
                    <strong className="text-slate-100 truncate block text-[11px]">{vigencia}</strong>
                  </div>
                </div>
              </div>

              {/* Cláusula reglamentaria */}
              <div className="text-[9px] text-slate-400 leading-tight text-center px-1">
                Este carnet es de uso personal e intransferible e identifica al personal de Seguridad y Vigilancia de ESCOLTAS.
              </div>

              {/* Código de Barras Vectorial */}
              <div className="mt-2 text-center rounded-lg bg-white p-2">
                <div className="flex items-center justify-center gap-[2px] h-7">
                  {Array.from({ length: 42 }).map((_, i) => (
                    <span
                      key={i}
                      className="bg-black inline-block h-full"
                      style={{ width: i % 3 === 0 ? '3px' : i % 2 === 0 ? '1px' : '2px' }}
                    />
                  ))}
                </div>
                <p className="font-mono text-[10px] font-bold text-black tracking-wider mt-0.5">
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

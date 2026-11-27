import React, { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import QRCode from 'qrcode';
import {
  Building,
  CheckCircle2,
  FileText,
  IdCard,
  Printer,
  User,
} from 'lucide-react';
import { Button, useToast } from './ui.jsx';
import './CarnetPersonal.css';
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

  const nombre = nombreCompleto(escolta) || 'Nombre sin registrar';
  const codigo = escolta.codigo || 'SIN-CÓDIGO';
  const cedula = escolta.cedula
    ? escolta.cedula.startsWith('C.I.') || escolta.cedula.startsWith('V-')
      ? (escolta.cedula.startsWith('C.I.') ? escolta.cedula : `C.I. ${escolta.cedula}`)
      : `C.I. V-${escolta.cedula}`
    : 'C.I. no indicada';
  const cargo = grado || escolta.cargo || 'Escolta Operativo';
  const area = escolta.area || 'No indicada';
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

      <div className="carnet-preview">
        <div ref={carnetRef} className={`carnet-tarjeta carnet-tarjeta--${lado}`}>
          <div className="carnet-banda carnet-banda--superior" aria-hidden="true" />
          <div className="carnet-banda carnet-banda--inferior" aria-hidden="true" />
          <header className="carnet-marca">
            <img src="/logo-escoltas.png" alt="Emblema de Escoltas" />
            <div>
              <strong>ESCOLTAS</strong>
              <span>SEGURIDAD Y VIGILANCIA</span>
            </div>
          </header>

          {lado === 'frente' ? (
            <div className="carnet-frente">
              <div className="carnet-identificacion">
                <div className="carnet-foto">
                  {foto ? <img src={foto} alt="Foto del titular" /> : <User aria-label="Sin foto" />}
                </div>
                <div className="carnet-codigos">
                  <div className="carnet-qr">
                    {qrDataUrl && <img src={qrDataUrl} alt="QR de verificación" />}
                  </div>
                  <strong>ID · {codigo}</strong>
                </div>
              </div>
              <div className="carnet-identidad">
                <strong>{nombre}</strong>
                <span>{cargo}</span>
              </div>
              <div className="carnet-cedula">{cedula}</div>
            </div>
          ) : (
            <div className="carnet-reverso">
              <img className="carnet-marca-agua" src="/logo-escoltas.png" alt="" />
              <dl className="carnet-datos">
                {[
                  [IdCard, 'Tipo de servicio', escolta.tipo_servicio || cargo],
                  [Building, 'Área / Asignación', area],
                  [CheckCircle2, 'Vigencia', vigencia],
                ].map(([Icono, etiqueta, valor]) => (
                  <div key={etiqueta}>
                    <Icono aria-hidden="true" />
                    <div><dt>{etiqueta}</dt><dd>{valor}</dd></div>
                  </div>
                ))}
              </dl>
              <p>Este carnet es de uso personal e intransferible e identifica al personal de Seguridad y Vigilancia de ESCOLTAS.</p>
              <div className="carnet-codigo-reverso">{codigo}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

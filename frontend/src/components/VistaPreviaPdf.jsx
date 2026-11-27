import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, Printer } from 'lucide-react';
import worker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { Button, Modal, useToast } from './ui.jsx';

export default function VistaPreviaPdf({ documento, onClose }) {
  const toast = useToast();
  const [render, setRender] = useState(null);

  useEffect(() => {
    if (!documento) return;
    let activa = true;
    let tarea;
    async function preparar() {
      try {
        const pdfjs = await import('pdfjs-dist');
        if (!activa) return;
        pdfjs.GlobalWorkerOptions.workerSrc = worker;
        tarea = pdfjs.getDocument({ data: documento.pdf.output('arraybuffer') });
        const pdf = await tarea.promise;
        const paginas = [];
        for (let numero = 1; activa && numero <= pdf.numPages; numero++) {
          const pagina = await pdf.getPage(numero);
          const original = pagina.getViewport({ scale: 1 });
          const viewport = pagina.getViewport({ scale: original.width < 200 ? 300 / 72 : 1.5 });
          const canvas = document.createElement('canvas');
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          await pagina.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
          paginas.push({ src: canvas.toDataURL('image/png'), ancho: original.width, alto: original.height });
          pagina.cleanup();
        }
        if (activa) setRender({ documento, paginas });
      } catch {
        if (activa) setRender({ documento, error: true });
      } finally {
        void tarea?.destroy().catch(() => {});
      }
    }
    preparar();
    return () => {
      activa = false;
      void tarea?.destroy().catch(() => {});
    };
  }, [documento]);

  useEffect(() => {
    if (!documento) return;
    const cerrarConEscape = (evento) => {
      if (evento.key !== 'Escape') return;
      evento.stopImmediatePropagation();
      onClose();
    };
    document.addEventListener('keydown', cerrarConEscape, true);
    return () => document.removeEventListener('keydown', cerrarConEscape, true);
  }, [documento, onClose]);

  if (!documento) return null;
  const actual = render?.documento === documento ? render : null;

  const imprimir = () => {
    const paginas = actual?.paginas;
    if (!paginas?.length) {
      const url = documento.pdf.output('bloburl');
      window.open(url, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(url), 120_000);
      return;
    }

    const ventana = window.open('', '_blank');
    if (!ventana) {
      toast.error('El navegador bloqueó la ventana de impresión.');
      return;
    }
    ventana.opener = null;
    const doc = ventana.document;
    doc.title = documento.archivo;
    const estilo = doc.createElement('style');
    estilo.textContent = '@page {size:' + paginas[0].ancho + 'pt ' + paginas[0].alto + 'pt;margin:0}'
      + 'html,body{margin:0}img{display:block;break-inside:avoid}img:not(:last-child){break-after:page}';
    doc.head.appendChild(estilo);
    const imagenes = paginas.map(({ src, ancho, alto }) => {
      const img = doc.createElement('img');
      img.src = src;
      img.style.width = ancho + 'pt';
      img.style.height = alto + 'pt';
      doc.body.appendChild(img);
      return img;
    });
    void Promise.all(imagenes.map((img) => img.decode())).then(() => {
      ventana.focus();
      ventana.print();
    }).catch(() => toast.error('No se pudieron preparar las imágenes para imprimir.'));
  };

  return createPortal(
    <Modal open onClose={onClose} title="Vista previa del PDF" description={documento.archivo} size="xl"
      footer={(
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" leftIcon={Printer} disabled={!actual} onClick={imprimir}>Imprimir</Button>
          <Button type="button" variant="primary" leftIcon={Download} onClick={() => documento.pdf.save(documento.archivo)}>Descargar PDF</Button>
        </div>
      )}
    >
      {!actual && <p role="status">Preparando vista previa…</p>}
      {actual?.error && <p role="status">La vista previa no está disponible. Puedes abrir el PDF para imprimirlo o descargarlo.</p>}
      {actual?.paginas && (
        <div className="space-y-4">
          {actual.paginas.map(({ src, ancho }, indice) => (
            <img key={indice} src={src} alt={'Página ' + (indice + 1)} className="mx-auto h-auto max-w-full rounded bg-white"
              style={{ width: Math.max(ancho * 4 / 3, 240) }} />
          ))}
        </div>
      )}
    </Modal>,
    document.body,
  );
}

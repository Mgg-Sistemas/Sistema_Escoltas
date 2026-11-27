/**
 * Margen único de TODOS los documentos PDF (Estilo Golden Touch - GT)
 * Regla: 2 cm por cada lado en todos los documentos.
 * En puntos (pt): 1 cm = 72 / 2.54 pt ≈ 56.7 pt.
 */
export const MARGEN_PDF = 56.7;

export const MARGENES_TABLA_PDF = {
  top: MARGEN_PDF,
  right: MARGEN_PDF,
  bottom: MARGEN_PDF + 15,
  left: MARGEN_PDF,
};

export function limiteInferiorPdf(altoPagina) {
  return altoPagina - MARGEN_PDF;
}

export function anchoUtilPdf(anchoPagina) {
  return anchoPagina - 2 * MARGEN_PDF;
}

/**
 * Sanitiza el texto para que las fuentes estándar de jsPDF (Helvetica) no fallen con glifos no soportados.
 */
export function pdfSafe(texto) {
  return String(texto ?? '')
    .replace(/→/g, '->')
    .replace(/←/g, '<-')
    .replace(/[≈≃≅]/g, '~')
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
    .replace(/[\u{2600}-\u{27BF}]/gu, '')
    .replace(/[\u{2B00}-\u{2BFF}]/gu, '')
    .replace(/[\u{2190}-\u{21FF}]/gu, '')
    .replace(/[\u{FE00}-\u{FE0F}\u{200D}\u{20E3}]/gu, '')
    .replace(/[\u{E000}-\u{F8FF}]/gu, '')
    .replace(/\uFFFD/g, '')
    .replace(/[^\x20-\xFF]/g, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

let cachedLogoDataUrl = null;

/**
 * Carga el logo institucional en Data URL (PNG) con cache en memoria.
 */
export async function obtenerLogoDataUrl() {
  if (cachedLogoDataUrl) return cachedLogoDataUrl;
  if (typeof window === 'undefined') return null;
  try {
    const res = await fetch('/logo-escoltas.png');
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        cachedLogoDataUrl = reader.result;
        resolve(cachedLogoDataUrl);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

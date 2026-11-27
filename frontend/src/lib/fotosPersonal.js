import { useEffect, useState } from 'react';
import { supabase } from './supabase.js';

const BUCKET = 'fotos';
const PREFIJO = 'storage:fotos/';
const MAX_BYTES = 5 * 1024 * 1024;
const FORMATOS = new Map([
  ['image/jpeg', 'jpg'], ['image/png', 'png'], ['image/webp', 'webp'], ['image/avif', 'avif'],
]);

export function validarFoto(archivo) {
  if (!FORMATOS.has(archivo.type)) return 'Selecciona una imagen JPG, PNG, WebP o AVIF.';
  if (!archivo.size || archivo.size > MAX_BYTES) return 'La foto debe pesar entre 1 byte y 5 MB.';
  return '';
}

export async function subirFotoPersonal(archivo, usuarioId) {
  const problema = validarFoto(archivo);
  if (problema) throw new Error(problema);
  if (!usuarioId) throw new Error('Inicia sesión para poder subir la foto.');
  const ruta = usuarioId + '/' + crypto.randomUUID() + '.' + FORMATOS.get(archivo.type);
  const { error } = await supabase.storage.from(BUCKET).upload(ruta, archivo, { contentType: archivo.type });
  if (error) throw new Error('No se pudo subir la foto. Intenta nuevamente.');
  return PREFIJO + ruta;
}

export function useFotoPersonal(referencia, archivo) {
  const [resuelta, setResuelta] = useState(null);
  useEffect(() => {
    if (archivo) {
      const url = URL.createObjectURL(archivo);
      setResuelta({ origen: archivo, url });
      return () => URL.revokeObjectURL(url);
    }
    if (!referencia?.startsWith(PREFIJO)) return;
    let vigente = true;
    supabase.storage.from(BUCKET).createSignedUrl(referencia.slice(PREFIJO.length), 3600)
      .then(({ data }) => { if (vigente) setResuelta({ origen: referencia, url: data?.signedUrl }); })
      .catch(() => {});
    return () => { vigente = false; };
  }, [referencia, archivo]);

  if (archivo || referencia?.startsWith(PREFIJO)) {
    return resuelta?.origen === (archivo || referencia) ? resuelta.url : null;
  }
  return /^https?:\/\//i.test(referencia ?? '') ? referencia : null;
}

import React, { useRef } from 'react';
import { Camera, ImagePlus } from 'lucide-react';
import { Button } from './ui.jsx';
import { useFotoPersonal, validarFoto } from '../lib/fotosPersonal.js';

const FORMATOS = 'image/jpeg,image/png,image/webp,image/avif';

export default function SelectorFotoPersonal({ referencia, archivo, onSeleccionar, onError, disabled }) {
  const galeria = useRef(null);
  const camara = useRef(null);
  const preview = useFotoPersonal(referencia, archivo);
  const seleccionar = (evento) => {
    const campo = evento.currentTarget;
    const elegida = campo.files?.[0];
    campo.value = '';
    if (!elegida) return;
    const error = validarFoto(elegida);
    if (error) return onError(error);
    onSeleccionar(elegida);
  };

  return (
    <fieldset className="space-y-3 rounded-xl border border-slate-700 p-3 sm:col-span-2" disabled={disabled}>
      <legend className="px-2 text-sm font-semibold">Foto del personal</legend>
      {preview && <img src={preview} alt="Vista previa de la foto" className="h-24 w-24 rounded-xl object-cover" />}
      <input ref={galeria} type="file" accept={FORMATOS} hidden onChange={seleccionar} />
      <input ref={camara} type="file" accept={FORMATOS} capture="environment" hidden onChange={seleccionar} />
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" leftIcon={ImagePlus} onClick={() => galeria.current?.click()}>Elegir de la galería</Button>
        <Button type="button" size="sm" variant="outline" leftIcon={Camera} onClick={() => camara.current?.click()}>Tomar foto</Button>
        {archivo && <Button type="button" size="sm" variant="ghost" onClick={() => onSeleccionar(null)}>Descartar selección</Button>}
      </div>
      <p className="text-xs text-slate-400">Opcional. JPG, PNG, WebP o AVIF, hasta 5 MB.</p>
    </fieldset>
  );
}

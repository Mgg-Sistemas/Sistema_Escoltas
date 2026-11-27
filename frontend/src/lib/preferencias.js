let contextoAudio;

function leer(clave, defecto) {
  try {
    return localStorage.getItem(clave) ?? defecto;
  } catch {
    return defecto;
  }
}

function guardar(clave, valor) {
  try {
    localStorage.setItem(clave, valor);
  } catch {
    // La preferencia sigue aplicada en la pestaña actual.
  }
}

const CLAVE_TEMA = 'escoltas_tema_interfaz';
const CLAVE_SONIDO = 'escoltas_notificaciones_sonido';
let tema = leer(CLAVE_TEMA, 'oscuro') === 'claro' ? 'claro' : 'oscuro';
let sonido = leer(CLAVE_SONIDO, 'false') === 'true';

export function leerPreferencias() {
  return { tema, sonido };
}

export function aplicarTema(valor = tema) {
  tema = valor === 'claro' ? 'claro' : 'oscuro';
  document.documentElement.dataset.tema = tema;
}

export function cambiarTema(valor) {
  aplicarTema(valor);
  guardar(CLAVE_TEMA, tema);
}

export function cambiarSonido(valor) {
  sonido = valor;
  guardar(CLAVE_SONIDO, String(sonido));
}

export async function sonarAviso(tipo) {
  if (!sonido || navigator.userActivation?.hasBeenActive === false) return;
  const Audio = window.AudioContext || window.webkitAudioContext;
  if (!Audio) return;
  try {
    contextoAudio ??= new Audio();
    if (contextoAudio.state === 'suspended') await contextoAudio.resume();
    if (!sonido || contextoAudio.state !== 'running') return;

    const tono = contextoAudio.createOscillator();
    const volumen = contextoAudio.createGain();
    const ahora = contextoAudio.currentTime;
    tono.frequency.value = tipo === 'error' ? 440 : 660;
    volumen.gain.setValueAtTime(0.04, ahora);
    volumen.gain.exponentialRampToValueAtTime(0.001, ahora + 0.16);
    tono.connect(volumen);
    volumen.connect(contextoAudio.destination);
    tono.onended = () => { tono.disconnect(); volumen.disconnect(); };
    tono.start(ahora);
    tono.stop(ahora + 0.16);
  } catch {
    // Los avisos visuales siguen disponibles si el navegador bloquea el audio.
  }
}

#!/usr/bin/env node
/**
 * Bot de Actualización Automática para Sistema de Escoltas
 *
 * Monitorea el repositorio remoto de Git periódicamente. Cuando detecta un nuevo
 * commit en la rama configurada (por defecto 'main'), actualiza el código,
 * reconstruye el frontend, actualiza version.json y notifica al sistema.
 *
 * Uso:
 *   node scripts/update-bot.js           # Modo demonio continuo (revisa cada 60s)
 *   node scripts/update-bot.js --once    # Ejecutar una sola verificación y salir
 */

import { execSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const INTERVALO_MS = (Number(process.env.UPDATE_BOT_INTERVAL_SECONDS) || 60) * 1000;
const RAMA = process.env.UPDATE_BRANCH || 'main';
const REMOTO = process.env.UPDATE_REMOTE || 'origin';
const LOG_FILE = path.join(ROOT_DIR, 'logs', 'update-bot.log');

// Asegurar carpeta de logs
fs.mkdirSync(path.join(ROOT_DIR, 'logs'), { recursive: true });

function log(mensaje, nivel = 'INFO') {
  const ahora = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const linea = `[${ahora}] [${nivel}] [UpdateBot] ${mensaje}`;
  console.log(linea);
  try {
    fs.appendFileSync(LOG_FILE, `${linea}\n`, 'utf8');
  } catch {
    // Si no se puede escribir en disco, continúa en consola
  }
}

function ejecutar(comando, opciones = {}) {
  return execSync(comando, {
    cwd: ROOT_DIR,
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    ...opciones,
  }).trim();
}

function escribirEstadoActualizacion(estado) {
  const datos = JSON.stringify(estado, null, 2);
  const destinos = [
    path.join(ROOT_DIR, 'frontend', 'dist', 'version.json'),
    path.join(ROOT_DIR, 'frontend', 'public', 'version.json'),
    path.join(ROOT_DIR, 'dist', 'version.json'),
  ];
  destinos.forEach((destino) => {
    try {
      fs.mkdirSync(path.dirname(destino), { recursive: true });
      fs.writeFileSync(destino, datos, 'utf8');
    } catch {
      // Ignorar si la carpeta aún no existe
    }
  });
}

let actualizando = false;

async function verificarYActualizar() {
  if (actualizando) {
    log('Ya hay una actualización en curso, omitiendo ciclo.', 'WARN');
    return;
  }

  try {
    // 1. Fetch silencioso de la rama remota
    ejecutar(`git fetch ${REMOTO} ${RAMA} --quiet`);

    const commitLocal = ejecutar('git rev-parse HEAD');
    const commitRemoto = ejecutar(`git rev-parse ${REMOTO}/${RAMA}`);

    if (commitLocal === commitRemoto) {
      // Sin cambios pendientes
      return;
    }

    actualizando = true;
    const cortoLocal = commitLocal.slice(0, 7);
    const cortoRemoto = commitRemoto.slice(0, 7);
    log(`¡Nuevo commit detectado en ${REMOTO}/${RAMA}! ${cortoLocal} -> ${cortoRemoto}`);

    // Avisar que el sistema está actualizándose inmediatamente
    escribirEstadoActualizacion({
      actualizando: true,
      versionAnterior: cortoLocal,
      versionNueva: cortoRemoto,
      mensaje: 'El sistema esta actualizandose, por favor haga click aca para tener la ultima version.',
      timestamp: new Date().toISOString(),
    });

    // 2. Comprobar si package.json o package-lock.json cambiaron
    const cambioDependencias = ejecutar(
      `git diff --name-only ${commitLocal} ${commitRemoto} -- package.json package-lock.json frontend/package.json backend/package.json`
    ).trim();

    // 3. Traer cambios de Git
    log(`Sincronizando código con git reset --hard ${REMOTO}/${RAMA}...`);
    ejecutar(`git reset --hard ${REMOTO}/${RAMA}`);

    // 4. Si cambiaron dependencias, instalar limpiamente
    if (cambioDependencias) {
      log('Dependencias modificadas. Ejecutando npm install...');
      ejecutar('npm install --no-audit --prefer-offline');
    }

    // 5. Compilar el frontend con Vite
    log('Compilando frontend para producción con Vite...');
    ejecutar('npm --prefix frontend run build');

    // 6. Escribir versión final horneada en version.json
    const versionFinal = cortoRemoto;
    escribirEstadoActualizacion({
      actualizando: false,
      version: versionFinal,
      commit: commitRemoto,
      rama: RAMA,
      actualizadoEl: new Date().toISOString(),
    });

    log(`¡Actualización completada con éxito a la versión ${versionFinal}!`, 'SUCCESS');
  } catch (error) {
    log(`Error durante la actualización: ${error.message}`, 'ERROR');
    if (error.stderr) {
      log(`Detalle stderr: ${error.stderr}`, 'ERROR');
    }
    // Restaurar bandera de actualización
    try {
      const commitActual = ejecutar('git rev-parse --short HEAD');
      escribirEstadoActualizacion({
        actualizando: false,
        version: commitActual,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    } catch {
      // No hacer nada
    }
  } finally {
    actualizando = false;
  }
}

async function main() {
  const esUnSoloCiclo = process.argv.includes('--once') || process.argv.includes('-1');

  log(`Iniciando bot de actualización automática (Rama: ${RAMA}, Intervalo: ${INTERVALO_MS / 1000}s)...`);

  // Ejecución inicial inmediata
  await verificarYActualizar();

  if (esUnSoloCiclo) {
    log('Modo --once completado. Cerrando bot.');
    process.exit(0);
  }

  // Bucle infinito periódico
  setInterval(async () => {
    await verificarYActualizar();
  }, INTERVALO_MS);
}

main().catch((err) => {
  log(`Fallo crítico en el bot: ${err.message}`, 'FATAL');
  process.exit(1);
});

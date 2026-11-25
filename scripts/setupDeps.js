import { existsSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const paquetes = [
  { dir: root, nombre: 'raíz' },
  { dir: path.join(root, 'backend'), nombre: 'backend' },
  { dir: path.join(root, 'frontend'), nombre: 'frontend' },
];

/** Instala sólo si no hay lock interno o si package.json es más reciente. */
function necesitaInstalar({ dir }) {
  const lock = path.join(dir, 'node_modules', '.package-lock.json');
  const pkg = path.join(dir, 'package.json');

  if (!existsSync(lock)) return true;
  return statSync(pkg).mtimeMs > statSync(lock).mtimeMs;
}

let instaladoAlgo = false;

for (const paquete of paquetes) {
  if (!necesitaInstalar(paquete)) continue;

  console.log(`[setup] Instalando dependencias (${paquete.nombre})...`);
  const comando = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const resultado = spawnSync(comando, ['install', '--no-audit', '--no-fund'], {
    cwd: paquete.dir,
    stdio: 'inherit',
  });

  if (resultado.error) throw resultado.error;
  if (resultado.status !== 0) process.exit(resultado.status ?? 1);
  instaladoAlgo = true;
}

console.log(
  instaladoAlgo
    ? '[setup] Dependencias listas.'
    : '[setup] Dependencias ya instaladas.'
);

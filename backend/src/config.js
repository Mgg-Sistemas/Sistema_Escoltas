import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raizBackend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Se carga primero backend/.env y después el .env del directorio de ejecución.
dotenv.config({ path: path.join(raizBackend, '.env') });
dotenv.config();

const requeridas = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_ANON_KEY'];
const faltantes = requeridas.filter((nombre) => !process.env[nombre]?.trim());

if (faltantes.length > 0) {
  console.error(
    `[CONFIG] Faltan variables de entorno obligatorias: ${faltantes.join(', ')}. ` +
      'Copia backend/.env.example a backend/.env y completa los valores antes de iniciar la API.'
  );
  process.exit(1);
}

let urlSupabase;
try {
  urlSupabase = new URL(process.env.SUPABASE_URL.trim());
} catch {
  console.error('[CONFIG] SUPABASE_URL no es una URL válida. Ejemplo: https://rznkopetlmitfxcixjcr.supabase.co');
  process.exit(1);
}

const puerto = Number.parseInt(process.env.PORT ?? '4000', 10);
if (!Number.isInteger(puerto) || puerto < 1 || puerto > 65535) {
  console.error('[CONFIG] PORT debe ser un número entero entre 1 y 65535.');
  process.exit(1);
}

export const config = Object.freeze({
  port: puerto,
  corsOrigin: (process.env.CORS_ORIGIN ?? 'http://localhost:5173').trim(),
  dbName: process.env.SUPABASE_DB_NAME?.trim() || urlSupabase.hostname.split('.')[0],
  supabaseUrl: urlSupabase.toString().replace(/\/$/, ''),
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY.trim(),
  anonKey: process.env.SUPABASE_ANON_KEY.trim(),
  // URL pública del frontend: destino del enlace de restablecimiento.
  appUrl: (process.env.APP_URL ?? 'http://localhost:5173').trim().replace(/\/$/, ''),
  // Valores por defecto; la tabla ajustes_sistema puede sobrescribirlos.
  passwordInicialUsuario: (process.env.PASSWORD_INICIAL_USUARIO ?? 'es-123').trim(),
  passwordInicialAdmin: (process.env.PASSWORD_INICIAL_ADMIN ?? '123456').trim(),
  adminEmail: (process.env.ADMIN_EMAIL ?? 'administrador@escoltas.local').trim().toLowerCase(),
});

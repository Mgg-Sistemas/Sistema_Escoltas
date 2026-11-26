import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function appVersion() {
  const env = (
    process.env.VITE_APP_VERSION || process.env.APP_VERSION ||
    process.env.GITHUB_SHA || process.env.SOURCE_COMMIT || ''
  ).trim();
  if (env) return env.slice(0, 12);
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    // Si no está disponible git en el entorno
  }
  try {
    const pkg = JSON.parse(readFileSync(path.resolve(__dirname, 'package.json'), 'utf8'));
    return `v${pkg.version ?? '1.0.0'}`;
  } catch {
    return 'v1.0.0';
  }
}

const APP_VERSION = appVersion();

const versionJsonPlugin = {
  name: 'version-json-plugin',
  generateBundle() {
    this.emitFile({
      type: 'asset',
      fileName: 'version.json',
      source: JSON.stringify({
        version: APP_VERSION,
        builtAt: new Date().toISOString(),
      }),
    });
  },
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY
    || process.env.SUPABASE_ANON_KEY
    || env.VITE_SUPABASE_ANON_KEY
    || env.SUPABASE_ANON_KEY
    || '';
  const supabaseUrl = process.env.VITE_SUPABASE_URL
    || process.env.SUPABASE_URL
    || env.VITE_SUPABASE_URL
    || env.SUPABASE_URL
    || 'https://rznkopetlmitfxcixjcr.supabase.co';

  const publicDir = existsSync(path.resolve(__dirname, '../public'))
    ? path.resolve(__dirname, '../public')
    : path.resolve(__dirname, 'public');

  return {
    publicDir,
    plugins: [react(), versionJsonPlugin],
    define: {
      'import.meta.env.VITE_APP_VERSION': JSON.stringify(APP_VERSION),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(supabaseAnonKey),
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(supabaseUrl),
    },
    server: {
      host: true,
      port: 5173,
    },
  };
});

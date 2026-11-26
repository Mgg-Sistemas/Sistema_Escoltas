import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

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

  return {
    publicDir: '../public',
    plugins: [react()],
    define: {
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(supabaseAnonKey),
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(supabaseUrl),
    },
    server: {
      host: true,
      port: 5173,
    },
  };
});

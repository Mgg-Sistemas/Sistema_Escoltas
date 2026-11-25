import { createClient } from '@supabase/supabase-js';

// Valores por defecto seguros: la URL pública del proyecto y un marcador de posición
// para la clave. Copia .env.example a .env con la clave anon real.
const URL_SUPABASE = import.meta.env.VITE_SUPABASE_URL || 'https://rznkopetlmitfxcixjcr.supabase.co';
const CLAVE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || 'anon-key-pendiente';

export const supabase = createClient(URL_SUPABASE, CLAVE_ANON, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export const supabaseConfigurado = Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY);

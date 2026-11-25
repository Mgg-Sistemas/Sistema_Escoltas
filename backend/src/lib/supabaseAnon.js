import { createClient } from '@supabase/supabase-js';
import { config } from '../config.js';

/**
 * Cliente público (anon). Se usa únicamente para enviar el correo de
 * restablecimiento: Supabase gestiona el token y el enlace con esta llave.
 * La service-role sigue siendo la única que puede crear usuarios o cambiar
 * banderas de seguridad.
 */
export const supabaseAnon = createClient(config.supabaseUrl, config.anonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
  global: {
    headers: { 'X-Client-Info': 'sistema-escoltas-backend-auth/1.0' },
  },
});

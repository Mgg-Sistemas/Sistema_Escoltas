import { createClient } from '@supabase/supabase-js';
import { config } from '../config.js';

/**
 * Cliente con la llave service-role. Solo existe en el servidor: nunca se envía
 * al frontend. Las decisiones de autorización se toman manualmente en los middleware.
 */
export const supabase = createClient(config.supabaseUrl, config.serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
  global: {
    headers: { 'X-Client-Info': 'sistema-escoltas-backend/1.0' },
  },
});

import { Router } from 'express';
import { supabase } from '../lib/supabase.js';
import { asyncHandler, ok } from '../lib/http.js';
import { mapSupabaseError } from '../lib/errors.js';

const router = Router();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { data: perfil, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, role, active, avatar_url, phone, must_change_password, cambio_clave_at')
      .eq('id', req.user.id)
      .single();

    if (error) throw mapSupabaseError(error, 'No fue posible consultar tu perfil.');

    const { data: escolta, error: errorEscolta } = await supabase
      .from('escoltas')
      .select('*')
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (errorEscolta) throw mapSupabaseError(errorEscolta, 'No fue posible consultar los datos del escolta.');

    const { data: matriz } = await supabase
      .from('roles_permisos')
      .select('permisos,vistas_telefono,solo_telefono')
      .eq('role', perfil.role)
      .maybeSingle();

    return ok(res, {
      ...perfil,
      must_change_password: perfil.must_change_password !== false,
      permisos: matriz?.permisos ?? {},
      vistas_telefono: matriz?.vistas_telefono ?? [],
      solo_telefono: matriz?.solo_telefono ?? false,
      escolta: escolta ?? null,
    });
  })
);

export default router;

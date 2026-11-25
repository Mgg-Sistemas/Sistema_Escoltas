import { Router } from 'express';
import { config } from '../config.js';
import { supabase } from '../lib/supabase.js';
import { supabaseAnon } from '../lib/supabaseAnon.js';
import { ajusteBooleano } from '../lib/ajustes.js';
import { audit } from '../lib/audit.js';
import { asyncHandler, ok } from '../lib/http.js';
import { validate } from '../middleware/validate.js';
import { esquemaRecuperarClave, esquemaClaveNueva } from '../schemas.js';

/** Rutas públicas: no requieren token (se montan antes de authenticate). */
export const authPublicRouter = Router();

authPublicRouter.post(
  '/recuperar',
  validate(esquemaRecuperarClave),
  asyncHandler(async (req, res) => {
    const permitido = await ajusteBooleano('permitir_recuperacion', true);
    if (!permitido) {
      return ok(res, {
        message: 'Si el correo existe en el sistema, recibirás las instrucciones para restablecer tu contraseña.',
      });
    }

    const redirectTo = `${config.appUrl}/restablecer-clave?origen=recuperacion`;
    const { error } = await supabaseAnon.auth.resetPasswordForEmail(req.body.correo, { redirectTo });
    if (error) {
      // No revelamos si la cuenta existe: respuesta neutra y registro interno.
      console.warn('[Auth] No se pudo enviar el correo de recuperación:', error.message);
    }

    return ok(res, {
      message: 'Si el correo existe en el sistema, recibirás las instrucciones para restablecer tu contraseña.',
      redirectTo,
    });
  }),
);

/** Rutas protegidas: requieren token válido. */
export const authRouter = Router();

/** Cambia la contraseña desde el backend (service-role) y libera el bloqueo. */
authRouter.post(
  '/cambiar-clave',
  validate(esquemaClaveNueva),
  asyncHandler(async (req, res) => {
    const { error } = await supabase.auth.admin.updateUserById(req.user.id, {
      password: req.body.clave,
      user_metadata: { cambio_clave_forzado: true },
    });
    if (error) throw error;

    const { error: perfilError } = await supabase
      .from('profiles')
      .update({ must_change_password: false, cambio_clave_at: new Date().toISOString() })
      .eq('id', req.user.id);
    if (perfilError) throw perfilError;

    await audit({
      tabla: 'profiles',
      operacion: 'CAMBIAR_CLAVE',
      registro_id: req.user.id,
      cambios: { must_change_password: false },
      usuario_id: req.user.id,
    });

    return ok(res, { message: 'Contraseña actualizada correctamente.' });
  }),
);

/**
 * Confirma el cambio cuando el frontend ya actualizó la contraseña con
 * `supabase.auth.updateUser` (flujo de correo de restablecimiento).
 */
authRouter.post(
  '/clave-confirmada',
  asyncHandler(async (req, res) => {
    const { error } = await supabase
      .from('profiles')
      .update({ must_change_password: false, cambio_clave_at: new Date().toISOString() })
      .eq('id', req.user.id);
    if (error) throw error;

    await audit({
      tabla: 'profiles',
      operacion: 'CONFIRMAR_CLAVE',
      registro_id: req.user.id,
      cambios: { must_change_password: false },
      usuario_id: req.user.id,
    });

    return ok(res, { message: 'Contraseña confirmada.' });
  }),
);

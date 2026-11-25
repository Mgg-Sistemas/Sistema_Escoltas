import { ApiError, mapSupabaseError } from '../lib/errors.js';

export function notFoundHandler(req, res, next) {
  next(
    new ApiError(
      404,
      `La ruta ${req.method} ${req.originalUrl} no existe.`,
      'RUTA_NO_ENCONTRADA'
    )
  );
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  let fallo = error;

  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    fallo = new ApiError(400, 'El cuerpo de la petición no contiene un JSON válido.', 'JSON_INVALIDO');
  } else if (error?.type === 'entity.too.large') {
    fallo = new ApiError(413, 'El cuerpo de la petición supera el tamaño máximo permitido (2 MB).', 'CUERPO_DEMASIADO_GRANDE');
  } else if (!(error instanceof ApiError) && typeof error?.code === 'string' && error?.details !== undefined) {
    // Error crudo de Supabase/Postgres que no pasó por mapSupabaseError.
    fallo = mapSupabaseError(error);
  }

  if (!(fallo instanceof ApiError)) {
    console.error('[ERROR_NO_CONTROLADO]', error);
    fallo = new ApiError(500, 'Ocurrió un error interno del servidor. Intente nuevamente.', 'ERROR_INTERNO');
  }

  if (fallo.status >= 500) console.error('[ERROR]', fallo);

  return res.status(fallo.status).json({
    ok: false,
    error: {
      message: fallo.message,
      code: fallo.code,
    },
  });
}

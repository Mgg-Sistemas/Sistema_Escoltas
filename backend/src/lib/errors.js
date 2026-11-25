export class ApiError extends Error {
  constructor(status, message, code, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function noEncontrado(mensaje = 'No se encontró el registro solicitado.') {
  return new ApiError(404, mensaje, 'NO_ENCONTRADO');
}

const MAPA_BASE_DATOS = {
  PGRST116: { status: 404, code: 'NO_ENCONTRADO', detalle: 'El registro solicitado no existe.' },
  '23505': { status: 409, code: 'CONFLICTO', detalle: 'Ya existe un registro con esos datos únicos.' },
  '23503': { status: 400, code: 'REFERENCIA_INVALIDA', detalle: 'Uno de los identificadores relacionados no existe.' },
  '23514': { status: 400, code: 'VALIDACION', detalle: 'El valor no cumple las reglas definidas en la base de datos.' },
  '23502': { status: 400, code: 'VALIDACION', detalle: 'Falta un campo obligatorio.' },
  '22P02': { status: 400, code: 'VALIDACION', detalle: 'El formato de uno de los valores no es válido.' },
  '42501': { status: 403, code: 'PROHIBIDO', detalle: 'No tiene permisos para realizar esta operación.' },
};

/** Convierte errores de PostgREST/Postgres a errores de API con mensaje en español. */
export function mapSupabaseError(error, mensaje = 'No fue posible completar la operación en la base de datos.') {
  if (error instanceof ApiError) return error;

  const codigo = String(error?.code ?? '');
  const equivalencia = MAPA_BASE_DATOS[codigo];

  if (equivalencia) {
    return new ApiError(
      equivalencia.status,
      `${mensaje} ${equivalencia.detalle}`,
      equivalencia.code,
      error?.details
    );
  }

  console.error('[BASE_DE_DATOS]', error?.message ?? error);
  return new ApiError(
    500,
    `${mensaje} Revise los registros del servidor para más información.`,
    'ERROR_BASE_DE_DATOS'
  );
}

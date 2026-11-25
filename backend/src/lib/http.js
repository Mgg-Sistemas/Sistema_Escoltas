import { ApiError } from './errors.js';

/** Envuelve controladores asíncronos para que los rechazos lleguen al middleware de errores. */
export const asyncHandler = (controlador) => (req, res, next) =>
  Promise.resolve(controlador(req, res, next)).catch(next);

export function ok(res, data, count) {
  const cuerpo = { ok: true, data };
  if (count !== undefined) cuerpo.count = count;
  return res.status(200).json(cuerpo);
}

export function created(res, data) {
  return res.status(201).json({ ok: true, data });
}

const TIPOS_EN_ESPAÑOL = {
  string: 'texto',
  number: 'número',
  boolean: 'booleano',
  object: 'objeto',
  array: 'lista',
};

/** Traduce los mensajes genéricos de Zod para que todas las respuestas estén en español. */
function mensajeZod(issue) {
  const mensaje = issue.message ?? '';
  if (!/^(Invalid input|Invalid |Expected |Too small|Too big|String must|Number must|Unrecognized)/i.test(mensaje)) {
    return mensaje;
  }

  if (issue.code === 'invalid_type') {
    if (issue.received === 'undefined' || issue.received === 'null') return 'Este campo es obligatorio.';
    const esperado = TIPOS_EN_ESPAÑOL[issue.expected] ?? 'valor válido';
    return `Se esperaba ${esperado} y se recibió un valor no válido.`;
  }
  if (issue.code === 'too_small') {
    return `Debe tener al menos ${issue.minimum} ${issue.type === 'string' ? 'caracteres' : 'unidades'}.`;
  }
  if (issue.code === 'too_big') {
    return `No puede superar ${issue.maximum} ${issue.type === 'string' ? 'caracteres' : 'unidades'}.`;
  }
  if (issue.code === 'invalid_format') return 'El formato del valor no es válido.';
  return 'Uno de los valores proporcionados no es válido.';
}

/** Parsea con Zod y lanza un ApiError en español; útil cuando el esquema depende del rol. */
export function parsear(esquema, datos) {
  const resultado = esquema.safeParse(datos);
  if (resultado.success) return resultado.data;

  const issue = resultado.error.issues[0];
  const prefijo = issue.path.length > 0 ? `${issue.path.join('.')}: ` : '';
  throw new ApiError(400, `${prefijo}${mensajeZod(issue)}`, 'VALIDACION');
}

import { parsear } from '../lib/http.js';

/** Valida req[origen] con Zod y sustituye el valor por el resultado saneado. */
export function validate(esquema, origen = 'body') {
  return (req, res, next) => {
    try {
      req[origen] = parsear(esquema, req[origen]);
      next();
    } catch (error) {
      next(error);
    }
  };
}

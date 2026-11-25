const CAMPOS_NO_EDITABLES = new Set(['id', 'created_at', 'updated_at', 'creado_at', 'actualizado_at']);

/** Elimina campos calculados por la base de datos y valores indefinidos antes de escribir. */
export function limpiarPayload(payload) {
  return Object.fromEntries(
    Object.entries(payload ?? {}).filter(([clave, valor]) => !CAMPOS_NO_EDITABLES.has(clave) && valor !== undefined)
  );
}

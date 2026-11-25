/** Aplica filtros declarados por cada ruta a un constructor de consulta de Supabase. */
export function applyFilters(query, params, especificaciones) {
  for (const [clave, definicion] of Object.entries(especificaciones)) {
    const valor = params[clave];
    if (valor === undefined || valor === null || valor === '') continue;

    const columna = definicion.columna ?? clave;
    const texto = String(valor);

    switch (definicion.tipo) {
      case 'ilike':
        query = query.ilike(columna, `%${texto.replace(/[%]/g, '')}%`);
        break;
      case 'gte':
        query = query.gte(columna, texto);
        break;
      case 'lte':
        query = query.lte(columna, texto);
        break;
      case 'in': {
        const valores = Array.isArray(valor)
          ? valor
          : texto.split(',').map((parte) => parte.trim()).filter(Boolean);
        if (valores.length > 0) query = query.in(columna, valores);
        break;
      }
      case 'bool': {
        const normalizado = texto.toLowerCase();
        if (['true', 'false', '1', '0'].includes(normalizado)) {
          query = query.eq(columna, ['true', '1'].includes(normalizado));
        }
        break;
      }
      case 'eq':
      default:
        query = query.eq(columna, valor);
        break;
    }
  }
  return query;
}

/** Búsqueda libre sobre varias columnas de texto. */
export function applySearch(query, termino, columnas) {
  if (!termino || !columnas?.length) return query;
  const limpio = String(termino).replace(/[,().%\\]/g, ' ').trim();
  if (!limpio) return query;
  return query.or(columnas.map((columna) => `${columna}.ilike.%${limpio}%`).join(','));
}

/** Orden seguro (lista blanca) y paginación por limit/offset. */
export function applyOrderAndRange(query, params, orden = { columna: 'id', ascendente: false }, maximo = 200) {
  const permitidas = orden.permitidas ?? [orden.columna];
  const columna = params.ordenar_por && permitidas.includes(String(params.ordenar_por))
    ? String(params.ordenar_por)
    : orden.columna;

  let ascendente = orden.ascendente;
  if (params.direccion === 'asc') ascendente = true;
  if (params.direccion === 'desc') ascendente = false;

  const limite = Math.min(Math.max(Number.parseInt(params.limit, 10) || 50, 1), maximo);
  const desplazamiento = Math.max(Number.parseInt(params.offset, 10) || 0, 0);

  return query.order(columna, { ascending: ascendente }).range(desplazamiento, desplazamiento + limite - 1);
}

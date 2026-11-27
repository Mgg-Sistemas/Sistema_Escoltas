export const VISTAS_TELEFONO = [
  { modulo: 'distribucion', ruta: '/distribucion', etiqueta: 'Turnos' },
  { modulo: 'asistencias', ruta: '/asistencias', etiqueta: 'Asistencia' },
  { modulo: 'permisos', ruta: '/permisos', etiqueta: 'Permisos' },
  { modulo: 'escoltas', ruta: '/escoltas', etiqueta: 'Personal' },
  { modulo: 'nomina', ruta: '/nomina', etiqueta: 'Nómina' },
];

export function resolverVistasTelefono(items, configuracion, rol) {
  const asignadas = configuracion?.vistas_telefono ?? [];
  const restringido = configuracion?.solo_telefono === true || asignadas.length > 0;

  return VISTAS_TELEFONO.flatMap(({ modulo, ruta, etiqueta }) => {
    const item = items.find(({ to }) => to === ruta);
    const permiso = configuracion?.permisos?.[modulo];
    const tieneLectura = rol === 'admin' || permiso?.lectura === true || permiso?.full === true;

    // Cada pantalla requiere permiso de lectura en su módulo
    if (!item || !tieneLectura) return [];
    if (restringido && !asignadas.includes(modulo)) return [];

    return [{ ...item, etiqueta }];
  });
}

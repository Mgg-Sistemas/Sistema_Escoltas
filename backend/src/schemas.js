import { z } from 'zod';

/* ---------- utilidades reutilizables ---------- */

export const uuid = z.string().uuid('Debe ser un identificador UUID válido.');

export const texto = (max = 255) =>
  z.string().trim().min(1, 'Este campo no puede estar vacío.').max(max, `No puede superar ${max} caracteres.`);

export const textoOpcional = (max = 255) =>
  z.string().trim().max(max, `No puede superar ${max} caracteres.`).nullish();

export const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe tener formato YYYY-MM-DD.');

export const fechaHora = z.string().refine(
  (valor) => !Number.isNaN(Date.parse(valor)),
  'Debe proporcionar una fecha y hora válidas.'
);

export const enteroNoNegativo = z.number().int('Debe ser un número entero.').nonnegative('No puede ser negativo.');

export const monto = z
  .number()
  .finite('Debe ser un número.')
  .nonnegative('No puede ser negativo.')
  .max(1_000_000_000, 'El monto es demasiado grande.');

export const esquemaId = z.object({ id: uuid });

/** Construye un esquema de actualización que exige al menos un campo. */
export const actualizacion = (esquema) =>
  esquema.partial().refine((objeto) => Object.keys(objeto).length > 0, {
    message: 'Debe enviar al menos un campo para actualizar.',
  });

const rangoFechasValido = (objeto) =>
  !objeto.fecha_fin || !objeto.fecha_inicio || objeto.fecha_fin >= objeto.fecha_inicio;

const MENSAJE_RANGO = {
  message: 'La fecha de fin no puede ser anterior a la fecha de inicio.',
  path: ['fecha_fin'],
};

/* ---------- estados (valores en minúsculas) ---------- */

export const estadosEscolta = z.enum(['activo', 'inactivo', 'suspendido', 'vacaciones']);
export const estadosAsignacion = z.enum(['planificada', 'activa', 'finalizada', 'cancelada']);
export const estadosAsistencia = z.enum(['presente', 'ausente', 'tarde', 'justificada']);
export const estadosPermiso = z.enum(['pendiente', 'aprobado', 'rechazado']);
export const estadosPeriodo = z.enum(['abierto', 'cerrado', 'pagado']);
export const estadosDetalleNomina = z.enum(['pendiente', 'aprobado', 'pagado']);
export const estadosPago = z.enum(['registrado', 'confirmado', 'anulado']);
export const metodosPago = z.enum(['transferencia', 'efectivo', 'cheque']);

/* ---------- escoltas ---------- */

export const esquemaEscoltaCrear = z.object({
  user_id: uuid.nullish(),
  codigo: texto(50),
  nombres: texto(120),
  apellidos: texto(120),
  cedula: texto(40),
  telefono: textoOpcional(40),
  direccion: textoOpcional(255),
  fecha_ingreso: fecha.nullish(),
  grado_id: uuid.nullish(),
  estado: estadosEscolta.optional(),
  foto_url: textoOpcional(500),
  notas: textoOpcional(1000),
});

export const esquemaEscoltaActualizar = actualizacion(esquemaEscoltaCrear);

/* ---------- catálogos ---------- */

// Se permite paso de columnas adicionales para no rechazar campos definidos en la migración.
export const esquemaClienteCrear = z
  .object({
    nombre: texto(150),
    ruc: textoOpcional(30),
    telefono: textoOpcional(40),
    direccion: textoOpcional(255),
    contacto: textoOpcional(120),
    activo: z.boolean().optional(),
    color: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, 'El color debe tener formato hexadecimal (#RRGGBB).').optional(),
  })
  .passthrough();

export const esquemaClienteActualizar = actualizacion(esquemaClienteCrear);

const hora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, 'La hora debe tener formato HH:MM o HH:MM:SS.');

export const esquemaTurnoCrear = z
  .object({
    nombre: texto(100),
    hora_inicio: hora,
    hora_fin: hora,
    horas_base: z.number().finite('Debe ser un número.').positive('Debe ser mayor que cero.').optional(),
    activo: z.boolean().optional(),
  })
  .passthrough();

export const esquemaTurnoActualizar = actualizacion(esquemaTurnoCrear);

export const esquemaGradoCrear = z
  .object({
    nombre: texto(100),
    nivel: z.number().int('El nivel debe ser un número entero.').nonnegative('No puede ser negativo.').optional(),
    activo: z.boolean().optional(),
  })
  .passthrough();

export const esquemaGradoActualizar = actualizacion(esquemaGradoCrear);

export const esquemaTipoPermisoCrear = z
  .object({
    nombre: texto(100),
    descripcion: textoOpcional(500),
    requiere_comprobante: z.boolean().optional(),
    activo: z.boolean().optional(),
  })
  .passthrough();

export const esquemaTipoPermisoActualizar = actualizacion(esquemaTipoPermisoCrear);

/* ---------- asignaciones ---------- */

export const esquemaAsignacionCrear = z
  .object({
    escolta_id: uuid,
    cliente_id: uuid,
    turno_id: uuid.nullish(),
    fecha_inicio: fecha,
    fecha_fin: fecha.nullish(),
    estado: estadosAsignacion.optional(),
    supervisor_id: uuid.nullish(),
    notas: textoOpcional(1000),
  })
  .refine(rangoFechasValido, MENSAJE_RANGO);

export const esquemaAsignacionActualizar = z
  .object({
    escolta_id: uuid.optional(),
    cliente_id: uuid.optional(),
    turno_id: uuid.nullish(),
    fecha_inicio: fecha.optional(),
    fecha_fin: fecha.nullish(),
    estado: estadosAsignacion.optional(),
    supervisor_id: uuid.nullish(),
    notas: textoOpcional(1000),
  })
  .refine((objeto) => Object.keys(objeto).length > 0, {
    message: 'Debe enviar al menos un campo para actualizar.',
  })
  .refine(rangoFechasValido, MENSAJE_RANGO);

/* ---------- asistencias ---------- */

export const esquemaAsistenciaCrear = z.object({
  escolta_id: uuid,
  asignacion_id: uuid.nullish(),
  fecha: fecha,
  check_in: fechaHora.optional(),
  check_out: fechaHora.nullish(),
  estado: estadosAsistencia.optional(),
  horas: z.number().finite('Debe ser un número.').nonnegative('No puede ser negativo.').optional(),
  notas: textoOpcional(1000),
});

export const esquemaAsistenciaActualizar = actualizacion(
  esquemaAsistenciaCrear.omit({ escolta_id: true })
);

/** El escolta solo puede registrar su propia asistencia (check-in). */
export const esquemaAsistenciaEscoltaCrear = z.object({
  asignacion_id: uuid,
  fecha: fecha.optional(),
  check_in: fechaHora.optional(),
  notas: textoOpcional(500),
});

/** El escolta solo puede cerrar su propia asistencia (check-out). */
export const esquemaAsistenciaEscoltaActualizar = z.object({
  check_out: fechaHora,
  notas: textoOpcional(500),
});

/* ---------- permisos ---------- */

export const esquemaPermisoCrear = z
  .object({
    escolta_id: uuid,
    tipo_id: uuid,
    fecha_inicio: fecha,
    fecha_fin: fecha,
    motivo: texto(1000),
    comprobante_url: textoOpcional(500),
    estado: estadosPermiso.optional(),
    solicitado_por: uuid.nullish(),
    notas_revision: textoOpcional(1000),
  })
  .refine(rangoFechasValido, MENSAJE_RANGO);

export const esquemaPermisoActualizar = z
  .object({
    escolta_id: uuid.optional(),
    tipo_id: uuid.optional(),
    fecha_inicio: fecha.optional(),
    fecha_fin: fecha.optional(),
    motivo: texto(1000).optional(),
    comprobante_url: textoOpcional(500),
    estado: estadosPermiso.optional(),
    notas_revision: textoOpcional(1000),
  })
  .refine((objeto) => Object.keys(objeto).length > 0, {
    message: 'Debe enviar al menos un campo para actualizar.',
  })
  .refine(rangoFechasValido, MENSAJE_RANGO);

/** El escolta solicita permisos únicamente para sí mismo. */
export const esquemaPermisoEscoltaCrear = z
  .object({
    tipo_id: uuid,
    fecha_inicio: fecha,
    fecha_fin: fecha,
    motivo: texto(1000),
    comprobante_url: textoOpcional(500),
  })
  .refine(rangoFechasValido, MENSAJE_RANGO);

export const esquemaRevisionPermiso = z.object({
  estado: z.enum(['aprobado', 'rechazado'], {
    error: () => "El estado debe ser 'aprobado' o 'rechazado'.",
  }),
  notas_revision: textoOpcional(1000),
});

/* ---------- nómina ---------- */

export const esquemaPeriodoCrear = z
  .object({
    nombre: texto(150),
    fecha_inicio: fecha,
    fecha_fin: fecha,
  })
  .refine(rangoFechasValido, MENSAJE_RANGO);

export const esquemaDetalleNominaActualizar = z
  .object({
    dias_trabajados: z.number().finite('Debe ser un número.').nonnegative('No puede ser negativo.').optional(),
    horas_extras: z.number().finite('Debe ser un número.').nonnegative('No puede ser negativo.').optional(),
    sueldo_base: monto.optional(),
    bonos: monto.optional(),
    descuentos: monto.optional(),
    estado: estadosDetalleNomina.optional(),
    pagado_at: fechaHora.nullish(),
    pago_referencia: textoOpcional(100),
    notas: textoOpcional(1000),
  })
  .refine((objeto) => Object.keys(objeto).length > 0, {
    message: 'Debe enviar al menos un campo para actualizar.',
  });

export const esquemaPagarPeriodo = z.object({
  metodo: metodosPago.optional(),
  referencia: textoOpcional(100),
  fecha_pago: fecha.optional(),
  estado: z.enum(['registrado', 'confirmado']).optional(),
});

/* ---------- pagos ---------- */

export const esquemaPagoCrear = z.object({
  periodo_id: uuid,
  escolta_id: uuid,
  monto,
  fecha_pago: fecha.optional(),
  metodo: metodosPago,
  referencia: textoOpcional(100),
  comprobante_url: textoOpcional(500),
  estado: estadosPago.optional(),
});

export const esquemaPagoActualizar = actualizacion(
  esquemaPagoCrear.omit({ periodo_id: true, escolta_id: true })
);

/* ---------- autenticación y contraseñas ---------- */

export const esquemaRecuperarClave = z.object({
  correo: z.string().trim().email('Escribe un correo electrónico válido.').max(255),
});

/** Resuelve el usuario visible al correo interno usado por Supabase Auth. */
export const esquemaResolverUsuario = z.object({
  usuario: texto(120),
});

export const esquemaClaveNueva = z
  .object({
    clave: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres.').max(128),
    confirmacion: z.string().min(1, 'Confirma la contraseña.'),
  })
  .refine((datos) => datos.clave === datos.confirmacion, {
    message: 'Las contraseñas no coinciden.',
    path: ['confirmacion'],
  });

/* ---------- usuarios, roles y ajustes ---------- */

export const rolesSistema = z.enum(['admin', 'supervisor', 'contador', 'escolta'], {
  error: () => 'El rol debe ser admin, supervisor, contador o escolta.',
});

export const esquemaUsuarioCrear = z.object({
  usuario: texto(120),
  // Opcional: si no se envía, se genera un correo interno desde el usuario.
  correo: z.string().trim().email('Escribe un correo electrónico válido.').max(255).optional(),
  nombre: texto(150),
  apellido: textoOpcional(150),
  telefono: textoOpcional(50),
  role: rolesSistema.default('escolta'),
  escolta_id: uuid.optional(),
});

export const esquemaUsuarioActualizar = z.object({
  usuario: texto(120).optional(),
  nombre: texto(150).optional(),
  apellido: textoOpcional(150),
  telefono: textoOpcional(50),
  role: rolesSistema.optional(),
  active: z.boolean().optional(),
  escolta_id: uuid.nullish(),
});

export const esquemaRolPermisos = z.object({
  role: rolesSistema,
  permisos: z.record(
    z.object({
      lectura: z.boolean(),
      escritura: z.boolean(),
      full: z.boolean(),
    }),
  ),
  vistas_telefono: z.array(z.string()).optional(),
  solo_telefono: z.boolean().optional(),
});

export const esquemaAjustesActualizar = z.object({
  cambios: z
    .array(
      z.object({
        clave: texto(120),
        valor: textoOpcional(4000),
      }),
    )
    .min(1, 'Envía al menos un ajuste para guardar.'),
});

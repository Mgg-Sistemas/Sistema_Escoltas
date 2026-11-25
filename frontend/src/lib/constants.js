export const ROLES = ['admin', 'supervisor', 'contador', 'escolta'];

export const ROLES_LABELS = {
  admin: 'Administrador',
  supervisor: 'Supervisor',
  contador: 'Contador',
  escolta: 'Escolta',
};

export const ROLES_DESCRIPCION = {
  admin: 'Control total del sistema: usuarios, roles, personal y pagos.',
  supervisor: 'Distribución de escoltas, asistencias y revisión de permisos.',
  contador: 'Periodos de nómina, cálculo de pagos y cierre de nómina.',
  escolta: 'Consultar tus datos, registrar asistencia y solicitar permisos.',
};

// Permisos de navegación por módulo (el backend/RLS sigue siendo la fuente de verdad).
export const ROLES_POR_MODULO = {
  escoltas: ['admin', 'supervisor', 'escolta'],
  distribucion: ['admin', 'supervisor'],
  permisos: ROLES,
  asistencias: ['admin', 'supervisor', 'escolta'],
  nomina: ['admin', 'contador'],
  pagos: ['admin', 'contador'],
  usuarios: ['admin'],
  'roles-permisos': ['admin'],
  ajustes: ['admin'],
  ayuda: ROLES,
};

// Módulos de la matriz de permisos traída de la base funcional GT.
export const MODULOS_SISTEMA = [
  { key: 'dashboard', label: 'Inicio', descripcion: 'Resumen general del sistema.' },
  { key: 'escoltas', label: 'Escoltas', descripcion: 'Fichas del personal.' },
  { key: 'distribucion', label: 'Distribución', descripcion: 'Asignaciones y turnos.' },
  { key: 'permisos', label: 'Permisos', descripcion: 'Solicitudes y aprobaciones.' },
  { key: 'asistencias', label: 'Asistencias', descripcion: 'Check-in y check-out.' },
  { key: 'nomina', label: 'Nómina', descripcion: 'Periodos y detalles.' },
  { key: 'pagos', label: 'Pagos', descripcion: 'Registro y confirmación.' },
  { key: 'usuarios', label: 'Usuarios', descripcion: 'Cuentas y claves.' },
  { key: 'roles', label: 'Roles', descripcion: 'Roles y matriz de acceso.' },
  { key: 'ajustes', label: 'Ajustes', descripcion: 'Configuración general.' },
  { key: 'auditoria', label: 'Auditoría', descripcion: 'Bitácora de cambios.' },
  { key: 'ayuda', label: 'Ayuda', descripcion: 'Guía del sistema.' },
  { key: 'tiempo_real', label: 'Tiempo real', descripcion: 'Actualizaciones automáticas.' },
];

export const NIVELES_PERMISO = [
  { key: 'lectura', label: 'Lectura' },
  { key: 'escritura', label: 'Escritura' },
  { key: 'full', label: 'Control total' },
];

export const TONES = {
  verde: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  amarillo: 'bg-amber-50 text-amber-800 ring-amber-200',
  rojo: 'bg-rose-50 text-rose-700 ring-rose-200',
  azul: 'bg-blue-50 text-blue-700 ring-blue-200',
  morado: 'bg-violet-50 text-violet-700 ring-violet-200',
  naranja: 'bg-brand-50 text-brand-800 ring-brand-200',
  gris: 'bg-slate-100 text-slate-600 ring-slate-200',
};

// Los valores deben coincidir con los CHECK de PostgreSQL (ver supabase/migrations).
export const ESTADOS = {
  // Escoltas
  activo: { label: 'Activo', tone: 'verde' },
  inactivo: { label: 'Inactivo', tone: 'gris' },
  suspendido: { label: 'Suspendido', tone: 'rojo' },
  vacaciones: { label: 'De vacaciones', tone: 'azul' },
  // Asignaciones / distribución
  planificada: { label: 'Planificada', tone: 'azul' },
  activa: { label: 'Activa', tone: 'verde' },
  finalizada: { label: 'Finalizada', tone: 'morado' },
  cancelada: { label: 'Cancelada', tone: 'gris' },
  // Asistencias
  presente: { label: 'Presente', tone: 'verde' },
  ausente: { label: 'Ausente', tone: 'rojo' },
  tarde: { label: 'Llegó tarde', tone: 'amarillo' },
  justificada: { label: 'Justificada', tone: 'amarillo' },
  // Permisos
  pendiente: { label: 'Pendiente', tone: 'amarillo' },
  aprobado: { label: 'Aprobado', tone: 'verde' },
  rechazado: { label: 'Rechazado', tone: 'rojo' },
  // Nómina
  abierto: { label: 'Abierto', tone: 'azul' },
  cerrado: { label: 'Cerrado', tone: 'morado' },
  pagado: { label: 'Pagado', tone: 'verde' },
  // Pagos
  registrado: { label: 'Registrado', tone: 'amarillo' },
  confirmado: { label: 'Confirmado', tone: 'verde' },
  anulado: { label: 'Anulado', tone: 'rojo' },
};

export const opcionesEstado = (...estados) =>
  estados.map((valor) => ({ value: valor, label: ESTADOS[valor]?.label || valor }));

export const OPCIONES_ESTADO_ESCOLTA = opcionesEstado('activo', 'inactivo', 'suspendido', 'vacaciones');
export const OPCIONES_ESTADO_ASIGNACION = opcionesEstado('planificada', 'activa', 'finalizada', 'cancelada');
export const OPCIONES_ESTADO_PERMISO = opcionesEstado('pendiente', 'aprobado', 'rechazado');
export const OPCIONES_ESTADO_ASISTENCIA = opcionesEstado('presente', 'ausente', 'tarde', 'justificada');
export const OPCIONES_ESTADO_PERIODO = opcionesEstado('abierto', 'cerrado', 'pagado');
export const OPCIONES_ESTADO_DETALLE = opcionesEstado('pendiente', 'aprobado', 'pagado');
export const OPCIONES_ESTADO_PAGO = opcionesEstado('registrado', 'confirmado', 'anulado');

export const METODOS_PAGO = [
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'cheque', label: 'Cheque' },
];

export const TURNOS_SUGERIDOS = ['Mañana', 'Tarde', 'Noche', '24 horas', 'Fin de semana'];

export const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

export const estadoLabel = (estado) => ESTADOS[estado]?.label || estado || 'Sin estado';
export const estadoTone = (estado) => ESTADOS[estado]?.tone || 'gris';

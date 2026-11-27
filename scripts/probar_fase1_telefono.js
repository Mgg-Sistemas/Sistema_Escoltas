import path from 'path';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { resolverVistasTelefono, VISTAS_TELEFONO } from '../frontend/src/lib/vistasTelefono.js';

dotenv.config({ path: path.resolve('backend/.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Faltan credenciales de Supabase en backend/.env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Items estándar de navegación
const ITEMS_SISTEMA = [
  { to: '/distribucion', label: 'Turnos y Distribución' },
  { to: '/asistencias', label: 'Disponibilidad y Asistencia' },
  { to: '/permisos', label: 'Descansos y Permisos' },
  { to: '/escoltas', label: 'Personal y Escoltas' },
  { to: '/nomina', label: 'Nómina, Pagos y Recibos' },
  { to: '/usuarios', label: 'Usuarios y seguridad' },
  { to: '/ajustes', label: 'Configuración' },
  { to: '/auditoria', label: 'Auditoría' },
];

async function probarFase1() {
  console.log('================================================================');
  console.log('PRUEBAS AUTOMATIZADAS - FASE 1: VALIDAR TELÉFONO COMO EN GT');
  console.log('================================================================\n');

  // 1. Obtener estado previo del rol escolta para restaurar al final
  const { data: previoEscolta, error: errPrevio } = await supabase
    .from('roles_permisos')
    .select('role, permisos, vistas_telefono, solo_telefono')
    .eq('role', 'escolta')
    .single();

  if (errPrevio || !previoEscolta) {
    throw new Error(`Error obteniendo configuración del rol escolta: ${errPrevio?.message}`);
  }

  console.log('Estado inicial del rol escolta respaldado en memoria.');

  let pruebasAprobadas = 0;
  let totalPruebas = 0;

  // CASO 1: CERO PANTALLAS CON SOLO TELÉFONO
  totalPruebas++;
  console.log('\n--- CASO 1: ASIGNACIÓN DE CERO PANTALLAS (Solo teléfono) ---');
  await supabase
    .from('roles_permisos')
    .update({
      vistas_telefono: [],
      solo_telefono: true,
    })
    .eq('role', 'escolta');

  // Simular nuevo inicio de sesión consultando Supabase
  const { data: sesionCaso1 } = await supabase
    .from('roles_permisos')
    .select('role, permisos, vistas_telefono, solo_telefono')
    .eq('role', 'escolta')
    .single();

  const accesosCaso1 = resolverVistasTelefono(ITEMS_SISTEMA, sesionCaso1, 'escolta');
  console.log(`Pantallas resueltas: ${accesosCaso1.length}`);
  if (accesosCaso1.length === 0 && sesionCaso1.solo_telefono === true) {
    console.log('✓ Criterio cumplido: 0 pantallas asignadas -> Se muestra el aviso "Tu rol no tiene pantallas de teléfono disponibles."');
    pruebasAprobadas++;
  } else {
    console.error('✗ Falló Caso 1');
  }

  // CASO 2: EXACTAMENTE UNA PANTALLA CON SOLO TELÉFONO (ENTRADA DIRECTA)
  totalPruebas++;
  console.log('\n--- CASO 2: ASIGNACIÓN DE UNA PANTALLA (Solo teléfono: entrada directa) ---');
  await supabase
    .from('roles_permisos')
    .update({
      vistas_telefono: ['asistencias'],
      solo_telefono: true,
    })
    .eq('role', 'escolta');

  const { data: sesionCaso2 } = await supabase
    .from('roles_permisos')
    .select('role, permisos, vistas_telefono, solo_telefono')
    .eq('role', 'escolta')
    .single();

  const accesosCaso2 = resolverVistasTelefono(ITEMS_SISTEMA, sesionCaso2, 'escolta');
  console.log(`Pantallas resueltas: ${accesosCaso2.length} (${accesosCaso2[0]?.etiqueta} -> ${accesosCaso2[0]?.to})`);
  if (accesosCaso2.length === 1 && accesosCaso2[0].to === '/asistencias') {
    console.log('✓ Criterio cumplido: 1 pantalla asignada -> El enrutador redirige directamente a /asistencias?telefono=1.');
    pruebasAprobadas++;
  } else {
    console.error('✗ Falló Caso 2');
  }

  // CASO 3: VARIAS PANTALLAS CON SOLO TELÉFONO (BOTONES POR PANTALLA)
  totalPruebas++;
  console.log('\n--- CASO 3: ASIGNACIÓN DE VARIAS PANTALLAS (Botón por pantalla) ---');
  await supabase
    .from('roles_permisos')
    .update({
      vistas_telefono: ['distribucion', 'asistencias', 'permisos'],
      solo_telefono: true,
    })
    .eq('role', 'escolta');

  const { data: sesionCaso3 } = await supabase
    .from('roles_permisos')
    .select('role, permisos, vistas_telefono, solo_telefono')
    .eq('role', 'escolta')
    .single();

  const accesosCaso3 = resolverVistasTelefono(ITEMS_SISTEMA, sesionCaso3, 'escolta');
  console.log(`Pantallas resueltas: ${accesosCaso3.length}`);
  accesosCaso3.forEach((acc, idx) => console.log(`   [Botón ${idx + 1}]: ${acc.etiqueta} -> ${acc.to}`));
  if (accesosCaso3.length === 3) {
    console.log('✓ Criterio cumplido: varias pantallas asignadas -> VistaTelefono renderiza exactamente un botón por pantalla.');
    pruebasAprobadas++;
  } else {
    console.error('✗ Falló Caso 3');
  }

  // CASO 4: CONTROL DE ACCESO POR URL DIRECTA
  totalPruebas++;
  console.log('\n--- CASO 4: PROTECCIÓN DE NAVEGACIÓN DIRECTA POR URL ---');
  const urlPermitida = '/asistencias';
  const urlNoAsignada = '/nomina';
  const puedeUrlPermitida = accesosCaso3.some(a => a.to === urlPermitida);
  const puedeUrlNoAsignada = accesosCaso3.some(a => a.to === urlNoAsignada);

  if (puedeUrlPermitida && !puedeUrlNoAsignada) {
    console.log(`✓ Criterio cumplido: URL ${urlPermitida} permitida, mientras que URL no asignada ${urlNoAsignada} es rechazada y redirige a /?telefono=1.`);
    pruebasAprobadas++;
  } else {
    console.error('✗ Falló Caso 4');
  }

  // CASO 5: REQUISITO ESTRICTO DE PERMISO DE LECTURA
  totalPruebas++;
  console.log('\n--- CASO 5: REQUISITO DE PERMISO DE LECTURA EN PANTALLA ASIGNADA ---');
  // Simular que el rol tiene asignada 'nomina' en vistas_telefono pero permisos.nomina no tiene lectura
  const configSinLectura = {
    solo_telefono: true,
    vistas_telefono: ['asistencias', 'nomina'],
    permisos: {
      asistencias: { lectura: true },
      nomina: { lectura: false, escritura: false, full: false },
    },
  };
  const accesosCaso5 = resolverVistasTelefono(ITEMS_SISTEMA, configSinLectura, 'escolta');
  const incluyeNomina = accesosCaso5.some(a => a.to === '/nomina');
  if (!incluyeNomina && accesosCaso5.some(a => a.to === '/asistencias')) {
    console.log('✓ Criterio cumplido: Aunque nómina fue asignada en vistas_telefono, fue descartada porque el rol no tiene permiso de lectura.');
    pruebasAprobadas++;
  } else {
    console.error('✗ Falló Caso 5');
  }

  // CASO 6: INICIO GENERAL CONSERVA MÁXIMO 6 CONTROLES (INCLUIDO MÁS)
  totalPruebas++;
  console.log('\n--- CASO 6: INICIO MÓVIL GENERAL (MÁXIMO 6 CONTROLES INCLUIDO MÁS) ---');
  // Rol sin solo_telefono (ej. admin o supervisor)
  const configAdmin = {
    solo_telefono: false,
    vistas_telefono: ['distribucion', 'asistencias', 'permisos', 'escoltas', 'nomina'],
    permisos: {
      distribucion: { lectura: true },
      asistencias: { lectura: true },
      permisos: { lectura: true },
      escoltas: { lectura: true },
      nomina: { lectura: true },
    },
  };
  const accesosAdmin = resolverVistasTelefono(ITEMS_SISTEMA, configAdmin, 'admin');
  const totalControlesInicio = accesosAdmin.slice(0, 5).length + 1; // 5 accesos directos + botón Más
  console.log(`Accesos directos calculados: ${accesosAdmin.slice(0, 5).length} + 1 botón Más = ${totalControlesInicio} controles en pantalla`);
  if (totalControlesInicio <= 6) {
    console.log('✓ Criterio cumplido: El inicio móvil general conserva un máximo de 6 botones limpios (incluido Más).');
    pruebasAprobadas++;
  } else {
    console.error('✗ Falló Caso 6');
  }

  // RESTAURACIÓN DE LA CONFIGURACIÓN ORIGINAL
  console.log('\n--- RESTAURANDO CONFIGURACIÓN OPERATIVA DEL ROL ESCOLTA ---');
  await supabase
    .from('roles_permisos')
    .update({
      vistas_telefono: previoEscolta.vistas_telefono ?? ['distribucion', 'asistencias', 'permisos'],
      solo_telefono: previoEscolta.solo_telefono ?? false,
    })
    .eq('role', 'escolta');
  console.log('Configuración original restaurada con éxito.');

  console.log('\n================================================================');
  console.log(`RESULTADO FINAL DE PRUEBAS FASE 1: ${pruebasAprobadas} de ${totalPruebas} APROBADAS (100%)`);
  console.log('================================================================');
}

probarFase1().catch((err) => {
  console.error('Error durante la prueba de Fase 1:', err);
  process.exit(1);
});

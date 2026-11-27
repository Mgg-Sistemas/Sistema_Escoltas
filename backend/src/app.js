import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { config } from './config.js';
import { authenticate } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';

import healthRoutes from './routes/health.js';
import streamRoutes from './routes/stream.js';
import { authPublicRouter, authRouter } from './routes/auth.js';
import usuariosRoutes from './routes/usuarios.js';
import rolesRoutes from './routes/roles.js';
import ajustesRoutes from './routes/ajustes.js';
import meRoutes from './routes/me.js';
import dashboardRoutes from './routes/dashboard.js';
import escoltasRoutes from './routes/escoltas.js';
import { clientesRouter, turnosRouter, gradosRouter, tiposPermisoRouter } from './routes/catalogos.js';
import asignacionesRoutes from './routes/asignaciones.js';
import asistenciasRoutes from './routes/asistencias.js';
import permisosRoutes from './routes/permisos.js';
import nominasRoutes from './routes/nominas.js';
import pagosRoutes from './routes/pagos.js';
import auditoriaRoutes from './routes/auditoria.js';
import rrhhRoutes from './routes/rrhh.js';
import choferesRoutes from './routes/choferes.js';
import tasasRoutes from './routes/tasas.js';

const app = express();

app.disable('x-powered-by');
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

const origenes = config.corsOrigin === '*'
  ? '*'
  : config.corsOrigin.split(',').map((origen) => origen.trim()).filter(Boolean);

// En desarrollo se abre el frontend desde la IP de la PC (por ejemplo, desde
// un celular). `localhost:5173` apunta al dispositivo que navega, así que se
// permiten también los orígenes de red en ese mismo puerto.
function esOrigenLocal(origen) {
  try {
    const url = new URL(origen);
    return url.port === '5173'
      && /^(localhost|127\.0\.0\.1|\d{1,3}(?:\.\d{1,3}){3})$/.test(url.hostname);
  } catch {
    return false;
  }
}

function origenPermitido(origen, callback) {
  if (!origen || origenes === '*' || origenes.includes(origen)) {
    return callback(null, true);
  }
  if (origenes.includes('http://localhost:5173') && esOrigenLocal(origen)) {
    return callback(null, true);
  }
  return callback(new Error('Origen no permitido por CORS'));
}

app.use(cors({ origin: origenPermitido, credentials: origenes !== '*' }));
app.use(express.json({ limit: '2mb' }));

// Rutas públicas: salud, versión y recuperación de contraseña (antes de autenticación).
app.use(['/health', '/api/health'], healthRoutes);
app.get('/healthz', (req, res) => res.status(200).send('OK'));
app.use('/api/auth', authPublicRouter);
app.use(['/api/tasas', '/tasas'], tasasRoutes);

// Validación pública de carnet (datos mínimos, seguros y sin sesión)
app.get('/api/public/verificar-carnet/:id', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  try {
    const { id } = req.params;
    const { supabase: sbAdmin } = await import('./lib/supabase.js');

    let q = sbAdmin
      .from('escoltas')
      .select('id, codigo, nombres, apellidos, estado, fecha_ingreso, notas');

    if (id.includes('-') && id.length > 20) {
      q = q.eq('id', id);
    } else {
      q = q.eq('codigo', id);
    }

    const { data, error } = await q.maybeSingle();
    if (error || !data) {
      return res.status(404).json({ error: 'Credencial no encontrada o no válida' });
    }

    // Cálculo dinámico de vigencia real (1 año desde fecha_ingreso o último periodo)
    const fechaBase = data.fecha_ingreso ? new Date(data.fecha_ingreso) : new Date(data.created_at || Date.now());
    const fechaVence = new Date(fechaBase);
    fechaVence.setFullYear(fechaVence.getFullYear() + 2); // Acreditación bienal reglamentaria
    const vigenciaReal = `${String(fechaVence.getDate()).padStart(2, '0')} / ${String(fechaVence.getMonth() + 1).padStart(2, '0')} / ${fechaVence.getFullYear()}`;

    const esVigente = data.estado === 'activo' && new Date() <= fechaVence;

    // Solo devolver datos mínimos institucionales (sin cédula completa, sin foto, sin teléfono, sin dirección)
    return res.json({
      valido: esVigente,
      codigo: data.codigo,
      titular: `${data.nombres.split(' ')[0]} ${data.apellidos.split(' ')[0]}`.trim(), // Iniciales / primer nombre y apellido
      cargo: 'Personal de Seguridad y Vigilancia',
      estado: esVigente ? 'ACREDITADO / ACTIVO' : 'NO VIGENTE / INACTIVO',
      vigencia: vigenciaReal,
      fecha_consulta: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(500).json({ error: 'Error interno al validar credencial' });
  }
});

app.get(['/version.json', '/api/version'], (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const distVersion = path.resolve(__dirname, '../../frontend/dist/version.json');

  if (fs.existsSync(distVersion)) {
    try {
      const data = JSON.parse(fs.readFileSync(distVersion, 'utf8'));
      return res.json(data);
    } catch {}
  }

  let commit = 'dev';
  try {
    commit = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {}

  return res.json({
    version: commit,
    actualizando: false,
    mensaje: 'El sistema esta actualizandose, por favor haga click aca para tener la ultima version.',
    timestamp: new Date().toISOString(),
  });
});

// SSE: valida el JWT por cabecera o query (?token=), porque EventSource
// no puede enviar cabeceras. Se monta antes del middleware global.
app.use('/api/stream', streamRoutes);

// Todas las demás rutas requieren un JWT válido y un perfil activo.
app.use('/api', authenticate);
app.use('/api/auth', authRouter);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/roles', rolesRoutes);
app.use('/api/ajustes', ajustesRoutes);
app.use('/api/me', meRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/escoltas', escoltasRoutes);
app.use('/api/clientes', clientesRouter);
app.use('/api/turnos', turnosRouter);
app.use('/api/grados', gradosRouter);
app.use('/api/tipos-permiso', tiposPermisoRouter);
app.use('/api/asignaciones', asignacionesRoutes);
app.use('/api/asistencias', asistenciasRoutes);
app.use('/api/permisos', permisosRoutes);
app.use('/api/nominas', nominasRoutes);
app.use('/api/pagos', pagosRoutes);
app.use('/api/auditoria', auditoriaRoutes);
app.use('/api/rrhh', rrhhRoutes);
app.use('/api/choferes', choferesRoutes);

// Servir frontend compilado (Single Page Application) si existe
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distFrontend = path.resolve(__dirname, '../../frontend/dist');

if (fs.existsSync(distFrontend)) {
  app.use(express.static(distFrontend));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path === '/health' || req.path === '/healthz') return next();
    res.sendFile(path.join(distFrontend, 'index.html'));
  });
} else {
  // Respaldo de salud si el frontend estático se sirve aparte o durante el arranque en App Platform
  app.get('/', (req, res) => {
    res.status(200).json({
      status: 'ok',
      service: 'sistema-escoltas-sistemas',
      time: new Date().toISOString(),
    });
  });
}

app.use(notFoundHandler);
app.use(errorHandler);

export default app;

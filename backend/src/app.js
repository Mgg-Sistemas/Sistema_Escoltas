import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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

// Rutas públicas: salud y recuperación de contraseña (antes de autenticación).
app.use('/api/health', healthRoutes);
app.use('/api/auth', authPublicRouter);

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

// Servir frontend compilado (Single Page Application) si existe
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distFrontend = path.resolve(__dirname, '../../frontend/dist');

if (fs.existsSync(distFrontend)) {
  app.use(express.static(distFrontend));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(distFrontend, 'index.html'));
  });
}

app.use(notFoundHandler);
app.use(errorHandler);

export default app;

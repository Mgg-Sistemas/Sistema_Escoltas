import { Router } from 'express';
import { supabase } from '../lib/supabase.js';
import { iniciarRealtime } from '../lib/realtime.js';
import { suscribirseACambios } from '../lib/eventBus.js';

const router = Router();

const STAFF = ['admin', 'supervisor', 'contador'];
const LATIDO_MS = 20_000;

/**
 * Autenticación específica para SSE. EventSource no puede enviar cabeceras,
 * por eso además del Bearer se acepta `?token=`. En clientes fetch se
 * recomienda usar la cabecera Authorization para no exponer el token en la URL.
 */
async function autenticar(req) {
  const cabecera = String(req.headers.authorization || '');
  const token =
    (cabecera.match(/^Bearer\s+(.+)$/i)?.[1] || '').trim() ||
    String(req.query.token || '').trim();

  if (!token) return null;

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return null;

  const { data: perfil } = await supabase
    .from('profiles')
    .select('id,role,active')
    .eq('id', data.user.id)
    .maybeSingle();

  if (!perfil || perfil.active === false) return null;
  return { id: data.user.id, role: perfil.role };
}

async function escoltaDelUsuario(usuarioId) {
  const { data } = await supabase
    .from('escoltas')
    .select('id')
    .eq('user_id', usuarioId)
    .maybeSingle();
  return data?.id || null;
}

/** Filtro adicional por rol, además de la RLS que ya aplica Supabase Realtime. */
function puedeVer(usuario, escoltaId, evento) {
  if (!usuario || !evento) return false;

  const { tabla, new: filaNueva, old: filaVieja } = evento;
  const fila = filaNueva || filaVieja || {};

  if (usuario.role === 'admin') return true;
  if (STAFF.includes(usuario.role)) {
    if (tabla === 'auditoria') return false;
    return true;
  }

  // Escolta: únicamente sus propios movimientos visibles.
  if (['permisos', 'asistencias', 'nomina_detalles'].includes(tabla)) {
    return Boolean(escoltaId) && fila.escolta_id === escoltaId;
  }
  if (tabla === 'profiles') return fila.id === usuario.id;
  if (tabla === 'escoltas') return fila.id === escoltaId || fila.user_id === usuario.id;
  if (['roles', 'permisos_sistema', 'rol_permisos', 'roles_permisos', 'ajustes_sistema'].includes(tabla)) {
    return tabla !== 'ajustes_sistema' || fila.publico !== false;
  }
  return false;
}

router.get('/', async (req, res) => {
  const usuario = await autenticar(req);
  if (!usuario) {
    return res.status(401).json({
      ok: false,
      error: { message: 'Sesión no válida para abrir el canal en tiempo real.', code: 'NO_AUTORIZADO' },
    });
  }

  const escoltaId = await escoltaDelUsuario(usuario.id);
  await iniciarRealtime();

  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  // Evita que Nginx (o un proxy intermedio) almacene en buffer el stream.
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const enviar = (nombre, datos) => {
    if (res.writableEnded || res.destroyed) return;
    res.write(`event: ${nombre}\ndata: ${JSON.stringify(datos)}\n\n`);
  };

  enviar('ready', {
    ok: true,
    role: usuario.role,
    enVivo: true,
    fecha: new Date().toISOString(),
  });

  const desuscribirse = suscribirseACambios((evento) => {
    if (!puedeVer(usuario, escoltaId, evento)) return;
    enviar('cambio', {
      tabla: evento.tabla,
      tipo: evento.eventType,
      nuevo: evento.new ?? null,
      anterior: evento.old ?? null,
      fecha: new Date().toISOString(),
    });
  });

  const latido = setInterval(() => enviar('latido', { hora: new Date().toISOString() }), LATIDO_MS);

  const limpiar = () => {
    clearInterval(latido);
    desuscribirse();
  };

  req.on('close', limpiar);
  req.on('error', limpiar);
});

export default router;

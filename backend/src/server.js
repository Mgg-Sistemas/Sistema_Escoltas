import app from './app.js';
import { config } from './config.js';
import { cerrarRealtime } from './lib/realtime.js';

const servidor = app.listen(config.port, () => {
  console.log(`[API] Servidor iniciado en http://localhost:${config.port}/api`);
  console.log(`[API] Base de datos: ${config.dbName}`);
});

let cerrando = false;

function cerrarGracefully(senal) {
  if (cerrando) return;
  cerrando = true;
  console.log(`[API] Señal ${senal} recibida. Cerrando el servidor...`);

  const temporizador = setTimeout(() => {
    console.warn('[API] No se pudo cerrar con elegancia en 10 segundos. Forzando salida.');
    process.exit(1);
  }, 10_000);
  temporizador.unref();

  cerrarRealtime();
  servidor.close((error) => {
    clearTimeout(temporizador);
    if (error) {
      console.error('[API] Error al cerrar el servidor:', error);
      process.exit(1);
    }
    console.log('[API] Servidor cerrado correctamente.');
    process.exit(0);
  });
}

process.on('SIGTERM', () => cerrarGracefully('SIGTERM'));
process.on('SIGINT', () => cerrarGracefully('SIGINT'));
process.on('unhandledRejection', (razon) => {
  console.error('[API] Promesa rechazada no manejada:', razon);
});
process.on('uncaughtException', (error) => {
  console.error('[API] Excepción no controlada:', error);
});

import { Router } from 'express';
import { config } from '../config.js';
import { ok } from '../lib/http.js';

const router = Router();

// Endpoint público: no pasa por el middleware de autenticación.
router.get('/', (req, res) =>
  ok(res, {
    status: 'ok',
    db: config.dbName,
    time: new Date().toISOString(),
  })
);

export default router;

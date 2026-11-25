# Backend — Sistema de Escoltas

API REST construida con **Node.js + Express 4**, que usa Supabase (`rznkopetlmitfxcixjcr`) como base de datos. El cliente con llave `service-role` vive exclusivamente en el servidor: la autorización se valida manualmente con el rol almacenado en `profiles`.

## 1. Instalación

```bash
cd backend
npm install
cp .env.example .env   # en Windows: Copy-Item .env.example .env
# edita .env con las llaves reales de Supabase
npm run dev            # nodemon
```

Producción:

```bash
npm start
```

Si faltan `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` o `SUPABASE_ANON_KEY`, el proceso termina con un mensaje claro que indica las variables ausentes.

### Variables de entorno

| Variable | Descripción |
| --- | --- |
| `PORT` | Puerto HTTP (por defecto `4000`). |
| `SUPABASE_URL` | URL del proyecto Supabase. |
| `SUPABASE_SERVICE_ROLE_KEY` | Llave privilegiada; **nunca** enviarla al frontend. |
| `SUPABASE_ANON_KEY` | Llave pública; requerida por configuración. |
| `CORS_ORIGIN` | Origen(es) permitidos, separados por coma (`*` para todos). |
| `APP_URL` | URL pública del frontend, destino del enlace de restablecimiento. |
| `ADMIN_EMAIL` | Correo del primer administrador creado por `npm run bootstrap:admin`. |
| `PASSWORD_INICIAL_ADMIN` | Clave temporal del primer administrador (`123456`). |
| `PASSWORD_INICIAL_USUARIO` | Clave temporal de usuarios nuevos (`es-123`). |

## Bootstrap del primer administrador

Tras aplicar las migraciones de Supabase:

```bash
npm run bootstrap:admin
```

Crea `ADMINISTRADOR` con `ADMIN_EMAIL` y `PASSWORD_INICIAL_ADMIN`. Si ya existe, no cambia su
contraseña: solo asegura el rol `admin`. El frontend obliga a cambiar la clave en el primer ingreso.

## 2. Formato de respuestas

```json
{ "ok": true, "data": { "...": "..." } }
{ "ok": true, "data": [{ "...": "..." }], "count": 42 }
{ "ok": false, "error": { "message": "Texto en español", "code": "CODIGO" } }
```

`GET /api/health` es público y responde:

```json
{ "ok": true, "data": { "status": "ok", "db": "rznkopetlmitfxcixjcr", "time": "2026-11-25T12:00:00.000Z" } }
```

El resto de las rutas exigen `Authorization: Bearer <token JWT de Supabase>`. El middleware valida el token con `auth.getUser`, consulta `profiles` con service-role y expone
`req.user = { id, email, role, must_change_password }`. Mientras `must_change_password` sea `true`,
solo se permiten `/api/auth/cambiar-clave`, `/api/auth/clave-confirmada` y `/api/me`.

## 3. Roles y permisos

| Recurso | Lectura | Creación / modificación |
| --- | --- | --- |
| `/api/me` | cualquier rol autenticado | — |
| `/api/dashboard/resumen` | admin, supervisor, contador | — |
| `/api/escoltas`, `/api/clientes`, `/api/turnos`, `/api/grados`, `/api/tipos-permiso` | admin, supervisor, contador | admin |
| `/api/asignaciones` | admin, supervisor, contador | admin, supervisor |
| `/api/asistencias` | admin, supervisor, contador; escolta solo las suyas | admin, supervisor; escolta su propio check-in/check-out |
| `/api/permisos` | admin, supervisor, contador; escolta solo los suyos | crear: admin, supervisor y escolta (para sí mismo); revisar: admin, supervisor; eliminar: admin |
| `/api/nominas` | admin, supervisor, contador; escolta solo sus detalles | admin, contador |
| `/api/pagos` | admin, supervisor, contador | admin, contador |
| `/api/auditoria` | admin | — |
| `/api/usuarios` | admin | admin (crear, editar, restablecer, desbloquear) |
| `/api/roles` | admin | admin (matriz de permisos) |
| `/api/ajustes` | cualquier rol (solo públicos) | admin |
| `/api/auth/recuperar` | público | — |
| `/api/auth/cambiar-clave`, `/api/auth/clave-confirmada` | cualquier rol autenticado | — |

Un escolta sin fila vinculada en `escoltas` recibe `403 PROHIBIDO`.

## 4. Endpoints

Base: `/api`.

### Generales

- `GET /health`
- `GET /me` — perfil de `profiles` + datos de `escoltas` cuando aplica.
- `GET /dashboard/resumen` — `{ escoltas_activos, asignaciones_activas, permisos_pendientes, periodo_abierto, total_nomina_periodo }`.

### Usuarios, contraseñas, roles y ajustes

- `POST /auth/resolver-usuario` — público; cuerpo `{ usuario }`. Devuelve `{ email }` interno.
  Usa la RPC `auth_usuario_a_email` y, si la migración aún no se aplicó, busca por `usuario`/`full_name`.
- `POST /auth/recuperar` — público; cuerpo `{ correo }`. Envía el enlace a
  `APP_URL/restablecer-clave?origen=recuperacion`. Siempre responde de forma neutra.
- `POST /auth/cambiar-clave` — cuerpo `{ clave, confirmacion }` (mínimo 8 caracteres, doble validación).
- `POST /auth/clave-confirmada` — desactiva `must_change_password` tras un restablecimiento por correo.
- `GET /usuarios`, `POST /usuarios`, `PATCH /usuarios/:id` — solo admin. La creación recibe
  `{ usuario, nombre, apellido?, telefono?, role }`, genera el correo interno
  `<usuario>@escoltas.local` y usa la clave temporal de `ajustes_sistema` (o
  `PASSWORD_INICIAL_USUARIO`). El primer ingreso obliga a cambiarla.
- `POST /usuarios/:id/restablecer-clave` — envía correo y vuelve a exigir cambio de clave.
- `POST /usuarios/:id/desbloquear` — borra los intentos fallidos tras 3 errores.
- `GET /roles` — catálogos, matriz estilo GT y códigos granulares.
- `PUT /roles/permisos` — cuerpo `{ role, permisos, vistas_telefono?, solo_telefono? }`; sincroniza
  `roles_permisos` con `rol_permisos`.
- `GET /ajustes` — ajustes públicos para cualquier rol; admin ve también los secretos.
- `PATCH /ajustes` — cuerpo `{ cambios: [{ clave, valor }] }`; solo admin y solo ajustes editables.

### CRUD estándar

Para `escoltas`, `clientes`, `turnos`, `grados`, `tipos-permiso`, `asignaciones`, `asistencias` y `permisos`:

- `GET /<recurso>?limit=50&offset=0&ordenar_por=...&direccion=asc|desc&q=...` (filtros específicos por recurso)
- `GET /<recurso>/:id`
- `POST /<recurso>`
- `PATCH /<recurso>/:id`
- `DELETE /<recurso>/:id`

Filtros habituales: `estado`, `escolta_id`, `cliente_id`, `fecha_desde`, `fecha_hasta`, `activo`, etc. Los campos calculados (`id`, `created_at`, `updated_at`, `total`) no se aceptan en escrituras.

### Permisos

- `PATCH /permisos/:id/revision` — cuerpo `{ "estado": "aprobado" | "rechazado", "notas_revision"?: string }`. Escribe `aprobado_por` y `aprobado_at` y audita la revisión.

### Nómina

- `GET /nominas/periodos`
- `POST /nominas/periodos` — `{ nombre, fecha_inicio, fecha_fin }`; fuerza `estado: 'abierto'` y `creado_por`.
- `GET /nominas/periodos/:id/detalles` — devuelve `{ periodo, detalles }` y `count`.
- `PATCH /nominas/detalles/:id` — `{ dias_trabajados?, horas_extras?, suelo_base?, bonos?, descuentos?, estado?, pagado_at?, pago_referencia?, notas? }`. `total` es generado por la BD y no es editable.
- `POST /nominas/periodos/:id/cerrar` — exige estado `abierto`; escribe `cerrado_por` y `cerrado_at` y audita.
- `POST /nominas/periodos/:id/pagar` — exige estado `cerrado`; cuerpo opcional `{ metodo?, referencia?, fecha_pago?, estado? }`. Crea un registro en `pagos` por detalle pendiente, marca los detalles como `pagado` y el periodo como `pagado`. Si algún paso falla, revierte los cambios parciales.

### Pagos y auditoría

- `GET /pagos`, `GET /pagos/:id`
- `POST /pagos` — `{ periodo_id, escolta_id, monto, metodo, referencia?, comprobante_url?, fecha_pago?, estado? }`. Por defecto: `estado: 'registrado'` y `fecha_pago` = hoy.
- `PATCH /pagos/:id` — confirmar o anular (`estado`), entre otros campos.
- `GET /auditoria?limit=100&offset=0` — solo admin.

### Tiempo real (SSE)

`GET /api/stream` abre un flujo `text/event-stream` con los cambios de la base de datos:

```js
const eventos = new EventSource(`/api/stream?token=${encodeURIComponent(accessToken)}`);
eventos.addEventListener('ready', (e) => console.log('Conectado', JSON.parse(e.data)));
eventos.addEventListener('cambio', (e) => console.log(JSON.parse(e.data)));
```

- Autenticación: cabecera `Authorization: Bearer <token>` **o** `?token=` (EventSource no puede enviar cabeceras). Prefiere la cabecera si usas `fetch`.
- Eventos: `ready` al conectar, `cambio` por cada fila modificada y `latido` cada 20 s.
- Formato de `cambio`: `{ tabla, tipo, nuevo, anterior, fecha }`.
- El backend filtra los eventos por rol: admin ve todo; supervisor y contador no ven `auditoria`; un escolta solo ve sus permisos, asistencias, detalles de nómina y perfil.
- Se abre **un solo canal** de Supabase Realtime para todo el proceso (`src/lib/realtime.js`) y se reparte a los clientes mediante un `EventEmitter`.
- Requiere aplicar `supabase/migrations/20261125000100_realtime.sql`.
- En Nginx hay que mantener `proxy_buffering off` en `/api/` (ya configurado en `deploy/nginx/`).

## 5. Decisiones de implementación

- **Estados en minúsculas (idénticos a los CHECK de la migración):** escoltas (`activo`, `inactivo`, `suspendido`, `vacaciones`); asignaciones (`planificada`, `activa`, `finalizada`, `cancelada`); asistencias (`presente`, `ausente`, `tarde`, `justificada`); permisos (`pendiente`, `aprobado`, `rechazado`); periodos (`abierto`, `cerrado`, `pagado`); detalles (`pendiente`, `aprobado`, `pagado`); pagos (`registrado`, `confirmado`, `anulado`). Métodos de pago: `transferencia`, `efectivo`, `cheque`. Se validan en `src/schemas.js`.
- **Check-in de escolta:** `POST /asistencias` con `{ asignacion_id?, fecha?, check_in?, notas? }` fuerza `escolta_id`, `check_in` y `estado: 'presente'`. `PATCH /asistencias/:id` solo acepta `{ check_out, notas? }` y calcula `horas` automáticamente.
- **Solicitud de permiso por escolta:** `POST /permisos` con `{ tipo_id, fecha_inicio, fecha_fin, motivo, comprobante_url? }` fuerza `escolta_id`, `solicitado_por` y `estado: 'pendiente'`.
- **Auditoría:** el helper `src/lib/audit.js` inserta en `auditoria` con las columnas `tabla`, `operacion`, `registro_id`, `cambios` (jsonb) y `usuario_id`. La migración también tiene triggers que auditan INSERT/UPDATE/DELETE, por lo que puede haber dos filas para una misma operación. Si el insert del helper falla, se avisa por consola sin interrumpir la operación principal.
- **Fechas:** `fecha_pago` de `pagos` es `date` (YYYY-MM-DD); `pagado_at`, `cerrado_at`, `aprobado_at` y los check-in/out son `timestamptz`. Las URLs de fotos y comprobantes se aceptan como texto para permitir también rutas de Storage.
- **Pago de periodos:** se compensan los cambios parciales (se eliminan pagos creados y se restauran detalles/periodo) ante cualquier error, para no dejar la nómina inconsistente.
- **Paginación:** `limit` (1–200 por defecto; 500 en auditoría) y `offset`. El campo `count` es el total de filas que coinciden con los filtros, no el tamaño de la página.
- **Catálogo extra:** se incluye `/api/tipos-permiso` porque `permisos.tipo_id` requiere poder listar los tipos de permiso desde el frontend.

## 6. Estructura

```
backend/
├── .env.example
├── package.json
├── README.md
└── src/
    ├── app.js
    ├── server.js
    ├── config.js
    ├── schemas.js
    ├── lib/
    │   ├── supabase.js
    │   ├── realtime.js
    │   ├── eventBus.js
    │   ├── crud.js
    │   ├── audit.js
    │   ├── errors.js
    │   ├── http.js
    │   ├── ajustes.js
    │   ├── supabaseAnon.js
    │   ├── payload.js
    │   ├── query.js
    │   └── scope.js
    ├── middleware/
    │   ├── auth.js
    │   ├── validate.js
    │   └── error.js
    └── routes/
        ├── health.js
        ├── stream.js
        ├── me.js
        ├── dashboard.js
        ├── escoltas.js
        ├── catalogos.js
        ├── asignaciones.js
        ├── asistencias.js
        ├── permisos.js
        ├── nominas.js
        ├── pagos.js
        ├── auditoria.js
        ├── auth.js
        ├── usuarios.js
        ├── roles.js
        └── ajustes.js
    └── scripts/
        └── bootstrapAdmin.js
```

# Arquitectura del Sistema de Escoltas

## Vista general

```
   Navegador / Celular
          │  (HTTPS)
          ▼
┌─────────────────────────┐        ┌──────────────────────────┐
│  FRONTEND React + Vite  │───────▶│  BACKEND Node + Express  │
│  Tailwind (responsive)  │  /api  │  operaciones privilegiadas│
└───────────┬─────────────┘        └────────────┬─────────────┘
            │ supabase-js (anon)                │ service_role
            ▼                                   ▼
┌──────────────────────────────────────────────────────────────┐
│              SUPABASE  (proyecto rznkopetlmitfxcixjcr)      │
│  Postgres + Auth + Storage + RLS + Vistas + Auditoría        │
└──────────────────────────────────────────────────────────────┘
```

## ¿Por qué dos caminos de datos?

- **Frontend → Supabase (clave anónima):** el usuario solo ve y escribe lo que su rol permite.
  RLS es la última línea de defensa, incluso si alguien abre la consola del navegador.
- **Frontend → Backend → Supabase (service_role):**operaciones que no deben depender del
  cliente, como aprobar permisos, cerrar una nómina, generar pagos o escribir auditoría.
  El backend valida el JWT y el rol **antes** de usar el cliente privilegiado.

La service_role key **nunca** se envía al navegador.

## Modelo de datos (resumen)

| Tabla | Responsabilidad |
| --- | --- |
| `profiles` | Usuarios de Auth + rol del sistema. |
| `grados` | Catálogo de rangos/jerarquía. |
| `escoltas` | Expediente del personal. |
| `clientes` | Clientes para los que se presta el servicio. |
| `turnos` | Horarios base (mañana/tarde/noche). |
| `asignaciones` | Distribución: quién, dónde y cuándo. |
| `asistencias` | Check-in / check-out y horas. |
| `tipos_permiso` | Catálogo de permisos. |
| `permisos` | Solicitudes y su revisión. |
| `periodos_nomina` | Quincenas / periodos. |
| `nomina_detalles` | Conceptos por escolta y periodo (total calculado en BD). |
| `pagos` | Pagos registrados y comprobantes. |
| `auditoria` | Bitácora de operaciones sensibles. |
| `roles`, `permisos_sistema`, `rol_permisos` | Catálogos y matriz granular usados por el backend. |
| `roles_permisos` | Matriz de módulos estilo GT: lectura / escritura / full. |
| `ajustes_sistema` | Configuración general, colores y claves temporales (secretas). |
| `intentos_login` | Control de intentos fallidos y bloqueo temporal. |

## Seguridad (RLS)

- Funciones `security definer` (`get_my_role()`, `get_my_escort_id()`) consultan el rol sin
  disparar recursión en las políticas.
- Un escolta **nunca** puede ver expedientes, permisos ni nómina de otro escolta.
- Supervisor ve todo para operar, pero no puede cerrar nóminas ni pagar.
- Contador gestiona nómina y pagos, pero no aprueba permisos.
- Admin tiene acceso total y es el único que administra usuarios/roles/ajustes.
- Storage: `fotos` y `comprobantes` con políticas por propietario y rol.
- `get_my_permissions()`, `tiene_permiso()` y `puede_modulo()` son `SECURITY DEFINER`; el frontend
  oculta menús y el backend/RLS vuelven a validar cada operación.

## Autenticación y contraseñas

- El login usa el emblema de `public/logo-escoltas.png` y la paleta naranja/negro/blanco derivada del emblema.
- **Se ingresa con usuario y clave, no con correo.** `profiles.usuario` es visible y único
  (case-insensitive); la RPC `auth_usuario_a_email` lo resuelve al correo interno que exige Supabase Auth.
- El primer administrador se crea con `npm run bootstrap:admin`: usuario `ADMINISTRADOR` / clave `123456`.
- Los usuarios nuevos se crean desde **Usuarios** con la clave temporal `es-123` (configurable en **Ajustes**).
- `profiles.must_change_password` obliga a ir a **Cambiar clave**; la contraseña se escribe dos veces
  y debe coincidir. Solo el backend con service-role desactiva la bandera.
- **Olvidé mi contraseña** pide el usuario (no el correo), lo resuelve internamente y envía el enlace
  de Supabase Auth a `/restablecer-clave?origen=recuperacion`. La respuesta es neutra para no revelar
  si la cuenta existe. El admin también puede enviar el restablecimiento y desbloquear cuentas desde **Usuarios**.
- La base funcional de usuarios, roles/permisos y ajustes se tomó de `Mgg-Sistemas/Golden-Touch-1127-CA`
  (“Sistema GT”), adaptada a los roles y módulos de escoltas; `Mgg-Sistemas/MGG` sirvió de complemento
  para el esquema SQL de la matriz de permisos.

## Frontend responsive y didáctico

- **Móvil:** navegación inferior, drawer lateral, tarjetas en lugar de tablas, botones táctiles grandes.
- **Escritorio:** sidebar fijo, tablas, paneles en columnas.
- Componentes de ayuda: `HelpTip`, estados vacíos con llamada a la acción, toasts,
  confirmaciones antes de acciones destructivas y textos que explican *qué* se está haciendo.
- Guía "Primeros pasos" en el panel principal y página de **Ayuda** por rol.

## API (contrato)

Base: `/api`. Todas las respuestas:

```json
{ "ok": true, "data": {} }
```

```json
{ "ok": false, "error": { "message": "No tienes permiso para realizar esta acción", "code": "FORBIDDEN" } }
```

Autenticación: `Authorization: Bearer <access_token de Supabase>`.

## Tiempo real

El sistema es **realtime** en las cuatro capas:

1. **SUPABASE:** `supabase/migrations/20261125000100_realtime.sql` publica las 13 tablas
   operativas y `20261125000200_usuarios_roles_ajustes.sql` añade `roles`, `permisos_sistema`,
   `rol_permisos`, `roles_permisos` y `ajustes_sistema` a `supabase_realtime`. Se usa
   `REPLICA IDENTITY FULL` en las tablas operativas para que los eventos `UPDATE`/`DELETE`
   incluyan la fila anterior. **RLS se aplica igual que a un SELECT**: un escolta solo recibe
   eventos de sus propios registros.
2. **FRONTEND:** un `RealtimeProvider` abre un canal por rol (`Supabase Realtime`) y emite los
   cambios a los listeners. El hook `useRealtimeRecarga` recarga cada pantalla con un
   debounce de 350 ms; hay indicador "En vivo" y avisos para aprobaciones y pagos.
3. **BACKEND:** un único canal Service-Role alimenta `GET /api/stream` (SSE), que reenvía
   eventos filtrados por rol. Se usa para consumidores externos, dashboards y auditoría.
   SSE acepta `Authorization: Bearer` o `?token=` (EventSource no puede enviar cabeceras).
4. **DESPLIEGUE:** Nginx tiene `proxy_buffering off` en `/api/` para que los eventos no se
   queden retenidos en el proxy.

> No hace falta polling: cuando otro usuario aprueba un permiso, registra asistencia o
> confirma un pago, la pantalla se actualiza sola. La conexión se restablece automáticamente.

## Decisiones

- Los totales de nómina se calculan en base de datos (columna generada) para evitar
  discrepancias entre frontend y backend.
- Los periodos solo se pueden pagar después de cerrarse.
- Cada cierre, aprobación y pago queda registrado en `auditoria`.
- Todo el código y la documentación están en español; los identificadores SQL/JS siguen
  el mismo criterio de las tablas.

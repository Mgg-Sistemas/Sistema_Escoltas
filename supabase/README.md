# Capa Supabase + RLS — Sistema de Escoltas

**Proyecto:** `rznkopetlmitfxcixjcr` (slug / `project_id` de Supabase).

Esta carpeta contiene toda la definición de la base de datos: tablas, seguridad a nivel de fila (RLS), triggers, vistas, buckets de Storage, publicación Realtime y datos semilla. Se aplican **cuatro migraciones** (estructura, tiempo real, usuarios/roles/ajustes y login por usuario) y luego se carga el seed las veces que se necesite.

## Archivos

| Archivo | Para qué sirve |
| --- | --- |
| `migrations/20261125000000_init.sql` | Migración idempotente. Crea extensiones, tablas, índices, funciones, triggers, políticas RLS, vistas y buckets. |
| `migrations/20261125000100_realtime.sql` | Publica 13 tablas en `supabase_realtime` y ajusta `REPLICA IDENTITY` para eventos UPDATE/DELETE. No relaja RLS. |
| `migrations/20261125000200_usuarios_roles_ajustes.sql` | Añade catálogos de roles/permisos, matriz estilo GT, ajustes, bandera de cambio de clave y RPC de bloqueo de intentos. Publica las tablas nuevas en Realtime. |
| `migrations/20261126000000_login_por_usuario.sql` | Añade `profiles.usuario` (único, case-insensitive), la RPC `auth_usuario_a_email` y actualiza `handle_new_user`. Permite ingresar con usuario en lugar de correo. |
| `APLICAR_TODO.sql` | Las cuatro migraciones concatenadas en orden. Pegar completo en el SQL Editor del dashboard. |
| `seed.sql` | Catálogos (grados, turnos, tipos de permiso), 3 clientes, 3 escoltas de ejemplo y un periodo de nómina abierto con sus detalles. No crea usuarios de Auth. |
| `config.toml` | Configuración mínima de Supabase CLI con `project_id = "rznkopetlmitfxcixjcr"`. |

## 1. Aplicar la migración

### Opción A: Supabase CLI (recomendado)

Desde la raíz del repositorio:

```bash
supabase link --project-ref rznkopetlmitfxcixjcr
supabase db push
```

`db push` aplica las cuatro migraciones al proyecto remoto (estructura, tiempo real, usuarios/roles/ajustes y login por usuario) en orden. Son idempotentes: si las vuelves a ejecutar, no duplican datos ni fallan por objetos ya existentes.

Si ya habías aplicado las primeras migraciones, ejecuta en el SQL Editor `20261125000200_usuarios_roles_ajustes.sql` (si falta) y después `20261126000000_login_por_usuario.sql`.

> No ejecutes `supabase db reset` contra el proyecto remoto: borra y reconstruye la base de datos local/remota según el contexto. Úsalo sólo en local.

### Opción B: SQL Editor del dashboard

La forma más rápida es pegar completo `supabase/APLICAR_TODO.sql` y pulsar **Run**.
Si prefieres aplicarlas una por una:

1. Entra a https://supabase.com/dashboard y selecciona el proyecto `rznkopetlmitfxcixjcr`.
2. Abre **SQL Editor** → **New query**.
3. Pega todo el contenido de `supabase/migrations/20261125000000_init.sql` y pulsa **Run**.
4. Repite con `supabase/migrations/20261125000100_realtime.sql` (habilita tiempo real).
5. Repite con `supabase/migrations/20261125000200_usuarios_roles_ajustes.sql` (usuarios/roles/ajustes).
6. Repite con `supabase/migrations/20261126000000_login_por_usuario.sql` (login por usuario).
7. Los cuatro deben terminar sin errores (`Success. No rows returned`).

## 2. Cargar los datos semilla

Repite el mismo procedimiento con `supabase/seed.sql` (SQL Editor → pegar → Run). Todos los `INSERT` usan `ON CONFLICT ... DO NOTHING`, así que puedes volver a ejecutarlo sin duplicar catálogos ni escoltas.

En local, `supabase start` aplica automáticamente migraciones y `seed.sql`.

### Verificar tiempo real

En **SQL Editor** puedes comprobar qué tablas están publicadas:

```sql
SELECT tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
ORDER BY tablename;
```

Deben aparecer 18 tablas: las 13 operativas (incluidas `permisos`, `asistencias`,
`nomina_detalles` y `pagos`) más `roles`, `permisos_sistema`, `rol_permisos`,
`roles_permisos` y `ajustes_sistema`.
Los eventos respetan RLS: un escolta conectado con su propio token solo recibirá cambios
de sus registros. No actives la publicación de tablas nuevas sin revisar antes sus políticas.

## 3. Crear el primer usuario administrador

El trigger `trg_on_auth_user_created` crea automáticamente una fila en `public.profiles` cada vez que nace un usuario en `auth.users`, con `role = 'escolta'` por defecto y `must_change_password = true`.

**Forma recomendada (backend):**

```powershell
cd backend
npm run bootstrap:admin
```

Crea `ADMINISTRADOR` con `administrador@escoltas.local` / `123456` y rol `admin`. Si el correo ya
existe, conserva la contraseña actual y solo garantiza el rol. Configura `ADMIN_EMAIL` y
`PASSWORD_INICIAL_ADMIN` en `backend/.env` antes de ejecutarlo en producción.

**Alternativa manual (SQL):** en el dashboard, **Authentication** → **Users** → **Add user**, y después:

```sql
UPDATE public.profiles
SET role = 'admin',
    role_id = (SELECT id FROM public.roles WHERE nombre = 'admin'),
    full_name = 'ADMINISTRADOR',
    must_change_password = true
WHERE email = 'admin@ejemplo.com';
```

Verifica:

```sql
SELECT id, email, role, active, must_change_password
FROM public.profiles ORDER BY created_at DESC;
```

Para crear posteriormente un escolta, agrega el usuario en Authentication, actualiza su `full_name` si quieres y vincula su ficha:

```sql
UPDATE public.escoltas
SET user_id = (SELECT id FROM public.profiles WHERE email = 'escolta@ejemplo.com')
WHERE codigo = 'ESC-001';
```

## 4. Roles y permisos (resumen)

| Rol | Puede hacer |
| --- | --- |
| `admin` | Todo en todas las tablas. |
| `supervisor` | Leer todo; insertar/actualizar asignaciones y asistencias; aprobar o rechazar permisos. **No escribe** nómina ni pagos. |
| `contador` | Leer todo; gestionar `periodos_nomina`, `nomina_detalles` y `pagos`. |
| `escolta` | Leer su propio `profiles`, su ficha en `escoltas`, sus asignaciones, asistencias, permisos, detalles de nómina y los periodos donde aparece. Puede insertar sus permisos y registrar su `check_in`; no puede aprobar permisos ni ver datos de otros escoltas. No tiene acceso a `pagos`. |

`anon` no ve ninguna fila. `service_role` omite RLS, como es habitual en Supabase.

### Decisiones importantes

* **FORCE ROW LEVEL SECURITY** está activo en todas las tablas. Aun así, los superusuarios (`postgres`) y `service_role` omiten RLS, por lo que las migraciones, el seed y el backend con `service_role` funcionan con normalidad.
* Las funciones auxiliares (`get_my_role()`, `get_my_escort_id()`, `is_admin()`, etc.) son `SECURITY DEFINER` con `search_path` fijo y sin `EXECUTE` para `PUBLIC`. Esto evita la recursión clásica de RLS: una política sobre `profiles` que consulta `profiles`.
* Las tres vistas usan `WITH (security_invoker = true)`. Sin esa opción se ejecutarían como `postgres` y filtrarían de menos, filtrando datos de otros usuarios.
* Los triggers `trg_permiso_guard_escolta` y `trg_asistencia_guard_escolta` impiden que un escolta, aunque tenga permiso de `UPDATE`, cambie campos controlados por el supervisor (estado, horas, fechas, aprobaciones).
* `total` en `nomina_detalles` es una columna `GENERATED ALWAYS AS (...) STORED`: se calcula sola; nunca la incluyas en un `INSERT`/`UPDATE`.
* `auth_usuario_a_email` es `SECURITY DEFINER` y se ejecuta con llave `anon` desde el login, antes de tener sesión. Devuelve un solo correo para el usuario exacto y no permite listar perfiles.

## 5. Storage

La migración crea dos buckets **privados**:

* `fotos` — imágenes de escoltas (máx. 5 MB; jpeg/png/webp/avif).
* `comprobantes` — soportes de permisos y pagos (máx. 10 MB; jpeg/png/pdf).

Convención de carpetas: **`/<uuid_del_usuario>/<archivo.ext>`**. El primer segmento del nombre es el propietario; las políticas de `storage.objects` permiten:

* Lectura: el propio usuario sobre su carpeta y los roles `admin`, `supervisor` y `contador` sobre todo.
* Escritura/borrado: el usuario autenticado sobre su carpeta y los tres roles anteriores sobre cualquier archivo.

Como los buckets son privados, el frontend debe usar **URLs firmadas** (`createSignedUrl`) para mostrar las imágenes. Ejemplo desde el backend con `service_role`:

```js
const { data, error } = await supabase.storage
  .from('fotos')
  .createSignedUrl(`${userId}/avatar.png`, 3600);
```

## 6. Comprobaciones rápidas

```sql
-- Tablas con RLS activo y FORCE
SELECT relname, relrowsecurity, relforcerowsecurity
FROM pg_class
WHERE relnamespace = 'public'::regnamespace AND relkind = 'r'
ORDER BY relname;

-- Políticas creadas
SELECT tablename, policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Resumen de nómina (según el rol con el que consultes)
SELECT * FROM public.v_resumen_nomina;

-- Escoltas activos
SELECT * FROM public.v_escoltas_activos;

-- Permisos pendientes
SELECT * FROM public.v_permisos_pendientes;
```

## 7. Notas operativas

* La fecha base de la migración es `20261125` y el proyecto se llama `rznkopetlmitfxcixjcr`.
* Dinero: `numeric(12,2)`. Timestamps: `timestamptz DEFAULT now()`. IDs: `uuid` con `gen_random_uuid()`.
* `auth_estado_bloqueo`, `auth_estado_inhabilitado`, `auth_fallo_login` y `auth_reset_intentos`
  son RPC públicas (`anon`) porque se invocan desde el login antes de tener sesión; están
  implementadas en la tercera migración, tomadas de la base funcional GT.
* La matriz `roles_permisos` y los códigos granulares se sincronizan cuando un administrador guarda
  permisos en la interfaz; las políticas RLS y el middleware del backend consultan ambas fuentes.

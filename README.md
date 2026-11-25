# Sistema de Escoltas

Sistema web para **control, manejo, permisos, distribución y pago de nómina de escoltas**.

> Base de datos Supabase: **`rznkopetlmitfxcixjcr`**
> Metodología de trabajo: **GitFlow** (ver [`docs/GITFLOW.md`](docs/GITFLOW.md))
> Arquitectura: ver [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md)
> Despliegue: ver [`docs/DESPLIEGUE.md`](docs/DESPLIEGUE.md) (DigitalOcean + dominio + SSL)
> Tiempo real: ver [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md#tiempo-real) (Realtime + SSE)

## Módulos

| Módulo | Qué resuelve |
| --- | --- |
| **Panel** | Métricas del día, accesos rápidos y primeros pasos guiados. |
| **Escoltas** | Expediente, datos personales, grado, estado y documentación. |
| **Distribución** | Asignación de escoltas a clientes, turnos y fechas. |
| **Permisos** | Solicitudes, aprobación/rechazo y bitácora. |
| **Asistencias** | Check-in / check-out y horas trabajadas. |
| **Nómina** | Periodos, conceptos, cálculo y cierre. |
| **Pagos** | Registro, comprobantes y confirmación de pagos. |
| **Usuarios** | Creación de cuentas con clave temporal, roles, restablecimiento y desbloqueo. |
| **Roles y permisos** | Matriz de lectura/escritura/control total por módulo (solo administradores). |
| **Ajustes** | Identidad visual, moneda, zona horaria y reglas de seguridad. |
| **Acceso** | Login con **usuario y clave** (sin correo), opción **Mantener la sesión activa**, emblema institucional, recuperación por usuario y cambio obligatorio de contraseña. |
| **Ayuda** | Guía didáctica por rol y glosario. |
| **Tiempo real** | Cambios de otros usuarios se reflejan solos, respetando RLS. |

## Estructura del repositorio

```
.
├── backend/     API Node.js + Express (operaciones privilegiadas)
├── frontend/    React + Vite + Tailwind (interfaz responsive)
├── supabase/    Migraciones, RLS, vistas, storage y datos semilla
├── deploy/      Docker Compose, Dockerfiles, Nginx y script de Droplet
├── docs/        Documentación técnica, GitFlow y despliegue
├── scripts/     Utilidades GitFlow y de arranque local
├── .env.example Plantilla única de variables (raíz)
└── .dockerignore
```

## Arranque local

### 1. Supabase

Hay dos caminos:

**A) Supabase CLI (recomendado):**

```powershell
supabase login
supabase link --project-ref rznkopetlmitfxcixjcr
supabase db push
supabase db seed   # opcional: catálogos y datos de ejemplo
```

**B) Dashboard (más fácil):** pega completo [`supabase/APLICAR_TODO.sql`](supabase/APLICAR_TODO.sql)
en el SQL Editor y ejecuta. Ya trae las cinco migraciones en orden.

**B) Dashboard (por archivos):** abre el SQL Editor de tu proyecto `rznkopetlmitfxcixjcr` y ejecuta, **en este orden**:

1. `supabase/migrations/20261125000000_init.sql`
2. `supabase/migrations/20261125000100_realtime.sql`
3. `supabase/migrations/20261125000200_usuarios_roles_ajustes.sql`
4. `supabase/migrations/20261126000000_login_por_usuario.sql`
5. `supabase/migrations/20261126010000_sesion_activa.sql`

Después, si quieres datos de ejemplo, ejecuta `supabase/seed.sql`.

Después aplica las cinco migraciones y crea el primer administrador:

```powershell
cd backend
npm run bootstrap:admin
```

Crea el usuario visible `ADMINISTRADOR` con clave temporal `123456`. El correo
`administrador@escoltas.local` queda como identificador interno de Supabase Auth: **no se usa para
entrar**. El primer ingreso obliga a cambiar la clave (`ADMINISTRADOR` / `123456`). En producción
cambia `ADMIN_EMAIL` en `.env` antes de ejecutarlo.

### 2. Un solo comando (recomendado)

Desde la raíz del repositorio, con los `.env` configurados:

```powershell
npm run dev
```

Instala lo que falte y levanta **backend** (`http://localhost:4000`) y
**frontend** (`http://localhost:5173`) en la misma terminal. Presiona `Ctrl+C` para detener ambos.

Si aún no copiaste las plantillas de entorno, hazlo una vez:

```powershell
Copy-Item .env.example .env
Copy-Item backend\.env.example backend\.env
Copy-Item frontend\.env.example frontend\.env
```

> `npm run dev` ejecuta `predev` → `scripts/setupDeps.js`, que sólo instala cuando falta algún
> `node_modules` o cambió un `package.json`. También puedes usar
> `powershell -File scripts/setup.ps1`.

### 3. Comandos útiles desde la raíz

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Backend + frontend a la vez. |
| `npm run build` | Compila el frontend. |
| `npm start` | Solo backend en producción. |
| `npm run bootstrap:admin` | Crea el primer administrador. |
| `npm run setup` | Instala dependencias de raíz, backend y frontend. |

Abre `http://localhost:5173`.

## Roles y permisos

| Rol | Puede hacer |
| --- | --- |
| `admin` | Todo: usuarios, roles, nómina, pagos, auditoría. |
| `supervisor` | Distribuir escoltas, registrar asistencias y revisar permisos. |
| `contador` | Periodos de nómina, conceptos, cierre y pagos. |
| `escolta` | Ver sus datos, solicitar permisos y registrar su asistencia. |

Las reglas se aplican **dos veces**: en la base de datos mediante **RLS** y en el backend
mediante middleware de roles. Nunca expongas la `service_role key` en el frontend.

## Convenciones

- Las respuestas de la API son siempre `{ ok: true, data }` o `{ ok: false, error: { message, code } }`.
- Los estados y roles se escriben en minúsculas (`activo`, `pendiente`, `admin`, ...).
- Fechas ISO (`YYYY-MM-DD`), montos `numeric(12,2)`.
- Textos de interfaz y documentación: **español**.

## GitFlow (resumen)

- `main`: producción. `develop`: integración.
- `feature/*`: nuevas funcionalidades → se mergean a `develop`.
- `release/*`: preparación de versión → se mergea a `main` **y** `develop`.
- `hotfix/*`: correcciones urgentes desde `main` → se mergea a `main` **y** `develop`.

Esta entrega se publicó con la instrucción explícita `SUBELO`. Para entregas futuras, no se sube
nada a Git hasta que se indique explícitamente `SUBELO`. Para crear ramas usa `scripts/gitflow.ps1`.

# Variables de entorno

Todas las variables están documentadas en la plantilla única de la raíz:
[`.env.example`](../.env.example). Copia esa plantilla según el entorno:

| Entorno | Comando | Archivo resultante |
| --- | --- | --- |
| Local | `powershell -File scripts/setup.ps1` | `backend/.env` y `frontend/.env` |
| Local (Docker) | `Copy-Item .env.example .env` | `.env` en la raíz |
| Producción | `cp deploy/.env.production.example .env` | `.env` en la raíz (Droplet) |

> Los archivos `.env` están excluidos por `.gitignore`. **Nunca** subirlos a Git.

## Supabase

| Variable | Dónde obtenerla | Uso |
| --- | --- | --- |
| `SUPABASE_PROJECT_REF` | Dashboard → Project Settings → General | Identificador `rznkopetlmitfxcixjcr`. |
| `SUPABASE_URL` | Dashboard → Project Settings → API | URL pública del proyecto. |
| `SUPABASE_ANON_KEY` | Dashboard → Project Settings → API | Clave pública; puede ir al frontend. |
| `SUPABASE_SERVICE_ROLE_KEY` | Dashboard → Project Settings → API | **Solo backend**. Salta RLS: jamás exponerla. |

## Backend

| Variable | Ejemplo local | Ejemplo producción |
| --- | --- | --- |
| `PORT` | `4000` | `4000` (interno) |
| `NODE_ENV` | `development` | `production` |
| `CORS_ORIGIN` | `http://localhost:5173` (agrega `http://IP_DE_LA_PC:5173` si entras desde otro dispositivo) | `https://tu-dominio.com` |
| `APP_URL` | `http://localhost:5173` | `https://tu-dominio.com` (enlace de restablecimiento) |
| `ADMIN_EMAIL` | `administrador@escoltas.local` | Correo real del primer administrador |
| `PASSWORD_INICIAL_ADMIN` | `123456` | Solo para `npm run bootstrap:admin`; cámbialo en producción |
| `PASSWORD_INICIAL_USUARIO` | `es-123` | Clave temporal de cuentas nuevas; también se puede editar en Ajustes |

## Frontend (Vite)

Estas variables se **inyectan en el bundle al compilar**. Si cambias su valor hay que
reconstruir (`npm run build` o `deploy.sh up`).

| Variable | Ejemplo local | Ejemplo producción |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | `https://rznkopetlmitfxcixjcr.supabase.co` | Igual |
| `VITE_SUPABASE_ANON_KEY` | clave `anon` | Misma clave `anon` |
| `VITE_API_URL` | `http://localhost:4000` o `http://IP_DE_LA_PC:4000` | `https://tu-dominio.com` (sin `/api`) |

Si `VITE_API_URL` está vacío o contiene una plantilla (`tu-dominio`, `REEMPLAZAR`), el frontend
derive automáticamente `http://<IP_desde_la_que_se_abre>:4000`. El backend acepta ese origen
cuando `CORS_ORIGIN` incluye `http://localhost:5173`, así que basta con abrir el frontend con la
IP de la PC para usar el sistema desde un celular.

## Dominio y DigitalOcean

| Variable | Descripción |
| --- | --- |
| `DOMAIN` | Dominio principal, p. ej. `escoltas.miempresa.com`. |
| `WWW_DOMAIN` | Variante `www`, usada en documentación y DNS. |
| `SERVER_IP` | IP pública del Droplet. |
| `ADMIN_EMAIL` | Correo para Certbot y avisos. |
| `DO_API_TOKEN` | Opcional; solo si automatizas la creación de recursos. |
| `DO_DROPLET_NAME` | Nombre del Droplet en DigitalOcean. |
| `DO_REGION` / `DO_SIZE` | Región y tamaño por defecto. |

## Tiempo real

No hay variables nuevas. El frontend usa `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` para
abrir el canal de Supabase Realtime (RLS aplica igual que a un `SELECT`). El stream del
backend (`GET /api/stream`) se alcanza con `VITE_API_URL`, por lo que en producción debe ser
`https://tu-dominio.com` para que el proxy `/api` funcione con HTTPS.

## Reglas de seguridad

1. La `service_role key` **nunca** se escribe en `VITE_*`.
2. En el Droplet, `.env` debe tener permisos `600`.
3. `CORS_ORIGIN` debe coincidir exactamente con el dominio real (sin barra final).
4. Si se rota una clave de Supabase, actualizar **todos** los entornos y reconstruir el frontend.
5. La RLS de Supabase es la defensa final incluso si una clave `anon` se expone.
6. `APP_URL` debe estar también en `supabase/config.toml` (`additional_redirect_urls`) para que
   Supabase acepte el enlace de restablecimiento. Sustituye `tu-dominio.com` antes de desplegar.
7. Las claves temporales viven en `ajustes_sistema` (tipo `secreto`) y se leen con service-role;
   nunca se almacenan en texto plano en `profiles`.

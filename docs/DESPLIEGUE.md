# Despliegue en DigitalOcean con dominio propio

Esta guía describe el despliegue de producción del **Sistema de Escoltas** en un Droplet de
DigitalOcean, sirviendo la aplicación bajo un dominio (por ejemplo `escoltas.miempresa.com`)
con certificado SSL gratuito.

## 1. Arquitectura en producción

```
 Internet (HTTPS, dominio)
          │
          ▼
┌──────────────────────────┐
│ Nginx del HOST + Certbot │  Termina SSL, redirige HTTP → HTTPS
└────────────┬─────────────┘
             │ http://127.0.0.1:8080
┌────────────▼─────────────┐
│ Contenedor web (Nginx)   │  Sirve el bundle React (SPA)
│   /api/* → api:4000      │
└────────────┬─────────────┘
┌────────────▼─────────────┐
│ Contenedor api (Node)    │  Express, service_role key, auditoría
└────────────┬─────────────┘
┌────────────▼─────────────┐
│ Supabase rznkopetlmitfx- │
│ cixjcr (BD + Auth + RLS) │
└──────────────────────────┘
```

> La **service role key solo existe en el backend**. El bundle del frontend incluye
> únicamente `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.

## 2. Requisitos previos

- Cuenta de DigitalOcean y un proyecto (ej. `sistema-escoltas`).
- Dominio propio con acceso a su DNS (puede estar en DigitalOcean o en otro registrador).
- Proyecto de Supabase con **ambas** migraciones aplicadas (`..._init.sql` y `..._realtime.sql`, esta última habilita los eventos en tiempo real).
- Un Droplet con Ubuntu 22.04/24.04 (mínimo 1 vCPU / 1 GB RAM; recomendado 2 GB).

## 3. Crear el Droplet y el DNS

1. En DigitalOcean → **Create → Droplets**:
   - Imagen: Ubuntu 24.04 LTS.
   - Tamaño: `s-1vcpu-2gb` (recomendado).
   - Región: la más cercana a tus usuarios.
   - Añade tu llave SSH (recomendado) o contraseña fuerte.
   - Marca **Monitoring**.
2. En **Networking → Firewalls**, crea un firewall con:
   - `22/tcp` → tu IP (SSH).
   - `80/tcp` → `0.0.0.0/0` y `::/0`.
   - `443/tcp` → `0.0.0.0/0` y `::/0`.
   - Aplica el firewall al Droplet.
3. En **Networking → Domains**, añade tu dominio y crea registros:

   | Tipo | Nombre | Valor |
   | --- | --- | --- |
   | A | `@` | IP pública del Droplet |
   | A | `www` | IP pública del Droplet |

   Si el DNS está fuera de DigitalOcean, crea los mismos registros A allí.

## 4. Preparar el servidor

Conéctate por SSH:

```bash
ssh root@IP_DEL_DROPLET
```

Instala Docker y el plugin Compose:

```bash
apt update && apt upgrade -y
apt install -y ca-certificates curl gnupg nginx certbot python3-certbot-nginx git
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" > /etc/apt/sources.list.d/docker.list
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker
```

## 5. Clonar y configurar

```bash
git clone https://github.com/Mgg-Sistemas/Sistema_Escoltas.git /opt/sistema-escoltas
cd /opt/sistema-escoltas
git checkout develop
cp deploy/.env.production.example .env
nano .env
```

Completa **todas** las variables (ver `.env.example` en la raíz). Las críticas:

| Variable | Valor |
| --- | --- |
| `SUPABASE_URL` | `https://rznkopetlmitfxcixjcr.supabase.co` |
| `SUPABASE_ANON_KEY` | Clave `anon` del proyecto |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave `service_role` (solo servidor) |
| `CORS_ORIGIN` | `https://tu-dominio.com` |
| `APP_URL` | `https://tu-dominio.com` (enlace de restablecimiento) |
| `VITE_SUPABASE_ANON_KEY` | Misma clave `anon` |
| `VITE_API_URL` | `https://tu-dominio.com` (**sin** `/api`) |
| `DOMAIN` | `tu-dominio.com` |
| `ADMIN_EMAIL` | Correo real del primer administrador |
| `PASSWORD_INICIAL_ADMIN` | Clave temporal; se cambia en el primer ingreso |

Asegura permisos del archivo:

```bash
chmod 600 .env
```

> **Tiempo real:** Nginx ya tiene `proxy_buffering off` en `/api/` (tanto en el contenedor
> como en el host) para que `GET /api/stream` (SSE) entregue los eventos sin retardo.
> Si usas App Platform, el App Router debe permitir conexiones de larga duración en `/api/stream`.

## 6. Levantar la aplicación

```bash
bash deploy/deploy.sh up
bash deploy/deploy.sh status
```

Comprueba el backend:

```bash
curl http://127.0.0.1:4000/api/health
# {"ok":true,"data":{"status":"ok","db":"rznkopetlmitfxcixjcr",...}}
```

Crea el primer administrador una sola vez:

```bash
docker compose --env-file .env -f deploy/docker-compose.yml exec api npm run bootstrap:admin
```

Configura además la URL de producción en **Supabase → Authentication → URL Configuration**:
`Site URL = https://tu-dominio.com` y `Redirect URLs = https://tu-dominio.com/restablecer-clave/**`
(lo mismo en `supabase/config.toml`). Sin esto, el correo de recuperación será rechazado.

## 7. Configurar el dominio y SSL

```bash
sudo cp deploy/nginx/host.conf.template /etc/nginx/sites-available/escoltas.conf
sudo sed -i "s/\${DOMAIN}/tu-dominio.com/g" /etc/nginx/sites-available/escoltas.conf
sudo ln -sf /etc/nginx/sites-available/escoltas.conf /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

sudo certbot --nginx -d tu-dominio.com -d www.tu-dominio.com \
  --agree-tos -m admin@tu-dominio.com --redirect
```

Verifica:

```bash
curl -I https://tu-dominio.com
curl https://tu-dominio.com/api/health
```

Certbot renueva automáticamente. Prueba la renovación con:

```bash
sudo certbot renew --dry-run
```

## 8. Operación diaria

```bash
cd /opt/sistema-escoltas

bash deploy/deploy.sh logs      # logs en vivo
bash deploy/deploy.sh restart   # reiniciar servicios
bash deploy/deploy.sh stop      # detener
bash deploy/deploy.sh status    # estado

# Actualizar a una rama/release ya mergeada
git fetch && git checkout develop && git pull --ff-only origin develop
bash deploy/deploy.sh up
```

> Si cambias cualquier `VITE_*`, hay que **reconstruir** el frontend (`up --build`),
> porque esas variables se inyectan en el bundle durante el build.

### Backup de la base de datos

Supabase ya realiza backups automáticos según tu plan. Para un volcado manual:

```bash
supabase db dump --project-ref rznkopetlmitfxcixjcr -f backup.sql
```

## 9. Alternativa: DigitalOcean App Platform

Si prefieres no administrar el Droplet:

- **Static Site** para `frontend/` (build command `npm run build`, output `dist`).
  Configura las variables `VITE_*` en **Build time**.
- **Web Service** para `backend/` (run command `npm start`, planBasic).
  Configura `SUPABASE_*`, `PORT`, `CORS_ORIGIN`.
- En el App Router, enruta `/api` al servicio backend y `/*` al Static Site.
- Añade el dominio en **Settings → Domains** y DigitalOcean gestiona el SSL.

> App Platform no permite ejecutar `deploy/nginx/host.conf.template`; en ese caso el
> enrutamiento `/api` lo hace el App Router y `CORS_ORIGIN` debe ser `https://tu-dominio.com`.

## 10. Checklist de seguridad

- [ ] `.env` con permisos `600` y **nunca** versionado.
- [ ] Service role key solo en el backend.
- [ ] RLS activa en todas las tablas de Supabase.
- [ ] CORS restringido al dominio real.
- [ ] Firewall con solo 22/80/443.
- [ ] HTTPS redirigiendo todo el tráfico HTTP.
- [ ] Usuario `admin` creado y roles revisados en `profiles`.
- [ ] Healthcheck del backend respondiendo en `/api/health`.

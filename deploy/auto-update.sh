#!/usr/bin/env bash
# ============================================================
#  Auto-deploy del Sistema de Escoltas en el Droplet / Servidor
#  Corre por systemd timer cada 1-2 min.
#  Solo reconstruye si origin/main avanzó.
# ============================================================
set -euo pipefail

export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
export HOME="${HOME:-/root}"

REPO="/var/www/Sistema_Escoltas"
if [ ! -d "$REPO" ]; then
  REPO="$(pwd)"
fi

BRANCH="${UPDATE_BRANCH:-main}"
LOG="/var/log/sistema-escoltas-deploy.log"

cd "$REPO"

# Evitar que dos ejecuciones simultáneas se solapen
exec 9>/tmp/sistema-escoltas-deploy.lock
flock -n 9 || exit 0

# ¿Hay commits nuevos en origin?
git fetch origin "$BRANCH" --quiet
LOCAL="$(git rev-parse HEAD)"
REMOTE="$(git rev-parse "origin/$BRANCH")"

OK_FILE="/var/lib/sistema-escoltas/ultimo-deploy-ok"
mkdir -p "$(dirname "$OK_FILE")"
ULTIMO_OK="$(cat "$OK_FILE" 2>/dev/null || true)"

if [ "$LOCAL" = "$REMOTE" ] && [ "$ULTIMO_OK" = "$REMOTE" ]; then
  exit 0   # Sin cambios y ya publicado
fi

echo "----------------------------------------" >> "$LOG"
echo "$(date '+%F %T') · Actualización detectada: ${LOCAL:0:7} -> ${REMOTE:0:7}" >> "$LOG"

# Marcar bandera de actualización para que el banner del frontend la detecte al instante
mkdir -p frontend/dist frontend/public
cat <<EOF > frontend/dist/version.json
{
  "actualizando": true,
  "versionAnterior": "${LOCAL:0:7}",
  "versionNueva": "${REMOTE:0:7}",
  "mensaje": "El sistema esta actualizandose, por favor haga click aca para tener la ultima version.",
  "timestamp": "$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
}
EOF
cp -f frontend/dist/version.json frontend/public/version.json 2>/dev/null || true

# Traer cambios de Git
git reset --hard "origin/$BRANCH" >> "$LOG" 2>&1

# Verificar si cambiaron dependencias
BASE="${ULTIMO_OK:-$LOCAL}"
if [ ! -d node_modules ] || ! git diff --quiet "$BASE" "$REMOTE" -- package.json package-lock.json 2>/dev/null; then
  echo "$(date '+%F %T') · Instalando dependencias..." >> "$LOG"
  npm ci >> "$LOG" 2>&1 || npm install --no-audit >> "$LOG" 2>&1
fi

# Construir el frontend en carpeta temporal para evitar downtime (swap atómico)
rm -rf frontend/dist.new
VITE_APP_VERSION="${REMOTE:0:7}" npm --prefix frontend run build -- --outDir dist.new >> "$LOG" 2>&1

# Grabar versión final publicada
cat <<EOF > frontend/dist.new/version.json
{
  "actualizando": false,
  "version": "${REMOTE:0:7}",
  "commit": "$REMOTE",
  "rama": "$BRANCH",
  "actualizadoEl": "$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
}
EOF

# Swap atómico de directorios
rm -rf frontend/dist.old
if [ -d frontend/dist ]; then mv frontend/dist frontend/dist.old; fi
mv frontend/dist.new frontend/dist
rm -rf frontend/dist.old

# Si el backend corre bajo pm2 o systemd, recargar si es necesario
if command -v systemctl >/dev/null 2>&1 && systemctl is-active --quiet sistema-escoltas.service; then
  systemctl reload-or-restart sistema-escoltas.service >> "$LOG" 2>&1 || true
fi
if command -v pm2 >/dev/null 2>&1 && pm2 list | grep -q "sistema-escoltas"; then
  pm2 reload sistema-escoltas >> "$LOG" 2>&1 || true
fi

echo "$REMOTE" > "$OK_FILE"
echo "$(date '+%F %T') · Despliegue completado con éxito en ${REMOTE:0:7}" >> "$LOG"

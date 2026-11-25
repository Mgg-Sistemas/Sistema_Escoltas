#!/usr/bin/env bash
# Despliegue / administración en el Droplet de DigitalOcean.
# Uso: bash deploy/deploy.sh [up|logs|status|restart|stop]
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

ACCION="${1:-up}"
COMPOSE=(docker compose --env-file .env -f deploy/docker-compose.yml)

if [ ! -f .env ]; then
  echo "Falta el archivo .env. Copia la plantilla primero:"
  echo "  cp deploy/.env.production.example .env"
  exit 1
fi

case "$ACCION" in
  up)
    echo "[deploy] Construyendo y levantando servicios..."
    "${COMPOSE[@]}" up -d --build
    "${COMPOSE[@]}" ps
    ;;
  logs)
    "${COMPOSE[@]}" logs -f --tail=200
    ;;
  status)
    "${COMPOSE[@]}" ps
    ;;
  restart)
    "${COMPOSE[@]}" restart
    ;;
  stop)
    "${COMPOSE[@]}" down
    ;;
  *)
    echo "Acción desconocida: $ACCION"
    echo "Uso: bash deploy/deploy.sh [up|logs|status|restart|stop]"
    exit 1
    ;;
esac

#!/usr/bin/env bash
# Arranca FormIA en el servidor con los servicios compartidos:
#   1. shared-postgres y shared-garage (repositorio github-selfhosted-runners),
#      solo si no están ya en marcha;
#   2. la app (docker-compose.yml + docker-compose.prod.yml), reconstruyendo
#      la imagen;
#   3. espera a que /api/health responda.
#
# Uso:
#   scripts/start.sh                 todo
#   scripts/start.sh --shared-only   solo los servicios compartidos
#
# Variables opcionales: RUNNERS_DIR (por defecto /var/www/github-selfhosted-runners).
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
RUNNERS_DIR="${RUNNERS_DIR:-/var/www/github-selfhosted-runners}"

compose() {
  if docker compose version >/dev/null 2>&1; then docker compose "$@"; else docker-compose "$@"; fi
}

log() { printf '\n==> %s\n' "$*"; }

# Espera hasta que el comando tenga éxito (máx. $1 segundos).
wait_for() {
  local timeout="$1" what="$2"; shift 2
  local i=0
  until "$@" >/dev/null 2>&1; do
    i=$((i + 2))
    if [ "$i" -gt "$timeout" ]; then
      echo "ERROR: $what no está listo tras ${timeout}s" >&2
      return 1
    fi
    sleep 2
  done
  echo "$what listo."
}

is_running() { [ "$(docker inspect -f '{{.State.Running}}' "$1" 2>/dev/null)" = "true" ]; }

# Arranca un servicio compartido solo si no está corriendo, para no
# recrear contenedores que usan otras apps (p. ej. shared-postgres).
start_shared() {
  local service="$1" container="$2"
  if is_running "$container"; then
    echo "$container ya está en marcha."
  else
    (cd "$RUNNERS_DIR" && compose up -d "$service")
  fi
}

log "Servicios compartidos"
start_shared postgres shared-postgres
start_shared garage shared-garage
wait_for 60 shared-postgres docker exec shared-postgres pg_isready -U postgres
wait_for 60 shared-garage docker exec shared-garage /garage status

if [ "${1:-}" = "--shared-only" ]; then
  exit 0
fi

log "App (docker-compose.prod.yml)"
cd "$APP_DIR"
compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

APP_PORT="$(sed -n 's/^APP_PORT=//p' .env | tail -n1)"
APP_PORT="${APP_PORT:-3000}"
wait_for 120 "App (http://127.0.0.1:${APP_PORT})" curl -fsS "http://127.0.0.1:${APP_PORT}/api/health"
curl -sS "http://127.0.0.1:${APP_PORT}/api/health"; echo

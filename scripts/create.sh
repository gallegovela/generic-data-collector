#!/usr/bin/env bash
# Preparación inicial de FormIA sobre los servicios compartidos del
# servidor (shared-postgres y shared-garage). Se puede repetir: cada paso
# se salta si ya está hecho.
#
#   1. Crea el secreto RPC de Garage si falta (Docker lo deja como carpeta
#      vacía cuando el fichero no existe, y Garage no arranca).
#   2. Arranca los servicios compartidos (scripts/start.sh --shared-only).
#   3. Aplica el layout de Garage y crea el bucket y la clave "formia".
#   4. Crea la base de datos y el usuario "formia" en shared-postgres
#      (solo si no existen: una contraseña existente no se puede recuperar).
#   5. Escribe las credenciales en .env (copia previa en .env.bak).
#   6. Aplica las migraciones de Prisma (y el seed con --seed).
#   7. Arranca la app (scripts/start.sh).
#
# Uso:
#   scripts/create.sh            preparación completa
#   scripts/create.sh --seed     además carga los datos de ejemplo de la demo
#
# Variables opcionales: RUNNERS_DIR (por defecto /var/www/github-selfhosted-runners),
# SECRETS_DIR (por defecto /etc/github-selfhosted-runners/secrets), APP_NAME (formia).
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
RUNNERS_DIR="${RUNNERS_DIR:-/var/www/github-selfhosted-runners}"
SECRETS_DIR="${SECRETS_DIR:-/etc/github-selfhosted-runners/secrets}"
APP_NAME="${APP_NAME:-formia}"
SHARED_NETWORK="${SHARED_NETWORK:-gallegovela-shared}"
SEED=0
[ "${1:-}" = "--seed" ] && SEED=1

ENV_FILE="$APP_DIR/.env"

compose() {
  if docker compose version >/dev/null 2>&1; then docker compose "$@"; else docker-compose "$@"; fi
}

log() { printf '\n==> %s\n' "$*"; }

# Sustituye KEY=... en .env, o lo añade al final si no existe.
set_env() {
  local key="$1" value="$2"
  if grep -q "^${key}=" "$ENV_FILE"; then
    sed -i "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
  else
    printf '%s=%s\n' "$key" "$value" >>"$ENV_FILE"
  fi
}

[ -f "$ENV_FILE" ] || { echo "ERROR: falta $ENV_FILE (copia .env.example)" >&2; exit 1; }

# 1. Secreto RPC de Garage ----------------------------------------------
log "Secreto RPC de Garage"
RPC_SECRET="$SECRETS_DIR/garage-rpc-secret"
RECREATE_GARAGE=0
if [ -d "$RPC_SECRET" ]; then
  rmdir "$RPC_SECRET"   # falla si no está vacía: mejor parar que borrar algo
fi
if [ ! -f "$RPC_SECRET" ]; then
  (umask 077; openssl rand -hex 32 >"$RPC_SECRET")
  RECREATE_GARAGE=1
  echo "Creado $RPC_SECRET"
else
  echo "Ya existe."
fi
chmod 600 "$RPC_SECRET"

# El contenedor que había montaba una carpeta: hay que recrearlo.
if [ "$RECREATE_GARAGE" = 1 ] && docker inspect shared-garage >/dev/null 2>&1; then
  (cd "$RUNNERS_DIR" && compose up -d --force-recreate garage)
fi

# 2. Servicios compartidos ----------------------------------------------
"$APP_DIR/scripts/start.sh" --shared-only

# 3. Garage: layout, bucket y clave ---------------------------------------
log "Garage: layout"
"$RUNNERS_DIR/garage/init-layout.sh"

log "Garage: bucket y clave '$APP_NAME'"
S3_OUT="$("$RUNNERS_DIR/garage/create-app-bucket.sh" "$APP_NAME")"
S3_KEY="$(sed -n 's/^S3_ACCESS_KEY_ID=//p' <<<"$S3_OUT")"
S3_SECRET="$(sed -n 's/^S3_SECRET_ACCESS_KEY=//p' <<<"$S3_OUT")"
S3_BUCKET="$(sed -n 's/^S3_BUCKET=//p' <<<"$S3_OUT")"
[ -n "$S3_KEY" ] && [ -n "$S3_SECRET" ] || { echo "ERROR: no se obtuvo la clave de Garage" >&2; exit 1; }

# 4. Postgres: base de datos y usuario ------------------------------------
log "Postgres: base de datos y usuario '$APP_NAME'"
PG_PASS=""
ROLE_EXISTS="$(docker exec shared-postgres psql -U postgres -Atc \
  "select 1 from pg_roles where rolname = '$APP_NAME'")"
if [ "$ROLE_EXISTS" = "1" ]; then
  echo "El usuario '$APP_NAME' ya existe: se mantienen las credenciales de .env."
else
  PG_OUT="$("$RUNNERS_DIR/postgres/create-app-db.sh" "$APP_NAME")"
  PG_PASS="$(sed -n 's/^PGPASSWORD=//p' <<<"$PG_OUT")"
  [ -n "$PG_PASS" ] || { echo "ERROR: no se obtuvo la contraseña de Postgres" >&2; exit 1; }
fi

# 5. Credenciales en .env --------------------------------------------------
log "Escribiendo credenciales en .env (copia en .env.bak)"
cp "$ENV_FILE" "$ENV_FILE.bak"
chmod 600 "$ENV_FILE.bak"
if [ -n "$PG_PASS" ]; then
  set_env POSTGRES_USER "$APP_NAME"
  set_env POSTGRES_PASSWORD "$PG_PASS"
  set_env POSTGRES_DB "$APP_NAME"
  # Desde el host: shared-postgres publica 127.0.0.1:5432.
  set_env DATABASE_URL "postgresql://$APP_NAME:$PG_PASS@localhost:5432/$APP_NAME"
fi
set_env COMPOSE_PROFILES none
set_env POSTGRES_HOST shared-postgres
set_env POSTGRES_PORT 5432
set_env SHARED_NETWORK "$SHARED_NETWORK"
set_env S3_DOCKER_ENDPOINT http://shared-garage:3900
set_env S3_ENDPOINT http://localhost:3900
set_env S3_REGION garage
set_env S3_BUCKET "${S3_BUCKET:-$APP_NAME}"
set_env S3_ACCESS_KEY "$S3_KEY"
set_env S3_SECRET_KEY "$S3_SECRET"
set_env S3_FORCE_PATH_STYLE true
chmod 600 "$ENV_FILE"

# 6. Migraciones (y seed) ---------------------------------------------------
# En el host no hay node_modules y la imagen final no lleva la CLI de
# Prisma, así que se usa la fase "deps" del Dockerfile, conectada a la red
# compartida.
log "Migraciones de Prisma"
cd "$APP_DIR"
docker build -q --target deps -t formia-deps . >/dev/null
DB_USER="$(sed -n 's/^POSTGRES_USER=//p' "$ENV_FILE" | tail -n1)"
DB_PASS="$(sed -n 's/^POSTGRES_PASSWORD=//p' "$ENV_FILE" | tail -n1)"
DB_NAME="$(sed -n 's/^POSTGRES_DB=//p' "$ENV_FILE" | tail -n1)"
DOCKER_DB_URL="postgresql://$DB_USER:$DB_PASS@shared-postgres:5432/$DB_NAME"

prisma_run() {
  docker run --rm --network "$SHARED_NETWORK" \
    --env-file "$ENV_FILE" \
    -e DATABASE_URL="$DOCKER_DB_URL" \
    -e S3_ENDPOINT=http://shared-garage:3900 \
    -v "$APP_DIR/prisma:/app/prisma:ro" \
    -v "$APP_DIR/src:/app/src:ro" \
    -v "$APP_DIR/tsconfig.json:/app/tsconfig.json:ro" \
    formia-deps "$@"
}
prisma_run npx prisma migrate deploy
if [ "$SEED" = 1 ]; then
  log "Datos de ejemplo (seed)"
  prisma_run npx prisma db seed
fi

# 7. App ----------------------------------------------------------------------
"$APP_DIR/scripts/start.sh"

log "Listo. Credenciales guardadas solo en $ENV_FILE: no la borres."

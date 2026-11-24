#!/bin/sh
# Entorno de pruebas en contenedores (docker-compose.yml +
# docker-compose.test.yml). Ver "Pruebas en contenedores" en
# specs/platform/design.md.
#
#   npm run test:stack:up                      construye las imágenes de la rama, levanta
#                                              los servicios, crea el bucket, migra la base
#                                              de datos y arranca la app (servicio web)
#   npm run test:stack:run -- <comando...>     ejecuta un comando en el contenedor `tests`
#                                              (p. ej. npm test, npx playwright test,
#                                              curl -fsS http://web:3000/api/health)
#   npm run test:stack:logs -- [servicio]      últimas líneas del log (web, postgres...)
#   npm run test:stack:down                    lo para y borra todo: contenedores, volúmenes
#                                              e imágenes de la rama (la caché de build queda)
#
# Cada ejecución se aísla con COMPOSE_PROJECT_NAME (por defecto
# formia-test; el pipeline usa formia-testpr-<n>, formia-dev-<n>...).
set -eu

cd "$(dirname "$0")/.."
COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-formia-test}"
export COMPOSE_PROJECT_NAME

# Los perfiles van explícitos para que el COMPOSE_PROFILES de .env (p. ej.
# "none" en el servidor) no deje las pruebas sin PostgreSQL ni MinIO.
compose() {
  docker compose -f docker-compose.yml -f docker-compose.test.yml \
    --profile tests --profile postgres --profile minio "$@"
}

command="${1:-}"
[ $# -gt 0 ] && shift

case "$command" in
  up)
    compose build
    compose up -d --wait postgres minio mailpit
    compose run --rm minio-init
    compose run --rm tests env -u NODE_ENV npm run db:migrate
    compose up -d --wait web
    ;;
  run)
    [ $# -gt 0 ] || { echo "Uso: npm run test:stack:run -- <comando...>" >&2; exit 2; }
    # Without the NODE_ENV of .env.example (development): next build and
    # Vitest set their own, and a forced one breaks the production build.
    compose run --rm tests env -u NODE_ENV "$@"
    ;;
  logs)
    compose logs --no-color --tail=200 "$@"
    ;;
  down)
    # Also removes the images built for this project (the build cache
    # stays), so runs on the CI runner do not fill its disk.
    compose down -v --remove-orphans --rmi local
    ;;
  *)
    echo "Uso: scripts/test-stack.sh up | run <comando...> | logs [servicio] | down" >&2
    exit 2
    ;;
esac

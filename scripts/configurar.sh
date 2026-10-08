#!/bin/sh
# Prepara el proyecto en un PC nuevo (macOS / Linux):
#   - crea .env (raiz) con una clave aleatoria para Postgres
#   - crea backend/.env (modo desarrollo) con los mismos datos
# No sobrescribe archivos que ya existan.
# Uso, desde la raiz del proyecto:  sh scripts/configurar.sh
set -e
cd "$(dirname "$0")/.."

if [ -f .env ]; then
  echo ".env ya existe: se mantiene"
else
  clave=$(LC_ALL=C tr -dc 'A-Za-z0-9' < /dev/urandom | head -c 24)
  sed "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$clave/" .env.example > .env
  echo "Creado .env con una clave aleatoria"
fi

# Lee los valores del .env (con predeterminados iguales a docker-compose.yml)
valor() { v=$(grep -E "^$1=" .env | tail -n 1 | cut -d= -f2- | tr -d '\r'); echo "${v:-$2}"; }
usuario=$(valor POSTGRES_USER minutas)
clave=$(valor POSTGRES_PASSWORD "")
base=$(valor POSTGRES_DB minutas)
puerto=$(valor POSTGRES_PORT 5432)

if [ -f backend/.env ]; then
  echo "backend/.env ya existe: se mantiene (revisa que DATABASE_URL use la misma clave)"
else
  sed "s#^DATABASE_URL=.*#DATABASE_URL=postgres://$usuario:$clave@localhost:$puerto/$base#" \
    backend/.env.example > backend/.env
  echo "Creado backend/.env"
fi

echo "Listo. Ahora ejecuta: docker compose up --build -d"

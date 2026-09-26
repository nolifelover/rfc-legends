#!/usr/bin/env bash
# Production PocketBase for RFC Legends (D1): separate data dir on :8091 so
# dev data never leaks into prod. Migrations are shared with dev
# (pb_migrations/), the data dir persists outside the repo.
set -euo pipefail
cd "$(dirname "$0")"

DIR="${POCKETBASE_PROD_DIR:-$HOME/rfc-legends-prod-data/pb_data}"
mkdir -p "$(dirname "$DIR")"

: "${POCKETBASE_SUPERUSER_EMAIL:?set POCKETBASE_SUPERUSER_EMAIL}"
: "${POCKETBASE_SUPERUSER_PASSWORD:?set POCKETBASE_SUPERUSER_PASSWORD}"

# Same superuser as dev so the Next.js prod server (which reads the shared
# .env.production.local) can authenticate; scoped to the prod data dir only.
./pocketbase superuser upsert "$POCKETBASE_SUPERUSER_EMAIL" "$POCKETBASE_SUPERUSER_PASSWORD" --dir "$DIR"

exec ./pocketbase serve --http "${POCKETBASE_HTTP:-127.0.0.1:8091}" --dir "$DIR" --migrationsDir pb_migrations --hooksDir pb_hooks

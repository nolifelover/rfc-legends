#!/usr/bin/env bash
# Runs the local PocketBase used by the game server (players, drops, guild chat, World ID nullifiers).
# Fetch the binary first with ./fetch.sh. Migrations in pb_migrations/ are applied on start.
set -euo pipefail
cd "$(dirname "$0")"
exec ./pocketbase serve --http "${POCKETBASE_HTTP:-127.0.0.1:8090}" --dir pb_data --migrationsDir pb_migrations --hooksDir pb_hooks

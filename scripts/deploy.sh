#!/usr/bin/env bash
# D1 — one-command production deploy for RFC Legends.
#
#   scripts/deploy.sh
#
# What it does:
#   1. Stages apps/web into ~/rfc-legends-prod/web (the dev server on :3000
#      and its .next dir are never touched)
#   2. Builds with the production env (apps/web/.env.production.local,
#      gitignored — create it once from .env.local with the overrides below)
#   3. (Re)starts under pm2: web on :3100, PocketBase prod on :8091
#   4. Health-checks both, and prints the smoke command for the proxy host
#
# Required env in apps/web/.env.production.local (beyond the .env.local copy):
#   APP_URL=https://rfclegends.rfcclub.app
#   WORLD_ENVIRONMENT=production
#   POCKETBASE_URL=http://127.0.0.1:8091
#   NEXT_PUBLIC_POCKETBASE_URL=/pb/          (browsers go through the /pb/ rewrite)
#   NEXT_PUBLIC_SITE_URL=https://rfclegends.rfcclub.app
set -euo pipefail
cd "$(dirname "$0")/.."

# PocketBase prod needs the superuser credentials from the production env.
set -a
# shellcheck disable=SC1091
[ -f apps/web/.env.production.local ] && . ./apps/web/.env.production.local
set +a
: "${POCKETBASE_SUPERUSER_EMAIL:?set POCKETBASE_SUPERUSER_EMAIL in apps/web/.env.production.local}"
: "${POCKETBASE_SUPERUSER_PASSWORD:?set POCKETBASE_SUPERUSER_PASSWORD in apps/web/.env.production.local}"

REPO="$(pwd)"
STAGE="${RFC_PROD_STAGE:-$HOME/rfc-legends-prod}"
WEB="$STAGE/web"
PORT="${RFC_PROD_PORT:-3100}"
PB_PORT="${POCKETBASE_HTTP:-127.0.0.1:8091}"

echo "==> building from a clean worktree of ${RFC_DEPLOY_REF:-HEAD} (dirty trees never ship)"
WT=$(mktemp -d /tmp/rfc-deploy-XXXXXX)
git worktree add --detach "$WT" "${RFC_DEPLOY_REF:-HEAD}" >/dev/null
trap 'git worktree remove --force "$WT" >/dev/null 2>&1 || rm -rf "$WT"' EXIT
cp apps/web/.env.production.local "$WT/apps/web/.env.production.local"
if [ ! -d "$WT/apps/web/node_modules" ]; then
  cp -al "$REPO/apps/web/node_modules" "$WT/apps/web/node_modules" 2>/dev/null \
    || rsync -a "$REPO/apps/web/node_modules/" "$WT/apps/web/node_modules/"
fi

echo "==> building (next build, from HEAD)"
cd "$WT/apps/web"
npx next build

echo "==> staging the built app -> $WEB"
mkdir -p "$STAGE"
# the worktree holds the fresh .next: ship it (no .next exclude), it is the
# entire point of the worktree build
rsync -a --delete \
  --exclude node_modules --exclude .data \
  --exclude '.env*' \
  "$WT/apps/web/" "$WEB/"
# secrets stay out of rsync; the production env is copied explicitly
if [ ! -f "$REPO/apps/web/.env.production.local" ]; then
  echo "!! apps/web/.env.production.local missing — see header of this script" >&2
  exit 1
fi
cp "$REPO/apps/web/.env.production.local" "$WEB/.env.production.local"
# Turbopack refuses a node_modules symlink outside the project root. A
# hardlink copy is instant on the same filesystem and next build only reads.
if [ -L "$WEB/node_modules" ] || [ ! -d "$WEB/node_modules" ] || [ -n "${RFC_PROD_REFRESH_DEPS:-}" ]; then
  rm -rf "$WEB/node_modules"
  cp -al "$REPO/apps/web/node_modules" "$WEB/node_modules" 2>/dev/null \
    || rsync -a "$REPO/apps/web/node_modules/" "$WEB/node_modules/"
fi

echo "==> (re)starting under pm2"
# startOrReload takes an ecosystem file (raw script + `--` args trips pm2's
# JSON path), so generate one with this machine's absolute paths.
cat > "$STAGE/ecosystem.config.cjs" <<ECOSYSTEM
module.exports = {
  apps: [
    {
      name: 'rfc-legends-pb',
      script: '$REPO/pocketbase/run-prod.sh',
      env: { POCKETBASE_HTTP: '$PB_PORT', POCKETBASE_SUPERUSER_EMAIL: process.env.POCKETBASE_SUPERUSER_EMAIL, POCKETBASE_SUPERUSER_PASSWORD: process.env.POCKETBASE_SUPERUSER_PASSWORD },
      time: true,
    },
    {
      name: 'rfc-legends-web',
      script: '$WEB/node_modules/.bin/next',
      args: 'start -p $PORT',
      cwd: '$WEB',
      time: true,
    },
  ],
}
ECOSYSTEM
PM2="npx pm2"
cd "$STAGE"
$PM2 startOrReload ecosystem.config.cjs --update-env >/dev/null
$PM2 save >/dev/null

echo "==> health checks"
ok=0
for i in $(seq 1 30); do
  code=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/" || true)
  [ "$code" = "200" ] && ok=$((ok + 1)) && break
  sleep 2
done
if [ "$ok" -lt 1 ]; then
  echo "!! web health check failed on :$PORT — npx pm2 logs rfc-legends-web" >&2
  exit 1
fi
curl -s "http://$PB_PORT/api/health" | head -c 120; echo

echo
echo "DEPLOY OK — web :$PORT, PocketBase :$PB_PORT"
echo "smoke (until DNS lands): curl -H 'Host: rfclegends.rfcclub.app' http://127.0.0.1/"

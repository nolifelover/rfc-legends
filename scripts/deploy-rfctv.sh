#!/usr/bin/env bash
# D2 — one-command deploy of RFC Legends to the rfctv production box
# (ssh alias `stream-edge`, ~/rfc-legends, docker compose).
#
#   scripts/deploy-rfctv.sh [--with-vhost]
#
# Never touches existing services: the stack runs isolated on loopback
# (127.0.0.1:3100 / :8091) and only --with-vhost (POST-APPROVAL) installs the
# nginx vhost. All ssh goes over one multiplexed connection (ufw rate-limits
# new connections to :22).
set -euo pipefail
cd "$(dirname "$0")/.."
REPO="$(pwd)"

HOST=stream-edge
SSH_OPTS=(-o ControlMaster=auto -o ControlPath="$HOME/.ssh/cm-edge.sock" -o ControlPersist=60m)
edg() { ssh "${SSH_OPTS[@]}" "$HOST" "$@"; }
rsync_edge() { rsync -az -e "ssh ${SSH_OPTS[*]}" "$@"; }

echo "==> building locally first (one build, shipped everywhere)"
"$REPO/scripts/deploy.sh" > /tmp/deploy-local-for-edge.log 2>&1 || {
  echo "!! local build failed — see /tmp/deploy-local-for-edge.log" >&2; exit 1;
}
tail -2 /tmp/deploy-local-for-edge.log

echo "==> syncing repo + prebuilt web -> $HOST:~/rfc-legends (secrets excluded)"
rsync_edge --delete \
  --exclude .git --exclude .data --exclude 'pb_data*' --exclude '.env*' \
  --exclude apps/web/.data --exclude pocketbase/pocketbase \
  "$REPO/" "$HOST:rfc-legends/"
# the local production build (stage dir) replaces the app source on the box;
# node_modules rides along so the runtime image is self-contained
rsync_edge --delete "$HOME/rfc-legends-prod/web/" "$HOST:rfc-legends/apps/web/"

echo "==> copying + tuning the production env"
scp "${SSH_OPTS[@]}" -q "$REPO/apps/web/.env.production.local" "$HOST:rfc-legends/apps/web/.env.production.local"
edg 'cd ~/rfc-legends/apps/web && sed -i "s|^POCKETBASE_URL=.*|POCKETBASE_URL=http://pocketbase:8091|" .env.production.local && grep -q "^POCKETBASE_SUPERUSER_PASSWORD=" .env.production.local && echo env-ok'

echo "==> building containers (fast: runtime image copies the prebuilt app)"
edg 'cd ~/rfc-legends && cp deploy/rfctv/compose.yaml compose.yaml && sudo docker compose build 2>&1 | tail -3'

echo "==> starting (loopback only)"
edg 'cd ~/rfc-legends && sudo docker compose up -d 2>&1 | tail -4'

echo "==> health checks"
ok=0
for i in $(seq 1 30); do
  code=$(edg 'curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3100/' || true)
  [ "$code" = "200" ] && ok=1 && break
  sleep 2
done
[ "$ok" = "1" ] || { echo "!! web health check failed on :3100" >&2; exit 1; }
edg 'curl -s http://127.0.0.1:8091/api/health | head -c 60; echo'

if [ "${1:-}" = "--with-vhost" ]; then
  echo "==> installing nginx vhost (approved proxy change)"
  # Cloudflare Full (non-strict) accepts this self-signed origin cert.
  edg 'sudo mkdir -p /etc/nginx/ssl/rfclegends && if [ ! -f /etc/nginx/ssl/rfclegends/fullchain.pem ]; then sudo openssl req -x509 -newkey rsa:2048 -nodes -days 730 -keyout /etc/nginx/ssl/rfclegends/privkey.pem -out /etc/nginx/ssl/rfclegends/fullchain.pem -subj "/CN=rfclegends.rfcclub.app" -addext "subjectAltName=DNS:rfclegends.rfcclub.app" 2>/dev/null; echo cert-created; else echo cert-exists; fi'
  edg 'sudo tee /etc/nginx/sites-available/rfclegends >/dev/null' < "$REPO/deploy/rfctv/nginx-vhost.conf"
  edg 'sudo ln -sf /etc/nginx/sites-available/rfclegends /etc/nginx/sites-enabled/rfclegends && sudo nginx -t && sudo systemctl reload nginx'
  edg 'curl -s -o /dev/null -w "vhost check :80 -> %{http_code}\n" -H "Host: rfclegends.rfcclub.app" http://127.0.0.1/; curl -sk -o /dev/null -w "vhost check :443 -> %{http_code}\n" --resolve rfclegends.rfcclub.app:443:127.0.0.1 https://rfclegends.rfcclub.app/'
else
  echo "(vhost skipped — run with --with-vhost once the proxy change is approved)"
fi

echo
echo "DEPLOY OK on $HOST — web 127.0.0.1:3100, PocketBase 127.0.0.1:8091 (loopback only)"

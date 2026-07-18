#!/usr/bin/env bash
set -euo pipefail

APP_NAME=${APP_NAME:-linkjo-next}
APP_PORT=${APP_PORT:-3100}
VPS_HOST=${VPS_HOST:?VPS_HOST must be set}
VPS_PORT=${VPS_PORT:?VPS_PORT must be set}
VPS_USER=${VPS_USER:?VPS_USER must be set}
REMOTE_ROOT=${REMOTE_ROOT:-/var/www/linkjo-next}
PRODUCTION_URL=${PRODUCTION_URL:?PRODUCTION_URL must be set}

LOCAL_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
REMOTE_APP="$REMOTE_ROOT/current"

SSH=(ssh -p "$VPS_PORT" "$VPS_USER@$VPS_HOST")
RSYNC_RSH="ssh -p $VPS_PORT"

echo "Deploying $APP_NAME current build to $VPS_HOST"

"${SSH[@]}" "set -euo pipefail
mkdir -p '$REMOTE_ROOT/shared' '$REMOTE_ROOT/shared/baileys-auth'
test -f '$REMOTE_ROOT/shared/.env'
if [ -L '$REMOTE_APP' ]; then
  rm '$REMOTE_APP'
fi
mkdir -p '$REMOTE_APP'
"

rsync -az --delete \
  -e "$RSYNC_RSH" \
  --exclude ".git/" \
  --exclude ".github/" \
  --exclude ".next/" \
  --exclude "node_modules/" \
  --exclude "test-results/" \
  --exclude "coverage/" \
  --exclude ".env" \
  --exclude ".env.*" \
  "$LOCAL_ROOT/" "$VPS_USER@$VPS_HOST:$REMOTE_APP/"

"${SSH[@]}" "APP_NAME='$APP_NAME' APP_PORT='$APP_PORT' REMOTE_ROOT='$REMOTE_ROOT' REMOTE_APP='$REMOTE_APP' PRODUCTION_URL='$PRODUCTION_URL' bash -s" <<'REMOTE'
set -euo pipefail

ln -sfn "$REMOTE_ROOT/shared/.env" "$REMOTE_APP/.env"

cd "$REMOTE_APP"
npm ci
npx prisma generate
npx prisma migrate deploy
rm -rf .next
npm run build

set -a
. "$REMOTE_ROOT/shared/.env"
set +a

cat > "$REMOTE_ROOT/ecosystem.config.cjs" <<EOF
module.exports = {
  apps: [
    {
      name: "$APP_NAME",
      script: "node_modules/.bin/next",
      args: "start -p $APP_PORT",
      cwd: "$REMOTE_ROOT/current",
      env: {
        NODE_ENV: "production",
      },
    },
    {
      name: "linkjo-wa-worker",
      script: "node_modules/.bin/tsx",
      args: "-r dotenv/config src/workers/whatsapp-baileys-worker.ts",
      cwd: "$REMOTE_ROOT/current",
      env: {
        NODE_ENV: "production",
        WHATSAPP_SHARED_DIR: "$REMOTE_ROOT/shared",
        WHATSAPP_BAILEYS_AUTH_DIR: "$REMOTE_ROOT/shared/baileys-auth",
        WHATSAPP_STATUS_PATH: "$REMOTE_ROOT/shared/whatsapp-status.json",
      },
    },
  ],
}
EOF

if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
  pm2 reload "$REMOTE_ROOT/ecosystem.config.cjs" --only "$APP_NAME" --update-env
else
  pm2 start "$REMOTE_ROOT/ecosystem.config.cjs" --only "$APP_NAME" --update-env
fi

if [ "${WHATSAPP_PROVIDER:-fonnte}" = "baileys" ]; then
  if pm2 describe linkjo-wa-worker >/dev/null 2>&1; then
    pm2 reload linkjo-wa-worker --update-env
  else
    pm2 start "$REMOTE_ROOT/ecosystem.config.cjs" --only linkjo-wa-worker --update-env
  fi
else
  pm2 delete linkjo-wa-worker >/dev/null 2>&1 || true
fi
pm2 save

ready=0
for attempt in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:$APP_PORT" >/dev/null; then
    ready=1
    break
  fi
  sleep 1
done

if [ "$ready" -ne 1 ]; then
  echo "Smoke test failed for current build at $REMOTE_APP" >&2
  exit 1
fi

rm -rf "$REMOTE_ROOT/releases"

echo "Deployed $REMOTE_APP"
REMOTE

echo "Deploy complete: $PRODUCTION_URL"

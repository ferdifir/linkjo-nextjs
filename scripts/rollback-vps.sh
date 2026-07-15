#!/usr/bin/env bash
set -euo pipefail

APP_NAME=${APP_NAME:-linkjo-next}
APP_PORT=${APP_PORT:-3100}
VPS_HOST=${VPS_HOST:?VPS_HOST must be set}
VPS_PORT=${VPS_PORT:?VPS_PORT must be set}
VPS_USER=${VPS_USER:?VPS_USER must be set}
REMOTE_ROOT=${REMOTE_ROOT:-/var/www/linkjo-next}
TARGET_RELEASE=${1:-}

SSH=(ssh -p "$VPS_PORT" "$VPS_USER@$VPS_HOST")

"${SSH[@]}" "APP_NAME='$APP_NAME' APP_PORT='$APP_PORT' REMOTE_ROOT='$REMOTE_ROOT' TARGET_RELEASE='$TARGET_RELEASE' bash -s" <<'REMOTE'
set -euo pipefail

if [ -n "$TARGET_RELEASE" ]; then
  if [[ "$TARGET_RELEASE" = /* ]]; then
    RELEASE_PATH="$TARGET_RELEASE"
  else
    RELEASE_PATH="$REMOTE_ROOT/releases/$TARGET_RELEASE"
  fi
else
  CURRENT=$(readlink -f "$REMOTE_ROOT/current" || true)
  RELEASE_PATH=$(find "$REMOTE_ROOT/releases" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' \
    | sort -rn \
    | awk -v current="$CURRENT" '$2 != current {print $2; exit}')
fi

if [ -z "${RELEASE_PATH:-}" ] || [ ! -d "$RELEASE_PATH" ]; then
  echo "No rollback release found" >&2
  exit 1
fi

ln -sfn "$RELEASE_PATH" "$REMOTE_ROOT/current"

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

pm2 reload "$REMOTE_ROOT/ecosystem.config.cjs" --only "$APP_NAME" --update-env \
  || pm2 start "$REMOTE_ROOT/ecosystem.config.cjs" --only "$APP_NAME" --update-env

if [ "${WHATSAPP_PROVIDER:-fonnte}" = "baileys" ] && [ -f "$REMOTE_ROOT/current/src/workers/whatsapp-baileys-worker.ts" ]; then
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
  echo "Rollback smoke test failed for $RELEASE_PATH" >&2
  exit 1
fi

echo "Rolled back to $RELEASE_PATH"
REMOTE

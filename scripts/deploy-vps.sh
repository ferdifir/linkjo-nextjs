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
COMMIT_SHA=${GITHUB_SHA:-$(git -C "$LOCAL_ROOT" rev-parse HEAD 2>/dev/null || date -u +%Y%m%d%H%M%S)}
SHORT_SHA=${COMMIT_SHA:0:12}
RELEASE_ID=${RELEASE_ID:-$(date -u +%Y%m%d%H%M%S)-$SHORT_SHA}
REMOTE_RELEASE="$REMOTE_ROOT/releases/$RELEASE_ID"

SSH=(ssh -p "$VPS_PORT" "$VPS_USER@$VPS_HOST")
RSYNC_RSH="ssh -p $VPS_PORT"

echo "Deploying $APP_NAME release $RELEASE_ID to $VPS_HOST"

"${SSH[@]}" "set -euo pipefail
mkdir -p '$REMOTE_ROOT/releases' '$REMOTE_ROOT/shared'
test -f '$REMOTE_ROOT/shared/.env'
mkdir -p '$REMOTE_RELEASE'
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
  "$LOCAL_ROOT/" "$VPS_USER@$VPS_HOST:$REMOTE_RELEASE/"

"${SSH[@]}" "APP_NAME='$APP_NAME' APP_PORT='$APP_PORT' REMOTE_ROOT='$REMOTE_ROOT' REMOTE_RELEASE='$REMOTE_RELEASE' PRODUCTION_URL='$PRODUCTION_URL' bash -s" <<'REMOTE'
set -euo pipefail

PREVIOUS_RELEASE=""
if [ -L "$REMOTE_ROOT/current" ]; then
  PREVIOUS_RELEASE=$(readlink -f "$REMOTE_ROOT/current" || true)
fi

ln -sfn "$REMOTE_ROOT/shared/.env" "$REMOTE_RELEASE/.env"

cd "$REMOTE_RELEASE"
npm ci
npx prisma generate
npx prisma migrate deploy
npm run build

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
  ],
}
EOF

ln -sfn "$REMOTE_RELEASE" "$REMOTE_ROOT/current"

if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
  pm2 reload "$REMOTE_ROOT/ecosystem.config.cjs" --update-env
else
  pm2 start "$REMOTE_ROOT/ecosystem.config.cjs" --update-env
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
  echo "Smoke test failed for release $REMOTE_RELEASE" >&2
  if [ -n "$PREVIOUS_RELEASE" ] && [ -d "$PREVIOUS_RELEASE" ]; then
    ln -sfn "$PREVIOUS_RELEASE" "$REMOTE_ROOT/current"
    pm2 reload "$REMOTE_ROOT/ecosystem.config.cjs" --update-env || pm2 start "$REMOTE_ROOT/ecosystem.config.cjs" --update-env
    pm2 save
  fi
  exit 1
fi

find "$REMOTE_ROOT/releases" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' \
  | sort -rn \
  | awk 'NR>5 {print $2}' \
  | while read -r old_release; do
      current=$(readlink -f "$REMOTE_ROOT/current" || true)
      [ "$old_release" = "$current" ] && continue
      rm -rf "$old_release"
    done

echo "Deployed $REMOTE_RELEASE"
REMOTE

echo "Deploy complete: $PRODUCTION_URL"

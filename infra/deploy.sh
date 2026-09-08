#!/usr/bin/env bash
set -euo pipefail
source /srv/synqit/.deploy.env

echo "==> Syncing VPS repo to origin/main"
cd /srv/synqit/repo
git fetch --prune origin main
git reset --hard origin/main
git clean -fd

cd /srv/synqit/repo/infra

IMAGE_TAG="${1:-latest}"
export IMAGE_TAG

echo "==> Logging into GHCR"
echo "${GHCR_TOKEN}" | docker login ghcr.io -u "${GHCR_USERNAME}" --password-stdin

# Reclaim before pulling, never after: a deploy that runs out of disk dies during
# `pull`, so a prune placed below it is exactly where it cannot help. Each deploy
# leaves ~2.5 GB of newly untagged images behind (api and worker are ~1.1 GB each),
# which filled the VPS after ~16 releases and failed the deploy on 2026-09-07.
# `until=24h` keeps roughly a day of releases to roll back to. Images backing a
# running container are never removed, so the live stack is untouched.
echo "==> Reclaiming images older than 24h"
docker image prune -af --filter "until=24h"

echo "==> Pulling images for tag: ${IMAGE_TAG}"
docker compose -f docker-compose.ci.yml pull

echo "==> Running database migrations"
docker compose -f docker-compose.ci.yml --profile tools run --rm migrate

echo "==> Recreating app services"
docker compose -f docker-compose.ci.yml up -d --force-recreate --remove-orphans api worker site web admin

echo "==> Current status"
docker compose -f docker-compose.ci.yml ps

echo "==> Waiting for API health"
for i in {1..30}; do
  if curl -fsS http://127.0.0.1:3001/healthz >/dev/null; then
    echo "API healthy"
    exit 0
  fi
  echo "Attempt $i/30 failed, retrying in 2s..."
  sleep 2
done

echo "API failed health check after retries"
docker compose -f docker-compose.ci.yml logs api --tail=100
exit 1
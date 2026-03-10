#!/usr/bin/env bash
set -euo pipefail
source /srv/synqit/.deploy.env

cd /srv/synqit/repo/infra

IMAGE_TAG="${1:-latest}"
export IMAGE_TAG

echo "==> Logging into GHCR"
echo "${GHCR_TOKEN}" | docker login ghcr.io -u "${GHCR_USERNAME}" --password-stdin

echo "==> Pulling images for tag: ${IMAGE_TAG}"
docker compose -f docker-compose.ci.yml pull

echo "==> Running database migrations"
docker compose -f docker-compose.ci.yml --profile tools run --rm migrate

echo "==> Recreating app services"
docker compose -f docker-compose.ci.yml up -d --force-recreate api worker site web admin

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

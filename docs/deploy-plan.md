# Deploy Plan

## Model

- Build Docker images in CI.
- Push images to registry.
- VPS pulls latest images and runs `docker compose up -d`.

## Services

- `postgres` (private network only)
- `redis` (private network only)
- `api`
- `worker`
- `web`
- `caddy` (public ingress + TLS)

## Secrets

- Store production secrets in VPS env files (`/srv/synqit/repo/infra/.env`, gitignored).
- The API refuses to start with `NODE_ENV=production` if `JWT_ACCESS_SECRET` or `TOKEN_ENC_KEY`
  is missing, a placeholder, or shorter than 32 characters. Generate values with
  `openssl rand -base64 48`.
- Rotate `JWT_ACCESS_SECRET`, `TOKEN_ENC_KEY`, `ADMIN_BOOTSTRAP_KEY`, and `METRICS_TOKEN` regularly.

### Rotation procedure

- `JWT_ACCESS_SECRET`: replace and redeploy. Access tokens are short-lived; sessions recover
  through the refresh flow, so users are not logged out.
- `TOKEN_ENC_KEY`: set `TOKEN_ENC_KEY_PREVIOUS` to the old value, `TOKEN_ENC_KEY` to the new one,
  redeploy. Stored provider tokens keep decrypting via the previous key and are re-encrypted with
  the new key as providers refresh them. Remove `TOKEN_ENC_KEY_PREVIOUS` after a full refresh
  cycle (Spotify tokens refresh hourly; allow a few days for inactive users).
- `ADMIN_BOOTSTRAP_KEY`: rotate or blank it; the route is disabled unless
  `ADMIN_BOOTSTRAP_ENABLED=true` and refuses to run once a super admin exists.

## Operational endpoints

- `/metrics` requires `Authorization: Bearer $METRICS_TOKEN` and is disabled in production until
  the token is set. `/docs` is off in production unless `API_DOCS_ENABLED=true`.
- Caddy returns 404 for `/api/metrics*` and `/api/docs*` regardless of API configuration.

## Reliability baseline

- Health checks for all long-running services.
- Daily DB backups and periodic restore test.

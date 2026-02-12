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

- Store production secrets in VPS env files.
- Rotate `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `TOKEN_ENC_KEY` regularly.

## Reliability baseline

- Health checks for all long-running services.
- Daily DB backups and periodic restore test.

# synqit

Playlist sync platform scaffold for the v1 scope.

## Monorepo layout

- `apps/api`: Fastify API (health, version, docs scaffold)
- `apps/worker`: BullMQ worker scaffold
- `apps/web`: React + Vite web shell
- `packages/shared`: shared Zod schemas/types/constants
- `infra`: Docker Compose + Caddy bootstrap
- `docs`: roadmap, scope, conventions, deployment plan

## Prerequisites

- Node.js 20 LTS
- Yarn 1.x (classic)
- Docker + Docker Compose (for infra stack)

## Getting started

```bash
yarn install
yarn dev
```

This starts:

- API on `http://localhost:3001`
- Web on `http://localhost:5173`
- Worker process connected to Redis URL in env

## Useful commands

```bash
yarn dev
yarn build
yarn lint
yarn format
yarn typecheck
```

## Environment files

Create env files from examples:

- `cp apps/api/.env.example apps/api/.env`
- `cp apps/worker/.env.example apps/worker/.env`
- `cp apps/web/.env.example apps/web/.env`

## Infra (early bootstrap)

```bash
cd infra
docker compose up -d
```

Services included:

- `postgres`
- `redis`
- `api`
- `worker`
- `web`
- `caddy`

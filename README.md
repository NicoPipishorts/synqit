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
yarn infra:up:core
yarn prisma:migrate:deploy
yarn dev
```

This starts:

- API on `http://localhost:3001`
- Web on `http://localhost:5173`
- Worker process connected to Redis URL in env

## Useful commands

```bash
yarn dev
yarn db:check
yarn prisma:pull
yarn prisma:generate
yarn prisma:studio
yarn prisma:migrate:status
yarn prisma:migrate:deploy
yarn infra:up
yarn infra:up:core
yarn infra:ps
yarn infra:down
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
yarn infra:up
```

Services included:

- `postgres`
- `redis`
- `api`
- `worker`
- `web`
- `caddy`

All infra services are grouped under the Compose project name `synqit`, so they stay isolated from other local Docker projects.

## Database (local)

The API now uses PostgreSQL for auth, integrations, and events.

### Start only DB + Redis

```bash
yarn infra:up:core
```

### API database config

- `apps/api/.env.local` (or `.env`) should contain:
- `DATABASE_URL=postgresql://synqit:synqit@localhost:5435/synqit`
- `REDIS_URL=redis://localhost:6380`
- `API_BASE_URL=http://localhost:3001`
- `AVATAR_STORAGE_DIR=./data/uploads/avatars`
- `AVATAR_MAX_BYTES=1500000`

On API startup, the API verifies DB connectivity.
Schema changes are managed by Prisma migrations (not runtime SQL bootstrap).

When running fully containerized (`yarn infra:up`), API and worker automatically use internal Docker service URLs (`postgres:5432`, `redis:6379`).

### Access DB from terminal

```bash
docker compose -f infra/docker-compose.yml exec postgres psql -U synqit -d synqit
```

Useful SQL:

```sql
\dt
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM integrations;
SELECT COUNT(*) FROM events;
SELECT COUNT(*) FROM event_tracks;
```

Quick count check via script:

```bash
yarn db:check
```

### Prisma

Prisma is installed in `apps/api` and introspected from the existing DB schema.

```bash
yarn prisma:migrate:status
yarn prisma:migrate:deploy
yarn prisma:pull
yarn prisma:generate
yarn prisma:studio
```

- Prisma schema: `apps/api/prisma/schema.prisma`
- Prisma config: `apps/api/prisma.config.ts` (loads `.env.local` first)
- New migration for avatars: `apps/api/prisma/migrations/0002_user_avatar_url`

### Avatar storage (VPS-friendly)

Avatar files are stored on disk (not S3), which works well on single-server VPS setups (Hostinger/OVH).

- DB stores avatar path on `users.avatar_url`.
- API serves files from `GET /v1/public/avatars/:fileName`.
- Profile upload/remove endpoints:
- `POST /v1/auth/avatar` with `{ "imageDataUrl": "data:image/...;base64,..." }`
- `DELETE /v1/auth/avatar`

For production, point `AVATAR_STORAGE_DIR` to a persistent folder outside ephemeral deploy paths, for example:

- `/var/www/synqit-data/avatars`

Then keep that directory mounted/preserved across deploys.

### Access DB from GUI (TablePlus, DBeaver, Postico)

GUI access from host machine:

1. Host: `localhost`
2. Port: `5435`
3. Database: `synqit`
4. User: `synqit`
5. Password: `synqit`

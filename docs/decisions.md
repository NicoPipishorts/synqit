# Locked Decisions

## Platform and runtime

- Monorepo with Yarn workspaces.
- Node.js `20 LTS` (recommended baseline).
- Docker-based deployment model.

## Backend

- Fastify + TypeScript.
- PostgreSQL as primary DB.
- Prisma as ORM for v1 speed.
- Redis + BullMQ for async sync jobs.
- JWT auth with access token + rotating refresh token.

## Frontend

- React + TypeScript + Vite.
- TanStack Router + TanStack Query.
- Shared validation/types from `packages/shared` using Zod.

## Infra

- Reverse proxy: Caddy.
- Production compose stack on VPS.
- Secrets in VPS env files (never committed).

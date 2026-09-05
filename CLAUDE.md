# Synqit

Cross-platform playlist sync and collaborative event playlists for Spotify and Apple Music.
Yarn 1 workspaces monorepo. Node 20. Architecture is a modular monolith plus a worker; do not
split domains into services (see `docs/architecture.md`).

## Layout

| Path              | What it is                                                                                                                   | Local port |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `apps/site`       | Marketing site + pricing page (React/Vite)                                                                                   | 4180       |
| `apps/web`        | Product app (React, TanStack Router/Query)                                                                                   | 5173       |
| `apps/admin`      | Back office (React/Vite)                                                                                                     | 4174       |
| `apps/api`        | Fastify + Prisma + PostgreSQL. Domains: `auth`, `integrations`, `events`, `syncs`, `admin`, `analytics`, `dashboard`, `jobs` | 3001       |
| `apps/worker`     | BullMQ worker (email notifications today; sync jobs planned)                                                                 | —          |
| `packages/shared` | Zod schemas, shared types, queue names. Build it before api/web: `yarn build:shared`                                         | —          |

## Everyday commands

```bash
yarn infra:up:local          # Postgres on 127.0.0.1:5435 + Redis on 6380 (matches apps/api/.env)
yarn prisma:migrate:deploy   # apply migrations to the local DB
yarn dev                     # everything; or dev:api / dev:web / dev:admin / dev:site / dev:worker
yarn typecheck               # all workspaces
yarn lint
yarn i18n:check              # en/fr locale parity, run after any copy change in apps/web
yarn test:api:regression     # needs the DB up + migrated
yarn test:web:e2e            # Playwright smoke test
```

## Gotchas (learned the hard way)

- Use `infra:up:local`, not `infra:up:core`. `core` starts the containers without host port
  mappings, so tests fail with `ECONNREFUSED 127.0.0.1:5435`.
- `prisma migrate dev` refuses to run non-interactively when a change drops data. Use
  `prisma migrate diff` to generate SQL, write the migration file by hand, then `migrate deploy`.
- An empty directory under `apps/api/prisma/migrations/` breaks `migrate deploy` (P3015). Git does
  not track empty dirs, so this only shows up locally; delete the directory.
- Secrets are validated at startup (`apps/api/src/config.ts`, shared helpers in
  `packages/shared/src/env.ts`). Missing `JWT_ACCESS_SECRET`, `TOKEN_ENC_KEY`, or `DATABASE_URL` is
  always fatal; placeholder or short values are fatal with `NODE_ENV=production` or
  `SECRETS_STRICT=true` and only warn in dev. `.env` is loaded by `apps/api/src/env.ts`, which must
  stay the first import of `index.ts`.
- Schema changes go through Prisma migrations only. CI runs `yarn workspace @synqit/api prisma:drift`
  and fails if `schema.prisma` and the migrations disagree, so add `@@index` lines for any index a
  migration creates.
- macOS Finder "copy" artefacts (`Something 2.tsx`) and `.DS_Store` files must not be committed.

## Branch flow

- `main` is production. A push to `main` runs CI, builds Docker images, and deploys to the VPS
  over SSH. Never commit directly to `main`.
- `dev` is the integration branch. Feature work goes on `feat/*` branches off `dev`.
- PRs go `feat/* -> dev` and `dev -> main`. CI tests run on PRs to `dev` and `main`; build and
  deploy run only on pushes to `main`. Still run `yarn typecheck` and `yarn test:api:regression`
  locally before opening a PR.
- Use the `/ship` skill to land the working tree.

## Conventions

- API routes live under `/v1`. Error body shape is `{ code, message, details? }`.
- Request/response contracts are Zod schemas in `packages/shared/src/index.ts`; add them there
  first, then use them in both api and web.
- DB: snake_case tables/columns, `@db.Timestamptz(6)`, UUID ids. Schema changes only via Prisma
  migrations, never at runtime.
- Web copy is translated: every string goes in `apps/web/src/locales/{en,fr}/common.json`.
- Sync UX stays one-way in the frontend even though the backend supports bidirectional.

## Docs to read first

- `docs/progress-checklist.md` — done vs pending tracker. Tick it when a feature lands.
- `docs/user-stories-by-priority.md` — security and scale hardening backlog (P0–P3).
- `docs/roadmap.md`, `docs/architecture.md` — where the product and backend are heading.
- `docs/billing-entitlements.md`, `docs/pricing-and-positioning.md` — monetization spec (no code yet).

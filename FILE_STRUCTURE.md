# Synqit File Structure

This file shows the main project layout and where core responsibilities live.

```text
synqit/
|-- apps/
|   |-- web/                     # Frontend (React + Vite + TanStack Router)
|   |   |-- src/
|   |   |   |-- pages/           # Route pages (auth, dashboard, profile, events)
|   |   |   |-- components/      # UI and marketing components
|   |   |   |-- hooks/           # App hooks (auth session, i18n, toast, theme)
|   |   |   |-- lib/             # API client, auth storage, i18n/theme utilities
|   |   |   |-- locales/         # Translations (en, fr)
|   |   |   |-- styles.css       # Global styles / design tokens usage
|   |   |   |-- App.tsx          # Route tree and app shell wiring
|   |   |   `-- main.tsx         # App entrypoint
|   |   |-- public/assets/       # Static logos, flags, provider icons
|   |   |-- scripts/             # Frontend utility scripts
|   |   `-- package.json
|   |
|   |-- api/                     # Backend API (Fastify + Prisma + PostgreSQL)
|   |   |-- src/
|   |   |   |-- auth/            # Auth, tokens, avatars, profile endpoints
|   |   |   |-- integrations/    # Provider OAuth + token refresh logic
|   |   |   |-- events/          # Event and track domain endpoints
|   |   |   |-- db/              # DB init + Prisma client bootstrap
|   |   |   |-- index.ts         # API bootstrap and route registration
|   |   |   `-- regression.test.ts
|   |   |-- prisma/
|   |   |   |-- schema.prisma
|   |   |   `-- migrations/      # SQL migrations (baseline + incremental changes)
|   |   |-- scripts/             # DB checks and maintenance helpers
|   |   `-- package.json
|   |
|   `-- worker/                  # Background worker app
|       `-- src/index.ts
|
|-- packages/
|   `-- shared/                  # Shared contracts/types (zod schemas + TS types)
|       `-- src/index.ts
|
|-- docs/                        # Product, architecture, roadmap, QA, conventions
|-- infra/                       # Local infra files (Docker Compose, Caddy)
|-- .env.example                 # Root environment template
|-- package.json                 # Workspace scripts and dependencies
|-- tsconfig.base.json           # Shared TypeScript config
`-- README.md                    # Setup and project overview
```

## Notes

- Database model changes are defined in `apps/api/prisma/schema.prisma` and versioned in `apps/api/prisma/migrations/`.
- API request/response shapes shared with web live in `packages/shared/src/index.ts`.
- UI-wide CTA styling lives in `apps/web/src/components/ui/cta.ts`.

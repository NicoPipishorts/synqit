# synqit

Playlist sync platform scaffold for the v1 scope.

Synqit is a monorepo containing the API, web application, background
workers, shared libraries, and infrastructure configuration required to
run the platform.

---

# Monorepo layout

    apps/
      api/        Fastify API
      worker/     background queue workers
      web/        React + Vite web application

    packages/
      shared/     shared schemas, types, and constants

    infra/
      container orchestration and reverse proxy configuration

    docs/
      roadmap, scope, conventions, deployment plan

---

# Prerequisites

The project requires the following tools:

- Node.js 20 LTS
- Yarn 1.x (classic)
- Docker
- Docker Compose

Optional but recommended:

- TablePlus / DBeaver / Postico for database inspection
- Node.js version manager (nvm, fnm, asdf)

---

# Getting started

Install dependencies:

```bash
yarn install
```

Start core infrastructure services (database + redis):

```bash
yarn infra:up:core
```

Run database migrations:

```bash
yarn prisma:migrate:deploy
```

Start the development environment:

```bash
yarn dev
```

This launches the development stack including:

- API server
- Web frontend
- Background worker

---

# Useful commands

Development

```bash
yarn dev
```

Database utilities

```bash
yarn db:check
yarn prisma:pull
yarn prisma:generate
yarn prisma:studio
yarn prisma:migrate:status
yarn prisma:migrate:deploy
```

Infrastructure

```bash
yarn infra:up
yarn infra:up:core
yarn infra:ps
yarn infra:down
```

Project maintenance

```bash
yarn build
yarn lint
yarn format
yarn typecheck
```

---

# Environment configuration

Create local environment files from the provided templates.

```bash
cp apps/api/.env.example apps/api/.env
cp apps/worker/.env.example apps/worker/.env
cp apps/web/.env.example apps/web/.env
```

Environment files contain runtime configuration such as:

- database connection
- redis connection
- API base URL
- storage paths
- feature configuration

**Never commit populated `.env` files or production secrets to version
control.**

---

# Infrastructure

The project includes a containerized development environment.

Start the full stack:

```bash
yarn infra:up
```

The development infrastructure includes:

- PostgreSQL
- Redis
- API service
- Worker service
- Web service
- Reverse proxy

Services run within a dedicated compose project to avoid conflicts with
other local Docker environments.

---

# Database

The application uses PostgreSQL as its primary datastore.

Core entities include:

- users
- integrations
- events
- event tracks

---

## Starting only core services

For local development you can start only the required services:

```bash
yarn infra:up:core
```

This starts:

- PostgreSQL
- Redis

---

## Database configuration

Database configuration is provided through environment variables.

Typical variables include:

- DATABASE_URL
- REDIS_URL
- API_BASE_URL

The API validates database connectivity during startup.

Schema changes are handled using Prisma migrations rather than runtime
schema creation.

---

# Prisma

Prisma is used for database access and migrations.

Common commands:

```bash
yarn prisma:migrate:status
yarn prisma:migrate:deploy
yarn prisma:pull
yarn prisma:generate
yarn prisma:studio
```

Project files:

    apps/api/prisma/schema.prisma
    apps/api/prisma.config.ts

---

# Accessing the database from terminal

You can connect to the running database container:

```bash
docker compose -f infra/docker-compose.yml exec postgres psql -U <user> -d <database>
```

Useful SQL commands:

```sql
\dt
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM integrations;
SELECT COUNT(*) FROM events;
SELECT COUNT(*) FROM event_tracks;
```

Quick check script:

```bash
yarn db:check
```

---

# Avatar storage

User avatars are stored on disk.

The database stores the avatar file reference and the API serves the
file through a public endpoint.

Avatar upload and removal are handled through authenticated API routes.

For production environments, the avatar storage directory should:

- be outside ephemeral deploy directories
- be persisted across deployments
- have appropriate filesystem permissions

---

# Accessing the database from a GUI

You can inspect the database using a GUI client such as:

- TablePlus
- DBeaver
- Postico

Connection settings should match the values defined in your local
environment configuration.

Typical fields:

Host: localhost\
Port: `<postgres_port>`{=html}\
Database: `<database_name>`{=html}\
User: `<database_user>`{=html}\
Password: `<database_password>`{=html}

---

# Documentation

Additional documentation is available in the `docs` folder:

- product roadmap
- architecture notes
- deployment plan
- development conventions

---

# License

This project is currently under private development.

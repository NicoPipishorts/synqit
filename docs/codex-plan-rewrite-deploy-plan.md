# Rewrite `deploy-plan.md` into a beginner OVH VPS runbook (Ubuntu 25.04)

## Summary

Create one canonical, copy-paste friendly deployment runbook for non-DevOps users by fully rewriting `docs/deploy-plan.md` with phased, validated steps for an OVH Ubuntu 25.04 (8GB) server. Keep scope to secure manual production deploy first, and avoid CI/CD automation in this pass.

## Files to change

1. [docs/deploy-plan.md](/Users/nicolaspisar/Sites/_Personal/synqit/docs/deploy-plan.md)
2. [docs/vps-deploy-ubuntu24.md](/Users/nicolaspisar/Sites/_Personal/synqit/docs/vps-deploy-ubuntu24.md)
3. [README.md](/Users/nicolaspisar/Sites/_Personal/synqit/README.md)

## Public Interfaces / Types

1. No runtime API/interface/type changes.
2. Documentation contract change: `docs/deploy-plan.md` becomes the canonical VPS setup guide.
3. Operational config contract documented explicitly:
   `apps/api/.env`, `apps/worker/.env`, `apps/web/.env`, `infra/Caddyfile`, and `infra/docker-compose.yml` production edits.

## Detailed Implementation Plan

### 1) Replace `docs/deploy-plan.md` with a full phased runbook

1. Add a short intro: target audience, OVH Ubuntu 25.04 target, and a caution that 25.04 is non-LTS (recommend 24.04 LTS for long-term stability, but keep commands targeting 25.04).
2. Use a single-domain architecture as default: `app.yourdomain.com` with API routed through `/api/*` in Caddy.
3. Add strict “before you begin” safety rules: keep one SSH session open, use key auth only, never continue when validation fails.
4. Add Phase 0 (local preflight): verify tests, gather secrets, set DNS, update Spotify/Apple callbacks to `https://app.yourdomain.com/api/v1/...`.
5. Add Phase 1 (OVH control panel): create Ubuntu 25.04 VPS, attach SSH key, configure OVH firewall to allow only TCP `22`, `80`, `443`.
6. Add Phase 2 (Ubuntu hardening): system updates, timezone/time sync, deploy user creation, SSH hardening, UFW, Fail2ban, unattended upgrades, and validation commands after each step.
7. Add Phase 3 (runtime install): Docker Engine + Compose plugin, Node 20, Corepack, Yarn 1.22.22, and version checks.
8. Add Phase 4 (app bootstrap): clone repo to `/opt/synqit`, create production env files, set file permissions, create persistent directories for avatars/backups.
9. Add explicit web build correctness step: create `apps/web/.env` with `VITE_API_URL=/api` so Vite compile-time config is correct in Docker builds.
10. Add infra production edits section:
    set Caddy site block to real domain;
    bind Postgres/Redis ports to loopback only (`127.0.0.1:5435:5432`, `127.0.0.1:6380:6379`).
11. Add first manual deploy commands:
    `docker compose up -d --build`,
    `docker compose ps`,
    `yarn install --frozen-lockfile`,
    `yarn build:shared`,
    `yarn workspace @synqit/api prisma:migrate:deploy`.
12. Add smoke-test section with exact checks:
    `curl` local health/version,
    browser HTTPS check,
    container health check,
    public port audit (`ss -tulpn` confirms only 22/80/443 public).
13. Add Phase 5 operations baseline:
    daily Postgres backup with retention cleanup,
    restore drill instructions on throwaway DB,
    simple manual rollback commands to previous commit.
14. End with “done means” checklist and a “next phase” note that CI/CD automation is intentionally out of scope for this doc version.

### 2) Deprecate old Ubuntu 24 runbook

1. Keep `docs/vps-deploy-ubuntu24.md` but add a prominent top notice:
   “Superseded by `docs/deploy-plan.md`”.
2. Keep historical content below the notice to avoid broken references.

### 3) Improve discoverability in README

1. Add a direct documentation pointer in `README.md` to the canonical VPS runbook path.
2. Make wording explicit for non-DevOps readers (“Step-by-step VPS setup guide”).

## Test Cases / Validation Scenarios

1. Content validation: all commands in new `deploy-plan.md` are syntactically valid for Ubuntu 25.04 and align with existing repo scripts/paths.
2. Consistency validation: env variable names in the guide match `apps/api/.env.example`, `apps/worker/.env.example`, and `apps/web/.env.example`.
3. Infra validation: Caddy route examples match current `/api/*` reverse proxy model and API endpoints (`/healthz`, `/v1/version`).
4. Security validation: guide includes both OVH firewall and UFW checks, with expected final open ports only `22/80/443`.
5. Operational validation: backup and restore steps are both present (not backup-only), with retention behavior documented.
6. Discoverability validation: README contains direct link/reference to the canonical guide.
7. De-duplication validation: old `vps-deploy-ubuntu24.md` clearly marked deprecated to prevent split source-of-truth.

## Assumptions and Defaults Chosen

1. Single canonical doc lives in `docs/deploy-plan.md`.
2. Target OS is Ubuntu 25.04 on OVH, with explicit non-LTS caution.
3. Scope is secure manual production deploy first (no CI/CD implementation in this pass).
4. Guide includes OVH control-panel firewall steps plus Ubuntu UFW.
5. URL pattern is single domain with `/api` path routing.
6. Existing `docs/vps-deploy-ubuntu24.md` remains but is deprecated.
7. README will include a direct link to the new step-by-step guide.

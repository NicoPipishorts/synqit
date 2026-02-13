import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

type LegacyAuthStore = {
  users?: Array<{
    id: string;
    email: string;
    passwordHash: string;
    createdAt: string;
  }>;
  refreshTokens?: Array<{
    id: string;
    userId: string;
    tokenHash: string;
    createdAt: string;
    expiresAt: string;
    revokedAt: string | null;
    replacedByTokenId: string | null;
  }>;
};

type LegacyIntegrationStore = {
  integrations?: Array<{
    id: string;
    userId: string;
    provider: string;
    accessToken: {
      iv: string;
      ciphertext: string;
      authTag: string;
    };
    refreshToken: {
      iv: string;
      ciphertext: string;
      authTag: string;
    };
    scopes: string[];
    expiresAt: string | null;
    lastRefreshAt: string | null;
    lastError: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
  oauthStates?: Array<{
    id: string;
    state: string;
    userId: string;
    provider: string;
    createdAt: string;
    expiresAt: string;
  }>;
};

type LegacyEventsStore = {
  events?: Array<{
    id: string;
    hostUserId: string;
    provider: string;
    providerPlaylistId: string;
    status: string;
    name: string;
    description: string;
    magicLinkToken: string;
    magicLinkRevokedAt?: string | null;
    createdAt: string;
    updatedAt: string;
    closedAt: string | null;
    tracks?: Array<{
      providerTrackId: string;
      name: string;
      artist: string;
      album: string;
      durationMs: number;
      artworkUrl: string | null;
      addedAt: string;
      addedBy: string;
    }>;
  }>;
};

const DEFAULT_DATABASE_URL = 'postgresql://synqit:synqit@localhost:5435/synqit';
const pool = new Pool({
  connectionString: process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL,
});

const readJsonFile = <T>(paths: string[]): T | null => {
  for (const nextPath of paths) {
    if (!existsSync(nextPath)) {
      continue;
    }

    try {
      return JSON.parse(readFileSync(nextPath, 'utf8')) as T;
    } catch {
      return null;
    }
  }

  return null;
};

const buildCandidateStorePaths = (params: {
  envValue: string | undefined;
  defaultPath: string;
}): string[] => {
  const explicitPath = resolve(process.cwd(), params.envValue ?? params.defaultPath);
  const defaultPath = resolve(process.cwd(), params.defaultPath);
  const legacyPath = resolve(
    process.cwd(),
    params.defaultPath.replace('apps/api/data', 'apps/api/apps/api/data'),
  );
  return Array.from(new Set([explicitPath, defaultPath, legacyPath]));
};

const ensureSchema = async (): Promise<void> => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL
    );

    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      revoked_at TIMESTAMPTZ NULL,
      replaced_by_token_id TEXT NULL
    );

    CREATE TABLE IF NOT EXISTS integrations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      access_token_json JSONB NOT NULL,
      refresh_token_json JSONB NOT NULL,
      scopes TEXT[] NOT NULL DEFAULT '{}',
      expires_at TIMESTAMPTZ NULL,
      last_refresh_at TIMESTAMPTZ NULL,
      last_error TEXT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL,
      UNIQUE (user_id, provider)
    );

    CREATE TABLE IF NOT EXISTS oauth_states (
      id TEXT PRIMARY KEY,
      state TEXT NOT NULL UNIQUE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL
    );

    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      host_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      provider_playlist_id TEXT NOT NULL,
      status TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      magic_link_token TEXT NOT NULL UNIQUE,
      magic_link_revoked_at TIMESTAMPTZ NULL,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL,
      closed_at TIMESTAMPTZ NULL
    );

    CREATE TABLE IF NOT EXISTS event_tracks (
      id BIGSERIAL PRIMARY KEY,
      event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      provider_track_id TEXT NOT NULL,
      name TEXT NOT NULL,
      artist TEXT NOT NULL,
      album TEXT NOT NULL,
      duration_ms INTEGER NOT NULL,
      artwork_url TEXT NULL,
      added_at TIMESTAMPTZ NOT NULL,
      added_by TEXT NOT NULL,
      UNIQUE (event_id, provider_track_id)
    );

    CREATE INDEX IF NOT EXISTS idx_events_host_user_id ON events(host_user_id);
    CREATE INDEX IF NOT EXISTS idx_event_tracks_event_id ON event_tracks(event_id);
    CREATE INDEX IF NOT EXISTS idx_integrations_user_id_provider ON integrations(user_id, provider);
  `);
};

const importLegacyAuthStore = async (): Promise<void> => {
  const existing = await pool.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM users');
  if (Number(existing.rows[0]?.count ?? '0') > 0) {
    return;
  }

  const legacy = readJsonFile<LegacyAuthStore>(
    buildCandidateStorePaths({
      envValue: process.env.AUTH_STORE_FILE,
      defaultPath: 'apps/api/data/auth-store.json',
    }),
  );
  if (!legacy) {
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const user of legacy.users ?? []) {
      await client.query(
        `
          INSERT INTO users (id, email, password_hash, created_at)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (id) DO NOTHING
        `,
        [user.id, user.email, user.passwordHash, user.createdAt],
      );
    }

    for (const token of legacy.refreshTokens ?? []) {
      await client.query(
        `
          INSERT INTO refresh_tokens (
            id,
            user_id,
            token_hash,
            created_at,
            expires_at,
            revoked_at,
            replaced_by_token_id
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (id) DO NOTHING
        `,
        [
          token.id,
          token.userId,
          token.tokenHash,
          token.createdAt,
          token.expiresAt,
          token.revokedAt,
          token.replacedByTokenId,
        ],
      );
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const importLegacyIntegrationsStore = async (): Promise<void> => {
  const existing = await pool.query<{ count: string }>(
    'SELECT COUNT(*)::text AS count FROM integrations',
  );
  if (Number(existing.rows[0]?.count ?? '0') > 0) {
    return;
  }

  const legacy = readJsonFile<LegacyIntegrationStore>(
    buildCandidateStorePaths({
      envValue: process.env.INTEGRATION_STORE_FILE,
      defaultPath: 'apps/api/data/integrations-store.json',
    }),
  );
  if (!legacy) {
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const integration of legacy.integrations ?? []) {
      await client.query(
        `
          INSERT INTO integrations (
            id,
            user_id,
            provider,
            access_token_json,
            refresh_token_json,
            scopes,
            expires_at,
            last_refresh_at,
            last_error,
            created_at,
            updated_at
          )
          VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7, $8, $9, $10, $11)
          ON CONFLICT (id) DO NOTHING
        `,
        [
          integration.id,
          integration.userId,
          integration.provider,
          JSON.stringify(integration.accessToken),
          JSON.stringify(integration.refreshToken),
          integration.scopes ?? [],
          integration.expiresAt,
          integration.lastRefreshAt,
          integration.lastError,
          integration.createdAt,
          integration.updatedAt,
        ],
      );
    }

    for (const oauthState of legacy.oauthStates ?? []) {
      await client.query(
        `
          INSERT INTO oauth_states (id, state, user_id, provider, created_at, expires_at)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (id) DO NOTHING
        `,
        [
          oauthState.id,
          oauthState.state,
          oauthState.userId,
          oauthState.provider,
          oauthState.createdAt,
          oauthState.expiresAt,
        ],
      );
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const importLegacyEventsStore = async (): Promise<void> => {
  const existing = await pool.query<{ count: string }>(
    'SELECT COUNT(*)::text AS count FROM events',
  );
  if (Number(existing.rows[0]?.count ?? '0') > 0) {
    return;
  }

  const legacy = readJsonFile<LegacyEventsStore>(
    buildCandidateStorePaths({
      envValue: process.env.EVENTS_STORE_FILE,
      defaultPath: 'apps/api/data/events-store.json',
    }),
  );
  if (!legacy) {
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const event of legacy.events ?? []) {
      await client.query(
        `
          INSERT INTO events (
            id,
            host_user_id,
            provider,
            provider_playlist_id,
            status,
            name,
            description,
            magic_link_token,
            magic_link_revoked_at,
            created_at,
            updated_at,
            closed_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          ON CONFLICT (id) DO NOTHING
        `,
        [
          event.id,
          event.hostUserId,
          event.provider,
          event.providerPlaylistId,
          event.status,
          event.name,
          event.description,
          event.magicLinkToken,
          event.magicLinkRevokedAt ?? null,
          event.createdAt,
          event.updatedAt,
          event.closedAt,
        ],
      );

      for (const track of event.tracks ?? []) {
        await client.query(
          `
            INSERT INTO event_tracks (
              event_id,
              provider_track_id,
              name,
              artist,
              album,
              duration_ms,
              artwork_url,
              added_at,
              added_by
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (event_id, provider_track_id) DO NOTHING
          `,
          [
            event.id,
            track.providerTrackId,
            track.name,
            track.artist,
            track.album,
            track.durationMs,
            track.artworkUrl,
            track.addedAt,
            track.addedBy,
          ],
        );
      }
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const bootstrapLegacyData = async (): Promise<void> => {
  await importLegacyAuthStore();
  await importLegacyIntegrationsStore();
  await importLegacyEventsStore();
};

let initializePromise: Promise<void> | null = null;

export const initializeDatabase = async (): Promise<void> => {
  if (!initializePromise) {
    initializePromise = (async () => {
      await ensureSchema();
      await bootstrapLegacyData();
    })();
  }

  await initializePromise;
};

export const query = async <TRow extends QueryResultRow = QueryResultRow>(
  text: string,
  values?: unknown[],
): Promise<QueryResult<TRow>> => pool.query<TRow>(text, values);

export const withTransaction = async <T>(fn: (client: PoolClient) => Promise<T>): Promise<T> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const closeDatabase = async (): Promise<void> => {
  await pool.end();
};

import { EventStatus, Provider } from '@synqit/shared';
import { randomBytes, randomUUID } from 'node:crypto';

import { query, withTransaction } from '../db';

type EventRecord = {
  id: string;
  hostUserId: string;
  provider: Provider;
  providerPlaylistId: string;
  status: EventStatus;
  name: string;
  description: string;
  magicLinkToken: string;
  magicLinkRevokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  closedAt: Date | null;
  tracks: EventTrackRecord[];
};

type EventTrackRecord = {
  providerTrackId: string;
  name: string;
  artist: string;
  album: string;
  durationMs: number;
  artworkUrl: string | null;
  addedAt: Date;
  addedBy: string;
};

type EventRow = {
  id: string;
  host_user_id: string;
  provider: Provider;
  provider_playlist_id: string;
  status: EventStatus;
  name: string;
  description: string;
  magic_link_token: string;
  magic_link_revoked_at: Date | null;
  created_at: Date;
  updated_at: Date;
  closed_at: Date | null;
};

type EventTrackRow = {
  provider_track_id: string;
  name: string;
  artist: string;
  album: string;
  duration_ms: number;
  artwork_url: string | null;
  added_at: Date;
  added_by: string;
};

const toEventTrackRecord = (row: EventTrackRow): EventTrackRecord => ({
  providerTrackId: row.provider_track_id,
  name: row.name,
  artist: row.artist,
  album: row.album,
  durationMs: row.duration_ms,
  artworkUrl: row.artwork_url,
  addedAt: new Date(row.added_at),
  addedBy: row.added_by,
});

const toEventRecord = (row: EventRow): EventRecord => ({
  id: row.id,
  hostUserId: row.host_user_id,
  provider: row.provider,
  providerPlaylistId: row.provider_playlist_id,
  status: row.status,
  name: row.name,
  description: row.description,
  magicLinkToken: row.magic_link_token,
  magicLinkRevokedAt: row.magic_link_revoked_at ? new Date(row.magic_link_revoked_at) : null,
  createdAt: new Date(row.created_at),
  updatedAt: new Date(row.updated_at),
  closedAt: row.closed_at ? new Date(row.closed_at) : null,
  tracks: [],
});

const mapRowsToEvents = (rows: EventRow[]): EventRecord[] => rows.map(toEventRecord);

const toEventWithTracks = async (event: EventRecord): Promise<EventRecord> => {
  const tracks = await eventsStore.listTracksByEventId(event.id);
  return {
    ...event,
    tracks,
  };
};

const generateMagicLinkToken = (): string => randomBytes(24).toString('base64url');

export const eventsStore = {
  async createEvent(params: {
    hostUserId: string;
    provider: Provider;
    providerPlaylistId: string;
    name: string;
    description: string;
  }): Promise<EventRecord> {
    const eventId = randomUUID();

    const result = await query<EventRow>(
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
        VALUES ($1, $2, $3, $4, 'open', $5, $6, $7, NULL, NOW(), NOW(), NULL)
        RETURNING
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
      `,
      [
        eventId,
        params.hostUserId,
        params.provider,
        params.providerPlaylistId,
        params.name,
        params.description,
        generateMagicLinkToken(),
      ],
    );

    return toEventWithTracks(toEventRecord(result.rows[0]));
  },

  async listEventsByHost(hostUserId: string): Promise<EventRecord[]> {
    const result = await query<EventRow>(
      `
        SELECT
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
        FROM events
        WHERE host_user_id = $1
        ORDER BY created_at DESC
      `,
      [hostUserId],
    );

    const baseEvents = mapRowsToEvents(result.rows);
    const eventsWithTracks = await Promise.all(baseEvents.map(toEventWithTracks));
    return eventsWithTracks;
  },

  async findEventById(eventId: string): Promise<EventRecord | null> {
    const result = await query<EventRow>(
      `
        SELECT
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
        FROM events
        WHERE id = $1
        LIMIT 1
      `,
      [eventId],
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return toEventWithTracks(toEventRecord(row));
  },

  async findEventByMagicLinkToken(magicLinkToken: string): Promise<EventRecord | null> {
    const result = await query<EventRow>(
      `
        SELECT
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
        FROM events
        WHERE magic_link_token = $1
        LIMIT 1
      `,
      [magicLinkToken],
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return toEventWithTracks(toEventRecord(row));
  },

  async listTracksByEventId(eventId: string): Promise<EventTrackRecord[]> {
    const result = await query<EventTrackRow>(
      `
        SELECT
          provider_track_id,
          name,
          artist,
          album,
          duration_ms,
          artwork_url,
          added_at,
          added_by
        FROM event_tracks
        WHERE event_id = $1
        ORDER BY added_at DESC
      `,
      [eventId],
    );

    return result.rows.map(toEventTrackRecord);
  },

  async hasTrack(params: { eventId: string; providerTrackId: string }): Promise<boolean> {
    const result = await query<{ exists: boolean }>(
      `
        SELECT EXISTS(
          SELECT 1
          FROM event_tracks
          WHERE event_id = $1 AND provider_track_id = $2
        ) AS exists
      `,
      [params.eventId, params.providerTrackId],
    );

    return Boolean(result.rows[0]?.exists);
  },

  async addTrackToEvent(params: {
    eventId: string;
    providerTrackId: string;
    name: string;
    artist: string;
    album: string;
    durationMs: number;
    artworkUrl: string | null;
    addedBy: string;
  }): Promise<EventTrackRecord | null> {
    return withTransaction(async (client) => {
      const insertResult = await client.query<EventTrackRow>(
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
          VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8)
          ON CONFLICT (event_id, provider_track_id) DO NOTHING
          RETURNING
            provider_track_id,
            name,
            artist,
            album,
            duration_ms,
            artwork_url,
            added_at,
            added_by
        `,
        [
          params.eventId,
          params.providerTrackId,
          params.name,
          params.artist,
          params.album,
          params.durationMs,
          params.artworkUrl,
          params.addedBy,
        ],
      );

      const insertedRow = insertResult.rows[0];
      if (!insertedRow) {
        return null;
      }

      await client.query(
        `
          UPDATE events
          SET updated_at = NOW()
          WHERE id = $1
        `,
        [params.eventId],
      );

      return toEventTrackRecord(insertedRow);
    });
  },

  async removeTrackFromEvent(params: {
    eventId: string;
    providerTrackId: string;
  }): Promise<EventTrackRecord | null> {
    return withTransaction(async (client) => {
      const removedResult = await client.query<EventTrackRow>(
        `
          DELETE FROM event_tracks
          WHERE event_id = $1 AND provider_track_id = $2
          RETURNING
            provider_track_id,
            name,
            artist,
            album,
            duration_ms,
            artwork_url,
            added_at,
            added_by
        `,
        [params.eventId, params.providerTrackId],
      );

      const removedRow = removedResult.rows[0];
      if (!removedRow) {
        return null;
      }

      await client.query(
        `
          UPDATE events
          SET updated_at = NOW()
          WHERE id = $1
        `,
        [params.eventId],
      );

      return toEventTrackRecord(removedRow);
    });
  },

  async closeEvent(params: { eventId: string; hostUserId: string }): Promise<EventRecord | null> {
    const existing = await query<EventRow>(
      `
        SELECT
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
        FROM events
        WHERE id = $1 AND host_user_id = $2
        LIMIT 1
      `,
      [params.eventId, params.hostUserId],
    );

    const existingRow = existing.rows[0];
    if (!existingRow) {
      return null;
    }

    if (existingRow.status === 'closed') {
      return toEventWithTracks(toEventRecord(existingRow));
    }

    const result = await query<EventRow>(
      `
        UPDATE events
        SET status = 'closed', closed_at = NOW(), updated_at = NOW()
        WHERE id = $1 AND host_user_id = $2
        RETURNING
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
      `,
      [params.eventId, params.hostUserId],
    );

    const row = result.rows[0];
    return row ? toEventWithTracks(toEventRecord(row)) : null;
  },

  async updateEvent(params: {
    eventId: string;
    hostUserId: string;
    name: string;
    description: string;
  }): Promise<EventRecord | null> {
    const result = await query<EventRow>(
      `
        UPDATE events
        SET name = $3, description = $4, updated_at = NOW()
        WHERE id = $1 AND host_user_id = $2
        RETURNING
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
      `,
      [params.eventId, params.hostUserId, params.name, params.description],
    );

    const row = result.rows[0];
    return row ? toEventWithTracks(toEventRecord(row)) : null;
  },

  async deleteEvent(params: { eventId: string; hostUserId: string }): Promise<boolean> {
    const result = await query<{ id: string }>(
      `
        DELETE FROM events
        WHERE id = $1 AND host_user_id = $2
        RETURNING id
      `,
      [params.eventId, params.hostUserId],
    );

    return result.rows.length > 0;
  },

  async revokeMagicLink(params: {
    eventId: string;
    hostUserId: string;
  }): Promise<EventRecord | null> {
    const result = await query<EventRow>(
      `
        UPDATE events
        SET magic_link_revoked_at = COALESCE(magic_link_revoked_at, NOW()), updated_at = NOW()
        WHERE id = $1 AND host_user_id = $2
        RETURNING
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
      `,
      [params.eventId, params.hostUserId],
    );

    const row = result.rows[0];
    return row ? toEventWithTracks(toEventRecord(row)) : null;
  },

  async regenerateMagicLink(params: {
    eventId: string;
    hostUserId: string;
  }): Promise<EventRecord | null> {
    const nextToken = generateMagicLinkToken();
    const result = await query<EventRow>(
      `
        UPDATE events
        SET magic_link_token = $3, magic_link_revoked_at = NULL, updated_at = NOW()
        WHERE id = $1 AND host_user_id = $2
        RETURNING
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
      `,
      [params.eventId, params.hostUserId, nextToken],
    );

    const row = result.rows[0];
    return row ? toEventWithTracks(toEventRecord(row)) : null;
  },
};

export type { EventRecord, EventTrackRecord };

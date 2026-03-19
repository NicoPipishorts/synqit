import {
  EventDraftStep,
  EventStatus,
  Provider,
  eventDraftStepSchema,
  eventStatusSchema,
  providerSchema,
} from '@synqit/shared';
import { randomBytes, randomUUID } from 'node:crypto';

import { prisma } from '../db/prisma';

type EventRecord = {
  id: string;
  hostUserId: string;
  provider: Provider;
  providerPlaylistId: string;
  status: EventStatus;
  name: string;
  description: string;
  coverImageUrl: string | null;
  magicLinkToken: string;
  magicLinkRevokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  closedAt: Date | null;
  tracks: EventTrackRecord[];
};

type EventDraftRecord = {
  id: string;
  hostUserId: string;
  provider: Provider | null;
  name: string;
  description: string;
  step: EventDraftStep;
  createdAt: Date;
  updatedAt: Date;
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
  provider: string;
  provider_playlist_id: string;
  status: string;
  name: string;
  description: string;
  cover_image_url: string | null;
  magic_link_token: string;
  magic_link_revoked_at: Date | null;
  created_at: Date;
  updated_at: Date;
  closed_at: Date | null;
};

type EventDraftRow = {
  id: string;
  host_user_id: string;
  provider: string | null;
  name: string;
  description: string;
  step: number;
  created_at: Date;
  updated_at: Date;
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
  provider: providerSchema.parse(row.provider),
  providerPlaylistId: row.provider_playlist_id,
  status: eventStatusSchema.parse(row.status),
  name: row.name,
  description: row.description,
  coverImageUrl: row.cover_image_url ?? null,
  magicLinkToken: row.magic_link_token,
  magicLinkRevokedAt: row.magic_link_revoked_at ? new Date(row.magic_link_revoked_at) : null,
  createdAt: new Date(row.created_at),
  updatedAt: new Date(row.updated_at),
  closedAt: row.closed_at ? new Date(row.closed_at) : null,
  tracks: [],
});

const toEventDraftRecord = (row: EventDraftRow): EventDraftRecord => ({
  id: row.id,
  hostUserId: row.host_user_id,
  provider: row.provider ? providerSchema.parse(row.provider) : null,
  name: row.name,
  description: row.description,
  step: eventDraftStepSchema.parse(row.step),
  createdAt: new Date(row.created_at),
  updatedAt: new Date(row.updated_at),
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

const isUniqueConstraintViolation = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') {
    return false;
  }

  return 'code' in error && (error as { code?: string }).code === 'P2002';
};

export const eventsStore = {
  async createEvent(params: {
    hostUserId: string;
    provider: Provider;
    providerPlaylistId: string;
    name: string;
    description: string;
  }): Promise<EventRecord> {
    const eventId = randomUUID();
    const now = new Date();

    const row = await prisma.events.create({
      data: {
        id: eventId,
        host_user_id: params.hostUserId,
        provider: params.provider,
        provider_playlist_id: params.providerPlaylistId,
        status: 'open',
        name: params.name,
        description: params.description,
        magic_link_token: generateMagicLinkToken(),
        magic_link_revoked_at: null,
        created_at: now,
        updated_at: now,
        closed_at: null,
      },
    });

    return toEventWithTracks(toEventRecord(row));
  },

  async createDraft(params: {
    hostUserId: string;
    provider: Provider | null;
    name: string;
    description: string;
    step: EventDraftStep;
  }): Promise<EventDraftRecord> {
    const now = new Date();
    const row = await prisma.eventDrafts.create({
      data: {
        id: randomUUID(),
        host_user_id: params.hostUserId,
        provider: params.provider,
        name: params.name,
        description: params.description,
        step: params.step,
        created_at: now,
        updated_at: now,
      },
      select: {
        id: true,
        host_user_id: true,
        provider: true,
        name: true,
        description: true,
        step: true,
        created_at: true,
        updated_at: true,
      },
    });

    return toEventDraftRecord(row);
  },

  async listDraftsByHost(hostUserId: string): Promise<EventDraftRecord[]> {
    const rows = await prisma.eventDrafts.findMany({
      where: {
        host_user_id: hostUserId,
      },
      orderBy: {
        updated_at: 'desc',
      },
      select: {
        id: true,
        host_user_id: true,
        provider: true,
        name: true,
        description: true,
        step: true,
        created_at: true,
        updated_at: true,
      },
    });

    return rows.map(toEventDraftRecord);
  },

  async findDraftById(params: {
    draftId: string;
    hostUserId: string;
  }): Promise<EventDraftRecord | null> {
    const row = await prisma.eventDrafts.findFirst({
      where: {
        id: params.draftId,
        host_user_id: params.hostUserId,
      },
      select: {
        id: true,
        host_user_id: true,
        provider: true,
        name: true,
        description: true,
        step: true,
        created_at: true,
        updated_at: true,
      },
    });
    if (!row) {
      return null;
    }

    return toEventDraftRecord(row);
  },

  async updateDraft(params: {
    draftId: string;
    hostUserId: string;
    provider?: Provider | null;
    name?: string;
    description?: string;
    step?: EventDraftStep;
  }): Promise<EventDraftRecord | null> {
    const existing = await prisma.eventDrafts.findFirst({
      where: {
        id: params.draftId,
        host_user_id: params.hostUserId,
      },
      select: {
        id: true,
      },
    });
    if (!existing) {
      return null;
    }

    const updated = await prisma.eventDrafts.update({
      where: { id: existing.id },
      data: {
        ...(params.provider !== undefined ? { provider: params.provider } : {}),
        ...(params.name !== undefined ? { name: params.name } : {}),
        ...(params.description !== undefined ? { description: params.description } : {}),
        ...(params.step !== undefined ? { step: params.step } : {}),
        updated_at: new Date(),
      },
      select: {
        id: true,
        host_user_id: true,
        provider: true,
        name: true,
        description: true,
        step: true,
        created_at: true,
        updated_at: true,
      },
    });

    return toEventDraftRecord(updated);
  },

  async deleteDraft(params: { draftId: string; hostUserId: string }): Promise<boolean> {
    const deleted = await prisma.eventDrafts.deleteMany({
      where: {
        id: params.draftId,
        host_user_id: params.hostUserId,
      },
    });

    return deleted.count > 0;
  },

  async listEventsByHost(hostUserId: string): Promise<EventRecord[]> {
    const rows = await prisma.events.findMany({
      where: {
        host_user_id: hostUserId,
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    const baseEvents = mapRowsToEvents(rows);
    const eventsWithTracks = await Promise.all(baseEvents.map(toEventWithTracks));
    return eventsWithTracks;
  },

  async findEventById(eventId: string): Promise<EventRecord | null> {
    const row = await prisma.events.findUnique({
      where: { id: eventId },
    });
    if (!row) {
      return null;
    }

    return toEventWithTracks(toEventRecord(row));
  },

  async findEventByMagicLinkToken(magicLinkToken: string): Promise<EventRecord | null> {
    const row = await prisma.events.findUnique({
      where: { magic_link_token: magicLinkToken },
    });
    if (!row) {
      return null;
    }

    return toEventWithTracks(toEventRecord(row));
  },

  async listTracksByEventId(eventId: string): Promise<EventTrackRecord[]> {
    const rows = await prisma.event_tracks.findMany({
      where: { event_id: eventId },
      orderBy: { added_at: 'desc' },
      select: {
        provider_track_id: true,
        name: true,
        artist: true,
        album: true,
        duration_ms: true,
        artwork_url: true,
        added_at: true,
        added_by: true,
      },
    });

    return rows.map(toEventTrackRecord);
  },

  async hasTrack(params: { eventId: string; providerTrackId: string }): Promise<boolean> {
    const existing = await prisma.event_tracks.findUnique({
      where: {
        event_id_provider_track_id: {
          event_id: params.eventId,
          provider_track_id: params.providerTrackId,
        },
      },
      select: {
        id: true,
      },
    });

    return Boolean(existing);
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
    return prisma.$transaction(async (tx) => {
      const now = new Date();
      let insertedRow: EventTrackRow | null = null;

      try {
        insertedRow = await tx.event_tracks.create({
          data: {
            event_id: params.eventId,
            provider_track_id: params.providerTrackId,
            name: params.name,
            artist: params.artist,
            album: params.album,
            duration_ms: params.durationMs,
            artwork_url: params.artworkUrl,
            added_at: now,
            added_by: params.addedBy,
          },
          select: {
            provider_track_id: true,
            name: true,
            artist: true,
            album: true,
            duration_ms: true,
            artwork_url: true,
            added_at: true,
            added_by: true,
          },
        });
      } catch (error) {
        if (isUniqueConstraintViolation(error)) {
          return null;
        }
        throw error;
      }

      if (!insertedRow) {
        return null;
      }

      await tx.events.update({
        where: { id: params.eventId },
        data: {
          updated_at: now,
        },
      });

      return toEventTrackRecord(insertedRow);
    });
  },

  async removeTrackFromEvent(params: {
    eventId: string;
    providerTrackId: string;
  }): Promise<EventTrackRecord | null> {
    return prisma.$transaction(async (tx) => {
      const removedRow = await tx.event_tracks.findUnique({
        where: {
          event_id_provider_track_id: {
            event_id: params.eventId,
            provider_track_id: params.providerTrackId,
          },
        },
        select: {
          provider_track_id: true,
          name: true,
          artist: true,
          album: true,
          duration_ms: true,
          artwork_url: true,
          added_at: true,
          added_by: true,
        },
      });
      if (!removedRow) {
        return null;
      }

      const deleted = await tx.event_tracks.deleteMany({
        where: {
          event_id: params.eventId,
          provider_track_id: params.providerTrackId,
        },
      });
      if (deleted.count !== 1) {
        return null;
      }

      await tx.events.update({
        where: { id: params.eventId },
        data: {
          updated_at: new Date(),
        },
      });

      return toEventTrackRecord(removedRow);
    });
  },

  async closeEvent(params: { eventId: string; hostUserId: string }): Promise<EventRecord | null> {
    const existingRow = await prisma.events.findFirst({
      where: {
        id: params.eventId,
        host_user_id: params.hostUserId,
      },
    });

    if (!existingRow) {
      return null;
    }

    if (existingRow.status === 'closed') {
      return toEventWithTracks(toEventRecord(existingRow));
    }

    const now = new Date();
    const updated = await prisma.events.update({
      where: { id: existingRow.id },
      data: {
        status: 'closed',
        closed_at: now,
        updated_at: now,
      },
    });

    return toEventWithTracks(toEventRecord(updated));
  },

  async reopenEvent(params: { eventId: string; hostUserId: string }): Promise<EventRecord | null> {
    const existingRow = await prisma.events.findFirst({
      where: {
        id: params.eventId,
        host_user_id: params.hostUserId,
      },
    });

    if (!existingRow) {
      return null;
    }

    if (existingRow.status === 'open') {
      return toEventWithTracks(toEventRecord(existingRow));
    }

    const updated = await prisma.events.update({
      where: { id: existingRow.id },
      data: {
        status: 'open',
        closed_at: null,
        updated_at: new Date(),
      },
    });

    return toEventWithTracks(toEventRecord(updated));
  },

  async updateEvent(params: {
    eventId: string;
    hostUserId: string;
    name: string;
    description: string;
  }): Promise<EventRecord | null> {
    const existing = await prisma.events.findFirst({
      where: {
        id: params.eventId,
        host_user_id: params.hostUserId,
      },
      select: {
        id: true,
      },
    });
    if (!existing) {
      return null;
    }

    const updated = await prisma.events.update({
      where: { id: existing.id },
      data: {
        name: params.name,
        description: params.description,
        updated_at: new Date(),
      },
    });

    return toEventWithTracks(toEventRecord(updated));
  },

  async deleteEvent(params: { eventId: string; hostUserId: string }): Promise<boolean> {
    const result = await prisma.events.deleteMany({
      where: {
        id: params.eventId,
        host_user_id: params.hostUserId,
      },
    });

    return result.count > 0;
  },

  async revokeMagicLink(params: {
    eventId: string;
    hostUserId: string;
  }): Promise<EventRecord | null> {
    const existing = await prisma.events.findFirst({
      where: {
        id: params.eventId,
        host_user_id: params.hostUserId,
      },
    });
    if (!existing) {
      return null;
    }

    const updated = await prisma.events.update({
      where: { id: existing.id },
      data: {
        magic_link_revoked_at: existing.magic_link_revoked_at ?? new Date(),
        updated_at: new Date(),
      },
    });

    return toEventWithTracks(toEventRecord(updated));
  },

  async updateEventCoverImage(params: {
    eventId: string;
    hostUserId: string;
    coverImageUrl: string | null;
  }): Promise<EventRecord | null> {
    const existing = await prisma.events.findFirst({
      where: { id: params.eventId, host_user_id: params.hostUserId },
      select: { id: true },
    });
    if (!existing) return null;

    const updated = await prisma.events.update({
      where: { id: existing.id },
      data: { cover_image_url: params.coverImageUrl, updated_at: new Date() },
    });

    return toEventWithTracks(toEventRecord(updated));
  },

  async regenerateMagicLink(params: {
    eventId: string;
    hostUserId: string;
  }): Promise<EventRecord | null> {
    const nextToken = generateMagicLinkToken();
    const existing = await prisma.events.findFirst({
      where: {
        id: params.eventId,
        host_user_id: params.hostUserId,
      },
      select: {
        id: true,
      },
    });
    if (!existing) {
      return null;
    }

    const updated = await prisma.events.update({
      where: { id: existing.id },
      data: {
        magic_link_token: nextToken,
        magic_link_revoked_at: null,
        updated_at: new Date(),
      },
    });

    return toEventWithTracks(toEventRecord(updated));
  },
};

export type { EventDraftRecord, EventRecord, EventTrackRecord };

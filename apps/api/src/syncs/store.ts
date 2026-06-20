import { Provider, providerSchema, syncModeSchema, type SyncMode } from '@synqit/shared';
import { randomBytes, randomUUID } from 'node:crypto';

import { buildTrackFingerprint, buildTrackIdentityKey } from './track-fingerprint';
import { prisma } from '../db/prisma';
import type { Prisma } from '../generated/prisma/client';

export type SyncRecord = {
  id: string;
  senderUserId: string;
  provider: Provider;
  providerPlaylistId: string;
  name: string;
  trackCount: number | null;
  syncMode: SyncMode;
  autoSyncEnabled: boolean;
  nextPollAt: Date | null;
  unchangedPollStreak: number;
  lastSourceSnapshotId: string | null;
  lastSourceFingerprint: string | null;
  lastPolledAt: Date | null;
  lastSyncedAt: Date | null;
  lastError: string | null;
  magicLinkToken: string;
  magicLinkRevokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type SyncImportRecord = {
  id: string;
  syncId: string;
  recipientUserId: string;
  recipientProvider: Provider;
  recipientProviderPlaylistId: string | null;
  lastRecipientSnapshotId: string | null;
  syncedSourceTrackFingerprints: string[];
  syncedRecipientTrackFingerprints: string[];
  status: string;
  matchedCount: number | null;
  skippedCount: number | null;
  lastSyncedAt: Date | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type SyncWithImportsRecord = SyncRecord & {
  imports: SyncImportRecord[];
};

export type SyncTrackActivityRecord = {
  id: string;
  syncId: string;
  trackFingerprint: string;
  providerTrackId: string;
  name: string;
  artist: string;
  album: string;
  artworkUrl: string | null;
  firstSeenAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type RecentSyncSubscriberRecord = {
  syncId: string;
  recipientUserId: string;
  name: string;
  subscribedAt: Date;
};

export type TopSubscriberRecord = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  subscriptionCount: number;
  latestSubscribedAt: Date;
};

type SyncTrackActivityTrack = {
  providerTrackId?: string | null;
  name: string;
  artist: string;
  album?: string | null;
  artworkUrl?: string | null;
  durationMs?: number;
};

type SyncRow = {
  id: string;
  sender_user_id: string;
  provider: string;
  provider_playlist_id: string;
  name: string;
  track_count: number | null;
  sync_mode: string;
  auto_sync_enabled: boolean;
  next_poll_at: Date | null;
  unchanged_poll_streak: number;
  last_source_snapshot_id: string | null;
  last_source_fingerprint: string | null;
  last_polled_at: Date | null;
  last_synced_at: Date | null;
  last_error: string | null;
  magic_link_token: string;
  magic_link_revoked_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

type SyncImportRow = {
  id: string;
  sync_id: string;
  recipient_user_id: string;
  recipient_provider: string;
  recipient_provider_playlist_id: string | null;
  last_recipient_snapshot_id: string | null;
  synced_source_track_fingerprints: string[];
  synced_recipient_track_fingerprints: string[];
  status: string;
  matched_count: number | null;
  skipped_count: number | null;
  last_synced_at: Date | null;
  last_error: string | null;
  created_at: Date;
  updated_at: Date;
};

type SyncWithImportsRow = SyncRow & {
  playlist_sync_imports: SyncImportRow[];
};

type ImportWithSyncRow = SyncImportRow & {
  playlist_syncs: SyncRow;
};

type SyncTrackActivityRow = {
  id: string;
  sync_id: string;
  track_fingerprint: string;
  provider_track_id: string;
  name: string;
  artist: string;
  album: string;
  artwork_url: string | null;
  first_seen_at: Date;
  created_at: Date;
  updated_at: Date;
};

const mapSyncRow = (row: SyncRow): SyncRecord => ({
  id: row.id,
  senderUserId: row.sender_user_id,
  provider: providerSchema.parse(row.provider),
  providerPlaylistId: row.provider_playlist_id,
  name: row.name,
  trackCount: row.track_count,
  syncMode: syncModeSchema.parse(row.sync_mode),
  autoSyncEnabled: row.auto_sync_enabled,
  nextPollAt: row.next_poll_at,
  unchangedPollStreak: row.unchanged_poll_streak,
  lastSourceSnapshotId: row.last_source_snapshot_id,
  lastSourceFingerprint: row.last_source_fingerprint,
  lastPolledAt: row.last_polled_at,
  lastSyncedAt: row.last_synced_at,
  lastError: row.last_error,
  magicLinkToken: row.magic_link_token,
  magicLinkRevokedAt: row.magic_link_revoked_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapSyncImportRow = (row: SyncImportRow): SyncImportRecord => ({
  id: row.id,
  syncId: row.sync_id,
  recipientUserId: row.recipient_user_id,
  recipientProvider: providerSchema.parse(row.recipient_provider),
  recipientProviderPlaylistId: row.recipient_provider_playlist_id,
  lastRecipientSnapshotId: row.last_recipient_snapshot_id,
  syncedSourceTrackFingerprints: row.synced_source_track_fingerprints,
  syncedRecipientTrackFingerprints: row.synced_recipient_track_fingerprints,
  status: row.status,
  matchedCount: row.matched_count,
  skippedCount: row.skipped_count,
  lastSyncedAt: row.last_synced_at,
  lastError: row.last_error,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapSyncTrackActivityRow = (row: SyncTrackActivityRow): SyncTrackActivityRecord => ({
  id: row.id,
  syncId: row.sync_id,
  trackFingerprint: row.track_fingerprint,
  providerTrackId: row.provider_track_id,
  name: row.name,
  artist: row.artist,
  album: row.album,
  artworkUrl: row.artwork_url,
  firstSeenAt: row.first_seen_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const buildUserDisplayName = (params: {
  email: string;
  displayName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}): string => {
  const fullName = [params.firstName?.trim(), params.lastName?.trim()].filter(Boolean).join(' ');
  if (fullName) {
    return fullName;
  }

  const displayName = params.displayName?.trim();
  if (displayName) {
    return displayName;
  }

  return params.email;
};

export const syncsStore = {
  async createSync(params: {
    senderUserId: string;
    provider: Provider;
    providerPlaylistId: string;
    name: string;
    trackCount: number | null;
    syncMode: SyncMode;
  }): Promise<SyncRecord> {
    const now = new Date();
    const data: Prisma.playlist_syncsUncheckedCreateInput = {
      id: randomUUID(),
      sender_user_id: params.senderUserId,
      provider: params.provider,
      provider_playlist_id: params.providerPlaylistId,
      name: params.name,
      track_count: params.trackCount,
      sync_mode: params.syncMode,
      auto_sync_enabled: true,
      next_poll_at: null,
      unchanged_poll_streak: 0,
      magic_link_token: randomBytes(24).toString('hex'),
      created_at: now,
      updated_at: now,
    };
    const row = await prisma.playlist_syncs.create({
      data,
    });
    return mapSyncRow(row as SyncRow);
  },

  async listDistinctSenderUserIds(): Promise<string[]> {
    const rows = await prisma.playlist_syncs.findMany({
      where: { magic_link_revoked_at: null },
      distinct: ['sender_user_id'],
      select: { sender_user_id: true },
    });
    return rows.map((row) => row.sender_user_id);
  },

  async listDistinctRecipientUserIds(): Promise<string[]> {
    const rows = await prisma.playlist_sync_imports.findMany({
      distinct: ['recipient_user_id'],
      select: { recipient_user_id: true },
    });
    return rows.map((row) => row.recipient_user_id);
  },

  async listSyncsBySender(senderUserId: string): Promise<SyncRecord[]> {
    const rows = await prisma.playlist_syncs.findMany({
      where: { sender_user_id: senderUserId },
      orderBy: { created_at: 'desc' },
    });
    return rows.map((row) => mapSyncRow(row as SyncRow));
  },

  async listSyncsByRecipient(recipientUserId: string): Promise<SyncRecord[]> {
    const rows = await prisma.playlist_sync_imports.findMany({
      where: { recipient_user_id: recipientUserId },
      include: {
        playlist_syncs: true,
      },
      orderBy: { created_at: 'desc' },
    });

    return (rows as unknown as ImportWithSyncRow[]).map((row) => {
      const sync = mapSyncRow(row.playlist_syncs);
      return {
        ...sync,
        lastSyncedAt: row.last_synced_at ?? sync.lastSyncedAt,
        lastError: row.last_error ?? sync.lastError,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    });
  },

  async listSyncsForAutoSync(): Promise<SyncWithImportsRecord[]> {
    const rows = await prisma.playlist_syncs.findMany({
      where: {
        auto_sync_enabled: true,
        magic_link_revoked_at: null,
        OR: [{ next_poll_at: null }, { next_poll_at: { lte: new Date() } }],
        playlist_sync_imports: {
          some: {
            recipient_provider_playlist_id: {
              not: null,
            },
          },
        },
      },
      include: {
        playlist_sync_imports: true,
      },
      orderBy: [{ next_poll_at: 'asc' }, { updated_at: 'asc' }],
    });

    return (rows as unknown as SyncWithImportsRow[]).map((row) => ({
      ...mapSyncRow(row),
      imports: row.playlist_sync_imports.map(mapSyncImportRow),
    }));
  },

  async findSyncById(syncId: string): Promise<SyncRecord | null> {
    const row = await prisma.playlist_syncs.findUnique({ where: { id: syncId } });
    return row ? mapSyncRow(row as SyncRow) : null;
  },

  async findOwnedSyncWithImports(params: {
    syncId: string;
    senderUserId: string;
  }): Promise<SyncWithImportsRecord | null> {
    const row = await prisma.playlist_syncs.findFirst({
      where: {
        id: params.syncId,
        sender_user_id: params.senderUserId,
      },
      include: {
        playlist_sync_imports: true,
      },
    });

    if (!row) {
      return null;
    }

    const typedRow = row as unknown as SyncWithImportsRow;
    return {
      ...mapSyncRow(typedRow),
      imports: typedRow.playlist_sync_imports.map(mapSyncImportRow),
    };
  },

  async findSyncByMagicLinkToken(token: string): Promise<SyncRecord | null> {
    const row = await prisma.playlist_syncs.findUnique({
      where: { magic_link_token: token },
    });
    return row ? mapSyncRow(row as SyncRow) : null;
  },

  async updateSyncAutoState(params: {
    syncId: string;
    trackCount?: number | null;
    nextPollAt?: Date | null;
    unchangedPollStreak?: number;
    lastSourceSnapshotId?: string | null;
    lastSourceFingerprint?: string | null;
    lastPolledAt?: Date | null;
    lastSyncedAt?: Date | null;
    lastError?: string | null;
  }): Promise<SyncRecord> {
    const row = await prisma.playlist_syncs.update({
      where: { id: params.syncId },
      data: {
        ...(params.trackCount !== undefined ? { track_count: params.trackCount } : {}),
        ...(params.nextPollAt !== undefined ? { next_poll_at: params.nextPollAt } : {}),
        ...(params.unchangedPollStreak !== undefined
          ? { unchanged_poll_streak: params.unchangedPollStreak }
          : {}),
        ...(params.lastSourceSnapshotId !== undefined
          ? { last_source_snapshot_id: params.lastSourceSnapshotId }
          : {}),
        ...(params.lastSourceFingerprint !== undefined
          ? { last_source_fingerprint: params.lastSourceFingerprint }
          : {}),
        ...(params.lastPolledAt !== undefined ? { last_polled_at: params.lastPolledAt } : {}),
        ...(params.lastSyncedAt !== undefined ? { last_synced_at: params.lastSyncedAt } : {}),
        ...(params.lastError !== undefined ? { last_error: params.lastError } : {}),
        updated_at: new Date(),
      },
    });

    return mapSyncRow(row as SyncRow);
  },

  async updateOwnedSync(params: {
    syncId: string;
    senderUserId: string;
    syncMode?: SyncMode;
  }): Promise<SyncRecord | null> {
    const existing = await prisma.playlist_syncs.findFirst({
      where: {
        id: params.syncId,
        sender_user_id: params.senderUserId,
      },
    });

    if (!existing) {
      return null;
    }

    const updated = await prisma.playlist_syncs.update({
      where: { id: params.syncId },
      data: {
        ...(params.syncMode !== undefined ? { sync_mode: params.syncMode } : {}),
        updated_at: new Date(),
      },
    });

    return mapSyncRow(updated as SyncRow);
  },

  async revokeMagicLink(params: {
    syncId: string;
    senderUserId: string;
  }): Promise<SyncRecord | null> {
    const existing = await prisma.playlist_syncs.findFirst({
      where: { id: params.syncId, sender_user_id: params.senderUserId },
    });
    if (!existing) return null;
    const updated = await prisma.playlist_syncs.update({
      where: { id: params.syncId },
      data: { magic_link_revoked_at: new Date(), updated_at: new Date() },
    });
    return mapSyncRow(updated as SyncRow);
  },

  async regenerateMagicLink(params: {
    syncId: string;
    senderUserId: string;
  }): Promise<SyncRecord | null> {
    const existing = await prisma.playlist_syncs.findFirst({
      where: { id: params.syncId, sender_user_id: params.senderUserId },
    });
    if (!existing) return null;
    const updated = await prisma.playlist_syncs.update({
      where: { id: params.syncId },
      data: {
        magic_link_token: randomBytes(24).toString('hex'),
        magic_link_revoked_at: null,
        updated_at: new Date(),
      },
    });
    return mapSyncRow(updated as SyncRow);
  },

  async upsertImport(params: {
    syncId: string;
    recipientUserId: string;
    recipientProvider: Provider;
    recipientProviderPlaylistId?: string | null;
    lastRecipientSnapshotId?: string | null;
    syncedSourceTrackFingerprints?: string[];
    syncedRecipientTrackFingerprints?: string[];
    status: string;
    matchedCount: number;
    skippedCount: number;
    lastSyncedAt?: Date | null;
    lastError?: string | null;
  }): Promise<SyncImportRecord> {
    const now = new Date();
    const row = await prisma.playlist_sync_imports.upsert({
      where: {
        sync_id_recipient_user_id: {
          sync_id: params.syncId,
          recipient_user_id: params.recipientUserId,
        },
      },
      create: {
        id: randomUUID(),
        sync_id: params.syncId,
        recipient_user_id: params.recipientUserId,
        recipient_provider: params.recipientProvider,
        recipient_provider_playlist_id: params.recipientProviderPlaylistId ?? null,
        last_recipient_snapshot_id: params.lastRecipientSnapshotId ?? null,
        synced_source_track_fingerprints: params.syncedSourceTrackFingerprints ?? [],
        synced_recipient_track_fingerprints: params.syncedRecipientTrackFingerprints ?? [],
        status: params.status,
        matched_count: params.matchedCount,
        skipped_count: params.skippedCount,
        last_synced_at: params.lastSyncedAt ?? null,
        last_error: params.lastError ?? null,
        created_at: now,
        updated_at: now,
      },
      update: {
        recipient_provider: params.recipientProvider,
        ...(params.recipientProviderPlaylistId !== undefined
          ? { recipient_provider_playlist_id: params.recipientProviderPlaylistId }
          : {}),
        ...(params.lastRecipientSnapshotId !== undefined
          ? { last_recipient_snapshot_id: params.lastRecipientSnapshotId }
          : {}),
        ...(params.syncedSourceTrackFingerprints !== undefined
          ? { synced_source_track_fingerprints: params.syncedSourceTrackFingerprints }
          : {}),
        ...(params.syncedRecipientTrackFingerprints !== undefined
          ? { synced_recipient_track_fingerprints: params.syncedRecipientTrackFingerprints }
          : {}),
        status: params.status,
        matched_count: params.matchedCount,
        skipped_count: params.skippedCount,
        ...(params.lastSyncedAt !== undefined ? { last_synced_at: params.lastSyncedAt } : {}),
        ...(params.lastError !== undefined ? { last_error: params.lastError } : {}),
        updated_at: now,
      },
    });
    return mapSyncImportRow(row as SyncImportRow);
  },

  async findImport(params: {
    syncId: string;
    recipientUserId: string;
  }): Promise<SyncImportRecord | null> {
    const row = await prisma.playlist_sync_imports.findUnique({
      where: {
        sync_id_recipient_user_id: {
          sync_id: params.syncId,
          recipient_user_id: params.recipientUserId,
        },
      },
    });
    return row ? mapSyncImportRow(row as SyncImportRow) : null;
  },

  async deleteImport(params: { syncId: string; recipientUserId: string }): Promise<boolean> {
    const deleted = await prisma.playlist_sync_imports.deleteMany({
      where: {
        sync_id: params.syncId,
        recipient_user_id: params.recipientUserId,
      },
    });

    return deleted.count > 0;
  },

  async updateImportSyncState(params: {
    syncId: string;
    recipientUserId: string;
    recipientProviderPlaylistId?: string | null;
    lastRecipientSnapshotId?: string | null;
    syncedSourceTrackFingerprints?: string[];
    syncedRecipientTrackFingerprints?: string[];
    status?: string;
    lastSyncedAt?: Date | null;
    lastError?: string | null;
  }): Promise<SyncImportRecord | null> {
    const existing = await prisma.playlist_sync_imports.findUnique({
      where: {
        sync_id_recipient_user_id: {
          sync_id: params.syncId,
          recipient_user_id: params.recipientUserId,
        },
      },
    });

    if (!existing) {
      return null;
    }

    const updated = await prisma.playlist_sync_imports.update({
      where: {
        sync_id_recipient_user_id: {
          sync_id: params.syncId,
          recipient_user_id: params.recipientUserId,
        },
      },
      data: {
        ...(params.recipientProviderPlaylistId !== undefined
          ? { recipient_provider_playlist_id: params.recipientProviderPlaylistId }
          : {}),
        ...(params.lastRecipientSnapshotId !== undefined
          ? { last_recipient_snapshot_id: params.lastRecipientSnapshotId }
          : {}),
        ...(params.syncedSourceTrackFingerprints !== undefined
          ? { synced_source_track_fingerprints: params.syncedSourceTrackFingerprints }
          : {}),
        ...(params.syncedRecipientTrackFingerprints !== undefined
          ? { synced_recipient_track_fingerprints: params.syncedRecipientTrackFingerprints }
          : {}),
        ...(params.status !== undefined ? { status: params.status } : {}),
        ...(params.lastSyncedAt !== undefined ? { last_synced_at: params.lastSyncedAt } : {}),
        ...(params.lastError !== undefined ? { last_error: params.lastError } : {}),
        updated_at: new Date(),
      },
    });

    return mapSyncImportRow(updated as SyncImportRow);
  },

  async countImports(syncId: string): Promise<number> {
    return prisma.playlist_sync_imports.count({ where: { sync_id: syncId } });
  },

  async countRecentImportsBySyncIds(params: {
    syncIds: string[];
    since: Date;
  }): Promise<Map<string, number>> {
    if (params.syncIds.length === 0) {
      return new Map();
    }

    const rows = await prisma.playlist_sync_imports.groupBy({
      by: ['sync_id'],
      where: {
        sync_id: { in: params.syncIds },
        created_at: { gte: params.since },
      },
      _count: {
        _all: true,
      },
    });

    return new Map(rows.map((row) => [row.sync_id, row._count._all]));
  },

  async countImportsBySyncIds(syncIds: string[]): Promise<Map<string, number>> {
    if (syncIds.length === 0) {
      return new Map();
    }

    const rows = await prisma.playlist_sync_imports.groupBy({
      by: ['sync_id'],
      where: {
        sync_id: { in: syncIds },
      },
      _count: {
        _all: true,
      },
    });

    return new Map(rows.map((row) => [row.sync_id, row._count._all]));
  },

  async listRecentSubscribersBySyncIds(params: {
    syncIds: string[];
    since: Date;
  }): Promise<Map<string, RecentSyncSubscriberRecord[]>> {
    if (params.syncIds.length === 0) {
      return new Map();
    }

    const rows = await prisma.playlist_sync_imports.findMany({
      where: {
        sync_id: { in: params.syncIds },
        created_at: { gte: params.since },
      },
      orderBy: [{ created_at: 'desc' }],
      select: {
        sync_id: true,
        recipient_user_id: true,
        created_at: true,
        users: {
          select: {
            email: true,
            user_profile: {
              select: {
                display_name: true,
                first_name: true,
                last_name: true,
              },
            },
          },
        },
      },
    });

    const bySyncId = new Map<string, RecentSyncSubscriberRecord[]>();

    for (const row of rows) {
      const current = bySyncId.get(row.sync_id) ?? [];
      current.push({
        syncId: row.sync_id,
        recipientUserId: row.recipient_user_id,
        name: buildUserDisplayName({
          email: row.users.email,
          displayName: row.users.user_profile?.display_name ?? null,
          firstName: row.users.user_profile?.first_name ?? null,
          lastName: row.users.user_profile?.last_name ?? null,
        }),
        subscribedAt: row.created_at,
      });
      bySyncId.set(row.sync_id, current);
    }

    return bySyncId;
  },

  async listTopSubscribersBySyncIds(params: {
    syncIds: string[];
    limit: number;
  }): Promise<{ followers: TopSubscriberRecord[]; totalCount: number }> {
    if (params.syncIds.length === 0) {
      return { followers: [], totalCount: 0 };
    }

    // Aggregate distinct subscribers across all the owner's synced playlists,
    // ranking by how many of those playlists they subscribe to, then recency.
    const grouped = await prisma.playlist_sync_imports.groupBy({
      by: ['recipient_user_id'],
      where: { sync_id: { in: params.syncIds } },
      _count: { _all: true },
      _max: { created_at: true },
    });

    const ranked = grouped
      .map((row) => ({
        userId: row.recipient_user_id,
        subscriptionCount: row._count._all,
        latestSubscribedAt: row._max.created_at ?? new Date(0),
      }))
      .sort(
        (a, b) =>
          b.subscriptionCount - a.subscriptionCount ||
          b.latestSubscribedAt.getTime() - a.latestSubscribedAt.getTime(),
      )
      .slice(0, params.limit);

    const users = await prisma.users.findMany({
      where: { id: { in: ranked.map((row) => row.userId) } },
      select: {
        id: true,
        email: true,
        avatar_url: true,
        user_profile: {
          select: { display_name: true, first_name: true, last_name: true },
        },
      },
    });

    const usersById = new Map(users.map((user) => [user.id, user]));

    const followers = ranked.map((row) => {
      const user = usersById.get(row.userId);
      return {
        userId: row.userId,
        name: buildUserDisplayName({
          email: user?.email ?? '',
          displayName: user?.user_profile?.display_name ?? null,
          firstName: user?.user_profile?.first_name ?? null,
          lastName: user?.user_profile?.last_name ?? null,
        }),
        avatarUrl: user?.avatar_url ?? null,
        subscriptionCount: row.subscriptionCount,
        latestSubscribedAt: row.latestSubscribedAt,
      };
    });

    return { followers, totalCount: grouped.length };
  },

  async recordTrackActivity(params: {
    syncId: string;
    tracks: SyncTrackActivityTrack[];
    seenAt: Date;
    bootstrapSeenAt?: Date;
  }): Promise<void> {
    if (params.tracks.length === 0) {
      return;
    }

    const byActivityKey = new Map<
      string,
      { trackFingerprint: string; providerTrackId: string; track: SyncTrackActivityTrack }
    >();
    for (const track of params.tracks) {
      const fingerprint = buildTrackFingerprint(track);
      const providerTrackId = track.providerTrackId?.trim() || fingerprint;
      if (!byActivityKey.has(providerTrackId)) {
        byActivityKey.set(providerTrackId, {
          trackFingerprint: fingerprint,
          providerTrackId,
          track,
        });
      }
    }

    if (byActivityKey.size === 0) {
      return;
    }

    const existingActivityRows = await prisma.playlist_sync_track_activity.findMany({
      where: {
        sync_id: params.syncId,
        provider_track_id: { in: Array.from(byActivityKey.keys()) },
      },
      select: {
        provider_track_id: true,
      },
    });
    const existingProviderTrackIds = new Set(
      existingActivityRows.map((row) => row.provider_track_id),
    );

    const existingCount = await prisma.playlist_sync_track_activity.count({
      where: { sync_id: params.syncId },
    });
    const firstSeenAt =
      existingCount === 0 ? (params.bootstrapSeenAt ?? params.seenAt) : params.seenAt;
    const now = new Date();
    const newRows = Array.from(byActivityKey.values()).filter(
      (entry) => !existingProviderTrackIds.has(entry.providerTrackId),
    );

    if (newRows.length === 0) {
      return;
    }

    await prisma.playlist_sync_track_activity.createMany({
      data: newRows.map(({ trackFingerprint, providerTrackId, track }) => ({
        id: randomUUID(),
        sync_id: params.syncId,
        track_fingerprint: trackFingerprint,
        provider_track_id: providerTrackId,
        name: track.name,
        artist: track.artist,
        album: track.album ?? '',
        artwork_url: track.artworkUrl ?? null,
        first_seen_at: firstSeenAt,
        created_at: now,
        updated_at: now,
      })),
      skipDuplicates: true,
    });
  },

  async countRecentTrackActivityBySyncIds(params: {
    syncIds: string[];
    since: Date;
  }): Promise<Map<string, number>> {
    if (params.syncIds.length === 0) {
      return new Map();
    }

    const rows = await prisma.playlist_sync_track_activity.findMany({
      where: {
        sync_id: { in: params.syncIds },
        first_seen_at: { gte: params.since },
      },
      select: {
        sync_id: true,
        provider_track_id: true,
        track_fingerprint: true,
        name: true,
        artist: true,
        album: true,
      },
    });

    const distinctActivityKeysBySyncId = new Map<string, Set<string>>();
    for (const row of rows) {
      const current = distinctActivityKeysBySyncId.get(row.sync_id) ?? new Set<string>();
      const activityKey = `track:${buildTrackIdentityKey({
        name: row.name,
        artist: row.artist,
        album: row.album,
      })}`;
      current.add(activityKey);
      distinctActivityKeysBySyncId.set(row.sync_id, current);
    }

    const counts = new Map<string, number>();
    for (const [syncId, activityKeys] of distinctActivityKeysBySyncId.entries()) {
      counts.set(syncId, activityKeys.size);
    }

    return counts;
  },

  async listRecentTrackActivityBySyncId(params: {
    syncId: string;
    since: Date;
    limit?: number;
  }): Promise<SyncTrackActivityRecord[]> {
    const rows = await prisma.playlist_sync_track_activity.findMany({
      where: {
        sync_id: params.syncId,
        first_seen_at: { gte: params.since },
      },
      orderBy: [{ first_seen_at: 'desc' }, { created_at: 'desc' }],
      take: params.limit ?? 50,
    });

    return rows.map((row) => mapSyncTrackActivityRow(row as SyncTrackActivityRow));
  },
};

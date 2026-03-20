import { Provider, providerSchema, syncModeSchema, type SyncMode } from '@synqit/shared';
import { randomBytes, randomUUID } from 'node:crypto';

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

type SyncRow = {
  id: string;
  sender_user_id: string;
  provider: string;
  provider_playlist_id: string;
  name: string;
  track_count: number | null;
  sync_mode: string;
  auto_sync_enabled: boolean;
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

const mapSyncRow = (row: SyncRow): SyncRecord => ({
  id: row.id,
  senderUserId: row.sender_user_id,
  provider: providerSchema.parse(row.provider),
  providerPlaylistId: row.provider_playlist_id,
  name: row.name,
  trackCount: row.track_count,
  syncMode: syncModeSchema.parse(row.sync_mode),
  autoSyncEnabled: row.auto_sync_enabled,
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
      magic_link_token: randomBytes(24).toString('hex'),
      created_at: now,
      updated_at: now,
    };
    const row = await prisma.playlist_syncs.create({
      data,
    });
    return mapSyncRow(row as SyncRow);
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
      orderBy: { updated_at: 'asc' },
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
    lastSourceFingerprint?: string | null;
    lastPolledAt?: Date | null;
    lastSyncedAt?: Date | null;
    lastError?: string | null;
  }): Promise<SyncRecord> {
    const row = await prisma.playlist_syncs.update({
      where: { id: params.syncId },
      data: {
        ...(params.trackCount !== undefined ? { track_count: params.trackCount } : {}),
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
};

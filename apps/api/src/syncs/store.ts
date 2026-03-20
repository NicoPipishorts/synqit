import { Provider, providerSchema } from '@synqit/shared';
import { randomBytes, randomUUID } from 'node:crypto';

import { prisma } from '../db/prisma';

export type SyncRecord = {
  id: string;
  senderUserId: string;
  provider: Provider;
  providerPlaylistId: string;
  name: string;
  trackCount: number | null;
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
  status: string;
  matchedCount: number | null;
  skippedCount: number | null;
  createdAt: Date;
  updatedAt: Date;
};

type SyncRow = {
  id: string;
  sender_user_id: string;
  provider: string;
  provider_playlist_id: string;
  name: string;
  track_count: number | null;
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
  status: string;
  matched_count: number | null;
  skipped_count: number | null;
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
  status: row.status,
  matchedCount: row.matched_count,
  skippedCount: row.skipped_count,
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
  }): Promise<SyncRecord> {
    const now = new Date();
    const row = await prisma.playlist_syncs.create({
      data: {
        id: randomUUID(),
        sender_user_id: params.senderUserId,
        provider: params.provider,
        provider_playlist_id: params.providerPlaylistId,
        name: params.name,
        track_count: params.trackCount,
        magic_link_token: randomBytes(24).toString('hex'),
        created_at: now,
        updated_at: now,
      },
    });
    return mapSyncRow(row as SyncRow);
  },

  async listSyncsBySender(senderUserId: string): Promise<SyncRecord[]> {
    const rows = await prisma.playlist_syncs.findMany({
      where: { sender_user_id: senderUserId },
      orderBy: { created_at: 'desc' },
    });
    return rows.map((r) => mapSyncRow(r as SyncRow));
  },

  async findSyncById(syncId: string): Promise<SyncRecord | null> {
    const row = await prisma.playlist_syncs.findUnique({ where: { id: syncId } });
    return row ? mapSyncRow(row as SyncRow) : null;
  },

  async findSyncByMagicLinkToken(token: string): Promise<SyncRecord | null> {
    const row = await prisma.playlist_syncs.findUnique({
      where: { magic_link_token: token },
    });
    return row ? mapSyncRow(row as SyncRow) : null;
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

  async upsertImport(params: {
    syncId: string;
    recipientUserId: string;
    recipientProvider: Provider;
    status: string;
    matchedCount: number;
    skippedCount: number;
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
        status: params.status,
        matched_count: params.matchedCount,
        skipped_count: params.skippedCount,
        created_at: now,
        updated_at: now,
      },
      update: {
        recipient_provider: params.recipientProvider,
        status: params.status,
        matched_count: params.matchedCount,
        skipped_count: params.skippedCount,
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

  async countImports(syncId: string): Promise<number> {
    return prisma.playlist_sync_imports.count({ where: { sync_id: syncId } });
  },
};

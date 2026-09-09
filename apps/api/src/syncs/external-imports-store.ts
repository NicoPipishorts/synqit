import {
  externalSourceTrackSchema,
  type ExternalImportStatus,
  type ExternalSourceKind,
  type ExternalSourceTrack,
  type Provider,
} from '@synqit/shared';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

import { prisma } from '../db/prisma';

export type ExternalImportRecord = {
  id: string;
  userId: string;
  source: ExternalSourceKind;
  sourceUrl: string;
  sourcePlaylistId: string;
  name: string;
  coverImageUrl: string | null;
  recipientProvider: Provider;
  recipientProviderPlaylistId: string | null;
  /** Present for file imports only; link imports re-read their source. */
  sourceTracks: ExternalSourceTrack[] | null;
  status: ExternalImportStatus;
  totalCount: number;
  matchedCount: number;
  skippedCount: number;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
};

type Row = {
  id: string;
  user_id: string;
  source: string;
  source_url: string;
  source_playlist_id: string;
  name: string;
  cover_image_url: string | null;
  recipient_provider: string;
  recipient_provider_playlist_id: string | null;
  source_tracks_json: unknown;
  status: string;
  total_count: number;
  matched_count: number;
  skipped_count: number;
  last_error: string | null;
  created_at: Date;
  updated_at: Date;
  completed_at: Date | null;
};

const sourceTracksSchema = z.array(externalSourceTrackSchema);

const toRecord = (row: Row): ExternalImportRecord => ({
  id: row.id,
  userId: row.user_id,
  source: row.source as ExternalSourceKind,
  sourceUrl: row.source_url,
  sourcePlaylistId: row.source_playlist_id,
  name: row.name,
  coverImageUrl: row.cover_image_url,
  recipientProvider: row.recipient_provider as Provider,
  recipientProviderPlaylistId: row.recipient_provider_playlist_id,
  sourceTracks: (() => {
    const parsed = sourceTracksSchema.safeParse(row.source_tracks_json);
    return parsed.success ? parsed.data : null;
  })(),
  status: row.status as ExternalImportStatus,
  totalCount: row.total_count,
  matchedCount: row.matched_count,
  skippedCount: row.skipped_count,
  lastError: row.last_error,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  completedAt: row.completed_at,
});

export const externalImportsStore = {
  async create(params: {
    userId: string;
    source: ExternalSourceKind;
    sourceUrl: string;
    sourcePlaylistId: string;
    name: string;
    coverImageUrl: string | null;
    recipientProvider: Provider;
    totalCount: number;
    sourceTracks?: ExternalSourceTrack[];
  }): Promise<ExternalImportRecord> {
    const now = new Date();
    const row = await prisma.external_imports.create({
      data: {
        id: randomUUID(),
        user_id: params.userId,
        source: params.source,
        source_url: params.sourceUrl,
        source_playlist_id: params.sourcePlaylistId,
        name: params.name,
        cover_image_url: params.coverImageUrl,
        recipient_provider: params.recipientProvider,
        // Serialised through JSON so Prisma sees plain values, never class instances.
        ...(params.sourceTracks
          ? { source_tracks_json: JSON.parse(JSON.stringify(params.sourceTracks)) }
          : {}),
        status: 'pending',
        total_count: params.totalCount,
        created_at: now,
        updated_at: now,
      },
    });
    return toRecord(row as Row);
  },

  async findById(id: string): Promise<ExternalImportRecord | null> {
    const row = await prisma.external_imports.findUnique({ where: { id } });
    return row ? toRecord(row as Row) : null;
  },

  async listByUser(userId: string): Promise<ExternalImportRecord[]> {
    const rows = await prisma.external_imports.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
    });
    return rows.map((row) => toRecord(row as Row));
  },

  async update(
    id: string,
    patch: Partial<{
      status: ExternalImportStatus;
      recipientProviderPlaylistId: string | null;
      totalCount: number;
      matchedCount: number;
      skippedCount: number;
      lastError: string | null;
      completedAt: Date | null;
    }>,
  ): Promise<ExternalImportRecord> {
    const row = await prisma.external_imports.update({
      where: { id },
      data: {
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.recipientProviderPlaylistId !== undefined
          ? { recipient_provider_playlist_id: patch.recipientProviderPlaylistId }
          : {}),
        ...(patch.totalCount !== undefined ? { total_count: patch.totalCount } : {}),
        ...(patch.matchedCount !== undefined ? { matched_count: patch.matchedCount } : {}),
        ...(patch.skippedCount !== undefined ? { skipped_count: patch.skippedCount } : {}),
        ...(patch.lastError !== undefined ? { last_error: patch.lastError } : {}),
        ...(patch.completedAt !== undefined ? { completed_at: patch.completedAt } : {}),
        updated_at: new Date(),
      },
    });
    return toRecord(row as Row);
  },

  async deleteByUserPrefix(emailPrefix: string): Promise<void> {
    await prisma.external_imports.deleteMany({
      where: { users: { email: { startsWith: emailPrefix } } },
    });
  },
};

import type { Provider } from '@synqit/shared';
import type { FastifyBaseLogger } from 'fastify';

import {
  addTrackToRecipientPlaylist,
  createRecipientPlaylist,
  findProviderMatch,
  type SyncTrack,
} from './auto-sync';
import { externalImportsStore, type ExternalImportRecord } from './external-imports-store';
import { fetchExternalPlaylist, ExternalSourceError } from './external-sources';
import { getProviderLabel } from '../integrations/provider-registry';
import { IntegrationError } from '../integrations/spotify-client';
import { ProviderApiError } from '../integrations/spotify-tracks';

/**
 * Runs one external import to completion in the background of the API process.
 * (Task 4 of the hardening plan moves this into worker jobs; the interface is
 * already job-shaped: an id in, progress persisted as it goes.)
 */

export type ExternalImportProviderOps = {
  createRecipientPlaylist: (params: {
    userId: string;
    provider: Provider;
    name: string;
  }) => Promise<string | null>;
  findProviderMatch: (params: {
    provider: Provider;
    userId: string;
    track: SyncTrack;
  }) => Promise<string | null>;
  addTrackToRecipientPlaylist: (params: {
    userId: string;
    provider: Provider;
    recipientProviderPlaylistId: string;
    recipientTrackId: string;
  }) => Promise<void>;
};

const defaultOps: ExternalImportProviderOps = {
  createRecipientPlaylist,
  findProviderMatch,
  addTrackToRecipientPlaylist,
};

let ops: ExternalImportProviderOps = defaultOps;

/** Regression tests swap the provider calls for deterministic fakes. */
export const setExternalImportProviderOpsForTests = (
  override: Partial<ExternalImportProviderOps> | null,
): void => {
  ops = override ? { ...defaultOps, ...override } : defaultOps;
};

const PROGRESS_FLUSH_EVERY = 5;
const running = new Set<string>();

const describeError = (error: unknown): string => {
  if (error instanceof ExternalSourceError) return error.message;
  if (error instanceof IntegrationError) return error.message;
  if (error instanceof ProviderApiError) return `Provider error (${error.statusCode}).`;
  if (error instanceof Error) return error.message;
  return 'Unknown error.';
};

export const runExternalImport = async (
  importId: string,
  logger: FastifyBaseLogger,
): Promise<ExternalImportRecord | null> => {
  if (running.has(importId)) {
    return externalImportsStore.findById(importId);
  }
  running.add(importId);

  try {
    const record = await externalImportsStore.findById(importId);
    if (!record || record.status === 'completed' || record.status === 'running') {
      return record;
    }

    await externalImportsStore.update(importId, { status: 'running', lastError: null });

    // A file import carries its tracks; a link import re-reads its source, which
    // may have changed since the preview.
    const tracks =
      record.source === 'file'
        ? (record.sourceTracks ?? [])
        : (
            await fetchExternalPlaylist({
              source: record.source,
              playlistId: record.sourcePlaylistId,
              url: record.sourceUrl,
            })
          ).tracks;
    await externalImportsStore.update(importId, { totalCount: tracks.length });

    const recipientProviderPlaylistId = await ops.createRecipientPlaylist({
      userId: record.userId,
      provider: record.recipientProvider,
      name: `${record.name} (via Synqit)`,
    });
    if (!recipientProviderPlaylistId) {
      return externalImportsStore.update(importId, {
        status: 'failed',
        lastError: `${getProviderLabel(record.recipientProvider)} is not available for playlist creation.`,
        completedAt: new Date(),
      });
    }
    await externalImportsStore.update(importId, { recipientProviderPlaylistId });

    let matchedCount = 0;
    let skippedCount = 0;
    const addedTrackIds = new Set<string>();
    let sinceFlush = 0;

    for (const track of tracks) {
      const syncTrack: SyncTrack = {
        providerTrackId: '',
        name: track.name,
        artist: track.artist,
        album: track.album,
        durationMs: track.durationMs,
        isrc: track.isrc,
      };
      try {
        const matched = await ops.findProviderMatch({
          provider: record.recipientProvider,
          userId: record.userId,
          track: syncTrack,
        });
        if (!matched) {
          skippedCount += 1;
        } else if (addedTrackIds.has(matched)) {
          // Same song listed twice on the source; count it once.
          skippedCount += 1;
        } else {
          await ops.addTrackToRecipientPlaylist({
            userId: record.userId,
            provider: record.recipientProvider,
            recipientProviderPlaylistId,
            recipientTrackId: matched,
          });
          addedTrackIds.add(matched);
          matchedCount += 1;
        }
      } catch (error) {
        logger.warn(
          { importId, track: `${track.artist} - ${track.name}`, err: error },
          'external import: track failed',
        );
        skippedCount += 1;
      }

      sinceFlush += 1;
      if (sinceFlush >= PROGRESS_FLUSH_EVERY) {
        sinceFlush = 0;
        await externalImportsStore.update(importId, { matchedCount, skippedCount });
      }
    }

    const completed = await externalImportsStore.update(importId, {
      status: 'completed',
      matchedCount,
      skippedCount,
      completedAt: new Date(),
    });
    logger.info(
      { importId, source: record.source, matchedCount, skippedCount },
      'external import completed',
    );
    return completed;
  } catch (error) {
    logger.error({ importId, err: error }, 'external import failed');
    return externalImportsStore.update(importId, {
      status: 'failed',
      lastError: describeError(error),
      completedAt: new Date(),
    });
  } finally {
    running.delete(importId);
  }
};

/** Fire-and-forget entry point used by the create route. */
export const startExternalImport = (importId: string, logger: FastifyBaseLogger): void => {
  void runExternalImport(importId, logger).catch((error) => {
    logger.error({ importId, err: error }, 'external import crashed');
  });
};

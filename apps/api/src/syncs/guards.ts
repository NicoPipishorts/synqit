import { FastifyReply, FastifyRequest } from 'fastify';

import { syncsStore, type SyncWithImportsRecord } from './store';
import { requireAuthenticatedUserId } from '../auth/guards';

type OwnedSyncResult = {
  userId: string;
  sync: SyncWithImportsRecord;
};

export const requireOwnedSync = async (params: {
  request: FastifyRequest;
  reply: FastifyReply;
  syncId: string;
}): Promise<OwnedSyncResult | null> => {
  const userId = await requireAuthenticatedUserId(params.request, params.reply);
  if (!userId) {
    return null;
  }

  const sync = await syncsStore.findOwnedSyncWithImports({
    syncId: params.syncId,
    senderUserId: userId,
  });
  if (!sync) {
    await params.reply.status(404).send({
      code: 'not_found',
      message: 'Sync not found.',
    });
    return null;
  }

  return { userId, sync };
};

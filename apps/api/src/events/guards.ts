import { FastifyReply, FastifyRequest } from 'fastify';

import { eventsStore, type EventDraftRecord, type EventRecord } from './store';
import { requireAuthenticatedUserId } from '../auth/guards';

type OwnedDraftResult = {
  userId: string;
  draft: EventDraftRecord;
};

type OwnedEventResult = {
  userId: string;
  event: EventRecord;
};

export const requireOwnedDraft = async (params: {
  request: FastifyRequest;
  reply: FastifyReply;
  draftId: string;
}): Promise<OwnedDraftResult | null> => {
  const userId = await requireAuthenticatedUserId(params.request, params.reply);
  if (!userId) {
    return null;
  }

  const draft = await eventsStore.findDraftById({
    draftId: params.draftId,
    hostUserId: userId,
  });
  if (!draft) {
    await params.reply.status(404).send({
      code: 'draft_not_found',
      message: 'Draft not found.',
    });
    return null;
  }

  return { userId, draft };
};

export const requireOwnedEvent = async (params: {
  request: FastifyRequest;
  reply: FastifyReply;
  eventId: string;
}): Promise<OwnedEventResult | null> => {
  const userId = await requireAuthenticatedUserId(params.request, params.reply);
  if (!userId) {
    return null;
  }

  const event = await eventsStore.findEventById(params.eventId);
  if (!event || event.hostUserId !== userId) {
    await params.reply.status(404).send({
      code: 'event_not_found',
      message: 'Playlist not found.',
    });
    return null;
  }

  return { userId, event };
};

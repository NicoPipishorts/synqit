import {
  createEventRequestSchema,
  eventListResponseSchema,
  eventPublicResponseSchema,
  eventResponseSchema,
} from '@synqit/shared';
import { FastifyInstance, FastifyRequest } from 'fastify';
import { randomUUID } from 'node:crypto';

import { eventsStore, EventRecord } from './store';
import { decryptToken } from '../integrations/crypto';
import { isSpotifyOauthLiveMode } from '../integrations/spotify';
import { createSpotifyPlaylist } from '../integrations/spotify-playlists';
import { integrationStore } from '../integrations/store';

const DEFAULT_EVENT_LINK_BASE_URL = 'http://127.0.0.1:5173';

const verifyAndGetUserId = async (request: FastifyRequest): Promise<string | null> => {
  try {
    await request.jwtVerify();
  } catch {
    return null;
  }

  if (!request.user || typeof request.user !== 'object' || !('sub' in request.user)) {
    return null;
  }

  const userId = String(request.user.sub);
  return userId || null;
};

const buildEventMagicLinkUrl = (magicLinkToken: string): string => {
  const eventLinkBaseUrl = process.env.EVENT_LINK_BASE_URL ?? DEFAULT_EVENT_LINK_BASE_URL;
  const url = new URL(`/event/${magicLinkToken}`, eventLinkBaseUrl);
  return url.toString();
};

const toEventResponse = (event: EventRecord) =>
  eventResponseSchema.parse({
    event: {
      ...event,
      createdAt: event.createdAt.toISOString(),
      updatedAt: event.updatedAt.toISOString(),
      closedAt: event.closedAt ? event.closedAt.toISOString() : null,
    },
    magicLinkUrl: buildEventMagicLinkUrl(event.magicLinkToken),
  });

export const registerEventRoutes = async (app: FastifyInstance): Promise<void> => {
  app.post('/events', async (request, reply) => {
    const userId = await verifyAndGetUserId(request);
    if (!userId) {
      return reply.status(401).send({
        code: 'unauthorized',
        message: 'Authentication required.',
      });
    }

    const parsedBody = createEventRequestSchema.safeParse(request.body);
    if (!parsedBody.success) {
      return reply.status(400).send({
        code: 'validation_error',
        message: 'Event payload is invalid.',
        details: parsedBody.error.flatten(),
      });
    }

    const integration = integrationStore.findIntegration({
      userId,
      provider: 'spotify',
    });
    if (!integration) {
      return reply.status(400).send({
        code: 'provider_not_connected',
        message: 'Connect Spotify before creating an event.',
      });
    }

    let providerPlaylistId: string;
    if (isSpotifyOauthLiveMode()) {
      let accessToken: string;
      try {
        accessToken = decryptToken(integration.accessToken);
      } catch {
        return reply.status(500).send({
          code: 'token_decrypt_failed',
          message: 'Stored provider token could not be decrypted.',
        });
      }

      try {
        const createdPlaylist = await createSpotifyPlaylist({
          accessToken,
          name: parsedBody.data.name,
          description: parsedBody.data.description,
        });
        providerPlaylistId = createdPlaylist.providerPlaylistId;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Provider API error.';
        return reply.status(502).send({
          code: 'provider_playlist_create_failed',
          message,
        });
      }
    } else {
      providerPlaylistId = `mock-playlist-${randomUUID()}`;
    }

    const event = eventsStore.createEvent({
      hostUserId: userId,
      provider: 'spotify',
      providerPlaylistId,
      name: parsedBody.data.name,
      description: parsedBody.data.description,
    });

    return toEventResponse(event);
  });

  app.get('/events', async (request, reply) => {
    const userId = await verifyAndGetUserId(request);
    if (!userId) {
      return reply.status(401).send({
        code: 'unauthorized',
        message: 'Authentication required.',
      });
    }

    const events = eventsStore.listEventsByHost(userId);
    return eventListResponseSchema.parse({
      events: events.map((event) => ({
        ...event,
        createdAt: event.createdAt.toISOString(),
        updatedAt: event.updatedAt.toISOString(),
        closedAt: event.closedAt ? event.closedAt.toISOString() : null,
      })),
    });
  });

  app.get('/events/link/:magicLinkToken', async (request, reply) => {
    const magicLinkToken = (request.params as { magicLinkToken?: string }).magicLinkToken ?? '';
    const event = eventsStore.findEventByMagicLinkToken(magicLinkToken);

    if (!event) {
      return reply.status(404).send({
        code: 'event_not_found',
        message: 'No event found for this link.',
      });
    }

    return eventPublicResponseSchema.parse({
      event: {
        id: event.id,
        provider: event.provider,
        status: event.status,
        name: event.name,
        description: event.description,
        createdAt: event.createdAt.toISOString(),
      },
    });
  });

  app.get('/events/:eventId', async (request, reply) => {
    const userId = await verifyAndGetUserId(request);
    if (!userId) {
      return reply.status(401).send({
        code: 'unauthorized',
        message: 'Authentication required.',
      });
    }

    const eventId = (request.params as { eventId?: string }).eventId ?? '';
    const event = eventsStore.findEventById(eventId);
    if (!event || event.hostUserId !== userId) {
      return reply.status(404).send({
        code: 'event_not_found',
        message: 'Event not found.',
      });
    }

    return toEventResponse(event);
  });

  app.post('/events/:eventId/close', async (request, reply) => {
    const userId = await verifyAndGetUserId(request);
    if (!userId) {
      return reply.status(401).send({
        code: 'unauthorized',
        message: 'Authentication required.',
      });
    }

    const eventId = (request.params as { eventId?: string }).eventId ?? '';
    const event = eventsStore.closeEvent({
      eventId,
      hostUserId: userId,
    });
    if (!event) {
      return reply.status(404).send({
        code: 'event_not_found',
        message: 'Event not found.',
      });
    }

    return toEventResponse(event);
  });
};

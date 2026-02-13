import { EventStatus, Provider } from '@synqit/shared';
import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

type EventRecord = {
  id: string;
  hostUserId: string;
  provider: Provider;
  providerPlaylistId: string;
  status: EventStatus;
  name: string;
  description: string;
  magicLinkToken: string;
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

type PersistedEventRecord = Omit<EventRecord, 'createdAt' | 'updatedAt' | 'closedAt' | 'tracks'> & {
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  tracks: PersistedEventTrackRecord[];
};

type PersistedEventTrackRecord = Omit<EventTrackRecord, 'addedAt'> & {
  addedAt: string;
};

type PersistedEventsStore = {
  events: PersistedEventRecord[];
};

type EventsStoreState = {
  events: EventRecord[];
};

const DEFAULT_EVENTS_STORE_FILE = 'apps/api/data/events-store.json';
const EVENTS_STORE_FILE = resolve(
  process.cwd(),
  process.env.EVENTS_STORE_FILE ?? DEFAULT_EVENTS_STORE_FILE,
);

const toEventRecord = (event: PersistedEventRecord): EventRecord => ({
  ...event,
  createdAt: new Date(event.createdAt),
  updatedAt: new Date(event.updatedAt),
  closedAt: event.closedAt ? new Date(event.closedAt) : null,
  tracks: Array.isArray(event.tracks)
    ? event.tracks.map((track) => ({
        ...track,
        addedAt: new Date(track.addedAt),
      }))
    : [],
});

const toPersistedEventRecord = (event: EventRecord): PersistedEventRecord => ({
  ...event,
  createdAt: event.createdAt.toISOString(),
  updatedAt: event.updatedAt.toISOString(),
  closedAt: event.closedAt ? event.closedAt.toISOString() : null,
  tracks: event.tracks.map((track) => ({
    ...track,
    addedAt: track.addedAt.toISOString(),
  })),
});

const cloneEvent = (event: EventRecord): EventRecord => ({
  ...event,
  createdAt: new Date(event.createdAt),
  updatedAt: new Date(event.updatedAt),
  closedAt: event.closedAt ? new Date(event.closedAt) : null,
  tracks: event.tracks.map((track) => ({
    ...track,
    addedAt: new Date(track.addedAt),
  })),
});

const readInitialState = (): EventsStoreState => {
  if (!existsSync(EVENTS_STORE_FILE)) {
    return {
      events: [],
    };
  }

  try {
    const fileContents = readFileSync(EVENTS_STORE_FILE, 'utf8');
    const parsed = JSON.parse(fileContents) as Partial<PersistedEventsStore>;
    const events = Array.isArray(parsed.events) ? parsed.events.map(toEventRecord) : [];
    return { events };
  } catch {
    return { events: [] };
  }
};

const persistState = (state: EventsStoreState): void => {
  mkdirSync(dirname(EVENTS_STORE_FILE), { recursive: true });
  const persisted: PersistedEventsStore = {
    events: state.events.map(toPersistedEventRecord),
  };
  const tempFile = `${EVENTS_STORE_FILE}.tmp`;
  writeFileSync(tempFile, JSON.stringify(persisted, null, 2), 'utf8');
  renameSync(tempFile, EVENTS_STORE_FILE);
};

const state = readInitialState();

export const eventsStore = {
  createEvent(params: {
    hostUserId: string;
    provider: Provider;
    providerPlaylistId: string;
    name: string;
    description: string;
  }): EventRecord {
    const now = new Date();
    const event: EventRecord = {
      id: randomUUID(),
      hostUserId: params.hostUserId,
      provider: params.provider,
      providerPlaylistId: params.providerPlaylistId,
      status: 'open',
      name: params.name,
      description: params.description,
      magicLinkToken: randomBytes(24).toString('base64url'),
      createdAt: now,
      updatedAt: now,
      closedAt: null,
      tracks: [],
    };

    state.events.push(event);
    persistState(state);
    return cloneEvent(event);
  },

  listEventsByHost(hostUserId: string): EventRecord[] {
    return state.events
      .filter((event) => event.hostUserId === hostUserId)
      .map(cloneEvent)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  },

  findEventById(eventId: string): EventRecord | null {
    const event = state.events.find((item) => item.id === eventId);
    return event ? cloneEvent(event) : null;
  },

  findEventByMagicLinkToken(magicLinkToken: string): EventRecord | null {
    const event = state.events.find((item) => item.magicLinkToken === magicLinkToken);
    return event ? cloneEvent(event) : null;
  },

  listTracksByEventId(eventId: string): EventTrackRecord[] {
    const event = state.events.find((item) => item.id === eventId);
    if (!event) {
      return [];
    }

    return event.tracks
      .map((track) => ({ ...track, addedAt: new Date(track.addedAt) }))
      .sort((a, b) => b.addedAt.getTime() - a.addedAt.getTime());
  },

  hasTrack(params: { eventId: string; providerTrackId: string }): boolean {
    const event = state.events.find((item) => item.id === params.eventId);
    if (!event) {
      return false;
    }

    return event.tracks.some((track) => track.providerTrackId === params.providerTrackId);
  },

  addTrackToEvent(params: {
    eventId: string;
    providerTrackId: string;
    name: string;
    artist: string;
    album: string;
    durationMs: number;
    artworkUrl: string | null;
    addedBy: string;
  }): EventTrackRecord | null {
    const event = state.events.find((item) => item.id === params.eventId);
    if (!event) {
      return null;
    }

    if (event.tracks.some((track) => track.providerTrackId === params.providerTrackId)) {
      return null;
    }

    const nextTrack: EventTrackRecord = {
      providerTrackId: params.providerTrackId,
      name: params.name,
      artist: params.artist,
      album: params.album,
      durationMs: params.durationMs,
      artworkUrl: params.artworkUrl,
      addedAt: new Date(),
      addedBy: params.addedBy,
    };

    event.tracks.push(nextTrack);
    event.updatedAt = new Date();
    persistState(state);

    return {
      ...nextTrack,
      addedAt: new Date(nextTrack.addedAt),
    };
  },

  closeEvent(params: { eventId: string; hostUserId: string }): EventRecord | null {
    const event = state.events.find(
      (item) => item.id === params.eventId && item.hostUserId === params.hostUserId,
    );
    if (!event) {
      return null;
    }

    if (event.status === 'closed') {
      return cloneEvent(event);
    }

    event.status = 'closed';
    event.closedAt = new Date();
    event.updatedAt = new Date();
    persistState(state);

    return cloneEvent(event);
  },

  updateEvent(params: {
    eventId: string;
    hostUserId: string;
    name: string;
    description: string;
  }): EventRecord | null {
    const event = state.events.find(
      (item) => item.id === params.eventId && item.hostUserId === params.hostUserId,
    );
    if (!event) {
      return null;
    }

    event.name = params.name;
    event.description = params.description;
    event.updatedAt = new Date();
    persistState(state);

    return cloneEvent(event);
  },

  deleteEvent(params: { eventId: string; hostUserId: string }): boolean {
    const beforeLength = state.events.length;
    state.events = state.events.filter(
      (item) => !(item.id === params.eventId && item.hostUserId === params.hostUserId),
    );

    if (beforeLength === state.events.length) {
      return false;
    }

    persistState(state);
    return true;
  },
};

export type { EventRecord, EventTrackRecord };

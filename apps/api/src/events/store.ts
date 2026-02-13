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
};

type PersistedEventRecord = Omit<EventRecord, 'createdAt' | 'updatedAt' | 'closedAt'> & {
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
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
});

const toPersistedEventRecord = (event: EventRecord): PersistedEventRecord => ({
  ...event,
  createdAt: event.createdAt.toISOString(),
  updatedAt: event.updatedAt.toISOString(),
  closedAt: event.closedAt ? event.closedAt.toISOString() : null,
});

const cloneEvent = (event: EventRecord): EventRecord => ({
  ...event,
  createdAt: new Date(event.createdAt),
  updatedAt: new Date(event.updatedAt),
  closedAt: event.closedAt ? new Date(event.closedAt) : null,
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
};

export type { EventRecord };

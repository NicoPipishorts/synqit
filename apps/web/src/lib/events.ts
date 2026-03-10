export type EventProvider = 'spotify' | 'apple';
export type EventStatus = 'open' | 'closed';
export type ProviderConnectionStatus = 'connected' | 'not_connected';

export type HostEvent = {
  id: string;
  name: string;
  description: string;
  provider: EventProvider;
  providerConnectionStatus: ProviderConnectionStatus;
  status: EventStatus;
  magicLinkToken: string;
  magicLinkRevokedAt: string | null;
  updatedAt: string;
};

export type HostEventDraft = {
  id: string;
  provider: EventProvider | null;
  name: string;
  description: string;
  step: 1 | 2 | 3 | 4;
  updatedAt: string;
};

export type EventTrackItem = {
  providerTrackId: string;
  name: string;
  artist: string;
  album: string;
  durationMs: number;
  artworkUrl: string | null;
  addedAt: string;
  addedBy: string;
};

export const getEventProviderAsset = (provider: EventProvider): { src: string; alt: string } => {
  if (provider === 'apple') {
    return {
      src: '/assets/logos/Providers/AppleMusic.png',
      alt: 'Apple Music',
    };
  }

  return {
    src: '/assets/logos/Providers/Spotify.png',
    alt: 'Spotify',
  };
};

export const getPublicEventPath = (magicLinkToken: string): string => {
  return `/playlist/${magicLinkToken}`;
};

export const getPublicEventUrl = (magicLinkToken: string): string => {
  const eventPath = getPublicEventPath(magicLinkToken);
  if (typeof window === 'undefined') {
    return eventPath;
  }
  return `${window.location.origin}${eventPath}`;
};

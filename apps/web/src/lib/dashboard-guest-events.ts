const STORAGE_KEY = 'synqit.dashboard.guest-events.v1';
const MAX_ITEMS = 8;

export type DashboardGuestEventHistoryItem = {
  magicLinkToken: string;
  name: string;
  lastVisitedAt: string;
};

const canUseStorage = () =>
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

export const readDashboardGuestEvents = (): DashboardGuestEventHistoryItem[] => {
  if (!canUseStorage()) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((item): item is DashboardGuestEventHistoryItem =>
        Boolean(
          item &&
          typeof item === 'object' &&
          'magicLinkToken' in item &&
          typeof item.magicLinkToken === 'string' &&
          'name' in item &&
          typeof item.name === 'string' &&
          'lastVisitedAt' in item &&
          typeof item.lastVisitedAt === 'string',
        ),
      )
      .sort((a, b) => Date.parse(b.lastVisitedAt) - Date.parse(a.lastVisitedAt))
      .slice(0, MAX_ITEMS);
  } catch {
    return [];
  }
};

export const recordDashboardGuestEvent = (params: {
  magicLinkToken: string;
  name: string;
}): void => {
  if (!canUseStorage()) {
    return;
  }

  const now = new Date().toISOString();
  const nextItems = [
    {
      magicLinkToken: params.magicLinkToken,
      name: params.name,
      lastVisitedAt: now,
    },
    ...readDashboardGuestEvents().filter((item) => item.magicLinkToken !== params.magicLinkToken),
  ].slice(0, MAX_ITEMS);

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextItems));
};

import { providerSchema, type Provider } from '@synqit/shared';
import { z } from 'zod';

import { settingsStore } from './store';

/**
 * Which services a host may create an event playlist on.
 *
 * Every provider adapter can technically host: guest search, adds and host
 * moderation all go through the registry. What differs is whether the service
 * can absorb a party's worth of guest searches. YouTube charges 100 quota units
 * per search against a 10,000-unit day, so it stays off until Google grants
 * more; TIDAL is off until someone has tried it. An admin flips the switch from
 * the back office, no deploy needed.
 *
 * Precedence: stored setting, then `EVENT_PROVIDERS` (comma-separated), then
 * Spotify and Apple Music.
 */
export const EVENT_PROVIDERS_SETTING_KEY = 'events.enabled_providers';

const DEFAULT_EVENT_PROVIDERS: readonly Provider[] = ['spotify', 'apple'];

const providerListSchema = z.array(providerSchema);

/** Canonical order (the schema's), no duplicates, unknown values dropped. */
const normalize = (value: unknown): Provider[] | null => {
  const parsed = providerListSchema.safeParse(value);
  if (!parsed.success) {
    return null;
  }
  const wanted = new Set(parsed.data);
  return providerSchema.options.filter((provider) => wanted.has(provider));
};

export const getDefaultEventProviders = (): Provider[] => {
  const raw = process.env.EVENT_PROVIDERS?.trim();
  if (!raw) {
    return [...DEFAULT_EVENT_PROVIDERS];
  }
  const fromEnv = normalize(
    raw
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean),
  );
  return fromEnv ?? [...DEFAULT_EVENT_PROVIDERS];
};

export const getEventProviders = async (): Promise<Provider[]> => {
  const stored = await settingsStore.get(EVENT_PROVIDERS_SETTING_KEY);
  return normalize(stored) ?? getDefaultEventProviders();
};

export const setEventProviders = async (params: {
  providers: readonly Provider[];
  updatedByUserId: string | null;
}): Promise<Provider[]> => {
  const next = normalize([...params.providers]) ?? [];
  await settingsStore.set({
    key: EVENT_PROVIDERS_SETTING_KEY,
    value: next,
    updatedByUserId: params.updatedByUserId,
  });
  return next;
};

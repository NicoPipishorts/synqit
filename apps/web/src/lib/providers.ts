import { providerSchema, type Provider } from '@synqit/shared';
import { CONNECT_SERVICES, MUSIC_SERVICES } from '@synqit/ui';

/**
 * Display names for every connected service. Brand names are proper nouns, so they are not
 * translated; they come from the shared catalogue that the site and admin panel also read.
 */
export const PROVIDER_LABELS: Record<Provider, string> = Object.fromEntries(
  providerSchema.options.map((provider) => [provider, MUSIC_SERVICES[provider].name]),
) as Record<Provider, string>;

/**
 * Providers we offer a connect flow for right now. The shared catalogue holds back any service
 * whose official brand mark we do not have yet, so this can be shorter than the full schema.
 */
export const CONNECTABLE_PROVIDERS: readonly Provider[] = providerSchema.options.filter(
  (provider) => CONNECT_SERVICES.some((service) => service.id === provider),
);

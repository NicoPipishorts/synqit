import { providerSchema } from '@synqit/shared';

export type Provider = (typeof providerSchema.options)[number];
export type Theme = 'light' | 'dark';

export type StoredAuth = {
  accessToken: string;
  refreshToken: string;
  userEmail: string;
};

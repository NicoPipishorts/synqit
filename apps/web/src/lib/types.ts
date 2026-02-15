import { providerSchema } from '@synqit/shared';

export type Provider = (typeof providerSchema.options)[number];
export type Theme = 'light' | 'dark' | 'auto';
export type ThemeAccent = 'lime' | 'pink';

export type StoredAuth = {
  accessToken: string;
  refreshToken: string;
  userId: string;
  userEmail: string;
  avatarUrl: string | null;
};

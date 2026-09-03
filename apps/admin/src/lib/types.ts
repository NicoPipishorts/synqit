import { providerSchema, type AccountRole, type AdminPermission } from '@synqit/shared';

export type Provider = (typeof providerSchema.options)[number];
export type Theme = 'light' | 'dark' | 'auto';
export type ThemeAccent = 'lime' | 'pink';

export type StoredAuth = {
  userId: string;
  userEmail: string;
  avatarUrl: string | null;
  role: AccountRole;
  adminPermissions: AdminPermission[];
};

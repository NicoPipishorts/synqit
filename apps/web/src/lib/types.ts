import { type AccountRole, type AdminPermission } from './client-models';

export type { Provider } from './client-models';

export type Theme = 'light' | 'dark' | 'auto';
export type ThemeAccent = 'lime' | 'pink';

export type StoredAuth = {
  accessToken: string;
  refreshToken: string;
  userId: string;
  userEmail: string;
  avatarUrl: string | null;
  role: AccountRole;
  adminPermissions: AdminPermission[];
};

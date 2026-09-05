// Parsers and shared client types now live in @synqit/client; password rules in
// @synqit/shared. This module keeps the historical import path for the app.
export {
  parseAuthResponse,
  parseAuthUser,
  parseOkResponse,
  parseRefreshResponse,
  type AccountRole,
  type AdminPermission,
  type ApiError,
  type ParsedAuthResponse,
} from '@synqit/client';
export type { AdminPermissionLevel, AdminPermissionScope, Provider } from '@synqit/shared';
export {
  PASSWORD_MIN_LENGTH,
  getPasswordCriteria,
  getPasswordStrengthScore,
  isPasswordStrong,
  type PasswordCriteria,
} from '@synqit/shared';

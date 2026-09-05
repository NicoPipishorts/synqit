import {
  adminAnalyticsOverviewResponseSchema,
  adminAnalyticsUserDetailResponseSchema,
  adminAnalyticsUsersListResponseSchema,
} from '@synqit/shared';
import { queryOptions } from '@tanstack/react-query';

import { callApi } from './api';
import type { AnalyticsFilters } from '../components/admin/AnalyticsFilterDrawer';

/**
 * Query keys are hierarchical so `invalidateQueries({ queryKey: adminQueryKeys.all })`
 * refreshes every admin dataset after a mutation.
 */
export const adminQueryKeys = {
  all: ['admin'] as const,
  users: () => ['admin', 'users'] as const,
  userDetail: (userId: string) => ['admin', 'users', userId] as const,
  analyticsOverview: (filters: AnalyticsFilters) =>
    ['admin', 'analytics', 'overview', filters] as const,
};

export const adminUsersQueryOptions = () =>
  queryOptions({
    queryKey: adminQueryKeys.users(),
    queryFn: () =>
      callApi('/v1/admin/analytics/users', { method: 'GET' }, (payload) =>
        adminAnalyticsUsersListResponseSchema.parse(payload),
      ),
  });

export const adminUserDetailQueryOptions = (userId: string) =>
  queryOptions({
    queryKey: adminQueryKeys.userDetail(userId),
    queryFn: () =>
      callApi(`/v1/admin/analytics/users/${userId}`, { method: 'GET' }, (payload) =>
        adminAnalyticsUserDetailResponseSchema.parse(payload),
      ),
  });

const buildOverviewSearch = (filters: AnalyticsFilters): string => {
  const search = new URLSearchParams({ range: filters.range });
  if (filters.source) search.set('source', filters.source);
  if (filters.target) search.set('target', filters.target);
  if (filters.page) search.set('page', filters.page);
  if (filters.locale) search.set('locale', filters.locale);
  if (filters.visitor) search.set('visitor', filters.visitor);
  return search.toString();
};

export const adminAnalyticsOverviewQueryOptions = (filters: AnalyticsFilters) =>
  queryOptions({
    queryKey: adminQueryKeys.analyticsOverview(filters),
    queryFn: () =>
      callApi(
        `/v1/admin/analytics/overview?${buildOverviewSearch(filters)}`,
        { method: 'GET' },
        (payload) => adminAnalyticsOverviewResponseSchema.parse(payload),
      ),
  });

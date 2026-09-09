import type { AdminProviderSetting, Provider } from '@synqit/shared';
import { ServiceLogo, useToast } from '@synqit/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';

import { AdminSectionHeader } from '../components/admin/AdminSectionHeader';
import { CTAButton } from '../components/ui/cta';
import { useI18n } from '../hooks/useI18n';
import { toApiError } from '../lib/api';
import { clearAuth } from '../lib/auth';
import {
  adminProviderSettingsQueryOptions,
  adminQueryKeys,
  updateAdminProviderEvents,
} from '../lib/queries';

/**
 * Per-service switches. Credentials are a server fact and only shown; event
 * hosting is the operator's call, because guest search is where a service's
 * API quota goes and a new service should take a real party only on purpose.
 */
export const AdminProvidersPage = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const settingsQuery = useQuery(adminProviderSettingsQueryOptions());

  const toggleMutation = useMutation({
    mutationFn: (params: { provider: Provider; eventsEnabled: boolean }) =>
      updateAdminProviderEvents(params),
    onSuccess: (data) => {
      queryClient.setQueryData(adminQueryKeys.providerSettings(), data);
    },
    onError: (error) => {
      const apiError = toApiError(error);
      if (apiError.code === 'unauthorized' || apiError.code === 'forbidden') {
        clearAuth();
        void navigate({ to: '/login' });
        return;
      }
      showToast(t('admin.providersToggleError', { message: apiError.message }), {
        variant: 'error',
      });
    },
  });

  const rows: AdminProviderSetting[] = settingsQuery.data?.providers ?? [];

  return (
    <div className="grid gap-6">
      <AdminSectionHeader
        title={t('admin.providersTitle')}
        description={t('admin.providersDescription')}
      />

      {settingsQuery.isError ? (
        <p className="text-sm text-app-danger">
          {t('admin.providersLoadError', { message: toApiError(settingsQuery.error).message })}
        </p>
      ) : null}

      <ul className="grid gap-3">
        {rows.map((row) => {
          const isBusy =
            toggleMutation.isPending && toggleMutation.variables?.provider === row.provider;
          return (
            <li
              key={row.provider}
              className="flex flex-wrap items-center gap-4 rounded-2xl border border-app-border bg-app-elevated px-4 py-3 dark:bg-app-card"
            >
              <ServiceLogo service={row.provider} alt="" className="h-9 w-9" />
              <div className="grid min-w-0 flex-1 gap-0.5">
                <span className="text-sm font-black text-app-text">{row.label}</span>
                <span className="text-xs text-app-text-secondary">
                  {row.liveMode ? t('admin.providersLive') : t('admin.providersMock')}
                </span>
              </div>
              <span
                className={
                  row.eventsEnabled
                    ? 'rounded-full bg-brand-lime px-2.5 py-1 text-xs font-black text-brand-dark'
                    : 'rounded-full border border-app-border px-2.5 py-1 text-xs font-black text-app-text-secondary'
                }
              >
                {row.eventsEnabled ? t('admin.providersEventsOn') : t('admin.providersEventsOff')}
              </span>
              <CTAButton
                variant={row.eventsEnabled ? 'secondary' : 'primary'}
                disabled={isBusy || settingsQuery.isLoading}
                onClick={() =>
                  toggleMutation.mutate({
                    provider: row.provider,
                    eventsEnabled: !row.eventsEnabled,
                  })
                }
              >
                {row.eventsEnabled
                  ? t('admin.providersDisableEvents')
                  : t('admin.providersEnableEvents')}
              </CTAButton>
            </li>
          );
        })}
      </ul>

      <p className="max-w-3xl text-xs text-app-text-secondary">{t('admin.providersFootnote')}</p>
    </div>
  );
};

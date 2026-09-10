import { MUSIC_SERVICES, ServiceLogo, type MusicServiceId } from '@synqit/ui';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { AdminSectionHeader } from '../components/admin/AdminSectionHeader';
import type { AnalyticsFilters } from '../components/admin/AnalyticsFilterDrawer';
import { useI18n } from '../hooks/useI18n';
import { adminProviderUsageQueryOptions } from '../lib/queries';

/**
 * Where each service's API budget went, and which services people move between.
 *
 * Two numbers per service, because only one of them is billed: requests are
 * comparable everywhere, units only mean something where the service publishes
 * a price for them. YouTube does — 100 for a search, 50 for an insert, against
 * 10,000 a day — so its bar is the one worth watching, and the others are shown
 * as requests with the units column reading the same.
 */

const RANGES: AnalyticsFilters['range'][] = ['24h', '7d', '30d', '90d'];

const DOMAIN_KEYS = {
  events: 'admin.providerUsageDomainEvents',
  shared_list: 'admin.providerUsageDomainSharedList',
  transfer: 'admin.providerUsageDomainTransfer',
  link_import: 'admin.providerUsageDomainLinkImport',
  account: 'admin.providerUsageDomainAccount',
  other: 'admin.providerUsageDomainOther',
} as const;

const OPERATION_KEYS = {
  search: 'admin.providerUsageOpSearch',
  write: 'admin.providerUsageOpWrite',
  read: 'admin.providerUsageOpRead',
  auth: 'admin.providerUsageOpAuth',
} as const;

const isServiceId = (value: string): value is MusicServiceId => value in MUSIC_SERVICES;

const ServiceName = ({ id }: { id: string }) => (
  <span className="inline-flex items-center gap-2">
    {isServiceId(id) ? <ServiceLogo service={id} className="h-5 w-5" alt="" /> : null}
    <span className="font-semibold text-app-text">
      {isServiceId(id) ? MUSIC_SERVICES[id].name : id}
    </span>
  </span>
);

const Bar = ({ value, total }: { value: number; total: number }) => (
  <span className="block h-2 w-full overflow-hidden rounded-full bg-app-surface">
    <span
      className="block h-full rounded-full bg-brand-lime"
      style={{ width: `${total > 0 ? Math.max(2, Math.round((value / total) * 100)) : 0}%` }}
    />
  </span>
);

export const AdminProviderUsagePage = () => {
  const { t } = useI18n();
  const [range, setRange] = useState<AnalyticsFilters['range']>('7d');
  const usageQuery = useQuery(adminProviderUsageQueryOptions(range));
  const data = usageQuery.data;

  /** Per service, with the domain and operation splits folded in. */
  const byProvider = useMemo(() => {
    const map = new Map<
      string,
      {
        provider: string;
        requests: number;
        units: number;
        domains: Map<string, number>;
        operations: Map<string, number>;
      }
    >();
    for (const row of data?.usage ?? []) {
      const entry = map.get(row.provider) ?? {
        provider: row.provider,
        requests: 0,
        units: 0,
        domains: new Map<string, number>(),
        operations: new Map<string, number>(),
      };
      entry.requests += row.requestCount;
      entry.units += row.unitCount;
      entry.domains.set(row.domain, (entry.domains.get(row.domain) ?? 0) + row.requestCount);
      entry.operations.set(
        row.operation,
        (entry.operations.get(row.operation) ?? 0) + row.requestCount,
      );
      map.set(row.provider, entry);
    }
    return [...map.values()].sort((a, b) => b.requests - a.requests);
  }, [data]);

  const totalRequests = byProvider.reduce((sum, entry) => sum + entry.requests, 0);
  const busiestDayUnits = Math.max(0, ...(data?.usageByDay ?? []).map((day) => day.units));

  return (
    <div className="grid gap-6">
      <AdminSectionHeader
        title={t('admin.providerUsageTitle')}
        description={t('admin.providerUsageDescription')}
      />

      <div className="flex flex-wrap items-center gap-2">
        {RANGES.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setRange(option)}
            className={`cursor-pointer rounded-full border-2 px-3 py-1 text-xs font-black uppercase tracking-wide transition ${
              range === option
                ? 'border-app-text bg-brand-lime text-brand-dark shadow-sticker-sm'
                : 'border-app-border text-app-text-secondary hover:border-app-text'
            }`}
          >
            {option}
          </button>
        ))}
      </div>

      {usageQuery.isLoading ? (
        <div className="grid gap-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="h-24 animate-pulse rounded-2xl border-2 border-app-border bg-app-surface/70"
            />
          ))}
        </div>
      ) : null}

      {data ? (
        <>
          {/* What each service's API cost, and what spent it. */}
          <section className="grid gap-3 rounded-2xl border-2 border-app-text bg-app-elevated p-4 shadow-sticker-sm dark:bg-app-card">
            <h2 className="text-lg font-black text-app-text">{t('admin.providerUsageApiTitle')}</h2>
            {byProvider.length === 0 ? (
              <p className="text-sm text-app-text-secondary">{t('admin.providerUsageEmpty')}</p>
            ) : (
              <ul className="grid gap-4">
                {byProvider.map((entry) => (
                  <li key={entry.provider} className="grid gap-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <ServiceName id={entry.provider} />
                      <span className="text-sm text-app-text-secondary">
                        {t('admin.providerUsageRequests', { count: entry.requests })}
                        {entry.provider === 'youtube'
                          ? ` · ${t('admin.providerUsageUnits', { count: entry.units })}`
                          : ''}
                      </span>
                    </div>
                    <Bar value={entry.requests} total={totalRequests} />
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-app-text-secondary">
                      {[...entry.operations.entries()]
                        .sort((a, b) => b[1] - a[1])
                        .map(([operation, count]) => (
                          <span key={operation}>
                            {t(
                              OPERATION_KEYS[operation as keyof typeof OPERATION_KEYS] ??
                                'admin.providerUsageOpRead',
                            )}
                            : {count}
                          </span>
                        ))}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-app-text-secondary">
                      {[...entry.domains.entries()]
                        .sort((a, b) => b[1] - a[1])
                        .map(([domain, count]) => (
                          <span key={domain}>
                            {t(
                              DOMAIN_KEYS[domain as keyof typeof DOMAIN_KEYS] ??
                                'admin.providerUsageDomainOther',
                            )}
                            : {count}
                          </span>
                        ))}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {/* The only allowance anyone publishes, so the only one worth a gauge. */}
            <p className="text-xs text-app-text-secondary">
              {t('admin.providerUsageYoutubeQuota', {
                peak: busiestDayUnits,
                quota: data.youtubeDailyQuotaUnits,
              })}
            </p>
          </section>

          {/* Which way playlists actually move. */}
          <section className="grid gap-3 rounded-2xl border-2 border-app-text bg-app-elevated p-4 shadow-sticker-sm dark:bg-app-card">
            <h2 className="text-lg font-black text-app-text">
              {t('admin.providerUsageLanesTitle')}
            </h2>
            {data.transferLanes.length === 0 ? (
              <p className="text-sm text-app-text-secondary">{t('admin.providerUsageEmpty')}</p>
            ) : (
              <ul className="grid gap-2">
                {data.transferLanes.map((lane) => (
                  <li
                    key={`${lane.sourceProvider}-${lane.destinationProvider}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-app-border px-3 py-2"
                  >
                    <span className="inline-flex items-center gap-2 text-sm">
                      <ServiceName id={lane.sourceProvider} />
                      <span aria-hidden="true">→</span>
                      <ServiceName id={lane.destinationProvider} />
                    </span>
                    <span className="text-sm text-app-text-secondary">
                      {t('admin.providerUsagePlaylists', { count: lane.playlistCount })} ·{' '}
                      {t('admin.providerUsageMatched', {
                        matched: lane.matchedCount,
                        skipped: lane.skippedCount,
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Which service hosts the parties. */}
            <section className="grid gap-3 rounded-2xl border-2 border-app-text bg-app-elevated p-4 shadow-sticker-sm dark:bg-app-card">
              <h2 className="text-lg font-black text-app-text">
                {t('admin.providerUsageEventsTitle')}
              </h2>
              {data.eventProviders.length === 0 ? (
                <p className="text-sm text-app-text-secondary">{t('admin.providerUsageEmpty')}</p>
              ) : (
                <ul className="grid gap-2">
                  {data.eventProviders.map((row) => (
                    <li key={row.provider} className="flex items-center justify-between gap-2">
                      <ServiceName id={row.provider} />
                      <span className="text-sm text-app-text-secondary">
                        {t('admin.providerUsageEvents', { count: row.eventCount })} ·{' '}
                        {t('admin.providerUsageTracks', { count: row.trackCount })}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Who follows a list from another service. */}
            <section className="grid gap-3 rounded-2xl border-2 border-app-text bg-app-elevated p-4 shadow-sticker-sm dark:bg-app-card">
              <h2 className="text-lg font-black text-app-text">
                {t('admin.providerUsageSubsTitle')}
              </h2>
              {data.subscriptionLanes.length === 0 ? (
                <p className="text-sm text-app-text-secondary">{t('admin.providerUsageEmpty')}</p>
              ) : (
                <ul className="grid gap-2">
                  {data.subscriptionLanes.map((lane) => (
                    <li
                      key={`${lane.sourceProvider}-${lane.recipientProvider}`}
                      className="flex flex-wrap items-center justify-between gap-2"
                    >
                      <span className="inline-flex items-center gap-2 text-sm">
                        <ServiceName id={lane.sourceProvider} />
                        <span aria-hidden="true">→</span>
                        <ServiceName id={lane.recipientProvider} />
                        {lane.sourceProvider !== lane.recipientProvider ? (
                          <span className="rounded-full bg-brand-pink/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-app-text">
                            {t('admin.providerUsageCrossService')}
                          </span>
                        ) : null}
                      </span>
                      <span className="text-sm text-app-text-secondary">
                        {t('admin.providerUsageSubs', { count: lane.subscriptionCount })}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      ) : null}
    </div>
  );
};

import {
  adminAnalyticsEventDetailResponseSchema,
  adminAnalyticsEventsListResponseSchema,
  type AdminAnalyticsEventSummary,
} from '@synqit/shared';
import { useNavigate } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { AdminPageHeader } from '../components/admin/AdminPageHeader';
import { AdminSubNav } from '../components/admin/AdminSubNav';
import { CTAButton } from '../components/ui/cta';
import { SlideOverPanel } from '../components/ui/SlideOverPanel';
import { useI18n } from '../hooks/useI18n';
import { callApi, toApiError } from '../lib/api';
import { clearAuth } from '../lib/auth';

type AnalyticsEventDetail = {
  eventId: string;
  name: string;
  description: string;
  provider: 'spotify' | 'apple';
  status: 'open' | 'closed';
  hostEmail: string;
  tracksCount: number;
  lastTrackAddedAt: string | null;
  createdAt: string;
  updatedAt: string;
  magicLinkToken: string;
  closedAt: string | null;
  analytics: {
    publicPageViews: number;
    hostPageViews: number;
    trackedEventActions: number;
  };
  recentTracks: Array<{
    providerTrackId: string;
    name: string;
    artist: string;
    album: string;
    addedAt: string;
    addedBy: string;
  }>;
};

const providerLabel = (provider: 'spotify' | 'apple'): string => {
  return provider === 'spotify' ? 'Spotify' : 'Apple Music';
};

export const AdminAnalyticsPage = () => {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const [rows, setRows] = useState<AdminAnalyticsEventSummary[]>([]);
  const [isLoadingRows, setIsLoadingRows] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<AnalyticsEventDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  const formatDate = useMemo(() => {
    return new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  }, [locale]);

  const normalizeDate = useCallback(
    (value: string | null): string => {
      if (!value) {
        return '—';
      }
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) {
        return '—';
      }
      return formatDate.format(parsed);
    },
    [formatDate],
  );

  const loadRows = useCallback(async () => {
    setIsLoadingRows(true);
    setStatus(null);
    try {
      const result = await callApi(
        '/v1/admin/analytics/events',
        {
          method: 'GET',
        },
        (payload) => adminAnalyticsEventsListResponseSchema.parse(payload),
      );
      setRows(result.events);
    } catch (error) {
      const apiError = toApiError(error);
      if (apiError.code === 'unauthorized' || apiError.code === 'forbidden') {
        clearAuth();
        void navigate({ to: '/admin/login' });
        return;
      }
      setStatus(apiError.message);
    } finally {
      setIsLoadingRows(false);
    }
  }, [navigate]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const openDetails = async (eventId: string) => {
    setSelectedEventId(eventId);
    setSelectedDetail(null);
    setIsLoadingDetail(true);

    try {
      const result = await callApi(
        `/v1/admin/analytics/events/${eventId}`,
        {
          method: 'GET',
        },
        (payload) => adminAnalyticsEventDetailResponseSchema.parse(payload),
      );
      setSelectedDetail(result.event);
    } catch (error) {
      const apiError = toApiError(error);
      setStatus(apiError.message);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  return (
    <section className="mx-auto grid content-start min-h-screen w-full max-w-6xl gap-5 px-4 pb-10 pt-28 sm:px-6 sm:pt-32 lg:px-8">
      <AdminPageHeader nav={<AdminSubNav />} />

      <article className="grid gap-4 rounded-3xl border border-app-border bg-app-elevated p-5 shadow-soft-lift dark:bg-app-card">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-black text-app-text">{t('admin.analyticsEventsTitle')}</h2>
          <CTAButton type="button" variant="secondary" onClick={() => void loadRows()}>
            {t('admin.analyticsRefresh')}
          </CTAButton>
        </div>

        {isLoadingRows ? (
          <p className="text-sm text-app-text-secondary">{t('admin.analyticsLoading')}</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-app-text-secondary">{t('admin.analyticsEmpty')}</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-app-border">
            <table className="w-full min-w-[760px] border-collapse text-left">
              <thead className="bg-app-surface dark:bg-app-card">
                <tr className="border-b border-app-border text-[11px] uppercase tracking-wide text-app-text-secondary">
                  <th className="px-3 py-2 font-black">{t('admin.analyticsColEvent')}</th>
                  <th className="px-3 py-2 font-black">{t('admin.analyticsColProvider')}</th>
                  <th className="px-3 py-2 font-black">{t('admin.analyticsColStatus')}</th>
                  <th className="px-3 py-2 font-black">{t('admin.analyticsColTracks')}</th>
                  <th className="px-3 py-2 font-black">{t('admin.analyticsColHost')}</th>
                  <th className="px-3 py-2 font-black">{t('admin.analyticsColUpdated')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.eventId}
                    className="cursor-pointer border-b border-app-border last:border-b-0 hover:bg-app-surface/70 dark:hover:bg-app-card"
                    onClick={() => void openDetails(row.eventId)}
                  >
                    <td className="max-w-[16rem] truncate px-3 py-2 text-sm font-black text-app-text">
                      {row.name}
                    </td>
                    <td className="px-3 py-2 text-xs font-semibold text-app-text-secondary">
                      {providerLabel(row.provider)}
                    </td>
                    <td className="px-3 py-2 text-xs font-semibold text-app-text-secondary">
                      {row.status}
                    </td>
                    <td className="px-3 py-2 text-xs font-semibold text-app-text-secondary">
                      {row.tracksCount}
                    </td>
                    <td className="max-w-[16rem] truncate px-3 py-2 text-xs font-semibold text-app-text-secondary">
                      {row.hostEmail}
                    </td>
                    <td className="px-3 py-2 text-xs font-semibold text-app-text-secondary">
                      {normalizeDate(row.updatedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {status ? (
          <p className="rounded-lg border border-app-border bg-app-surface px-3 py-2 text-xs font-semibold text-app-text-secondary">
            {status}
          </p>
        ) : null}
      </article>

      <SlideOverPanel
        open={Boolean(selectedEventId)}
        onClose={() => {
          setSelectedEventId(null);
          setSelectedDetail(null);
        }}
        title={selectedDetail?.name ?? t('admin.analyticsDetailTitle')}
        closeLabel={t('admin.analyticsDetailClose')}
      >
        {isLoadingDetail ? (
          <p className="text-sm text-app-text-secondary">{t('admin.analyticsDetailLoading')}</p>
        ) : selectedDetail ? (
          <div className="grid gap-4">
            <div className="grid gap-2 rounded-xl border border-app-border bg-app-elevated p-3 text-xs font-semibold text-app-text-secondary dark:bg-app-card">
              <div className="flex items-center justify-between gap-2">
                <span>{t('admin.analyticsColProvider')}</span>
                <span className="font-black text-app-text">
                  {providerLabel(selectedDetail.provider)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span>{t('admin.analyticsColStatus')}</span>
                <span className="font-black text-app-text">{selectedDetail.status}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span>{t('admin.analyticsColTracks')}</span>
                <span className="font-black text-app-text">{selectedDetail.tracksCount}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span>{t('admin.analyticsColHost')}</span>
                <span className="truncate font-black text-app-text">
                  {selectedDetail.hostEmail}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span>{t('admin.analyticsColUpdated')}</span>
                <span className="font-black text-app-text">
                  {normalizeDate(selectedDetail.updatedAt)}
                </span>
              </div>
            </div>

            <div className="grid gap-2 rounded-xl border border-app-border bg-app-elevated p-3 text-xs font-semibold text-app-text-secondary dark:bg-app-card">
              <h3 className="text-sm font-black text-app-text">
                {t('admin.analyticsSnapshotTitle')}
              </h3>
              <div className="flex items-center justify-between gap-2">
                <span>{t('admin.analyticsPublicViews')}</span>
                <span className="font-black text-app-text">
                  {selectedDetail.analytics.publicPageViews}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span>{t('admin.analyticsHostViews')}</span>
                <span className="font-black text-app-text">
                  {selectedDetail.analytics.hostPageViews}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span>{t('admin.analyticsTrackedActions')}</span>
                <span className="font-black text-app-text">
                  {selectedDetail.analytics.trackedEventActions}
                </span>
              </div>
            </div>

            <div className="grid gap-2 rounded-xl border border-app-border bg-app-elevated p-3 dark:bg-app-card">
              <h3 className="text-sm font-black text-app-text">
                {t('admin.analyticsRecentTracks')}
              </h3>
              {selectedDetail.recentTracks.length === 0 ? (
                <p className="text-xs font-semibold text-app-text-secondary">
                  {t('admin.analyticsNoTracks')}
                </p>
              ) : (
                <ul className="grid gap-2">
                  {selectedDetail.recentTracks.map((track) => (
                    <li
                      key={`${track.providerTrackId}-${track.addedAt}`}
                      className="rounded-lg border border-app-border bg-app-bg px-2.5 py-2 text-xs"
                    >
                      <p className="truncate font-black text-app-text">{track.name}</p>
                      <p className="truncate text-app-text-secondary">{track.artist}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-app-text-secondary">{t('admin.analyticsNoSelection')}</p>
        )}
      </SlideOverPanel>
    </section>
  );
};

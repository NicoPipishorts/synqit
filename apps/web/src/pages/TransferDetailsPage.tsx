import { useQuery } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import { AlertTriangle, ArrowRight, Check, Music2, X } from 'lucide-react';

import { AppPageHeader } from '../components/app/AppPageHeader';
import { AppPageLayout } from '../components/app/AppPageLayout';
import { ProviderIcon } from '../components/providers/ProviderIcon';
import { useI18n } from '../hooks/useI18n';
import { PROVIDER_LABELS } from '../lib/providers';
import { fetchTransferDetails, syncQueryKeys } from '../lib/queries';

const formatDuration = (durationMs: number | null): string | null => {
  if (durationMs === null) {
    return null;
  }
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`;
};

const formatDate = (value: string | null): string | null => {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? null
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
};

/**
 * One transferred playlist, song by song: what landed on the destination and
 * what the destination had no match for. Reads the outcome recorded when the
 * transfer ran, so opening the page costs no provider calls.
 */
export const TransferDetailsPage = () => {
  const { t } = useI18n();
  const { syncId } = useParams({ strict: false }) as { syncId: string };

  const transferQuery = useQuery({
    queryKey: syncQueryKeys.transferDetails(syncId),
    queryFn: () => fetchTransferDetails(syncId),
    staleTime: 60_000,
  });

  const transfer = transferQuery.data ?? null;
  const matchedCount = transfer?.matchedCount ?? 0;
  const skippedCount = transfer?.skippedCount ?? 0;
  const totalCount = transfer?.tracks.length || matchedCount + skippedCount;
  const isComplete = transfer?.status === 'completed';
  const transferredAt = formatDate(transfer?.transferredAt ?? null);

  return (
    <AppPageLayout bodyClassName="gap-6">
      <AppPageHeader
        eyebrow={t('transferDetailsPage.eyebrow')}
        title={transfer?.name ?? t('transferDetailsPage.loadingTitle')}
        backTo="/transfer"
        backLabel={t('transferDetailsPage.back')}
      />

      {transferQuery.isLoading ? (
        <div className="grid gap-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="h-[4.5rem] animate-pulse rounded-2xl border-2 border-app-border-strong bg-app-surface/70"
            />
          ))}
        </div>
      ) : !transfer ? (
        <p className="rounded-3xl border-2 border-dashed border-app-border px-5 py-10 text-center text-sm text-app-text-secondary">
          {t('transferDetailsPage.notFound')}
        </p>
      ) : (
        <>
          {/* The outcome first: how the transfer went is the reason to open
              this page, the track list is the evidence for it. */}
          <article
            className={`grid gap-4 rounded-3xl border-2 border-app-text p-5 shadow-sticker sm:p-6 ${
              isComplete ? 'bg-brand-lime/20' : 'bg-app-elevated dark:bg-app-card'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className={`inline-flex h-14 w-14 items-center justify-center rounded-full border-2 border-app-text ${
                    isComplete ? 'bg-brand-lime text-brand-dark' : 'bg-app-surface text-app-text'
                  }`}
                >
                  {isComplete ? <Check size={26} strokeWidth={3} /> : <AlertTriangle size={24} />}
                </span>
                <div className="grid gap-1">
                  <p className="text-2xl font-black text-brand-dark dark:text-brand-white">
                    {isComplete
                      ? t('transferDetailsPage.successTitle')
                      : t('transferDetailsPage.incompleteTitle')}
                  </p>
                  <p className="text-sm text-app-text-secondary">
                    {t('transferDetailsPage.successBody', {
                      matched: matchedCount,
                      total: totalCount,
                    })}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <ProviderIcon provider={transfer.sourceProvider} sizeClassName="h-10 w-10" />
                <ArrowRight size={16} className="text-app-text-secondary" aria-hidden="true" />
                <ProviderIcon provider={transfer.destinationProvider} sizeClassName="h-10 w-10" />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="rounded-full border border-app-text bg-app-elevated px-3 py-1 font-bold text-app-text dark:bg-app-card">
                {t('transferDetailsPage.matchedCount', { count: matchedCount })}
              </span>
              {skippedCount > 0 ? (
                <span className="rounded-full border border-app-text bg-brand-pink/15 px-3 py-1 font-bold text-app-text">
                  {t('transferDetailsPage.skippedCount', { count: skippedCount })}
                </span>
              ) : null}
              <span className="text-app-text-secondary">
                {t('transferDetailsPage.lane', {
                  source: PROVIDER_LABELS[transfer.sourceProvider],
                  destination: PROVIDER_LABELS[transfer.destinationProvider],
                })}
                {transferredAt ? ` · ${transferredAt}` : ''}
              </span>
            </div>

            {transfer.errorMessage ? (
              <p className="rounded-2xl border-2 border-app-text bg-brand-pink/15 px-4 py-3 text-sm font-semibold text-app-text">
                {transfer.errorMessage}
              </p>
            ) : null}
          </article>

          {transfer.tracks.length === 0 ? (
            // Transfers made before per-track results were recorded keep their
            // counts; there is nothing to list for them.
            <p className="rounded-3xl border-2 border-dashed border-app-border px-5 py-10 text-center text-sm text-app-text-secondary">
              {t('transferDetailsPage.tracksUnavailable')}
            </p>
          ) : (
            <section className="grid gap-3">
              <h2 className="px-1 text-lg font-black text-brand-dark dark:text-brand-white">
                {t('transferDetailsPage.tracksTitle')}
              </h2>
              <ul className="grid gap-2">
                {transfer.tracks.map((track) => {
                  const isMatched = track.status === 'matched';
                  const duration = formatDuration(track.durationMs);
                  return (
                    <li
                      key={`${track.position}-${track.name}`}
                      // A grid item's min-width is auto, so without this the
                      // row takes its content's min-content width, grows past
                      // the column and the truncate inside never engages.
                      className={`flex min-w-0 items-center gap-3 rounded-2xl border-2 px-3 py-3 ${
                        isMatched
                          ? 'border-app-text/70 bg-app-elevated dark:bg-app-card'
                          : 'border-brand-pink/60 bg-brand-pink/10'
                      }`}
                    >
                      {track.artworkUrl ? (
                        <img
                          src={track.artworkUrl}
                          alt=""
                          className={`h-11 w-11 shrink-0 rounded-xl object-cover ${
                            isMatched ? '' : 'opacity-60 grayscale'
                          }`}
                        />
                      ) : (
                        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-app-border text-app-text-secondary">
                          <Music2 size={16} aria-hidden="true" />
                        </span>
                      )}

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-brand-dark dark:text-brand-white">
                          {track.name}
                        </p>
                        <p className="truncate text-xs text-app-text-secondary">
                          {[track.artist, track.album].filter(Boolean).join(' · ')}
                        </p>
                      </div>

                      {duration ? (
                        <span className="hidden text-xs text-app-text-secondary sm:inline">
                          {duration}
                        </span>
                      ) : null}

                      <span
                        title={
                          isMatched
                            ? t('transferDetailsPage.trackMatched')
                            : t('transferDetailsPage.trackSkipped')
                        }
                        className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border-2 border-app-text px-2.5 text-xs font-black ${
                          isMatched
                            ? 'bg-brand-lime text-brand-dark'
                            : 'bg-brand-pink text-brand-white'
                        }`}
                      >
                        {isMatched ? (
                          <Check size={13} strokeWidth={3} aria-hidden="true" />
                        ) : (
                          <X size={13} strokeWidth={3} aria-hidden="true" />
                        )}
                        <span className="hidden sm:inline">
                          {isMatched
                            ? t('transferDetailsPage.trackMatched')
                            : t('transferDetailsPage.trackSkipped')}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </>
      )}
    </AppPageLayout>
  );
};

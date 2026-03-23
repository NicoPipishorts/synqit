import { providerSchema } from '@synqit/shared';
import type { SyncPublicTrack } from '@synqit/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import { Check, ListMusic, LoaderCircle, Users } from 'lucide-react';
import { useEffect, useState } from 'react';

import { EventProviderIcon } from '../components/events/EventProviderIcon';
import { TrackSkeletonList } from '../components/events/PublicTrackRow';
import { HomeFooterReveal } from '../components/marketing/HomeFooterReveal';
import { BlurSpotLayer } from '../components/shell/BackgroundBlurSpots';
import { CTAButton, CTALink } from '../components/ui/cta';
import { LanguageSwitcher } from '../components/ui/LanguageSwitcher';
import { ThemeToggle } from '../components/ui/ThemeToggle';
import { useI18n } from '../hooks/useI18n';
import { useToast } from '../hooks/useToast';
import { toApiError } from '../lib/api';
import { isAuthenticated } from '../lib/auth';
import {
  fetchIntegrations,
  fetchSyncPublic,
  importSync,
  queryKeys,
  syncQueryKeys,
  unsubscribeSync,
} from '../lib/queries';
import { Provider } from '../lib/types';

// ---------------------------------------------------------------------------
// Provider picker sheet (modal on desktop, bottom-sheet on mobile)
// ---------------------------------------------------------------------------

type ProviderSheetProps = {
  open: boolean;
  onClose: () => void;
  connectedProviders: Provider[];
  selectedProvider: Provider | null;
  onSelect: (p: Provider) => void;
  onConfirm: () => void;
  isImporting: boolean;
};

const ProviderSheet = ({
  open,
  onClose,
  connectedProviders,
  selectedProvider,
  onSelect,
  onConfirm,
  isImporting,
}: ProviderSheetProps) => {
  const { t } = useI18n();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        aria-hidden="true"
      />

      {/* Bottom-sheet on mobile, centred modal on desktop */}
      <div
        role="dialog"
        aria-modal="true"
        className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl border border-app-border bg-app-bg p-6 shadow-2xl sm:inset-0 sm:m-auto sm:h-fit sm:max-w-sm sm:rounded-3xl"
      >
        <div className="mb-1 h-1 w-10 rounded-full bg-app-border sm:hidden mx-auto" />
        <h2 className="mt-4 text-lg font-black text-brand-dark dark:text-brand-white sm:mt-0">
          {t('syncPublicPage.connectProviderTitle')}
        </h2>
        <p className="mt-1 text-sm text-app-text-secondary">
          {t('syncPublicPage.connectProviderBody')}
        </p>

        <div className="mt-5 grid gap-3">
          {connectedProviders.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onSelect(p)}
              className={`flex w-full cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                selectedProvider === p
                  ? 'border-brand-lime bg-brand-lime/10'
                  : 'border-app-border bg-app-surface hover:border-app-border-strong dark:bg-app-elevated'
              }`}
            >
              <EventProviderIcon provider={p} sizeClassName="h-8 w-8" />
              <span className="text-sm font-bold capitalize text-brand-dark dark:text-brand-white">
                {p === 'spotify' ? 'Spotify' : 'Apple Music'}
              </span>
            </button>
          ))}
        </div>

        <CTAButton
          type="button"
          variant="primary"
          onClick={onConfirm}
          disabled={!selectedProvider || isImporting}
          className="mt-5 w-full justify-center"
        >
          {isImporting ? t('syncPublicPage.subscribing') : t('syncPublicPage.subscribeCta')}
        </CTAButton>
      </div>
    </>
  );
};

// ---------------------------------------------------------------------------
// Track row (read-only, matching EventPublicPage style)
// ---------------------------------------------------------------------------

const SyncTrackRow = ({ track }: { track: SyncPublicTrack }) => (
  <li className="flex min-w-0 items-center gap-3 rounded-xl border border-app-border bg-app-bg px-3 py-3 shadow-soft-lift dark:bg-app-elevated">
    {track.artworkUrl ? (
      <img
        src={track.artworkUrl}
        alt=""
        width={44}
        height={44}
        className="h-11 w-11 shrink-0 rounded-md object-cover"
      />
    ) : (
      <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-app-border text-xs text-app-text-secondary">
        <ListMusic size={14} aria-hidden="true" />
      </span>
    )}
    <div className="min-w-0 flex-1">
      <p className="truncate text-sm font-bold text-brand-dark dark:text-brand-white">
        {track.name}
      </p>
      <p className="truncate text-xs text-app-text-secondary">
        {track.artist} · {track.album}
      </p>
    </div>
  </li>
);

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const VISIBLE_TRACKS_STEP = 20;

export const SyncPublicPage = () => {
  const { token } = useParams({ from: '/sync/$token' });
  const { t } = useI18n();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const loggedIn = isAuthenticated();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [visibleTracks, setVisibleTracks] = useState(VISIBLE_TRACKS_STEP);
  const [importStageIndex, setImportStageIndex] = useState(0);

  const getCurrentPath = () => {
    if (typeof window === 'undefined') {
      return `/sync/${token}`;
    }

    return `${window.location.pathname}${window.location.search}`;
  };

  const getLoginRedirectHref = () => {
    return `/auth/login?redirectTo=${encodeURIComponent(getCurrentPath())}`;
  };

  const getPlatformsRedirectHref = () => {
    return `/profile/platforms?redirectTo=${encodeURIComponent(getCurrentPath())}`;
  };

  // noindex
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const meta = Object.assign(document.createElement('meta'), {
      name: 'robots',
      content: 'noindex, nofollow, noarchive, nosnippet',
    });
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------

  const syncQuery = useQuery({
    queryKey: syncQueryKeys.public(token),
    queryFn: () => fetchSyncPublic(token),
    retry: false,
  });

  const integrationsQuery = useQuery({
    queryKey: queryKeys.integrations.list(),
    queryFn: fetchIntegrations,
    staleTime: 60_000,
    enabled: loggedIn,
  });

  // ---------------------------------------------------------------------------
  // Derived
  // ---------------------------------------------------------------------------

  const providerStatusByType = integrationsQuery.data ?? {
    spotify: 'not_connected' as 'connected' | 'not_connected',
    apple: 'not_connected' as 'connected' | 'not_connected',
  };

  const connectedProviders = loggedIn
    ? providerSchema.options.filter((p) => providerStatusByType[p] === 'connected')
    : [];

  const hasAnyConnectedProvider = connectedProviders.length > 0;

  // Auto-select when only one provider connected
  useEffect(() => {
    if (connectedProviders.length === 1 && !selectedProvider) {
      setSelectedProvider(connectedProviders[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [integrationsQuery.data]);

  // ---------------------------------------------------------------------------
  // Import / subscribe mutation
  // ---------------------------------------------------------------------------

  const importMutation = useMutation({
    mutationFn: importSync,
    onSuccess: () => {
      setSheetOpen(false);
      showToast(t('syncPublicPage.subscribeSuccess'), { variant: 'success' });
      void queryClient.invalidateQueries({ queryKey: syncQueryKeys.public(token) });
      void queryClient.invalidateQueries({ queryKey: syncQueryKeys.all() });
    },
    onError: (error) => {
      const apiError = toApiError(error);
      showToast(t('syncPublicPage.subscribeError', { message: apiError.message }), {
        variant: 'error',
      });
    },
  });

  const unsubscribeMutation = useMutation({
    mutationFn: () => unsubscribeSync(token),
    onSuccess: () => {
      showToast(t('syncPublicPage.unsubscribeSuccess'), { variant: 'success' });
      void queryClient.invalidateQueries({ queryKey: syncQueryKeys.public(token) });
      void queryClient.invalidateQueries({ queryKey: syncQueryKeys.all() });
    },
    onError: (error) => {
      const apiError = toApiError(error);
      showToast(t('syncPublicPage.unsubscribeError', { message: apiError.message }), {
        variant: 'error',
      });
    },
  });

  useEffect(() => {
    if (!importMutation.isPending) {
      setImportStageIndex(0);
      return;
    }

    setImportStageIndex(0);
    const timeouts = [
      window.setTimeout(() => setImportStageIndex(1), 900),
      window.setTimeout(() => setImportStageIndex(2), 2400),
    ];

    return () => {
      for (const timeoutId of timeouts) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [importMutation.isPending]);

  const handleSubscribeClick = () => {
    if (syncQuery.data?.isOwner) {
      return;
    }
    if (!loggedIn) {
      window.location.assign(getLoginRedirectHref());
      return;
    }
    if (!hasAnyConnectedProvider) {
      window.location.assign(getPlatformsRedirectHref());
      return;
    }
    if (connectedProviders.length === 1) {
      // Skip the picker — go straight to import
      importMutation.mutate({ magicLinkToken: token, recipientProvider: connectedProviders[0] });
      return;
    }
    setSheetOpen(true);
  };

  const handleConfirm = () => {
    if (!selectedProvider) return;
    importMutation.mutate({ magicLinkToken: token, recipientProvider: selectedProvider });
  };

  // ---------------------------------------------------------------------------
  // Render states
  // ---------------------------------------------------------------------------

  const isLoading = syncQuery.isLoading;
  const isError =
    syncQuery.isError || (!isLoading && (!syncQuery.data || syncQuery.data.isRevoked));
  const sync = syncQuery.data;
  const importSteps = [
    t('syncPublicPage.importStepCreate'),
    t('syncPublicPage.importStepMatch'),
    t('syncPublicPage.importStepAdd'),
  ];
  const isOwner = Boolean(sync?.isOwner);
  const isSubscribed = Boolean(sync?.isSubscribed);
  const isBusy = importMutation.isPending || unsubscribeMutation.isPending;
  const primaryLabel = isOwner
    ? t('syncPublicPage.ownerCta')
    : isSubscribed
      ? unsubscribeMutation.isPending
        ? t('syncPublicPage.unsubscribing')
        : t('syncPublicPage.unsubscribeCta')
      : importMutation.isPending
        ? t('syncPublicPage.subscribing')
        : t('syncPublicPage.subscribeCta');
  const primaryVariant = isSubscribed ? 'dangerSoft' : 'primary';
  const isPrimaryDisabled = isOwner || isBusy;

  const handlePrimaryAction = () => {
    if (isOwner) {
      return;
    }
    if (isSubscribed) {
      unsubscribeMutation.mutate();
      return;
    }
    handleSubscribeClick();
  };

  return (
    <div className="relative bg-brand-dark dark:bg-brand-white">
      <HomeFooterReveal />

      <div className="relative z-10 min-h-[calc(100svh+4.5rem)] overflow-hidden rounded-b-[2.75rem] bg-app-bg shadow-[0_28px_64px_-20px_rgba(0,0,0,0.55)] dark:shadow-[0_30px_70px_-20px_rgba(0,0,0,0.72)] sm:min-h-[calc(100svh+5.5rem)] sm:rounded-b-[3.5rem] lg:min-h-[calc(100svh+7rem)] lg:rounded-b-[4.5rem]">
        <BlurSpotLayer
          filterId="sync-public-blur"
          className="pointer-events-none absolute inset-0 z-0"
          spots={[
            { id: 'a', size: 260, top: 5, left: 10, color: 'rgba(198,255,0,0.18)' },
            { id: 'b', size: 280, top: 10, left: 78, color: 'rgba(255,46,139,0.18)' },
            { id: 'c', size: 220, top: 50, left: 50, color: 'rgba(125,211,252,0.15)' },
            { id: 'd', size: 240, top: 78, left: 12, color: 'rgba(198,255,0,0.15)' },
            { id: 'e', size: 200, top: 72, left: 88, color: 'rgba(255,46,139,0.15)' },
          ]}
        />

        <section className="relative mx-auto w-full max-w-2xl px-4 pb-16 pt-20 sm:px-6 sm:pt-24 lg:px-8">
          {/* ── Loading skeleton ── */}
          {isLoading ? (
            <div className="grid gap-8">
              <div className="flex flex-col items-center gap-4 pt-6 text-center">
                <div className="h-20 w-20 animate-pulse rounded-full bg-app-border sm:mb-5 sm:h-36 sm:w-36" />
                <div className="grid gap-2">
                  <div className="mx-auto h-8 w-56 animate-pulse rounded-xl bg-app-border sm:w-80" />
                  <div className="mx-auto h-4 w-40 animate-pulse rounded-lg bg-app-border" />
                </div>
                <div className="h-10 w-36 animate-pulse rounded-full bg-app-border" />
              </div>
              <TrackSkeletonList />
            </div>
          ) : null}

          {/* ── Error ── */}
          {isError ? (
            <div className="flex min-h-[60svh] flex-col items-center justify-center gap-6 text-center">
              <ListMusic size={40} className="text-app-text-secondary/40" aria-hidden="true" />
              <p className="text-sm text-app-text-secondary">{t('syncPublicPage.notFound')}</p>
              {!loggedIn && (
                <CTALink to={getLoginRedirectHref()} variant="primary">
                  {t('syncPublicPage.loginCta')}
                </CTALink>
              )}
            </div>
          ) : null}

          {/* ── Content ── */}
          {sync && !isLoading ? (
            <div className="grid gap-6">
              {/* Hero */}
              <header className="flex flex-col items-center gap-4 pt-4 text-center">
                {/* Playlist artwork placeholder — round, like event cover */}
                <div className="relative mb-1 flex h-20 w-20 items-center justify-center rounded-full border-4 border-app-border bg-app-elevated shadow-lg sm:mb-5 sm:h-36 sm:w-36 dark:bg-app-card">
                  <ListMusic
                    size={28}
                    className="text-app-text-secondary/40 sm:hidden"
                    aria-hidden="true"
                  />
                  <ListMusic
                    size={48}
                    className="hidden text-app-text-secondary/40 sm:block"
                    aria-hidden="true"
                  />
                </div>

                <div className="grid gap-1">
                  <h1 className="text-3xl font-black tracking-tight text-brand-dark dark:text-brand-white sm:text-4xl">
                    {sync.name}
                  </h1>
                </div>

                {/* Subscribe CTA */}
                <CTAButton
                  type="button"
                  variant={primaryVariant}
                  size="lg"
                  onClick={handlePrimaryAction}
                  disabled={isPrimaryDisabled}
                  className="px-8"
                >
                  {primaryLabel}
                </CTAButton>

                {/* Not logged in hint */}
                {!loggedIn && (
                  <p className="text-xs text-app-text-secondary">
                    {t('syncPublicPage.loginRequired')}
                  </p>
                )}
                {loggedIn && isOwner ? (
                  <p className="text-xs text-app-text-secondary">{t('syncPublicPage.ownerHint')}</p>
                ) : null}
                {loggedIn && isSubscribed ? (
                  <p className="text-xs text-app-text-secondary">
                    {t('syncPublicPage.unsubscribeHint')}
                  </p>
                ) : null}
                {importMutation.isPending ? (
                  <div className="w-full max-w-md rounded-2xl border border-app-border bg-app-elevated/80 px-4 py-4 text-left shadow-soft-lift backdrop-blur-sm dark:bg-app-card/80">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-app-text-secondary">
                      {t('syncPublicPage.importProgressTitle')}
                    </p>
                    <div className="mt-3 grid gap-2.5">
                      {importSteps.map((label, index) => {
                        const isComplete = index < importStageIndex;
                        const isCurrent = index === importStageIndex;

                        return (
                          <div key={label} className="flex items-center gap-3">
                            <span
                              className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                                isComplete
                                  ? 'border-brand-lime/60 bg-brand-lime/15 text-[#6d9600] dark:text-[#d5ff5c]'
                                  : isCurrent
                                    ? 'border-brand-pink/60 bg-brand-pink/10 text-brand-pink'
                                    : 'border-app-border text-app-text-secondary/50'
                              }`}
                            >
                              {isComplete ? (
                                <Check size={14} aria-hidden="true" />
                              ) : isCurrent ? (
                                <LoaderCircle
                                  size={14}
                                  className="animate-spin"
                                  aria-hidden="true"
                                />
                              ) : (
                                <span
                                  className="h-2 w-2 rounded-full bg-current"
                                  aria-hidden="true"
                                />
                              )}
                            </span>
                            <p
                              className={`text-sm ${
                                isComplete || isCurrent
                                  ? 'font-semibold text-brand-dark dark:text-brand-white'
                                  : 'text-app-text-secondary'
                              }`}
                            >
                              {label}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {/* Subscriber count */}
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <div className="flex items-center gap-1.5 rounded-full border border-brand-lime/60 bg-brand-lime/10 px-3 py-1.5 text-xs font-semibold text-[#6d9600] backdrop-blur-sm dark:text-[#d5ff5c]">
                    <Users size={12} aria-hidden="true" />
                    {t('syncPublicPage.subscriberCount_other', { count: sync.subscriberCount })}
                  </div>
                </div>
              </header>

              {/* Track list */}
              <div className="grid gap-3">
                <div className="flex items-center justify-between">
                  <p className="pl-4 text-xs font-semibold text-app-text-secondary">
                    {t('syncPublicPage.currentTracks', { count: sync.tracks.length })}
                  </p>
                </div>

                {sync.tracks.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 py-12 text-center">
                    <ListMusic
                      size={32}
                      className="text-app-text-secondary/40"
                      aria-hidden="true"
                    />
                    <p className="text-sm font-semibold text-app-text-secondary">
                      {t('syncPublicPage.noTracksYet')}
                    </p>
                  </div>
                ) : (
                  <>
                    <ul className="grid gap-3">
                      {sync.tracks.slice(0, visibleTracks).map((track, i) => (
                        <SyncTrackRow key={`${track.name}-${i}`} track={track} />
                      ))}
                    </ul>
                    {sync.tracks.length > visibleTracks && (
                      <div className="flex justify-center pt-1">
                        <CTAButton
                          type="button"
                          variant="secondary"
                          onClick={() => setVisibleTracks((v) => v + VISIBLE_TRACKS_STEP)}
                        >
                          {t('eventPublicPage.loadMoreTracks')}
                        </CTAButton>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Footer controls */}
              <div className="flex justify-center pt-2">
                <div className="flex items-center gap-2 rounded-full border border-app-border/70 bg-app-elevated/90 px-2 py-1.5 shadow-soft-lift backdrop-blur-md dark:bg-app-card/90">
                  <LanguageSwitcher />
                  <ThemeToggle />
                </div>
              </div>
            </div>
          ) : null}
        </section>
      </div>

      <div aria-hidden className="h-112 sm:h-96 lg:h-104" />

      {/* Provider picker sheet */}
      <ProviderSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        connectedProviders={connectedProviders}
        selectedProvider={selectedProvider}
        onSelect={setSelectedProvider}
        onConfirm={handleConfirm}
        isImporting={importMutation.isPending}
      />
    </div>
  );
};

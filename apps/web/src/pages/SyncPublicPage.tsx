import type { SyncPublicTrack } from '@synqit/shared';
import { providerSchema } from '@synqit/shared';
import { Highlight, Sticker, useToast } from '@synqit/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ListMusic, LoaderCircle, ShieldCheck, Users } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { TrackSkeletonList } from '../components/events/PublicTrackRow';
import { ProviderIcon } from '../components/providers/ProviderIcon';
import { PublicPageShell } from '../components/public/PublicPageShell';
import { CTAButton, CTALink } from '../components/ui/cta';
import { LanguageSwitcher } from '../components/ui/LanguageSwitcher';
import { ThemeToggle } from '../components/ui/ThemeToggle';
import { useI18n } from '../hooks/useI18n';
import { trackAnalyticsEvent } from '../lib/analytics';
import { toApiError } from '../lib/api';
import { isAuthenticated } from '../lib/auth';
import {
  EMPTY_INTEGRATION_MAP,
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
        className="fixed inset-0 z-40 bg-brand-dark/55 backdrop-blur-[2px] dark:bg-black/70"
        aria-hidden="true"
      />

      {/* Bottom-sheet on mobile, centred modal on desktop */}
      <div
        role="dialog"
        aria-modal="true"
        className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl border-2 border-b-0 border-app-text bg-app-elevated p-6 dark:bg-app-card sm:inset-0 sm:m-auto sm:h-fit sm:max-w-sm sm:rounded-3xl sm:border-b-2 sm:shadow-[6px_6px_0_0_var(--syn-text)]"
      >
        <div className="mx-auto mb-1 h-1.5 w-12 rounded-full bg-app-text/30 sm:hidden" />
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
              className={`flex w-full cursor-pointer items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left transition ${
                selectedProvider === p
                  ? 'border-app-text bg-brand-lime/20 shadow-sticker-sm'
                  : 'border-app-border-strong bg-app-surface hover:border-app-text dark:bg-app-elevated'
              }`}
            >
              <ProviderIcon provider={p} sizeClassName="h-8 w-8" />
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

const SyncTrackRow = ({ track, index }: { track: SyncPublicTrack; index: number }) => (
  <li className="relative flex min-w-0 items-center gap-3 rounded-2xl border-2 border-app-text bg-app-elevated px-3 py-3 shadow-sticker-sm dark:bg-app-card">
    <Sticker
      tone="paper"
      tilt="rotate-3"
      className="absolute -right-2 -top-2.5 px-2 py-0 text-[10px] tabular-nums"
    >
      {String(index + 1).padStart(2, '0')}
    </Sticker>
    {track.artworkUrl ? (
      <img
        src={track.artworkUrl}
        alt=""
        width={44}
        height={44}
        className="h-11 w-11 shrink-0 rounded-lg border-2 border-app-text object-cover"
      />
    ) : (
      <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border-2 border-app-text bg-app-surface text-xs text-app-text-secondary">
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
  const [showImportSuccessOverlay, setShowImportSuccessOverlay] = useState(false);
  const [isImportPreviewActive, setIsImportPreviewActive] = useState(false);
  const importSuccessTimeoutRef = useRef<number | null>(null);
  const importStageTimeoutsRef = useRef<number[]>([]);
  const hasRunPreviewFromQueryRef = useRef(false);

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

  const providerStatusByType = integrationsQuery.data ?? EMPTY_INTEGRATION_MAP;

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
    onSuccess: (_result, variables) => {
      setSheetOpen(false);
      setImportStageIndex(2);
      setIsImportPreviewActive(false);
      setShowImportSuccessOverlay(true);
      trackAnalyticsEvent({
        eventName: 'sync_subscribed',
        target: 'sync',
        properties: { provider: variables.recipientProvider },
      });
      if (importSuccessTimeoutRef.current !== null) {
        window.clearTimeout(importSuccessTimeoutRef.current);
      }
      importSuccessTimeoutRef.current = window.setTimeout(() => {
        setShowImportSuccessOverlay(false);
        importSuccessTimeoutRef.current = null;
      }, 4_000);
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
      trackAnalyticsEvent({
        eventName: 'sync_unsubscribed',
        target: 'sync',
      });
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
    if (isImportPreviewActive) {
      return;
    }

    if (!importMutation.isPending) {
      if (!showImportSuccessOverlay) {
        setImportStageIndex(0);
      }
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
  }, [importMutation.isPending, isImportPreviewActive, showImportSuccessOverlay]);

  useEffect(() => {
    return () => {
      if (importSuccessTimeoutRef.current !== null) {
        window.clearTimeout(importSuccessTimeoutRef.current);
      }
      for (const timeoutId of importStageTimeoutsRef.current) {
        window.clearTimeout(timeoutId);
      }
    };
  }, []);

  const startImportPreview = useCallback((mode: 'steps' | 'success') => {
    for (const timeoutId of importStageTimeoutsRef.current) {
      window.clearTimeout(timeoutId);
    }
    importStageTimeoutsRef.current = [];

    if (importSuccessTimeoutRef.current !== null) {
      window.clearTimeout(importSuccessTimeoutRef.current);
      importSuccessTimeoutRef.current = null;
    }

    setImportStageIndex(0);
    setShowImportSuccessOverlay(false);
    setIsImportPreviewActive(true);

    importStageTimeoutsRef.current.push(
      window.setTimeout(() => setImportStageIndex(1), 900),
      window.setTimeout(() => {
        setImportStageIndex(2);

        if (mode === 'success') {
          setShowImportSuccessOverlay(true);
          importSuccessTimeoutRef.current = window.setTimeout(() => {
            setShowImportSuccessOverlay(false);
            setIsImportPreviewActive(false);
            importSuccessTimeoutRef.current = null;
          }, 4_000);
          return;
        }

        setIsImportPreviewActive(false);
      }, 2400),
    );
  }, []);

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      hasRunPreviewFromQueryRef.current ||
      syncQuery.isLoading ||
      syncQuery.isError ||
      !syncQuery.data ||
      syncQuery.data.isRevoked
    ) {
      return;
    }

    const previewMode = new URLSearchParams(window.location.search).get('syncPreview');
    if (previewMode === 'steps' || previewMode === 'success') {
      hasRunPreviewFromQueryRef.current = true;
      startImportPreview(previewMode);
    }
  }, [startImportPreview, syncQuery.data, syncQuery.isError, syncQuery.isLoading]);

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
  const showImportProgressCard =
    importMutation.isPending || isImportPreviewActive || showImportSuccessOverlay;
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
    <PublicPageShell>
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
              <div className="relative mb-1 flex h-20 w-20 items-center justify-center rounded-full border-[3px] border-app-text bg-brand-lime text-brand-dark shadow-sticker sm:mb-5 sm:h-36 sm:w-36">
                <ListMusic size={28} className="sm:hidden" aria-hidden="true" />
                <ListMusic size={48} className="hidden sm:block" aria-hidden="true" />
              </div>

              <div className="grid gap-1">
                <h1 className="text-3xl font-black leading-[1.05] tracking-tight text-balance text-brand-dark dark:text-brand-white sm:text-5xl">
                  <Highlight>{sync.name}</Highlight>
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
              <motion.div
                layout
                transition={{ layout: { duration: 0.28, ease: [0.22, 1, 0.36, 1] } }}
                className={`relative w-full max-w-xl text-left ${
                  showImportProgressCard
                    ? 'rounded-3xl border-2 border-app-text bg-app-elevated px-4 py-4 shadow-sticker dark:bg-app-card'
                    : 'rounded-2xl border border-dashed border-app-text/35 bg-app-elevated/50 px-4 py-3 dark:bg-app-card/40'
                }`}
              >
                <div className="relative">
                  <AnimatePresence initial={false} mode="wait">
                    {showImportProgressCard ? (
                      <motion.div
                        key="import-progress"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                        className={`relative w-full ${
                          showImportSuccessOverlay ? 'min-h-[9.5rem] sm:min-h-[10rem]' : ''
                        }`}
                      >
                        <p
                          className={`text-xs font-semibold uppercase tracking-[0.18em] text-app-text-secondary transition-opacity duration-150 ${
                            showImportSuccessOverlay ? 'invisible opacity-0' : 'visible opacity-100'
                          }`}
                        >
                          {t('syncPublicPage.importProgressTitle')}
                        </p>
                        <div
                          className={`mt-2 grid gap-2.5 transition-opacity duration-150 ${
                            showImportSuccessOverlay ? 'invisible opacity-0' : 'visible opacity-100'
                          }`}
                        >
                          {importSteps.map((label, index) => {
                            const isComplete = index < importStageIndex;
                            const isCurrent = index === importStageIndex;

                            return (
                              <div key={label} className="flex items-center gap-3">
                                <span
                                  className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
                                    isComplete
                                      ? 'border-app-text bg-brand-lime text-brand-dark'
                                      : isCurrent
                                        ? 'border-app-text bg-brand-pink text-brand-white'
                                        : 'border-app-border-strong text-app-text-secondary/50'
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
                        <AnimatePresence>
                          {showImportSuccessOverlay ? (
                            <motion.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              transition={{
                                delay: 0.3,
                                duration: 0.32,
                                ease: [0.22, 1, 0.36, 1],
                              }}
                              className="absolute inset-0 z-10 grid place-items-center rounded-[inherit] px-6 py-4 text-center"
                            >
                              <div className="flex w-full flex-col items-center justify-center gap-3">
                                <motion.div
                                  initial={{ opacity: 0, scale: 0.8 }}
                                  animate={{
                                    opacity: 1,
                                    scale: [0.8, 1.1, 0.96, 1],
                                  }}
                                  exit={{ opacity: 0, scale: 0.98 }}
                                  transition={{
                                    delay: 0.62,
                                    duration: 0.46,
                                    ease: [0.22, 1, 0.36, 1],
                                  }}
                                  className="relative inline-flex h-14 w-14 items-center justify-center rounded-full border-2 border-app-text bg-brand-lime text-brand-dark shadow-sticker-sm sm:h-16 sm:w-16"
                                >
                                  <motion.svg
                                    width="56"
                                    height="56"
                                    viewBox="0 0 64 64"
                                    fill="none"
                                    aria-hidden="true"
                                    className="overflow-visible"
                                  >
                                    <circle
                                      cx="32"
                                      cy="32"
                                      r="22"
                                      stroke="currentColor"
                                      strokeOpacity="0.12"
                                      strokeWidth="4"
                                    />
                                    <motion.circle
                                      cx="32"
                                      cy="32"
                                      r="22"
                                      stroke="currentColor"
                                      strokeWidth="4"
                                      strokeLinecap="round"
                                      initial={{ pathLength: 0, opacity: 0 }}
                                      animate={{ pathLength: 1, opacity: 1 }}
                                      exit={{ opacity: 0 }}
                                      transition={{
                                        duration: 0.4,
                                        delay: 1.1,
                                        ease: [0.22, 1, 0.36, 1],
                                      }}
                                    />
                                    <motion.g
                                      initial={{ opacity: 0, scale: 0.7, rotate: -8 }}
                                      animate={{
                                        opacity: 1,
                                        scale: [0.7, 1.12, 0.98, 1],
                                        rotate: [-8, 2, 0],
                                      }}
                                      exit={{ opacity: 0, scale: 0.92 }}
                                      transition={{
                                        delay: 1.38,
                                        duration: 0.42,
                                        ease: [0.22, 1, 0.36, 1],
                                      }}
                                      style={{ originX: '32px', originY: '32px' }}
                                    >
                                      <motion.path
                                        d="M23 32.5L29.2 38.7L41.5 26.4"
                                        stroke="currentColor"
                                        strokeWidth="4.5"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        initial={{ pathLength: 0 }}
                                        animate={{ pathLength: 1 }}
                                        exit={{ opacity: 0 }}
                                        transition={{
                                          duration: 0.26,
                                          delay: 1.42,
                                          ease: [0.22, 1, 0.36, 1],
                                        }}
                                      />
                                    </motion.g>
                                  </motion.svg>
                                </motion.div>
                                <motion.div
                                  initial={{ opacity: 0, y: 4 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: 2 }}
                                  transition={{
                                    delay: 0.68,
                                    duration: 0.22,
                                    ease: [0.22, 1, 0.36, 1],
                                  }}
                                  className="grid max-w-xs gap-1"
                                >
                                  <p className="text-base font-black leading-none text-brand-dark dark:text-brand-white">
                                    {t('syncPublicPage.importSuccessTitle')}
                                  </p>
                                  <p className="text-sm font-medium leading-tight text-brand-dark/80 dark:text-brand-white/80">
                                    {t('syncPublicPage.importSuccessBody')}
                                  </p>
                                </motion.div>
                              </div>
                            </motion.div>
                          ) : null}
                        </AnimatePresence>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="owner-managed"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                        className="flex items-start gap-3"
                      >
                        <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-app-text/40 text-app-text-secondary">
                          <ShieldCheck size={14} aria-hidden="true" />
                        </span>
                        <div className="grid gap-0.5">
                          <p className="text-xs font-black uppercase tracking-[0.12em] text-app-text-secondary">
                            {t('syncPublicPage.ownerManagedTitle')}
                          </p>
                          <p className="text-xs leading-5 text-app-text-secondary">
                            {t('syncPublicPage.ownerManagedBody')}
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>

              {/* Subscriber count */}
              <div className="flex flex-wrap items-center justify-center gap-2">
                <div className="flex items-center gap-1.5 rounded-full border-2 border-app-text bg-brand-lime px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-brand-dark shadow-sticker-sm">
                  <Users size={12} aria-hidden="true" />
                  {t('syncPublicPage.subscriberCount_other', { count: sync.subscriberCount })}
                </div>
              </div>
            </header>

            {/* Track list */}
            <div className="grid gap-3">
              <div className="flex items-center justify-between">
                <p className="pl-1 text-xs font-black uppercase tracking-[0.14em] text-app-text-secondary">
                  {t('syncPublicPage.currentTracks', { count: sync.tracks.length })}
                </p>
              </div>

              {sync.tracks.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-12 text-center">
                  <ListMusic size={32} className="text-app-text-secondary/40" aria-hidden="true" />
                  <p className="text-sm font-semibold text-app-text-secondary">
                    {t('syncPublicPage.noTracksYet')}
                  </p>
                </div>
              ) : (
                <>
                  <ul className="grid gap-4 pt-1">
                    {sync.tracks.slice(0, visibleTracks).map((track, i) => (
                      <SyncTrackRow key={`${track.name}-${i}`} track={track} index={i} />
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
              <div className="flex items-center gap-2 rounded-full border-2 border-app-text bg-app-elevated px-2 py-1.5 shadow-sticker-sm dark:bg-app-card">
                <LanguageSwitcher />
                <ThemeToggle />
              </div>
            </div>
          </div>
        ) : null}
      </section>

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
    </PublicPageShell>
  );
};

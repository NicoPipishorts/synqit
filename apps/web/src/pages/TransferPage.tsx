import type { ProviderPlaylistItem, ProviderPlaylistTrack, SyncItem } from '@synqit/shared';
import { Sticker, useToast } from '@synqit/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  Music2,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { AppPageHeader } from '../components/app/AppPageHeader';
import { AppPageLayout } from '../components/app/AppPageLayout';
import { CreateFlowStepBreadcrumbs } from '../components/create-flow/CreateFlowStepBreadcrumbs';
import { CREATE_FLOW_STEP_SLIDE_VARIANTS } from '../components/create-flow/flowMotion';
import { EventProviderIcon } from '../components/events/EventProviderIcon';
import { SyncPlaylistPicker } from '../components/syncs/SyncPlaylistPicker';
import { CTAButton, CTALink } from '../components/ui/cta';
import { useI18n } from '../hooks/useI18n';
import { trackAnalyticsEvent } from '../lib/analytics';
import { toApiError } from '../lib/api';
import { connectAppleMusic } from '../lib/appleMusic';
import { openProviderOauthPopup } from '../lib/providerOauthPopup';
import {
  createSync,
  fetchIntegrations,
  fetchProviderPlaylistTrackCount,
  fetchProviderPlaylistTracks,
  fetchProviderPlaylists,
  importSync,
  queryKeys,
  syncQueryKeys,
} from '../lib/queries';
import type { Provider } from '../lib/types';

const PLAYLISTS_PAGE_SIZE = 25;
const TRANSFER_ROW_HEIGHT = 76;
const TRANSFER_VISIBLE_ROWS = 5;
const STEP_TWO_VISIBLE_TRACKS = 15;

type TransferStep = 1 | 2 | 3;

type ProviderCardProps = {
  title: string;
  selectedProvider: Provider;
  providerStatusByType: Record<Provider, 'connected' | 'not_connected'>;
  isBusy: boolean;
  connectLabel: string;
  connectedLabel: string;
  notConnectedLabel: string;
  onConnect: (provider: Provider) => void;
};

const formatDuration = (durationMs: number): string => {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

const ProviderCard = ({
  title,
  selectedProvider,
  providerStatusByType,
  isBusy,
  connectLabel,
  connectedLabel,
  notConnectedLabel,
  onConnect,
}: ProviderCardProps) => {
  const isConnected = providerStatusByType[selectedProvider] === 'connected';
  return (
    <motion.article
      layoutId={`transfer-provider-card-${selectedProvider}`}
      transition={{ type: 'spring', stiffness: 320, damping: 30 }}
      className="relative rounded-2xl border-2 border-app-text bg-app-surface p-5 shadow-sticker-sm dark:bg-app-elevated"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="grid gap-1">
          <Sticker tone="paper" tilt="-rotate-2" className="mb-1">
            {title}
          </Sticker>
          <p className="text-2xl font-black text-brand-dark dark:text-brand-white">
            {selectedProvider === 'spotify' ? 'Spotify' : 'Apple Music'}
          </p>
          <p className="text-sm text-app-text-secondary">
            {isConnected ? connectedLabel : notConnectedLabel}
          </p>
        </div>
        <EventProviderIcon provider={selectedProvider} sizeClassName="h-14 w-14 sm:h-16 sm:w-16" />
      </div>

      {!isConnected ? (
        <div className="mt-5">
          <CTAButton
            variant="primary"
            className="w-full justify-center"
            onClick={() => onConnect(selectedProvider)}
            disabled={isBusy}
          >
            {isBusy ? <LoaderCircle size={14} className="animate-spin" aria-hidden="true" /> : null}
            {connectLabel}
          </CTAButton>
        </div>
      ) : null}
    </motion.article>
  );
};

const PlaylistTrackRow = ({
  track,
  state = 'pending',
  compact = false,
}: {
  track: ProviderPlaylistTrack;
  state?: 'completed' | 'active' | 'pending' | 'skipped';
  compact?: boolean;
}) => (
  <div
    className={`flex items-center gap-3 rounded-2xl border-2 px-3 py-3 transition ${
      state === 'completed'
        ? 'border-app-text bg-brand-lime/20'
        : state === 'active'
          ? 'border-app-text bg-brand-pink/10 shadow-sticker-sm'
          : state === 'skipped'
            ? 'border-dashed border-app-text/40 bg-app-surface dark:bg-app-elevated'
            : 'border-app-border-strong bg-app-surface dark:bg-app-elevated'
    } ${compact ? '' : 'min-h-[4.5rem]'}`}
  >
    {track.artworkUrl ? (
      <img
        src={track.artworkUrl}
        alt=""
        className="h-11 w-11 shrink-0 rounded-xl border-2 border-app-text object-cover"
      />
    ) : (
      <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 border-app-text bg-app-surface text-app-text dark:bg-app-elevated">
        <Music2 size={16} aria-hidden="true" />
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
    <div className="flex items-center gap-2">
      <span className="hidden text-xs text-app-text-secondary sm:inline">
        {formatDuration(track.durationMs)}
      </span>
      <span
        className={`inline-flex h-8 w-8 items-center justify-center rounded-full border-2 transition ${
          state === 'completed'
            ? 'border-app-text bg-brand-lime text-brand-dark'
            : state === 'active'
              ? 'border-app-text bg-brand-pink text-brand-white'
              : state === 'skipped'
                ? 'border-dashed border-app-text/50 text-app-text-muted'
                : 'border-app-border-strong text-app-text-secondary'
        }`}
      >
        {state === 'completed' ? (
          <Check size={14} strokeWidth={3} aria-hidden="true" />
        ) : state === 'active' ? (
          <LoaderCircle size={14} className="animate-spin" aria-hidden="true" />
        ) : state === 'skipped' ? (
          <X size={14} strokeWidth={3} aria-hidden="true" />
        ) : (
          <ChevronRight size={14} aria-hidden="true" />
        )}
      </span>
    </div>
  </div>
);

const TransferViewport = ({
  tracks,
  progressCount,
  matchedCount,
  transferComplete,
}: {
  tracks: ProviderPlaylistTrack[];
  progressCount: number;
  matchedCount: number;
  transferComplete: boolean;
}) => {
  const viewportHeight = TRANSFER_ROW_HEIGHT * TRANSFER_VISIBLE_ROWS;
  const maxOffset = Math.max(0, tracks.length - TRANSFER_VISIBLE_ROWS) * TRANSFER_ROW_HEIGHT;
  const y = Math.min(Math.max(progressCount - 2, 0) * TRANSFER_ROW_HEIGHT, maxOffset);

  if (transferComplete) {
    return (
      <div className="max-h-[min(70svh,38rem)] overflow-y-auto rounded-2xl border-2 border-app-text/70 bg-app-surface p-3 dark:bg-app-elevated">
        <div className="grid gap-2">
          {tracks.map((track, index) => (
            <PlaylistTrackRow
              key={`${track.providerTrackId}-${index}`}
              track={track}
              state={index < matchedCount ? 'completed' : 'skipped'}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border-2 border-app-text/70 bg-app-surface p-3 dark:bg-app-elevated">
      <div className="overflow-hidden" style={{ height: viewportHeight }}>
        <motion.div
          animate={{ y: -y }}
          transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
          className="grid gap-2"
        >
          {tracks.map((track, index) => (
            <div key={`${track.providerTrackId}-${index}`} style={{ height: TRANSFER_ROW_HEIGHT }}>
              <PlaylistTrackRow
                track={track}
                state={
                  index < progressCount
                    ? 'completed'
                    : index === progressCount
                      ? 'active'
                      : 'pending'
                }
              />
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
};

export const TransferPage = () => {
  const { t } = useI18n();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<TransferStep>(1);
  const [stepDirection, setStepDirection] = useState<1 | -1>(1);
  const [sourceProvider, setSourceProvider] = useState<Provider>('spotify');
  const [destinationProvider, setDestinationProvider] = useState<Provider>('apple');
  const [selectedPlaylist, setSelectedPlaylist] = useState<ProviderPlaylistItem | null>(null);
  const [playlistOffset, setPlaylistOffset] = useState(0);
  const [allPlaylists, setAllPlaylists] = useState<ProviderPlaylistItem[]>([]);
  const [hasMorePlaylists, setHasMorePlaylists] = useState(false);
  const [isConnectingProvider, setIsConnectingProvider] = useState<Provider | null>(null);
  const [resultSync, setResultSync] = useState<SyncItem | null>(null);
  const [resultCounts, setResultCounts] = useState<{
    matchedCount: number;
    skippedCount: number;
  } | null>(null);
  const [transferProgressCount, setTransferProgressCount] = useState(0);
  const [isTransferResponseReady, setIsTransferResponseReady] = useState(false);

  const integrationsQuery = useQuery({
    queryKey: queryKeys.integrations.list(),
    queryFn: fetchIntegrations,
    staleTime: 60_000,
  });

  const providerStatusByType = integrationsQuery.data ?? {
    spotify: 'not_connected',
    apple: 'not_connected',
  };

  const sourceConnected = providerStatusByType[sourceProvider] === 'connected';
  const destinationConnected = providerStatusByType[destinationProvider] === 'connected';
  const bothConnected = sourceConnected && destinationConnected;

  const playlistsQuery = useQuery({
    queryKey: syncQueryKeys.providerPlaylists(sourceProvider, playlistOffset),
    queryFn: () =>
      fetchProviderPlaylists({
        provider: sourceProvider,
        limit: PLAYLISTS_PAGE_SIZE,
        offset: playlistOffset,
      }),
    enabled: sourceConnected,
    staleTime: Infinity,
  });

  const selectedPlaylistTrackCountQuery = useQuery({
    queryKey: syncQueryKeys.providerPlaylistTrackCount(
      sourceProvider,
      selectedPlaylist?.providerPlaylistId ?? '',
    ),
    queryFn: () =>
      fetchProviderPlaylistTrackCount({
        provider: sourceProvider,
        providerPlaylistId: selectedPlaylist!.providerPlaylistId,
      }),
    enabled: sourceConnected && selectedPlaylist !== null && selectedPlaylist.trackCount === null,
    retry: false,
    staleTime: Infinity,
  });

  const selectedPlaylistTracksQuery = useQuery({
    queryKey: syncQueryKeys.providerPlaylistTracks(
      sourceProvider,
      selectedPlaylist?.providerPlaylistId ?? '',
    ),
    queryFn: () =>
      fetchProviderPlaylistTracks({
        provider: sourceProvider,
        providerPlaylistId: selectedPlaylist!.providerPlaylistId,
      }),
    enabled: sourceConnected && selectedPlaylist !== null,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (!playlistsQuery.data) return;
    const { playlists, hasMore } = playlistsQuery.data;
    setAllPlaylists((prev) => {
      if (playlistOffset === 0) return playlists;
      const existingIds = new Set(prev.map((item) => item.providerPlaylistId));
      return [...prev, ...playlists.filter((item) => !existingIds.has(item.providerPlaylistId))];
    });
    setHasMorePlaylists(hasMore);
  }, [playlistsQuery.data, playlistOffset]);

  useEffect(() => {
    setSelectedPlaylist(null);
    setPlaylistOffset(0);
    setAllPlaylists([]);
    setHasMorePlaylists(false);
    setResultSync(null);
    setResultCounts(null);
    setTransferProgressCount(0);
    setIsTransferResponseReady(false);
    if (step > 1) {
      setStep(1);
    }
  }, [sourceProvider]);

  useEffect(() => {
    setResultSync(null);
    setResultCounts(null);
    setTransferProgressCount(0);
    setIsTransferResponseReady(false);
  }, [destinationProvider]);

  useEffect(() => {
    if (selectedPlaylistTrackCountQuery.data === undefined || !selectedPlaylist) {
      return;
    }

    const nextTrackCount = selectedPlaylistTrackCountQuery.data;
    setSelectedPlaylist((current) => {
      if (!current || current.providerPlaylistId !== selectedPlaylist.providerPlaylistId) {
        return current;
      }
      if (current.trackCount === nextTrackCount) {
        return current;
      }
      return {
        ...current,
        trackCount: nextTrackCount,
      };
    });
    setAllPlaylists((current) =>
      current.map((playlist) =>
        playlist.providerPlaylistId === selectedPlaylist.providerPlaylistId
          ? { ...playlist, trackCount: nextTrackCount }
          : playlist,
      ),
    );
  }, [selectedPlaylist, selectedPlaylistTrackCountQuery.data]);

  const connectSelectedProvider = useCallback(
    async (provider: Provider) => {
      setIsConnectingProvider(provider);
      try {
        if (provider === 'apple') {
          await connectAppleMusic();
        } else {
          await openProviderOauthPopup({
            provider: 'spotify',
            nextPath: '/transfer',
          });
        }

        await queryClient.invalidateQueries({ queryKey: queryKeys.integrations.all() });
        showToast(
          t('profile.connectionConnected', {
            provider: provider === 'spotify' ? 'Spotify' : 'Apple Music',
          }),
          { variant: 'success' },
        );
      } catch (error) {
        const apiError = toApiError(error);
        showToast(t('syncCreatePage.connectionError', { message: apiError.message }), {
          variant: 'error',
        });
      } finally {
        setIsConnectingProvider(null);
      }
    },
    [queryClient, showToast, t],
  );

  const previewTracks = selectedPlaylistTracksQuery.data ?? [];
  const transferTracks = previewTracks.length > 0 ? previewTracks : [];

  const transferMutation = useMutation({
    mutationFn: async () => {
      if (sourceProvider === destinationProvider) {
        throw new Error('same_provider');
      }
      if (!selectedPlaylist) {
        throw new Error('missing_playlist');
      }

      const created = await createSync({
        provider: sourceProvider,
        providerPlaylistId: selectedPlaylist.providerPlaylistId,
        name: selectedPlaylist.name,
        trackCount: selectedPlaylist.trackCount,
        syncMode: 'host_only',
        kind: 'transfer',
      });
      const imported = await importSync({
        magicLinkToken: created.sync.magicLinkToken,
        recipientProvider: destinationProvider,
      });

      return { created, imported };
    },
    onMutate: () => {
      setResultSync(null);
      setResultCounts(null);
      setIsTransferResponseReady(false);
      setTransferProgressCount(0);
    },
    onSuccess: ({ created, imported }) => {
      setResultSync(created.sync);
      setResultCounts({
        matchedCount: imported.matchedCount,
        skippedCount: imported.skippedCount,
      });
      setIsTransferResponseReady(true);
      showToast(t('transferPage.success', { name: created.sync.name }), { variant: 'success' });
      trackAnalyticsEvent({
        eventName: 'playlist_transfer_succeeded',
        target: 'transfer',
        properties: {
          sourceProvider,
          destinationProvider,
        },
      });
      void queryClient.invalidateQueries({ queryKey: syncQueryKeys.all() });
    },
    onError: (error) => {
      let messageKey = 'transferPage.error';
      let message = toApiError(error).message;
      if (error instanceof Error && error.message === 'same_provider') {
        messageKey = 'transferPage.providerSameError';
        message = t('transferPage.providerSameError');
      }
      if (error instanceof Error && error.message === 'missing_playlist') {
        messageKey = 'transferPage.playlistRequired';
        message = t('transferPage.playlistRequired');
      }
      showToast(messageKey === 'transferPage.error' ? t(messageKey, { message }) : message, {
        variant: 'error',
      });
      trackAnalyticsEvent({
        eventName: 'playlist_transfer_failed',
        target: 'transfer',
        properties: {
          sourceProvider,
          destinationProvider,
          message,
        },
      });
    },
  });

  useEffect(() => {
    if (!transferMutation.isPending) {
      return;
    }

    const total = Math.max(transferTracks.length, 1);
    const intervalId = window.setInterval(() => {
      setTransferProgressCount((current) => {
        if (current >= total) {
          window.clearInterval(intervalId);
          return current;
        }
        return current + 1;
      });
    }, 260);

    return () => window.clearInterval(intervalId);
  }, [transferMutation.isPending, transferTracks.length]);

  const transferAnimationComplete =
    !transferMutation.isPending &&
    isTransferResponseReady &&
    transferProgressCount >= Math.max(transferTracks.length, 1);
  const matchedCount = resultCounts?.matchedCount ?? 0;

  const canAdvanceFromStep1 = bothConnected && sourceProvider !== destinationProvider;
  const canAdvanceFromStep2 = selectedPlaylist !== null;
  const isBusy = transferMutation.isPending || isConnectingProvider !== null;

  const stepItems = [
    { value: 1 as const, label: t('transferPage.stepProviders') },
    { value: 2 as const, label: t('transferPage.stepPlaylist') },
    { value: 3 as const, label: t('transferPage.stepTransfer') },
  ] as const;

  const stepTitle = useMemo(() => {
    if (step === 1) return t('transferPage.providersHeading');
    if (step === 2) return t('transferPage.playlistTitle');
    return t('transferPage.confirmTitle');
  }, [step, t]);

  const stepBody = useMemo(() => {
    if (step === 1) return t('transferPage.providerBody');
    if (step === 2) return t('transferPage.playlistBody');
    return t('transferPage.confirmBody');
  }, [step, t]);

  const goToStep = (nextStep: TransferStep) => {
    setStepDirection(nextStep > step ? 1 : -1);
    setStep(nextStep);
  };

  const handleNext = () => {
    if (step === 1) {
      if (!canAdvanceFromStep1) {
        showToast(
          bothConnected
            ? t('transferPage.providerSameError')
            : t('transferPage.statusMissingConnections'),
          { variant: 'error' },
        );
        return;
      }
      goToStep(2);
      return;
    }

    if (step === 2) {
      if (!canAdvanceFromStep2) {
        showToast(t('transferPage.playlistRequired'), { variant: 'error' });
        return;
      }
      goToStep(3);
      return;
    }

    if (!transferMutation.isPending && !transferAnimationComplete) {
      transferMutation.mutate();
    }
  };

  const handleBack = () => {
    if (step === 1 || transferMutation.isPending) {
      return;
    }
    if (step === 2 && selectedPlaylist) {
      setSelectedPlaylist(null);
      return;
    }
    if (step === 3) {
      goToStep(2);
      return;
    }
    goToStep(1);
  };

  const [swapSpin, setSwapSpin] = useState(0);
  const handleSwapProviders = () => {
    setSourceProvider(destinationProvider);
    setDestinationProvider(sourceProvider);
  };

  const sourceLabel = sourceProvider === 'spotify' ? 'Spotify' : 'Apple Music';
  const destinationLabel = destinationProvider === 'spotify' ? 'Spotify' : 'Apple Music';
  // Round-trip: the chosen source playlist was itself created by a previous
  // Synqit transfer from the provider we're now sending it back to.
  const isRoundTrip =
    selectedPlaylist?.origin != null && selectedPlaylist.origin.provider === destinationProvider;
  const roundTripWarning =
    isRoundTrip && selectedPlaylist ? (
      <div className="flex items-start gap-3 rounded-2xl border-2 border-app-text bg-[#ffc400]/25 px-4 py-3 text-sm font-semibold text-app-text">
        <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
        <p>
          {t('transferPage.roundTripWarning', {
            name: selectedPlaylist.name,
            provider: destinationLabel,
          })}
        </p>
      </div>
    ) : null;

  // Re-transfer: this same source playlist was already transferred before.
  // Stronger warning when it was sent to the destination we picked now.
  const providerLabel = (provider: Provider) =>
    provider === 'spotify' ? 'Spotify' : 'Apple Music';
  const priorTransfer = selectedPlaylist?.priorTransfer ?? null;
  const hasPriorTransfer = priorTransfer != null && priorTransfer.destinationProviders.length > 0;
  const alreadyTransferredToDestination =
    hasPriorTransfer && priorTransfer.destinationProviders.includes(destinationProvider);
  const priorTransferDate = priorTransfer?.lastTransferredAt
    ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(
        new Date(priorTransfer.lastTransferredAt),
      )
    : null;
  const retransferWarning =
    selectedPlaylist && hasPriorTransfer ? (
      <div
        className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm ${
          alreadyTransferredToDestination
            ? 'border-amber-400/60 bg-amber-50 text-amber-900 dark:border-amber-400/40 dark:bg-amber-500/10 dark:text-amber-200'
            : 'border-app-border bg-app-surface/70 text-app-text-secondary'
        }`}
      >
        <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
        <div>
          <p>
            {alreadyTransferredToDestination
              ? t('transferPage.alreadyTransferredSameDest', {
                  name: selectedPlaylist.name,
                  provider: destinationLabel,
                })
              : t('transferPage.alreadyTransferredOtherDest', {
                  name: selectedPlaylist.name,
                  providers: priorTransfer.destinationProviders.map(providerLabel).join(', '),
                })}
          </p>
          {priorTransferDate ? (
            <p className="mt-0.5 text-xs opacity-80">
              {t('transferPage.alreadyTransferredWhen', { date: priorTransferDate })}
            </p>
          ) : null}
        </div>
      </div>
    ) : null;

  const transferWarnings =
    roundTripWarning || retransferWarning ? (
      <div className="grid gap-2">
        {roundTripWarning}
        {retransferWarning}
      </div>
    ) : null;
  const isShowingPlaylistTracks = step === 2 && selectedPlaylist !== null;
  const visibleStepTwoTracks = previewTracks.slice(0, STEP_TWO_VISIBLE_TRACKS);

  return (
    <AppPageLayout bodyClassName="gap-6" className="overflow-hidden">
      <AppPageHeader
        eyebrow={t('transferPage.eyebrow')}
        title={t('transferPage.title')}
        description={t('transferPage.description')}
      />

      <CreateFlowStepBreadcrumbs
        activeLayoutId="transfer-flow-active"
        currentStep={step}
        items={stepItems}
        layoutGroupId="transfer-flow"
        canOpenStep={(targetStep) =>
          targetStep === 1 ||
          (targetStep === 2 && canAdvanceFromStep1) ||
          (targetStep === 3 && canAdvanceFromStep2)
        }
        onStepChange={goToStep}
      />

      <section className="relative rounded-3xl border-2 border-app-text bg-app-elevated p-4 shadow-sticker dark:bg-app-card sm:p-6">
        <AnimatePresence initial={false} mode="wait">
          <motion.div
            key={`transfer-step-${step}`}
            custom={stepDirection}
            variants={CREATE_FLOW_STEP_SLIDE_VARIANTS}
            initial="enter"
            animate="center"
            exit="exit"
            className="grid gap-6"
          >
            <div className="grid gap-1 px-1">
              <h2 className="text-2xl font-black text-brand-dark dark:text-brand-white">
                {stepTitle}
              </h2>
              <p className="max-w-3xl text-sm text-app-text-secondary sm:text-base">{stepBody}</p>
            </div>

            {step === 1 ? (
              <div className="grid gap-5 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
                <ProviderCard
                  title={t('transferPage.sourceTitle')}
                  selectedProvider={sourceProvider}
                  providerStatusByType={providerStatusByType}
                  isBusy={isBusy}
                  connectLabel={t('transferPage.connectSource')}
                  connectedLabel={t('transferPage.alreadyConnected')}
                  notConnectedLabel={t('transferPage.notConnected')}
                  onConnect={connectSelectedProvider}
                />

                <div className="flex items-center justify-center">
                  <motion.button
                    type="button"
                    onClick={() => {
                      setSwapSpin((count) => count + 1);
                      handleSwapProviders();
                    }}
                    disabled={isBusy}
                    aria-label={t('transferPage.swap')}
                    whileHover={{ scale: 1.08 }}
                    whileTap={{ scale: 0.92 }}
                    className="group inline-flex h-14 w-14 cursor-pointer items-center justify-center rounded-full border-2 border-app-text bg-app-elevated text-app-text shadow-sticker transition-colors hover:bg-brand-lime hover:text-brand-dark disabled:cursor-not-allowed disabled:opacity-60 dark:bg-app-card"
                  >
                    {/* Two arrows: on hover each nudges outward; on click each flies out its own
                        way and comes back from the opposite side, so they visibly trade places.
                        The group is turned 90° while the cards are stacked (below lg). */}
                    <span
                      aria-hidden="true"
                      className="relative block h-7 w-8 rotate-90 lg:rotate-0"
                    >
                      <motion.span
                        key={`left-${swapSpin}`}
                        initial={false}
                        animate={
                          swapSpin > 0
                            ? { x: [0, -26, 26, 0], opacity: [1, 0, 0, 1] }
                            : { x: 0, opacity: 1 }
                        }
                        transition={{ duration: 0.55, times: [0, 0.4, 0.5, 1], ease: 'easeInOut' }}
                        className="absolute left-0 top-0"
                      >
                        <ArrowLeft
                          size={15}
                          strokeWidth={2.75}
                          className="transition-transform duration-200 group-hover:-translate-x-1"
                        />
                      </motion.span>
                      <motion.span
                        key={`right-${swapSpin}`}
                        initial={false}
                        animate={
                          swapSpin > 0
                            ? { x: [0, 26, -26, 0], opacity: [1, 0, 0, 1] }
                            : { x: 0, opacity: 1 }
                        }
                        transition={{ duration: 0.55, times: [0, 0.4, 0.5, 1], ease: 'easeInOut' }}
                        className="absolute bottom-0 right-0"
                      >
                        <ArrowRight
                          size={15}
                          strokeWidth={2.75}
                          className="transition-transform duration-200 group-hover:translate-x-1"
                        />
                      </motion.span>
                    </span>
                  </motion.button>
                </div>

                <ProviderCard
                  title={t('transferPage.destinationTitle')}
                  selectedProvider={destinationProvider}
                  providerStatusByType={providerStatusByType}
                  isBusy={isBusy}
                  connectLabel={t('transferPage.connectDestination')}
                  connectedLabel={t('transferPage.alreadyConnected')}
                  notConnectedLabel={t('transferPage.notConnected')}
                  onConnect={connectSelectedProvider}
                />
              </div>
            ) : null}

            {step === 2 ? (
              <article className="rounded-2xl border-2 border-app-text/70 bg-app-surface p-4 dark:bg-app-elevated">
                {!isShowingPlaylistTracks ? (
                  <div className="grid gap-4">
                    <div className="flex items-center justify-between gap-3">
                      <CTAButton
                        variant="ghost"
                        className="rounded-xl px-3 py-2 text-xs"
                        onClick={() => goToStep(1)}
                      >
                        <ChevronLeft size={14} aria-hidden="true" />
                        {t('transferPage.backToProviders')}
                      </CTAButton>
                    </div>

                    <SyncPlaylistPicker
                      playlists={allPlaylists}
                      selectedId={selectedPlaylist?.providerPlaylistId ?? null}
                      onSelect={setSelectedPlaylist}
                      isLoading={playlistsQuery.isLoading}
                      hasMore={hasMorePlaylists}
                      onLoadMore={() =>
                        setPlaylistOffset((current) => current + PLAYLISTS_PAGE_SIZE)
                      }
                      isLoadingMore={playlistsQuery.isFetching && playlistOffset > 0}
                    />
                  </div>
                ) : (
                  <div className="grid gap-4 overflow-hidden">
                    <div className="flex items-start justify-between gap-3 rounded-2xl border-2 border-app-text/70 bg-app-surface px-4 py-4 dark:bg-app-elevated">
                      <div className="min-w-0">
                        <p className="truncate text-lg font-black text-brand-dark dark:text-brand-white">
                          {selectedPlaylist.name}
                        </p>
                        <p className="mt-1 text-sm text-app-text-secondary">
                          {t('transferPage.trackCount', {
                            count: selectedPlaylist.trackCount ?? previewTracks.length,
                          })}
                        </p>
                        {previewTracks.length > STEP_TWO_VISIBLE_TRACKS ? (
                          <p className="mt-1 text-xs text-app-text-secondary">
                            {t('transferPage.previewTracksLimit', {
                              count: STEP_TWO_VISIBLE_TRACKS,
                              total: previewTracks.length,
                            })}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <EventProviderIcon provider={sourceProvider} sizeClassName="h-10 w-10" />
                      </div>
                    </div>

                    {transferWarnings}

                    <div className="flex items-center justify-between gap-3">
                      <CTAButton
                        variant="ghost"
                        className="rounded-xl px-3 py-2 text-xs"
                        onClick={() => setSelectedPlaylist(null)}
                      >
                        <ChevronLeft size={14} aria-hidden="true" />
                        {t('transferPage.backToPlaylists')}
                      </CTAButton>

                      <CTAButton
                        variant="primary"
                        onClick={() => goToStep(3)}
                        disabled={
                          selectedPlaylistTracksQuery.isLoading || previewTracks.length === 0
                        }
                      >
                        {t('transferPage.synchronizeNowCta')}
                      </CTAButton>
                    </div>

                    <div className="grid max-h-[calc(5*4.5rem+1.5rem)] gap-2 overflow-y-auto pr-1">
                      {selectedPlaylistTracksQuery.isLoading ? (
                        Array.from({ length: 6 }).map((_, index) => (
                          <div
                            key={index}
                            className="h-[4.5rem] animate-pulse rounded-2xl border-2 border-app-border-strong bg-app-surface/70"
                          />
                        ))
                      ) : visibleStepTwoTracks.length > 0 ? (
                        visibleStepTwoTracks.map((track) => (
                          <PlaylistTrackRow key={track.providerTrackId} track={track} compact />
                        ))
                      ) : (
                        <div className="rounded-2xl border-2 border-dashed border-app-text/50 bg-app-surface px-4 py-6 text-sm text-app-text-secondary dark:bg-app-elevated">
                          {t('transferPage.previewTracksEmpty')}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </article>
            ) : null}

            {step === 3 ? (
              <div className="grid gap-4">
                {transferWarnings}
                <div className="flex items-center justify-between gap-3 rounded-[1.5rem] border border-app-border bg-app-surface/70 px-4 py-4">
                  <div className="min-w-0">
                    <div className="inline-flex items-center gap-2 rounded-full bg-brand-dark px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-brand-white">
                      {t('transferPage.summaryTitle')}
                    </div>
                    <p className="mt-3 truncate text-lg font-black text-brand-dark dark:text-brand-white">
                      {selectedPlaylist?.name ?? t('transferPage.previewTracksEmpty')}
                    </p>
                    <p className="mt-1 text-sm text-app-text-secondary">
                      {sourceLabel} {t('transferPage.toLabel')} {destinationLabel}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <CTAButton
                      variant="ghost"
                      className="rounded-xl px-3 py-2 text-xs"
                      onClick={() => goToStep(2)}
                      disabled={transferMutation.isPending}
                    >
                      <ChevronLeft size={14} aria-hidden="true" />
                      {t('transferPage.backToPlaylistChoice')}
                    </CTAButton>

                    {!transferAnimationComplete ? (
                      <CTAButton
                        variant="primary"
                        onClick={handleNext}
                        disabled={transferMutation.isPending}
                      >
                        {transferMutation.isPending
                          ? t('transferPage.transferring')
                          : t('transferPage.startTransfer')}
                      </CTAButton>
                    ) : null}
                  </div>
                </div>

                {resultCounts ? (
                  <div className="flex flex-wrap gap-2 text-sm">
                    <span className="rounded-full bg-brand-lime/15 px-3 py-1 font-semibold text-[#7da300] dark:text-[#e8ff9a]">
                      {t('transferPage.matchedCount', { count: resultCounts.matchedCount })}
                    </span>
                    <span className="rounded-full bg-app-surface px-3 py-1 font-semibold text-app-text-secondary">
                      {t('transferPage.skippedCount', { count: resultCounts.skippedCount })}
                    </span>
                  </div>
                ) : null}

                <article className="grid gap-3 rounded-2xl border-2 border-app-text bg-app-surface p-4 shadow-sticker-sm dark:bg-app-elevated">
                  <AnimatePresence>
                    {transferAnimationComplete ? (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.92, y: 8 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.98, y: -6 }}
                        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                        className="rounded-2xl border-2 border-app-text bg-brand-lime/20 px-5 py-6 text-center shadow-sticker-sm"
                      >
                        <motion.div
                          initial={{ scale: 0.8, rotate: -10 }}
                          animate={{ scale: 1, rotate: 0 }}
                          transition={{ type: 'spring', stiffness: 320, damping: 20 }}
                          className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-brand-lime text-brand-dark shadow-soft-lift"
                        >
                          <CheckCircle2 size={34} aria-hidden="true" />
                        </motion.div>
                        <p className="mt-4 text-2xl font-black text-brand-dark dark:text-brand-white">
                          {t('transferPage.completionTitle')}
                        </p>
                        <p className="mt-2 text-sm text-app-text-secondary">
                          {t('transferPage.completionBody')}
                        </p>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>

                  <div className="rounded-2xl border-2 border-app-text bg-brand-dark px-4 py-3 text-brand-white shadow-sticker-sm dark:bg-brand-white dark:text-brand-dark">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-white/55">
                          {transferMutation.isPending
                            ? t('transferPage.transferringListTitle')
                            : transferAnimationComplete
                              ? t('transferPage.transferDoneTitle')
                              : t('transferPage.confirmTracksTitle')}
                        </p>
                        <p className="mt-1 truncate text-sm font-bold">
                          {selectedPlaylist?.name ?? t('transferPage.previewTracksEmpty')}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <EventProviderIcon provider={sourceProvider} sizeClassName="h-8 w-8" />
                        <ArrowLeftRight
                          size={16}
                          className="text-brand-white/55"
                          aria-hidden="true"
                        />
                        <EventProviderIcon provider={destinationProvider} sizeClassName="h-8 w-8" />
                      </div>
                    </div>
                  </div>

                  <p className="mb-4 text-xs font-semibold uppercase tracking-[0.22em] text-app-text-secondary">
                    {t('transferPage.trackCount', {
                      count: selectedPlaylist?.trackCount ?? previewTracks.length,
                    })}
                  </p>
                  {transferTracks.length > 0 ? (
                    <TransferViewport
                      tracks={transferTracks}
                      progressCount={transferProgressCount}
                      matchedCount={matchedCount}
                      transferComplete={transferAnimationComplete}
                    />
                  ) : (
                    <div className="rounded-2xl border-2 border-dashed border-app-text/50 bg-app-surface px-4 py-10 text-center text-sm text-app-text-secondary dark:bg-app-elevated">
                      {t('transferPage.previewTracksEmpty')}
                    </div>
                  )}
                </article>

                {transferAnimationComplete && resultSync ? (
                  <div className="flex flex-wrap gap-2">
                    <CTALink to="/transfer" variant="primary">
                      {t('transferPage.openSync')}
                    </CTALink>
                    <CTAButton
                      variant="ghost"
                      onClick={() => {
                        setSelectedPlaylist(null);
                        setResultSync(null);
                        setResultCounts(null);
                        setTransferProgressCount(0);
                        setIsTransferResponseReady(false);
                        goToStep(2);
                      }}
                    >
                      {t('transferPage.transferAnother')}
                    </CTAButton>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="flex items-center justify-between gap-3 px-1">
              {step === 2 ? (
                <div />
              ) : step === 1 ? (
                <div />
              ) : step < 3 ? (
                <>
                  <CTAButton
                    variant="secondary"
                    onClick={handleBack}
                    disabled={transferMutation.isPending}
                  >
                    {t('syncCreatePage.back')}
                  </CTAButton>

                  <CTAButton variant="primary" onClick={handleNext} disabled={isBusy}>
                    {t('syncCreatePage.next')}
                  </CTAButton>
                </>
              ) : transferAnimationComplete ? (
                <div />
              ) : (
                <div />
              )}
              {step === 1 ? (
                <div className="ml-auto pr-2 sm:pr-4">
                  <CTAButton
                    variant="primary"
                    onClick={handleNext}
                    disabled={isBusy || !canAdvanceFromStep1}
                  >
                    {t('transferPage.choosePlaylistCta')}
                    <ChevronRight size={14} aria-hidden="true" />
                  </CTAButton>
                </div>
              ) : null}
            </div>
          </motion.div>
        </AnimatePresence>
      </section>
    </AppPageLayout>
  );
};

import type { ProviderPlaylistItem } from '@synqit/shared';
import { DrawnArrow, LINK_SERVICES, MUSIC_SERVICES, useToast } from '@synqit/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  MousePointerClick,
  RefreshCw,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { AppPageHeader } from '../components/app/AppPageHeader';
import { AppPageLayout } from '../components/app/AppPageLayout';
import { CreateFlowStepBreadcrumbs } from '../components/create-flow/CreateFlowStepBreadcrumbs';
import { CREATE_FLOW_STEP_SLIDE_VARIANTS } from '../components/create-flow/flowMotion';
import { ProviderIcon } from '../components/providers/ProviderIcon';
import { SyncPlaylistPicker } from '../components/syncs/SyncPlaylistPicker';
import { PlaylistTrackRow, TransferViewport } from '../components/syncs/TransferPrimitives';
import {
  TransferDestinationCard,
  TransferSourceCard,
  type LinkSourceId,
} from '../components/syncs/TransferTunnelCards';
import { CTAButton, CTALink } from '../components/ui/cta';
import { useI18n } from '../hooks/useI18n';
import { trackAnalyticsEvent } from '../lib/analytics';
import { toApiError } from '../lib/api';
import { connectAppleMusic } from '../lib/appleMusic';
import { openProviderOauthPopup } from '../lib/providerOauthPopup';
import { CONNECTABLE_PROVIDERS, PROVIDER_LABELS } from '../lib/providers';
import {
  EMPTY_INTEGRATION_MAP,
  createTransfer,
  fetchExternalSources,
  fetchIntegrations,
  fetchProviderPlaylistTrackCount,
  fetchProviderPlaylistTracks,
  fetchProviderPlaylists,
  fetchTransferBatch,
  queryKeys,
  syncQueryKeys,
} from '../lib/queries';
import type { Provider } from '../lib/types';

const PLAYLISTS_PAGE_SIZE = 25;
const STEP_TWO_VISIBLE_TRACKS = 15;

type TransferStep = 1 | 2 | 3;

export const TransferPage = () => {
  const { t } = useI18n();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [step, setStep] = useState<TransferStep>(1);
  const [stepDirection, setStepDirection] = useState<1 | -1>(1);
  // Nothing is preselected. The left card offers every source — connected
  // services on the direct line, public links on the second — and the right
  // card stays blank until one is chosen, because what can receive the playlist
  // depends on what it comes from.
  const [sourceProvider, setSourceProvider] = useState<Provider | null>(null);
  const [linkSource, setLinkSource] = useState<LinkSourceId | null>(null);
  const [linkUrl, setLinkUrl] = useState('');
  const [destinationProvider, setDestinationProvider] = useState<Provider | null>(null);
  const [selectedPlaylist, setSelectedPlaylist] = useState<ProviderPlaylistItem | null>(null);
  const [playlistOffset, setPlaylistOffset] = useState(0);
  const [allPlaylists, setAllPlaylists] = useState<ProviderPlaylistItem[]>([]);
  const [hasMorePlaylists, setHasMorePlaylists] = useState(false);
  const [isConnectingProvider, setIsConnectingProvider] = useState<Provider | null>(null);
  const [transferBatchId, setTransferBatchId] = useState<string | null>(null);
  const [transferProgressCount, setTransferProgressCount] = useState(0);

  const integrationsQuery = useQuery({
    queryKey: queryKeys.integrations.list(),
    queryFn: fetchIntegrations,
    staleTime: 60_000,
  });

  // Which link sources the API currently accepts, so the link card never offers
  // a service the backend has switched off.
  const externalSourcesQuery = useQuery({
    queryKey: syncQueryKeys.externalSources(),
    queryFn: fetchExternalSources,
    staleTime: Infinity,
  });

  const providerStatusByType = integrationsQuery.data ?? EMPTY_INTEGRATION_MAP;

  const sourceConnected =
    sourceProvider !== null && providerStatusByType[sourceProvider] === 'connected';
  const destinationConnected =
    destinationProvider !== null && providerStatusByType[destinationProvider] === 'connected';
  const bothConnected = sourceConnected && destinationConnected;

  const playlistsQuery = useQuery({
    queryKey: syncQueryKeys.providerPlaylists(sourceProvider ?? '', playlistOffset),
    queryFn: () =>
      fetchProviderPlaylists({
        provider: sourceProvider!,
        limit: PLAYLISTS_PAGE_SIZE,
        offset: playlistOffset,
      }),
    enabled: sourceConnected,
    staleTime: Infinity,
  });

  const selectedPlaylistTrackCountQuery = useQuery({
    queryKey: syncQueryKeys.providerPlaylistTrackCount(
      sourceProvider ?? '',
      selectedPlaylist?.providerPlaylistId ?? '',
    ),
    queryFn: () =>
      fetchProviderPlaylistTrackCount({
        provider: sourceProvider!,
        providerPlaylistId: selectedPlaylist!.providerPlaylistId,
      }),
    enabled: sourceConnected && selectedPlaylist !== null && selectedPlaylist.trackCount === null,
    retry: false,
    staleTime: Infinity,
  });

  const selectedPlaylistTracksQuery = useQuery({
    queryKey: syncQueryKeys.providerPlaylistTracks(
      sourceProvider ?? '',
      selectedPlaylist?.providerPlaylistId ?? '',
    ),
    queryFn: () =>
      fetchProviderPlaylistTracks({
        provider: sourceProvider!,
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
    setTransferBatchId(null);
    setTransferProgressCount(0);
    if (step > 1) {
      setStep(1);
    }
  }, [sourceProvider]);

  useEffect(() => {
    setTransferBatchId(null);
    setTransferProgressCount(0);
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
            provider,
            nextPath: '/transfer',
          });
        }

        await queryClient.invalidateQueries({ queryKey: queryKeys.integrations.all() });
        showToast(
          t('profile.connectionConnected', {
            provider: PROVIDER_LABELS[provider],
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

  // The batch is queued server-side; progress is polled rather than awaited,
  // so a long playlist no longer has to finish inside one request.
  const transferBatchQuery = useQuery({
    queryKey: syncQueryKeys.transferBatch(transferBatchId ?? ''),
    queryFn: () => fetchTransferBatch(transferBatchId!),
    enabled: transferBatchId !== null,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'completed' || status === 'partial' || status === 'failed' ? false : 1500;
    },
  });

  const transferItem = transferBatchQuery.data?.items[0] ?? null;
  const isTransferSettled =
    transferItem?.status === 'completed' || transferItem?.status === 'failed';
  const resultCounts =
    transferItem && transferItem.matchedCount !== null && transferItem.skippedCount !== null
      ? { matchedCount: transferItem.matchedCount, skippedCount: transferItem.skippedCount }
      : null;

  const transferMutation = useMutation({
    mutationFn: async () => {
      if (sourceProvider === null || destinationProvider === null) {
        throw new Error('missing_provider');
      }
      if (sourceProvider === destinationProvider) {
        throw new Error('same_provider');
      }
      if (!selectedPlaylist) {
        throw new Error('missing_playlist');
      }

      return createTransfer({
        sourceProvider,
        destinationProvider,
        playlists: [
          {
            providerPlaylistId: selectedPlaylist.providerPlaylistId,
            name: selectedPlaylist.name,
            trackCount: selectedPlaylist.trackCount,
          },
        ],
      });
    },
    onMutate: () => {
      setTransferBatchId(null);
      setTransferProgressCount(0);
    },
    onSuccess: (batch) => {
      setTransferBatchId(batch.id);
      trackAnalyticsEvent({
        eventName: 'playlist_transfer_queued',
        target: 'transfer',
        properties: { sourceProvider, destinationProvider },
      });
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
      if (error instanceof Error && error.message === 'missing_provider') {
        messageKey = 'transferPage.statusMissingConnections';
        message = t('transferPage.statusMissingConnections');
      }
      showToast(messageKey === 'transferPage.error' ? t(messageKey, { message }) : message, {
        variant: 'error',
      });
      trackAnalyticsEvent({
        eventName: 'playlist_transfer_failed',
        target: 'transfer',
        properties: { sourceProvider, destinationProvider, message },
      });
    },
  });

  // Surface the outcome once the queued job reports back.
  useEffect(() => {
    if (!transferItem || !isTransferSettled) {
      return;
    }
    if (transferItem.status === 'completed') {
      showToast(t('transferPage.success', { name: transferItem.name }), { variant: 'success' });
      void queryClient.invalidateQueries({ queryKey: syncQueryKeys.all() });
      trackAnalyticsEvent({
        eventName: 'playlist_transfer_succeeded',
        target: 'transfer',
        properties: { sourceProvider, destinationProvider },
      });
    } else {
      showToast(t('transferPage.error', { message: transferItem.errorMessage ?? '' }), {
        variant: 'error',
      });
    }
    // Only react to the transition into a settled state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transferItem?.id, transferItem?.status, isTransferSettled]);

  // The row animation runs while the job is in flight but deliberately stops
  // one short of the end: only the server reporting the item settled fills it
  // in. Previously a timer decided when the transfer "finished".
  const isTransferInFlight =
    transferMutation.isPending || (transferBatchId !== null && !isTransferSettled);

  useEffect(() => {
    const total = Math.max(transferTracks.length, 1);

    if (isTransferSettled) {
      setTransferProgressCount(total);
      return;
    }
    if (!isTransferInFlight) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setTransferProgressCount((current) => (current >= total - 1 ? current : current + 1));
    }, 260);

    return () => window.clearInterval(intervalId);
  }, [isTransferInFlight, isTransferSettled, transferTracks.length]);

  const transferAnimationComplete = transferItem?.status === 'completed';
  const matchedCount = resultCounts?.matchedCount ?? 0;

  // A direct transfer reads one library and writes the copy into another, so
  // both lines of the tunnel are drawn from what Synqit can actually do with a
  // service: the connectable ones are read *and* write (every one of them has a
  // createPlaylist adapter), the link sources are read-only and can never be a
  // destination.
  const externalSources = externalSourcesQuery.data?.sources ?? null;
  const linkServices = LINK_SERVICES.map((service) => service.id).filter((service) => {
    if (externalSources === null) return true;
    return service === 'deezer' || service === 'youtube' || service === 'qobuz'
      ? externalSources[service]
      : false;
  });
  // What the right card offers once a source is chosen: everything writable,
  // minus the service the playlist is already on.
  const destinationOptions = CONNECTABLE_PROVIDERS.filter(
    (provider) => provider !== sourceProvider,
  );
  const isLinkTransfer = linkSource !== null;
  const hasSource = sourceProvider !== null || isLinkTransfer;

  const canAdvanceFromStep1 =
    sourceProvider !== null &&
    destinationProvider !== null &&
    bothConnected &&
    sourceProvider !== destinationProvider;
  // A link import hands over to the link flow instead of walking steps 2 and 3
  // here: it needs a preview of a playlist we have not read yet.
  // The lane belongs to the source: it takes that service's colour and is
  // drawn once, when the source is picked. Choosing the destination is the
  // line arriving somewhere, not a new line, so it neither redraws nor
  // recolours. Services whose mark has no colour of its own leave it as the
  // text colour.
  const laneService = sourceProvider ?? linkSource;
  const laneColor = laneService ? MUSIC_SERVICES[laneService].color : undefined;
  const laneKey = laneService ?? 'none';

  const canContinueLinkTransfer =
    isLinkTransfer && destinationProvider !== null && linkUrl.trim().length > 0;
  const canAdvanceFromStep2 = selectedPlaylist !== null;
  const isBusy = isTransferInFlight || isConnectingProvider !== null;

  const stepItems = [
    { value: 1 as const, label: t('transferPage.stepMode') },
    { value: 2 as const, label: t('transferPage.stepPlaylist') },
    { value: 3 as const, label: t('transferPage.stepTransfer') },
  ] as const;

  const stepTitle = useMemo(() => {
    if (step === 1) return t('transferPage.tunnelHeading');
    if (step === 2) return t('transferPage.playlistTitle');
    return t('transferPage.confirmTitle');
  }, [step, t]);

  // Only the opening step carries a line under its title: the later ones show
  // the playlist and the list itself, which explain themselves.
  const stepBody = useMemo(() => (step === 1 ? t('transferPage.tunnelBody') : null), [step, t]);

  const goToStep = (nextStep: TransferStep) => {
    setStepDirection(nextStep > step ? 1 : -1);
    setStep(nextStep);
  };

  const handleNext = () => {
    if (step === 1) {
      if (!hasSource || destinationProvider === null) {
        showToast(t('transferPage.tunnelIncomplete'), { variant: 'error' });
        return;
      }
      if (isLinkTransfer) {
        // The link flow owns the preview, so hand it the source and destination
        // this tunnel already collected.
        if (!canContinueLinkTransfer) {
          showToast(t('transferPage.linkUrlRequired'), { variant: 'error' });
          return;
        }
        void navigate({
          to: '/transfer/link',
          search: { url: linkUrl.trim(), destination: destinationProvider },
        });
        return;
      }
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

    if (!isTransferInFlight && !transferAnimationComplete) {
      transferMutation.mutate();
    }
  };

  const handleBack = () => {
    if (step === 1 || isTransferInFlight) {
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

  const handleSelectSourceProvider = (provider: Provider) => {
    setSourceProvider(provider);
    setLinkSource(null);
    // The right card is filtered by the source, so a destination that just
    // became the source is dropped rather than silently moved elsewhere.
    if (provider === destinationProvider) {
      setDestinationProvider(null);
    }
  };

  const handleSelectLinkSource = (source: LinkSourceId) => {
    setLinkSource((current) => (current === source ? null : source));
    setSourceProvider(null);
  };

  const handleClearSource = () => {
    // The destination is only ever offered against a source, so dropping the
    // source drops it too: no half-set lane can survive the reset.
    setSourceProvider(null);
    setLinkSource(null);
    setLinkUrl('');
    setDestinationProvider(null);
  };

  const handleSelectDestinationProvider = (provider: Provider) => {
    setDestinationProvider(provider);
  };

  const destinationLabel = destinationProvider ? PROVIDER_LABELS[destinationProvider] : '';
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
  const providerLabel = (provider: Provider) => PROVIDER_LABELS[provider];
  const priorTransfer = selectedPlaylist?.priorTransfer ?? null;
  const hasPriorTransfer = priorTransfer != null && priorTransfer.destinationProviders.length > 0;
  const alreadyTransferredToDestination =
    hasPriorTransfer &&
    destinationProvider !== null &&
    priorTransfer.destinationProviders.includes(destinationProvider);
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
              {stepBody ? (
                <p className="max-w-3xl text-sm text-app-text-secondary sm:text-base">{stepBody}</p>
              ) : null}
            </div>

            {step === 1 ? (
              <div className="grid gap-5 lg:grid-cols-[1fr_auto_1fr] lg:items-stretch">
                <TransferSourceCard
                  directProviders={CONNECTABLE_PROVIDERS}
                  linkServices={linkServices}
                  selectedProvider={sourceProvider}
                  selectedLinkSource={linkSource}
                  providerStatusByType={providerStatusByType}
                  isBusy={isBusy}
                  linkUrl={linkUrl}
                  onSelectProvider={handleSelectSourceProvider}
                  onSelectLinkSource={handleSelectLinkSource}
                  onChangeLinkUrl={setLinkUrl}
                  onClearSelection={handleClearSource}
                  onConnect={connectSelectedProvider}
                />

                {/* The lane between the cards. Nothing is drawn until a
                    source is picked: an arrow with no service at either end
                    points at nothing. Until then the gap holds a prompt to
                    choose. Nothing to swap here any more either — a source is
                    changed by clearing it and picking another. */}
                {/* Stacked, the line is turned on its side, so the row has to
                    reserve its length as height or it runs over the cards. */}
                <div className="grid h-20 place-items-center lg:h-auto lg:w-28">
                  {/* Both states share one cell: the incoming one is mounted
                      straight away and the outgoing fades under it, so a paused
                      exit can never leave the lane empty. */}
                  <AnimatePresence initial={false}>
                    {hasSource ? (
                      <motion.div
                        key="lane-arrow"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="col-start-1 row-start-1 flex w-20 items-center justify-center lg:w-28"
                      >
                        <DrawnArrow
                          replayKey={laneKey}
                          color={laneColor}
                          className="w-20 rotate-90 lg:w-28 lg:rotate-0"
                        />
                      </motion.div>
                    ) : (
                      <motion.span
                        key="lane-prompt"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        title={t('transferPage.lanePrompt')}
                        className="col-start-1 row-start-1 inline-flex h-12 w-12 items-center justify-center rounded-full border-2 border-dashed border-app-border text-app-text-muted lg:h-20 lg:w-20"
                      >
                        <MousePointerClick className="h-5 w-5 lg:h-8 lg:w-8" aria-hidden="true" />
                        <span className="sr-only">{t('transferPage.lanePrompt')}</span>
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>

                <TransferDestinationCard
                  options={destinationOptions}
                  selected={destinationProvider}
                  isWaitingForSource={!hasSource}
                  providerStatusByType={providerStatusByType}
                  isBusy={isBusy}
                  onSelect={handleSelectDestinationProvider}
                  onClearSelection={() => setDestinationProvider(null)}
                  onConnect={connectSelectedProvider}
                />
              </div>
            ) : null}

            {step === 2 && sourceProvider !== null ? (
              <article className="sm:rounded-2xl sm:border-2 sm:border-app-text/70 sm:bg-app-surface sm:p-4 sm:dark:bg-app-elevated">
                {!isShowingPlaylistTracks ? (
                  <div className="grid gap-4">
                    <div className="flex items-center justify-between gap-3">
                      <CTAButton
                        variant="ghost"
                        className="rounded-xl px-3 py-2 text-xs"
                        onClick={() => goToStep(1)}
                      >
                        <ChevronLeft size={14} aria-hidden="true" />
                        <span className="sm:hidden">{t('syncCreatePage.back')}</span>
                        <span className="hidden sm:inline">
                          {t('transferPage.backToProviders')}
                        </span>
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
                    {/* No box around it: the card it sits in is already one,
                        and a frame inside a frame made the header read as a
                        separate thing from the list it belongs to. */}
                    <div className="flex items-start justify-between gap-3 px-1">
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
                        <ProviderIcon provider={sourceProvider} sizeClassName="h-10 w-10" />
                      </div>
                    </div>

                    {transferWarnings}

                    {/* The sticker CTA carries its shadow outside its box, so
                        it needs room on the right or the card clips it. */}
                    <div className="flex flex-wrap items-center justify-between gap-3 px-1 pr-2">
                      <CTAButton
                        variant="ghost"
                        className="rounded-xl px-3 py-2 text-xs"
                        onClick={() => setSelectedPlaylist(null)}
                      >
                        <ChevronLeft size={14} aria-hidden="true" />
                        <span className="sm:hidden">{t('syncCreatePage.back')}</span>
                        <span className="hidden sm:inline">
                          {t('transferPage.backToPlaylists')}
                        </span>
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

                    <div className="grid max-h-[calc(5*4.5rem+1.5rem)] gap-2 overflow-y-auto sm:pr-1">
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

            {step === 3 && sourceProvider !== null && destinationProvider !== null ? (
              <div className="grid gap-4">
                {transferWarnings}

                {/* No summary panel: the dark header below already carries the
                    playlist's name and the two services, and repeating them
                    above it buried the one thing this step is for. */}
                <div className="flex flex-wrap items-center justify-between gap-3 px-1 pr-2">
                  <CTAButton
                    variant="ghost"
                    className="rounded-xl px-3 py-2 text-xs"
                    onClick={() => goToStep(2)}
                    disabled={isTransferInFlight}
                  >
                    <ChevronLeft size={14} aria-hidden="true" />
                    <span className="sm:hidden">{t('syncCreatePage.back')}</span>
                    <span className="hidden sm:inline">
                      {t('transferPage.backToPlaylistChoice')}
                    </span>
                  </CTAButton>

                  {/* The action reads as the sync it is: a round button wearing
                      the sync arrows, its label beside it rather than inside a
                      pill. The arrows turn on hover and spin for real while the
                      job runs — never at rest, which is what made this step
                      look like it had already started. */}
                  {!transferAnimationComplete ? (
                    <button
                      type="button"
                      onClick={handleNext}
                      disabled={isTransferInFlight}
                      aria-label={
                        isTransferInFlight
                          ? t('transferPage.transferring')
                          : t('transferPage.startTransfer')
                      }
                      className="group inline-flex cursor-pointer items-center gap-3 rounded-full text-left transition focus-ring-brand disabled:cursor-not-allowed"
                    >
                      <span className="hidden text-base font-black text-brand-dark dark:text-brand-white sm:inline sm:text-lg">
                        {isTransferInFlight
                          ? t('transferPage.transferring')
                          : t('transferPage.startTransfer')}
                      </span>
                      <span
                        aria-hidden="true"
                        className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 border-app-text bg-brand-lime text-brand-dark shadow-sticker transition group-hover:bg-brand-pink group-hover:text-brand-white motion-safe:group-hover:-translate-y-0.5 group-disabled:opacity-60"
                      >
                        <RefreshCw
                          size={22}
                          strokeWidth={2.75}
                          className={
                            isTransferInFlight
                              ? 'animate-spin'
                              : 'transition-transform duration-500 group-hover:rotate-180'
                          }
                        />
                      </span>
                    </button>
                  ) : (
                    <span />
                  )}
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

                <article className="grid gap-3 sm:rounded-2xl sm:border-2 sm:border-app-text sm:bg-app-surface sm:p-4 sm:shadow-sticker-sm sm:dark:bg-app-elevated">
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
                          {isTransferInFlight
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
                        <ProviderIcon provider={sourceProvider} sizeClassName="h-8 w-8" />
                        <ArrowRight size={16} className="text-brand-white/55" aria-hidden="true" />
                        <ProviderIcon provider={destinationProvider} sizeClassName="h-8 w-8" />
                      </div>
                    </div>
                  </div>

                  <p className="mb-4 px-4 text-xs font-semibold uppercase tracking-[0.22em] text-app-text-secondary">
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
                      isRunning={isTransferInFlight || transferAnimationComplete}
                    />
                  ) : (
                    <div className="rounded-2xl border-2 border-dashed border-app-text/50 bg-app-surface px-4 py-10 text-center text-sm text-app-text-secondary dark:bg-app-elevated">
                      {t('transferPage.previewTracksEmpty')}
                    </div>
                  )}
                </article>

                {transferAnimationComplete ? (
                  <div className="flex flex-wrap gap-2">
                    <CTALink to="/transfer" variant="primary">
                      {t('transferPage.openSync')}
                    </CTALink>
                    <CTAButton
                      variant="ghost"
                      onClick={() => {
                        setSelectedPlaylist(null);
                        setTransferBatchId(null);
                        setTransferProgressCount(0);
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
              {step === 2 && sourceProvider !== null ? (
                <div />
              ) : step === 1 ? (
                <div />
              ) : step < 3 ? (
                <>
                  <CTAButton variant="secondary" onClick={handleBack} disabled={isTransferInFlight}>
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
                  {isLinkTransfer ? (
                    <CTAButton
                      variant="primary"
                      onClick={handleNext}
                      disabled={isBusy || !canContinueLinkTransfer}
                    >
                      {t('transferPage.previewLinkCta')}
                      <ChevronRight size={14} aria-hidden="true" />
                    </CTAButton>
                  ) : (
                    <CTAButton
                      variant="primary"
                      onClick={handleNext}
                      disabled={isBusy || !canAdvanceFromStep1}
                    >
                      {t('transferPage.choosePlaylistCta')}
                      <ChevronRight size={14} aria-hidden="true" />
                    </CTAButton>
                  )}
                </div>
              ) : null}
            </div>
          </motion.div>
        </AnimatePresence>
      </section>
    </AppPageLayout>
  );
};

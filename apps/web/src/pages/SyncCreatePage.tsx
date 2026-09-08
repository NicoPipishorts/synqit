import type { ProviderPlaylistItem, SyncItem } from '@synqit/shared';
import { useToast } from '@synqit/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { AppPageHeader } from '../components/app/AppPageHeader';
import { AppPageLayout } from '../components/app/AppPageLayout';
import { CreateFlowStepBreadcrumbs } from '../components/create-flow/CreateFlowStepBreadcrumbs';
import {
  CREATE_FLOW_STEP_ACTIONS_LAYOUT_TRANSITION,
  CREATE_FLOW_STEP_SLIDE_VARIANTS,
} from '../components/create-flow/flowMotion';
import {
  ProviderIntegrationStatus,
  ProviderSelectionStep,
} from '../components/create-flow/ProviderSelectionStep';
import { ProviderIcon } from '../components/providers/ProviderIcon';
import { SyncCard } from '../components/syncs/SyncCard';
import { SyncPlaylistPicker } from '../components/syncs/SyncPlaylistPicker';
import { CTAButton, CTALink } from '../components/ui/cta';
import { useI18n } from '../hooks/useI18n';
import { trackAnalyticsEvent } from '../lib/analytics';
import { toApiError } from '../lib/api';
import { connectAppleMusic } from '../lib/appleMusic';
import { openProviderOauthPopup } from '../lib/providerOauthPopup';
import { CONNECTABLE_PROVIDERS, PROVIDER_LABELS } from '../lib/providers';
import {
  EMPTY_INTEGRATION_MAP,
  createSync,
  fetchIntegrations,
  fetchProviderPlaylists,
  fetchProviderPlaylistTrackCount,
  fetchSyncs,
  queryKeys,
  syncQueryKeys,
} from '../lib/queries';
import { Provider } from '../lib/types';

type CreateStep = 1 | 2 | 3;

const PLAYLISTS_PAGE_SIZE = 25;

export const SyncCreatePage = () => {
  const { t } = useI18n();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<CreateStep>(1);
  const [stepDirection, setStepDirection] = useState<1 | -1>(1);
  const [provider, setProvider] = useState<Provider | null>(null);
  const [selectedPlaylist, setSelectedPlaylist] = useState<ProviderPlaylistItem | null>(null);
  const [playlistOffset, setPlaylistOffset] = useState(0);
  const [allPlaylists, setAllPlaylists] = useState<ProviderPlaylistItem[]>([]);
  const [hasMorePlaylists, setHasMorePlaylists] = useState(false);
  const [isConnectingProvider, setIsConnectingProvider] = useState(false);
  const [createdSync, setCreatedSync] = useState<SyncItem | null>(null);

  // ---------------------------------------------------------------------------
  // Integrations query
  // ---------------------------------------------------------------------------

  const integrationsQuery = useQuery({
    queryKey: queryKeys.integrations.list(),
    queryFn: fetchIntegrations,
    staleTime: 60_000,
  });

  const providerStatusByType: Record<Provider, ProviderIntegrationStatus> =
    integrationsQuery.data ?? EMPTY_INTEGRATION_MAP;

  const selectedProviderConnected = provider
    ? providerStatusByType[provider] === 'connected'
    : false;

  // ---------------------------------------------------------------------------
  // Provider playlists query
  // ---------------------------------------------------------------------------

  const playlistsQuery = useQuery({
    queryKey: syncQueryKeys.providerPlaylists(provider ?? 'spotify', playlistOffset),
    queryFn: () =>
      fetchProviderPlaylists({
        provider: provider!,
        limit: PLAYLISTS_PAGE_SIZE,
        offset: playlistOffset,
      }),
    enabled: provider !== null && selectedProviderConnected,
    staleTime: Infinity,
  });

  const selectedPlaylistTrackCountQuery = useQuery({
    queryKey: syncQueryKeys.providerPlaylistTrackCount(
      provider ?? 'spotify',
      selectedPlaylist?.providerPlaylistId ?? '',
    ),
    queryFn: () =>
      fetchProviderPlaylistTrackCount({
        provider: provider!,
        providerPlaylistId: selectedPlaylist!.providerPlaylistId,
      }),
    enabled:
      provider !== null &&
      selectedProviderConnected &&
      selectedPlaylist !== null &&
      selectedPlaylist.trackCount === null,
    retry: false,
    staleTime: Infinity,
  });

  const existingSyncsQuery = useQuery({
    queryKey: syncQueryKeys.ownedList(),
    queryFn: fetchSyncs,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!playlistsQuery.data) return;
    const { playlists, hasMore } = playlistsQuery.data;
    setAllPlaylists((prev) => {
      if (playlistOffset === 0) return playlists;
      const existingIds = new Set(prev.map((p) => p.providerPlaylistId));
      return [...prev, ...playlists.filter((p) => !existingIds.has(p.providerPlaylistId))];
    });
    setHasMorePlaylists(hasMore);
  }, [playlistsQuery.data, playlistOffset]);

  useEffect(() => {
    if (!provider) {
      setSelectedPlaylist(null);
      setPlaylistOffset(0);
      setAllPlaylists([]);
      setHasMorePlaylists(false);
    }
  }, [provider]);

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

  const handleLoadMore = () => {
    setPlaylistOffset((prev) => prev + PLAYLISTS_PAGE_SIZE);
  };

  // ---------------------------------------------------------------------------
  // Create sync mutation
  // ---------------------------------------------------------------------------

  const createSyncMutation = useMutation({
    mutationFn: createSync,
    onSuccess: (result) => {
      setCreatedSync(result.sync);
      showToast(t('syncCreatePage.shared', { name: result.sync.name }), { variant: 'success' });
      void queryClient.invalidateQueries({ queryKey: syncQueryKeys.all() });
      trackAnalyticsEvent({
        eventName: 'sync_create_succeeded',
        target: 'sync',
        properties: { provider: result.sync.provider },
      });
    },
    onError: (error) => {
      const apiError = toApiError(error);
      showToast(t('eventsPage.error', { message: apiError.message }), { variant: 'error' });
      trackAnalyticsEvent({
        eventName: 'sync_create_failed',
        target: 'sync',
        properties: { code: apiError.code },
      });
    },
  });

  // ---------------------------------------------------------------------------
  // Auto-skip step 1 if a single provider is already connected
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!integrationsQuery.data || provider !== null || step !== 1) return;
    const connectedProviders = CONNECTABLE_PROVIDERS.filter(
      (p) => integrationsQuery.data[p] === 'connected',
    );
    if (connectedProviders.length === 1) {
      setProvider(connectedProviders[0]);
      setStepDirection(1);
      setStep(2);
    }
  }, [integrationsQuery.data, provider, step]);

  // ---------------------------------------------------------------------------
  // Connect provider
  // ---------------------------------------------------------------------------

  const connectSelectedProvider = useCallback(
    async (selectedProvider: Provider) => {
      setIsConnectingProvider(true);
      try {
        if (selectedProvider === 'apple') {
          await connectAppleMusic();
          await queryClient.invalidateQueries({ queryKey: queryKeys.integrations.all() });
          const snapshot = queryClient.getQueryData<Record<Provider, ProviderIntegrationStatus>>(
            queryKeys.integrations.list(),
          );
          if (snapshot?.apple === 'connected') {
            showToast(
              t('profile.connectionConnected', {
                provider: PROVIDER_LABELS.apple,
              }),
              { variant: 'success' },
            );
          }
          return;
        }

        const popupResult = await openProviderOauthPopup({
          provider: selectedProvider,
          nextPath: '/auth/provider-connected',
        });
        await queryClient.invalidateQueries({ queryKey: queryKeys.integrations.all() });
        const snapshot = queryClient.getQueryData<Record<Provider, ProviderIntegrationStatus>>(
          queryKeys.integrations.list(),
        );
        if (snapshot?.[selectedProvider] === 'connected' || popupResult === 'connected') {
          showToast(
            t('profile.connectionConnected', {
              provider: PROVIDER_LABELS[selectedProvider],
            }),
            { variant: 'success' },
          );
          return;
        }

        if (popupResult === 'blocked' || popupResult === 'error' || popupResult === 'timeout') {
          showToast(
            t('profile.connectionFailed', {
              provider: PROVIDER_LABELS[selectedProvider],
            }),
            { variant: 'error' },
          );
        }
      } catch (error) {
        const apiError = toApiError(error);
        showToast(t('syncCreatePage.connectionError', { message: apiError.message }), {
          variant: 'error',
        });
      } finally {
        setIsConnectingProvider(false);
      }
    },
    [queryClient, showToast, t],
  );

  // ---------------------------------------------------------------------------
  // Navigation helpers
  // ---------------------------------------------------------------------------

  const stepItems = [
    { value: 1 as const, label: t('syncCreatePage.stepProvider') },
    { value: 2 as const, label: t('syncCreatePage.stepPlaylist') },
    { value: 3 as const, label: t('syncCreatePage.stepConfirm') },
  ];

  const canOpenStep = (nextStep: CreateStep): boolean => {
    if (nextStep <= step) return true;
    if (nextStep === 2) return selectedProviderConnected;
    if (nextStep === 3) return selectedProviderConnected && selectedPlaylist !== null;
    return false;
  };

  const navigateToStep = (nextStep: CreateStep) => {
    if (nextStep === step) return;
    setStepDirection(nextStep > step ? 1 : -1);
    setStep(nextStep);
  };

  const goNextStep = () => {
    if (step === 1) {
      if (!provider) {
        showToast(t('syncCreatePage.providerRequired'), { variant: 'info' });
        return;
      }
      if (!selectedProviderConnected) {
        showToast(t('syncCreatePage.providerMustBeConnected'), { variant: 'info' });
        return;
      }
    }
    if (step === 2 && !selectedPlaylist) return;
    navigateToStep(Math.min(3, step + 1) as CreateStep);
  };

  const goBackStep = () => {
    navigateToStep(Math.max(1, step - 1) as CreateStep);
  };

  const handleShare = () => {
    if (!provider || !selectedPlaylist) return;
    const selectedTrackCount = selectedPlaylistTrackCountQuery.data ?? selectedPlaylist.trackCount;

    trackAnalyticsEvent({
      eventName: 'sync_create_submitted',
      target: 'sync',
      properties: { provider },
    });
    createSyncMutation.mutate({
      provider,
      providerPlaylistId: selectedPlaylist.providerPlaylistId,
      name: selectedPlaylist.name,
      trackCount: selectedTrackCount,
      syncMode: 'host_only',
    });
  };

  const isLoadingIntegrations = integrationsQuery.isLoading;
  const isSharing = createSyncMutation.isPending;
  const selectedTrackCount =
    selectedPlaylistTrackCountQuery.data ?? selectedPlaylist?.trackCount ?? null;
  const isSelectedTrackCountLoading =
    selectedPlaylist !== null &&
    selectedTrackCount === null &&
    selectedPlaylistTrackCountQuery.isFetching;
  const alreadyShared =
    createdSync === null &&
    selectedPlaylist !== null &&
    (existingSyncsQuery.data ?? []).some(
      (s) =>
        s.providerPlaylistId === selectedPlaylist.providerPlaylistId &&
        s.magicLinkRevokedAt === null,
    );
  const providerLabels = PROVIDER_LABELS;

  return (
    <AppPageLayout bodyClassName="gap-5">
      <AppPageHeader
        backTo="/synced-lists"
        backLabel={t('syncCreatePage.backToSyncedLists')}
        title={t('syncCreatePage.title')}
        description={t('syncCreatePage.description')}
      />

      <CreateFlowStepBreadcrumbs
        activeLayoutId="create-sync-breadcrumb-active"
        currentStep={step}
        items={stepItems}
        layoutGroupId="create-sync-breadcrumbs"
        canOpenStep={canOpenStep}
        onStepChange={navigateToStep}
      />

      <div className="mx-auto w-full max-w-3xl">
        <AnimatePresence mode="wait" initial={false} custom={stepDirection}>
          {step === 1 ? (
            <ProviderSelectionStep
              providers={CONNECTABLE_PROVIDERS}
              body={t('syncCreatePage.stepProviderTitle')}
              isConnectingProvider={isConnectingProvider}
              motionKey="step-1"
              provider={provider}
              providerLabels={providerLabels}
              providerStatusByType={providerStatusByType}
              stepDirection={stepDirection}
              unselectAriaLabel="Unselect provider"
              onProviderClear={() => setProvider(null)}
              onProviderSelect={(value) => {
                setProvider(value);
                if (providerStatusByType[value] !== 'connected') {
                  void connectSelectedProvider(value);
                }
              }}
            />
          ) : null}

          {step === 2 ? (
            <motion.article
              key="step-2"
              custom={stepDirection}
              variants={CREATE_FLOW_STEP_SLIDE_VARIANTS}
              initial="enter"
              animate="center"
              exit="exit"
              className="p-1 sm:p-2"
            >
              <p className="mx-auto mb-4 max-w-[70%] text-center text-sm text-app-text-secondary sm:max-w-[50%]">
                {t('syncCreatePage.stepPlaylistBody')}
              </p>
              <div className="relative mx-auto w-full max-w-2xl px-4 sm:px-6 lg:px-8">
                <SyncPlaylistPicker
                  playlists={allPlaylists}
                  selectedId={selectedPlaylist?.providerPlaylistId ?? null}
                  onSelect={(playlist) => setSelectedPlaylist(playlist)}
                  isLoading={playlistsQuery.isLoading && allPlaylists.length === 0}
                  hasMore={hasMorePlaylists}
                  onLoadMore={handleLoadMore}
                  isLoadingMore={playlistsQuery.isFetching && allPlaylists.length > 0}
                />
              </div>
            </motion.article>
          ) : null}

          {step === 3 ? (
            <motion.article
              key="step-3"
              custom={stepDirection}
              variants={CREATE_FLOW_STEP_SLIDE_VARIANTS}
              initial="enter"
              animate="center"
              exit="exit"
              className="relative rounded-3xl border-2 border-app-text bg-app-elevated p-5 shadow-sticker dark:bg-app-card sm:p-6"
            >
              <p className="max-w-full text-sm text-app-text-secondary sm:max-w-[60%]">
                {t('syncCreatePage.stepConfirmBody')}
              </p>
              <div className="mt-4 grid gap-3 rounded-2xl border-2 border-dashed border-app-text/50 bg-app-bg p-4 text-sm dark:bg-app-elevated">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-app-text-secondary">
                    {t('syncCreatePage.summaryProvider')}
                  </span>
                  {provider ? <ProviderIcon provider={provider} sizeClassName="h-10 w-10" /> : null}
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-app-text-secondary">
                    {t('syncCreatePage.summaryPlaylist')}
                  </span>
                  <span className="max-w-[60%] truncate text-right font-bold text-app-text">
                    {selectedPlaylist?.name ?? '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-app-text-secondary">
                    {t('syncCreatePage.summaryTracks')}
                  </span>
                  <span className="font-bold text-app-text">
                    {selectedPlaylist
                      ? isSelectedTrackCountLoading
                        ? t('syncCreatePage.trackCountLoading')
                        : selectedTrackCount === null
                          ? t('syncCreatePage.trackCountUnavailable')
                          : t('syncCreatePage.trackCount', { count: selectedTrackCount })
                      : '—'}
                  </span>
                </div>
              </div>

              {alreadyShared && (
                <p className="mt-4 rounded-2xl border-2 border-app-text bg-brand-pink/15 px-4 py-3 text-sm font-semibold text-app-text">
                  {t('syncCreatePage.stepConfirmAlreadyShared')}
                </p>
              )}

              <p className="mt-4 rounded-2xl border-2 border-app-text bg-brand-lime/20 px-4 py-3 text-sm font-semibold text-app-text">
                {t('syncCreatePage.shareNotice')}
              </p>

              {createdSync ? (
                <div className="mt-4 grid gap-3">
                  <p className="text-base font-black text-brand-dark dark:text-brand-white">
                    {t('syncCreatePage.magicLinkReady')}
                  </p>
                  <SyncCard sync={createdSync} />
                  <CTALink to="/synced-lists" variant="secondary">
                    {t('syncCreatePage.backToSyncedLists')}
                  </CTALink>
                </div>
              ) : (
                <div className="mt-4 flex justify-center">
                  <CTAButton
                    type="button"
                    onClick={handleShare}
                    disabled={isSharing || !provider || !selectedPlaylist}
                    variant="primary"
                  >
                    {isSharing ? t('syncCreatePage.sharing') : t('syncCreatePage.share')}
                  </CTAButton>
                </div>
              )}
            </motion.article>
          ) : null}
        </AnimatePresence>

        <LayoutGroup id="create-sync-actions">
          <motion.div
            layout
            transition={CREATE_FLOW_STEP_ACTIONS_LAYOUT_TRANSITION}
            className="fixed inset-x-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 mt-6 flex min-h-10 items-center justify-center gap-2 py-4 sm:sticky sm:inset-x-auto sm:bottom-0 sm:z-auto"
          >
            <AnimatePresence initial={false} mode="popLayout">
              {step > 1 && !createdSync ? (
                <motion.div
                  key="create-step-back"
                  layout
                  transition={CREATE_FLOW_STEP_ACTIONS_LAYOUT_TRANSITION}
                  initial={{ opacity: 0, x: -18, scale: 0.96 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: -18, scale: 0.96 }}
                >
                  <CTAButton type="button" onClick={goBackStep} variant="secondary">
                    <ArrowLeft size={16} strokeWidth={2.4} aria-hidden="true" />
                    <span className="sr-only sm:not-sr-only sm:inline">
                      {t('syncCreatePage.back')}
                    </span>
                  </CTAButton>
                </motion.div>
              ) : null}

              {step < 3 ? (
                <motion.div
                  key="create-step-next"
                  layout
                  transition={CREATE_FLOW_STEP_ACTIONS_LAYOUT_TRANSITION}
                  initial={{ opacity: 0, x: 18, scale: 1 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 18, scale: 1 }}
                >
                  <CTAButton
                    type="button"
                    onClick={goNextStep}
                    disabled={
                      (step === 1 &&
                        (!provider || !selectedProviderConnected || isConnectingProvider)) ||
                      (step === 2 && !selectedPlaylist) ||
                      isLoadingIntegrations
                    }
                    variant="primary"
                    className="group disabled:opacity-100"
                    aria-label={t('syncCreatePage.next')}
                  >
                    <span className="sr-only sm:not-sr-only sm:inline">
                      {t('syncCreatePage.next')}
                    </span>
                    <ArrowRight
                      size={16}
                      strokeWidth={2.4}
                      aria-hidden="true"
                      className="transition-transform duration-150 group-hover:translate-x-0.5"
                    />
                  </CTAButton>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </motion.div>
        </LayoutGroup>
      </div>
    </AppPageLayout>
  );
};

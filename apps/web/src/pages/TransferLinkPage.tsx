import type { ExternalImportItem, ExternalPlaylistPreviewResponse } from '@synqit/shared';
import { LINK_SERVICES, MUSIC_SERVICES, ServiceChip, ServiceLogo, useToast } from '@synqit/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, ArrowLeftRight, CheckCircle2, ChevronLeft, Link2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { AppPageHeader } from '../components/app/AppPageHeader';
import { AppPageLayout } from '../components/app/AppPageLayout';
import { CreateFlowStepBreadcrumbs } from '../components/create-flow/CreateFlowStepBreadcrumbs';
import { CREATE_FLOW_STEP_SLIDE_VARIANTS } from '../components/create-flow/flowMotion';
import { ProviderIcon } from '../components/providers/ProviderIcon';
import { PlaylistTrackRow, ProviderCard } from '../components/syncs/TransferPrimitives';
import { CTAButton, CTALink } from '../components/ui/cta';
import { useI18n } from '../hooks/useI18n';
import { trackAnalyticsEvent } from '../lib/analytics';
import { toApiError } from '../lib/api';
import { connectAppleMusic } from '../lib/appleMusic';
import { openProviderOauthPopup } from '../lib/providerOauthPopup';
import { PROVIDER_LABELS } from '../lib/providers';
import {
  EMPTY_INTEGRATION_MAP,
  createExternalImport,
  fetchExternalImport,
  fetchExternalSources,
  fetchIntegrations,
  previewExternalPlaylist,
  queryKeys,
  syncQueryKeys,
} from '../lib/queries';
import { buildSiteUrl } from '../lib/site-url';
import type { Provider } from '../lib/types';

type LinkStep = 1 | 2 | 3;

const POLL_INTERVAL_MS = 1_500;

const providerLabel = (provider: Provider): string => PROVIDER_LABELS[provider];

const isTerminal = (status: ExternalImportItem['status']): boolean =>
  status === 'completed' || status === 'failed';

/**
 * Import a public Deezer or YouTube playlist into the user's Spotify or Apple
 * Music. Three steps: link + destination, preview, import with live progress.
 */
export const TransferLinkPage = () => {
  const { t } = useI18n();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<LinkStep>(1);
  const [stepDirection, setStepDirection] = useState<1 | -1>(1);
  const [url, setUrl] = useState('');
  const [destinationProvider, setDestinationProvider] = useState<Provider>('spotify');
  const [preview, setPreview] = useState<ExternalPlaylistPreviewResponse | null>(null);
  const [activeImportId, setActiveImportId] = useState<string | null>(null);
  const [isConnectingProvider, setIsConnectingProvider] = useState<Provider | null>(null);

  const integrationsQuery = useQuery({
    queryKey: queryKeys.integrations.list(),
    queryFn: fetchIntegrations,
    staleTime: 60_000,
  });
  const sourcesQuery = useQuery({
    queryKey: syncQueryKeys.externalSources(),
    queryFn: fetchExternalSources,
    staleTime: Infinity,
  });
  const importQuery = useQuery({
    queryKey: syncQueryKeys.externalImport(activeImportId ?? ''),
    queryFn: () => fetchExternalImport(activeImportId!),
    enabled: activeImportId !== null,
    refetchInterval: (query) =>
      query.state.data && isTerminal(query.state.data.status) ? false : POLL_INTERVAL_MS,
  });

  const providerStatusByType = integrationsQuery.data ?? EMPTY_INTEGRATION_MAP;
  const destinationConnected = providerStatusByType[destinationProvider] === 'connected';
  const sources = sourcesQuery.data?.sources ?? { deezer: true, youtube: false };
  const maxTracks = sourcesQuery.data?.maxTracks ?? 500;
  const activeImport = importQuery.data ?? null;

  const goToStep = (next: LinkStep) => {
    setStepDirection(next > step ? 1 : -1);
    setStep(next);
  };

  const connectProvider = async (provider: Provider) => {
    setIsConnectingProvider(provider);
    try {
      if (provider === 'apple') {
        await connectAppleMusic();
      } else {
        await openProviderOauthPopup({ provider, nextPath: '/transfer/link' });
      }
      await queryClient.invalidateQueries({ queryKey: queryKeys.integrations.all() });
      showToast(t('profile.connectionConnected', { provider: providerLabel(provider) }), {
        variant: 'success',
      });
    } catch (error) {
      showToast(t('syncCreatePage.connectionError', { message: toApiError(error).message }), {
        variant: 'error',
      });
    } finally {
      setIsConnectingProvider(null);
    }
  };

  const previewMutation = useMutation({
    mutationFn: () => previewExternalPlaylist(url),
    onSuccess: (result) => {
      setPreview(result);
      goToStep(2);
    },
    onError: (error) => {
      const apiError = toApiError(error);
      showToast(
        apiError.code === 'unsupported_url'
          ? t('transferLinkPage.invalidLink')
          : t('transferLinkPage.previewError', { message: apiError.message }),
        { variant: 'error' },
      );
    },
  });

  const startMutation = useMutation({
    mutationFn: () => createExternalImport({ url, recipientProvider: destinationProvider }),
    onSuccess: (item) => {
      setActiveImportId(item.id);
      goToStep(3);
      trackAnalyticsEvent({
        eventName: 'playlist_import_started',
        target: 'transfer',
        properties: { source: item.source, destinationProvider },
      });
    },
    onError: (error) => {
      showToast(t('transferLinkPage.startError', { message: toApiError(error).message }), {
        variant: 'error',
      });
    },
  });

  useEffect(() => {
    if (!activeImport || !isTerminal(activeImport.status)) {
      return;
    }
    void queryClient.invalidateQueries({ queryKey: syncQueryKeys.externalImports() });
    trackAnalyticsEvent({
      eventName:
        activeImport.status === 'completed'
          ? 'playlist_import_succeeded'
          : 'playlist_import_failed',
      target: 'transfer',
      properties: {
        source: activeImport.source,
        destinationProvider: activeImport.recipientProvider,
        matchedCount: activeImport.matchedCount,
        skippedCount: activeImport.skippedCount,
      },
    });
  }, [activeImport, queryClient]);

  const resetFlow = () => {
    setUrl('');
    setPreview(null);
    setActiveImportId(null);
    goToStep(1);
  };

  const isBusy =
    previewMutation.isPending || startMutation.isPending || isConnectingProvider !== null;
  const canPreview = url.trim().length > 0 && destinationConnected && !isBusy;
  const processedCount = activeImport ? activeImport.matchedCount + activeImport.skippedCount : 0;
  const progressTotal = activeImport?.totalCount ?? preview?.trackCount ?? 0;
  const progressRatio = progressTotal > 0 ? Math.min(1, processedCount / progressTotal) : 0;

  const stepItems = [
    { value: 1 as const, label: t('transferLinkPage.stepLink') },
    { value: 2 as const, label: t('transferLinkPage.stepPreview') },
    { value: 3 as const, label: t('transferLinkPage.stepImport') },
  ] as const;

  return (
    <AppPageLayout bodyClassName="gap-6" className="overflow-hidden">
      <AppPageHeader
        eyebrow={t('transferLinkPage.eyebrow')}
        title={t('transferLinkPage.title')}
        description={t('transferLinkPage.description')}
      />

      <CreateFlowStepBreadcrumbs
        activeLayoutId="transfer-link-flow-active"
        currentStep={step}
        items={stepItems}
        layoutGroupId="transfer-link-flow"
        canOpenStep={(target) =>
          target === 1 ||
          (target === 2 && preview !== null) ||
          (target === 3 && activeImportId !== null)
        }
        onStepChange={goToStep}
      />

      <section className="rounded-[2.2rem] border border-app-border bg-app-surface/80 p-4 shadow-soft-lift sm:p-6">
        <AnimatePresence initial={false} mode="wait">
          <motion.div
            key={`transfer-link-step-${step}`}
            custom={stepDirection}
            variants={CREATE_FLOW_STEP_SLIDE_VARIANTS}
            initial="enter"
            animate="center"
            exit="exit"
            className="grid gap-6"
          >
            {step === 1 ? (
              <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
                <article className="grid content-start gap-4 rounded-[1.9rem] border border-app-border bg-white/80 p-5 shadow-soft-lift dark:bg-app-elevated/80">
                  <div className="grid gap-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-app-text-secondary">
                      {t('transferLinkPage.stepLink')}
                    </p>
                    <h2 className="text-2xl font-black text-brand-dark dark:text-brand-white">
                      {t('transferLinkPage.linkTitle')}
                    </h2>
                    <p className="text-sm text-app-text-secondary">
                      {t('transferLinkPage.linkBody')}
                    </p>
                  </div>
                  <label className="grid gap-2 text-sm font-semibold text-app-text">
                    {t('transferLinkPage.linkLabel')}
                    <input
                      type="url"
                      inputMode="url"
                      autoComplete="off"
                      spellCheck={false}
                      value={url}
                      onChange={(event) => setUrl(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && canPreview) {
                          previewMutation.mutate();
                        }
                      }}
                      placeholder={t('transferLinkPage.linkPlaceholder')}
                      className="w-full rounded-xl border border-app-border bg-app-bg px-3 py-2.5 font-normal text-app-text outline-none transition focus:border-brand-pink"
                    />
                  </label>
                  <div className="grid gap-2">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-app-text-muted">
                      {t('transferLinkPage.supportedSourcesLabel')}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {LINK_SERVICES.map((service) => {
                        const available =
                          service.id === 'deezer' ? sources.deezer : sources.youtube;
                        return (
                          <ServiceChip
                            key={service.id}
                            service={service.id}
                            muted={!available}
                            note={
                              available
                                ? t(`transferLinkPage.note.${service.id}`)
                                : t('transferLinkPage.sourceUnavailable')
                            }
                          />
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-app-text-secondary">
                      {t('transferLinkPage.switchToProviders')}{' '}
                      <CTALink to="/transfer/new" variant="ghost" className="ml-1 px-2 py-1">
                        {t('transferLinkPage.switchToProvidersCta')}
                      </CTALink>
                    </p>
                    <CTAButton
                      variant="primary"
                      onClick={() => previewMutation.mutate()}
                      disabled={!canPreview}
                    >
                      <Link2 size={14} aria-hidden="true" />
                      {previewMutation.isPending
                        ? t('transferPage.connecting')
                        : t('transferLinkPage.previewCta')}
                    </CTAButton>
                  </div>
                </article>

                <ProviderCard
                  title={t('transferLinkPage.destinationTitle')}
                  selectedProvider={destinationProvider}
                  providerStatusByType={providerStatusByType}
                  isBusy={isBusy}
                  connectLabel={t('transferPage.connectDestination')}
                  connectedLabel={t('transferPage.alreadyConnected')}
                  notConnectedLabel={t('transferPage.notConnected')}
                  onSelect={setDestinationProvider}
                  onConnect={(provider) => void connectProvider(provider)}
                />
              </div>
            ) : null}

            {step === 2 && preview ? (
              <div className="grid gap-4">
                <div className="grid gap-1 px-1">
                  <h2 className="text-2xl font-black text-brand-dark dark:text-brand-white">
                    {t('transferLinkPage.previewTitle')}
                  </h2>
                  <p className="text-sm text-app-text-secondary">
                    {t('transferLinkPage.previewBody')}
                  </p>
                </div>

                <div className="flex items-start justify-between gap-3 rounded-[1.5rem] border border-app-border bg-app-surface/70 px-4 py-4">
                  <div className="flex min-w-0 items-center gap-3">
                    {preview.coverImageUrl ? (
                      <img
                        src={preview.coverImageUrl}
                        alt=""
                        className="h-14 w-14 shrink-0 rounded-xl object-cover"
                      />
                    ) : null}
                    <div className="min-w-0">
                      <p className="truncate text-lg font-black text-brand-dark dark:text-brand-white">
                        {preview.name}
                      </p>
                      <p className="mt-1 flex items-center gap-1.5 text-sm text-app-text-secondary">
                        <ServiceLogo service={preview.source} alt="" className="h-4 w-4 rounded" />
                        {MUSIC_SERVICES[preview.source].name} ·{' '}
                        {t('transferPage.trackCount', { count: preview.trackCount })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <ArrowLeftRight
                      size={16}
                      className="text-app-text-secondary"
                      aria-hidden="true"
                    />
                    <ProviderIcon provider={destinationProvider} sizeClassName="h-10 w-10" />
                  </div>
                </div>

                {preview.truncated ? (
                  <div className="flex items-start gap-3 rounded-2xl border border-amber-400/60 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-400/40 dark:bg-amber-500/10 dark:text-amber-200">
                    <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
                    <p>
                      {t('transferLinkPage.previewTruncated', {
                        count: maxTracks,
                        total: preview.trackCount,
                      })}
                    </p>
                  </div>
                ) : null}
                {preview.source === 'youtube' ? (
                  <p className="rounded-2xl border border-app-border bg-app-surface/70 px-4 py-3 text-sm text-app-text-secondary">
                    {t('transferLinkPage.youtubeMatchNote')}{' '}
                    <a
                      href={buildSiteUrl('/faq#skipped')}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold underline decoration-brand-pink decoration-2 underline-offset-2 hover:text-app-text"
                    >
                      {t('transferLinkPage.matchingFaq')}
                    </a>
                  </p>
                ) : null}

                <div className="grid max-h-[calc(5*4.5rem+1.5rem)] gap-2 overflow-y-auto pr-1">
                  {preview.tracks.map((track, index) => (
                    <PlaylistTrackRow
                      key={`${track.isrc ?? track.name}-${index}`}
                      track={{ providerTrackId: `${index}`, ...track }}
                      compact
                    />
                  ))}
                </div>
                {preview.trackCount > preview.tracks.length ? (
                  <p className="px-1 text-xs text-app-text-secondary">
                    {t('transferLinkPage.previewSample', {
                      count: preview.tracks.length,
                      total: preview.trackCount,
                    })}
                  </p>
                ) : null}

                <div className="flex items-center justify-between gap-3">
                  <CTAButton
                    variant="ghost"
                    className="rounded-xl px-3 py-2 text-xs"
                    onClick={() => goToStep(1)}
                    disabled={isBusy}
                  >
                    <ChevronLeft size={14} aria-hidden="true" />
                    {t('transferLinkPage.backToLink')}
                  </CTAButton>
                  <CTAButton
                    variant="primary"
                    onClick={() => startMutation.mutate()}
                    disabled={isBusy || !destinationConnected}
                  >
                    {startMutation.isPending
                      ? t('transferLinkPage.importing')
                      : t('transferLinkPage.startImport', {
                          provider: providerLabel(destinationProvider),
                        })}
                  </CTAButton>
                </div>
              </div>
            ) : null}

            {step === 3 ? (
              <div className="grid gap-4">
                <article className="grid gap-3 rounded-[1.9rem] border border-app-border bg-app-surface/70 p-4 shadow-soft-lift">
                  <AnimatePresence>
                    {activeImport?.status === 'completed' ? (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.92, y: 8 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                        className="rounded-[1.5rem] border border-brand-lime/40 bg-brand-lime/12 px-5 py-6 text-center"
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
                          {t('transferLinkPage.completionTitle')}
                        </p>
                        <p className="mt-2 text-sm text-app-text-secondary">
                          {t('transferLinkPage.completionBody')}
                        </p>
                      </motion.div>
                    ) : activeImport?.status === 'failed' ? (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="rounded-[1.5rem] border border-brand-pink/40 bg-brand-pink/10 px-5 py-6 text-center"
                      >
                        <p className="text-2xl font-black text-brand-dark dark:text-brand-white">
                          {t('transferLinkPage.failedTitle')}
                        </p>
                        <p className="mt-2 text-sm text-app-text-secondary">
                          {t('transferLinkPage.failedBody', {
                            message: activeImport.lastError ?? '',
                          })}
                        </p>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>

                  <div className="rounded-[1.25rem] border border-app-border bg-brand-dark px-4 py-3 text-brand-white">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-white/55">
                          {activeImport && isTerminal(activeImport.status)
                            ? t('transferPage.transferDoneTitle')
                            : t('transferLinkPage.importTitle')}
                        </p>
                        <p className="mt-1 truncate text-sm font-bold">
                          {activeImport?.name ?? preview?.name ?? ''}
                        </p>
                      </div>
                      <ProviderIcon provider={destinationProvider} sizeClassName="h-8 w-8" />
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-brand-white/15">
                      <motion.div
                        className="h-full rounded-full bg-brand-lime"
                        animate={{ width: `${Math.round(progressRatio * 100)}%` }}
                        transition={{ duration: 0.4, ease: 'easeOut' }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-brand-white/70" aria-live="polite">
                      {t('transferLinkPage.progress', {
                        done: processedCount,
                        total: progressTotal,
                      })}
                    </p>
                  </div>

                  {activeImport && !isTerminal(activeImport.status) ? (
                    <p className="text-sm text-app-text-secondary">
                      {t('transferLinkPage.importBody')}
                    </p>
                  ) : null}

                  {activeImport ? (
                    <div className="flex flex-wrap gap-2 text-sm">
                      <span className="rounded-full bg-brand-lime/15 px-3 py-1 font-semibold text-[#7da300] dark:text-[#e8ff9a]">
                        {t('transferLinkPage.matchedCount', { count: activeImport.matchedCount })}
                      </span>
                      <span className="rounded-full bg-app-surface px-3 py-1 font-semibold text-app-text-secondary">
                        {t('transferLinkPage.skippedCount', { count: activeImport.skippedCount })}
                      </span>
                    </div>
                  ) : null}
                </article>

                {activeImport && isTerminal(activeImport.status) ? (
                  <div className="flex flex-wrap gap-2">
                    <CTALink to="/transfer" variant="primary">
                      {t('transferLinkPage.openDashboard')}
                    </CTALink>
                    <CTAButton variant="ghost" onClick={resetFlow}>
                      {t('transferLinkPage.importAnother')}
                    </CTAButton>
                  </div>
                ) : null}
              </div>
            ) : null}
          </motion.div>
        </AnimatePresence>
      </section>
    </AppPageLayout>
  );
};

import { providerSchema } from '@synqit/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Variants } from 'framer-motion';
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import { Check, ChevronLeft, ChevronRight, Eye, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { AppPageHeader } from '../components/app/AppPageHeader';
import { AppPageLayout } from '../components/app/AppPageLayout';
import { EventMagicLinkRow } from '../components/events/EventMagicLinkRow';
import { EventProviderIcon } from '../components/events/EventProviderIcon';
import { CTAButton, CTALink, CTAMobileIconLabel } from '../components/ui/cta';
import { useI18n } from '../hooks/useI18n';
import { useToast } from '../hooks/useToast';
import { trackAnalyticsEvent } from '../lib/analytics';
import { toApiError } from '../lib/api';
import { connectAppleMusic } from '../lib/appleMusic';
import { openProviderOauthPopup } from '../lib/providerOauthPopup';
import {
  createDraft,
  createEvent as createEventFn,
  fetchDraft,
  fetchIntegrations,
  queryKeys,
  updateDraft,
} from '../lib/queries';
import { Provider } from '../lib/types';

type ProviderIntegrationStatus = 'connected' | 'not_connected';
type CreateStep = 1 | 2 | 3 | 4;

type CreatedEventState = {
  eventId: string;
  magicLinkToken: string;
  magicLinkUrl: string;
};

const STEP_SLIDE_EASE = [0.16, 1, 0.3, 1] as const;
const BREADCRUMB_LAYOUT_TRANSITION = {
  type: 'spring',
  stiffness: 430,
  damping: 36,
  mass: 0.82,
} as const;
const STEP_ACTIONS_LAYOUT_TRANSITION = {
  type: 'spring',
  stiffness: 420,
  damping: 34,
  mass: 0.8,
} as const;
const STEP_SLIDE_VARIANTS: Variants = {
  enter: (direction: number) => ({
    opacity: 0,
    x: direction > 0 ? 52 : -52,
  }),
  center: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.3,
      ease: STEP_SLIDE_EASE,
    },
  },
  exit: (direction: number) => ({
    opacity: 0,
    x: direction > 0 ? -52 : 52,
    transition: {
      duration: 0.22,
      ease: STEP_SLIDE_EASE,
    },
  }),
};

export const EventCreatePage = () => {
  const { t } = useI18n();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<CreateStep>(1);
  const [stepDirection, setStepDirection] = useState<1 | -1>(1);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [provider, setProvider] = useState<Provider | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [createdEvent, setCreatedEvent] = useState<CreatedEventState | null>(null);
  const [isConnectingProvider, setIsConnectingProvider] = useState(false);
  const [isDraftHydrationDone, setIsDraftHydrationDone] = useState(false);
  const isApplyingDraftRef = useRef(false);
  const draftHydrationDoneRef = useRef(false);

  // ---------------------------------------------------------------------------
  // Integrations query
  // ---------------------------------------------------------------------------

  const integrationsQuery = useQuery({
    queryKey: queryKeys.integrations.list(),
    queryFn: fetchIntegrations,
    staleTime: 60_000,
  });

  const providerStatusByType: Record<Provider, ProviderIntegrationStatus> =
    integrationsQuery.data ?? { spotify: 'not_connected', apple: 'not_connected' };

  const selectedProviderConnected = provider
    ? providerStatusByType[provider] === 'connected'
    : false;

  const trimmedName = name.trim();

  // ---------------------------------------------------------------------------
  // Draft mutations
  // ---------------------------------------------------------------------------

  const createDraftMutation = useMutation({
    mutationFn: createDraft,
    onSuccess: (draft) => {
      setDraftId(draft.id);
      syncDraftIdInQuery(draft.id);
      void queryClient.invalidateQueries({ queryKey: queryKeys.drafts.all() });
    },
    onError: (error) => {
      const apiError = toApiError(error);
      showToast(t('eventsPage.error', { message: apiError.message }), { variant: 'error' });
    },
  });

  const updateDraftMutation = useMutation({
    mutationFn: updateDraft,
    onError: (error) => {
      const apiError = toApiError(error);
      showToast(t('eventsPage.error', { message: apiError.message }), { variant: 'error' });
    },
  });

  // ---------------------------------------------------------------------------
  // Create event mutation
  // ---------------------------------------------------------------------------

  const createEventMutation = useMutation({
    mutationFn: createEventFn,
    onSuccess: (result) => {
      setCreatedEvent({
        eventId: result.eventId,
        magicLinkToken: result.magicLinkToken,
        magicLinkUrl: result.magicLinkUrl,
      });
      trackAnalyticsEvent({
        eventName: 'event_create_succeeded',
        target: 'events',
        properties: { provider: provider!, eventId: result.eventId },
      });
      setDraftId(null);
      syncDraftIdInQuery(null);
      void queryClient.invalidateQueries({ queryKey: queryKeys.events.all() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.drafts.all() });
    },
    onError: (error) => {
      const apiError = toApiError(error);
      trackAnalyticsEvent({
        eventName: 'event_create_failed',
        target: 'events',
        properties: { provider: provider!, code: apiError.code },
      });
      showToast(t('eventsPage.error', { message: apiError.message }), { variant: 'error' });
    },
  });

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  const stepItems = useMemo(
    () => [
      { value: 1 as const, label: t('eventsPage.createFlow.stepProvider') },
      { value: 2 as const, label: t('eventsPage.createFlow.stepName') },
      { value: 3 as const, label: t('eventsPage.createFlow.stepDescription') },
      { value: 4 as const, label: t('eventsPage.createFlow.stepReview') },
    ],
    [t],
  );

  const syncDraftIdInQuery = useCallback((nextDraftId: string | null) => {
    const params = new URLSearchParams(window.location.search);
    if (nextDraftId) {
      params.set('draftId', nextDraftId);
    } else {
      params.delete('draftId');
    }
    const nextQuery = params.toString();
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}`,
    );
  }, []);

  const hasDraftContent = useCallback(
    (
      nextStep: CreateStep,
      nextProvider: Provider | null,
      nextName: string,
      nextDescription: string,
    ) => {
      return (
        nextStep > 1 ||
        nextProvider !== null ||
        nextName.trim().length > 0 ||
        nextDescription.trim().length > 0
      );
    },
    [],
  );

  // ---------------------------------------------------------------------------
  // Connect provider
  // ---------------------------------------------------------------------------

  const connectSelectedProvider = useCallback(
    async (selectedProvider: Provider) => {
      setIsConnectingProvider(true);
      trackAnalyticsEvent({
        eventName: 'provider_connect_started',
        target: 'providers',
        properties: { provider: selectedProvider, context: 'event_create' },
      });
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
                provider: t('eventsPage.createFlow.providerApple'),
              }),
              { variant: 'success' },
            );
            trackAnalyticsEvent({
              eventName: 'provider_connect_succeeded',
              target: 'providers',
              properties: { provider: selectedProvider, context: 'event_create' },
            });
          }
          return;
        }

        const token = (await import('../lib/auth')).getAccessToken();
        if (!token) throw new Error('missing_access_token');
        const popupResult = await openProviderOauthPopup({
          provider: 'spotify',
          accessToken: token,
          nextPath: '/auth/provider-connected',
        });
        await queryClient.invalidateQueries({ queryKey: queryKeys.integrations.all() });
        const snapshot = queryClient.getQueryData<Record<Provider, ProviderIntegrationStatus>>(
          queryKeys.integrations.list(),
        );
        if (snapshot?.spotify === 'connected' || popupResult === 'connected') {
          showToast(
            t('profile.connectionConnected', {
              provider: t('eventsPage.createFlow.providerSpotify'),
            }),
            { variant: 'success' },
          );
          trackAnalyticsEvent({
            eventName: 'provider_connect_succeeded',
            target: 'providers',
            properties: { provider: selectedProvider, context: 'event_create' },
          });
          return;
        }

        if (popupResult === 'blocked' || popupResult === 'error' || popupResult === 'timeout') {
          showToast(
            t('profile.connectionFailed', {
              provider: t('eventsPage.createFlow.providerSpotify'),
            }),
            { variant: 'error' },
          );
          trackAnalyticsEvent({
            eventName: 'provider_connect_failed',
            target: 'providers',
            properties: { provider: selectedProvider, context: 'event_create', popupResult },
          });
        }
      } catch (error) {
        const normalized = error as { message?: string };
        if (normalized.message === 'missing_access_token') {
          showToast(t('profile.notLoggedIn'), { variant: 'error' });
        } else {
          const apiError = toApiError(error);
          showToast(t('eventsPage.createFlow.connectionError', { message: apiError.message }), {
            variant: 'error',
          });
          trackAnalyticsEvent({
            eventName: 'provider_connect_failed',
            target: 'providers',
            properties: {
              provider: selectedProvider,
              context: 'event_create',
              code: apiError.code,
            },
          });
        }
      } finally {
        setIsConnectingProvider(false);
      }
    },
    [queryClient, showToast, t],
  );

  // ---------------------------------------------------------------------------
  // Analytics effects
  // ---------------------------------------------------------------------------

  useEffect(() => {
    trackAnalyticsEvent({
      eventName: 'event_create_step_changed',
      target: 'events',
      properties: { step },
    });
  }, [step]);

  useEffect(() => {
    if (!provider) return;
    trackAnalyticsEvent({
      eventName: 'event_create_provider_selected',
      target: 'events',
      properties: { provider },
    });
  }, [provider]);

  // ---------------------------------------------------------------------------
  // Draft hydration from URL param
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const draftIdParam = params.get('draftId');
    if (!draftIdParam) {
      draftHydrationDoneRef.current = true;
      setIsDraftHydrationDone(true);
      setDraftId(null);
      return;
    }

    let cancelled = false;
    const loadDraft = async () => {
      try {
        const integrations = await queryClient.fetchQuery({
          queryKey: queryKeys.integrations.list(),
          queryFn: fetchIntegrations,
          staleTime: 60_000,
        });
        const draft = await fetchDraft(draftIdParam);
        if (cancelled) return;

        isApplyingDraftRef.current = true;
        setDraftId(draft.id);
        setProvider(draft.provider);
        setName(draft.name);
        setDescription(draft.description);

        const savedStep = draft.step as CreateStep;
        const providerIsConnected =
          draft.provider !== null && integrations[draft.provider] === 'connected';
        let resumeStep: CreateStep = savedStep;
        if (savedStep === 1 && draft.provider !== null && providerIsConnected) {
          resumeStep = 2;
        }
        setStep(resumeStep);
        setStepDirection(1);
        window.setTimeout(() => {
          isApplyingDraftRef.current = false;
        }, 0);
      } catch (error) {
        if (!cancelled) {
          const apiError = toApiError(error);
          showToast(t('eventsPage.error', { message: apiError.message }), { variant: 'error' });
          setDraftId(null);
          syncDraftIdInQuery(null);
        }
      } finally {
        draftHydrationDoneRef.current = true;
        setIsDraftHydrationDone(true);
      }
    };

    void loadDraft();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------------------------------------------------------------
  // Auto-select preferred provider and skip step 1 if already connected
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!isDraftHydrationDone || !integrationsQuery.data) return;
    if (provider !== null || step !== 1) return;
    const connectedProviders = providerSchema.options.filter(
      (p) => integrationsQuery.data[p] === 'connected',
    );
    if (connectedProviders.length === 1) {
      setProvider(connectedProviders[0]);
      setStepDirection(1);
      setStep(2);
    }
  }, [isDraftHydrationDone, integrationsQuery.data, provider, step]);

  // ---------------------------------------------------------------------------
  // Auto-save draft
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!draftHydrationDoneRef.current || isApplyingDraftRef.current || createdEvent) return;

    const nextStep = step;
    const nextProvider = provider;
    const nextName = name;
    const nextDescription = description;
    const shouldPersistDraft = hasDraftContent(nextStep, nextProvider, nextName, nextDescription);
    if (!shouldPersistDraft && !draftId) return;

    const timeoutId = window.setTimeout(() => {
      if (!draftId) {
        createDraftMutation.mutate({
          step: nextStep,
          provider: nextProvider,
          name: nextName,
          description: nextDescription,
        });
      } else {
        updateDraftMutation.mutate({
          draftId,
          step: nextStep,
          provider: nextProvider,
          name: nextName,
          description: nextDescription,
        });
      }
    }, 500);

    return () => {
      window.clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    createdEvent,
    description,
    draftId,
    hasDraftContent,
    name,
    provider,
    step,
    createDraftMutation.mutate,
    updateDraftMutation.mutate,
  ]);

  // ---------------------------------------------------------------------------
  // Handle OAuth callback redirect params
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const providerParam = params.get('provider');
    const status = params.get('status');
    const redirectStep = params.get('step');

    if (providerParam && providerSchema.options.includes(providerParam as Provider)) {
      setProvider(providerParam as Provider);
    }
    if (redirectStep === '1') setStep(1);

    if (providerParam && providerSchema.options.includes(providerParam as Provider) && status) {
      const providerLabel =
        providerParam === 'apple'
          ? t('eventsPage.createFlow.providerApple')
          : t('eventsPage.createFlow.providerSpotify');
      if (status === 'connected') {
        showToast(t('profile.connectionConnected', { provider: providerLabel }), {
          variant: 'success',
        });
      } else {
        showToast(t('profile.connectionFailed', { provider: providerLabel }), {
          variant: 'error',
        });
      }
      void queryClient.invalidateQueries({ queryKey: queryKeys.integrations.all() });
    }

    params.delete('provider');
    params.delete('status');
    params.delete('step');
    const nextQuery = params.toString();
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}`,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------------------------------------------------------------
  // Navigation helpers
  // ---------------------------------------------------------------------------

  const canOpenStep = (nextStep: CreateStep): boolean => {
    if (nextStep <= step) return true;
    if (nextStep === 2) return selectedProviderConnected;
    if (nextStep === 3 || nextStep === 4)
      return selectedProviderConnected && trimmedName.length > 0;
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
        showToast(t('eventsPage.createFlow.providerRequired'), { variant: 'info' });
        return;
      }
      if (!selectedProviderConnected) {
        showToast(t('eventsPage.createFlow.providerMustBeConnected'), { variant: 'info' });
        return;
      }
    }
    if (step === 2 && trimmedName.length === 0) {
      showToast(t('eventsPage.createFlow.nameRequired'), { variant: 'info' });
      return;
    }
    navigateToStep(Math.min(4, step + 1) as CreateStep);
  };

  const goBackStep = () => {
    navigateToStep(Math.max(1, step - 1) as CreateStep);
  };

  const handleCreateEvent = () => {
    if (!provider) return;
    trackAnalyticsEvent({
      eventName: 'event_create_submitted',
      target: 'events',
      properties: { provider, hasDescription: description.trim().length > 0 },
    });
    createEventMutation.mutate({
      provider,
      name: trimmedName,
      description: description.trim(),
      draftId,
    });
  };

  const providerLabel = provider
    ? provider === 'apple'
      ? t('eventsPage.createFlow.providerApple')
      : t('eventsPage.createFlow.providerSpotify')
    : t('eventsPage.createFlow.providerNotSelected');

  const isLoadingIntegrations = integrationsQuery.isLoading;
  const isCreatingEvent = createEventMutation.isPending;

  return (
    <AppPageLayout bodyClassName="gap-5">
      <AppPageHeader
        backTo="/playlists"
        backLabel={t('eventsPage.backToEvents')}
        title={t('eventsPage.createFlow.title')}
        description={t('eventsPage.createFlow.description')}
      />
      <LayoutGroup id="create-event-breadcrumbs">
        <div className="mt-2 mb-5 flex w-full flex-wrap items-center justify-center gap-2 sm:gap-3">
          {stepItems.map((item) => {
            const isActive = step === item.value;
            const isClickable = canOpenStep(item.value);

            return (
              <motion.button
                key={item.value}
                type="button"
                layout
                transition={BREADCRUMB_LAYOUT_TRANSITION}
                disabled={!isClickable || isActive}
                onClick={() => navigateToStep(item.value)}
                className={`relative inline-flex items-center justify-center overflow-hidden rounded-full border text-xs font-black transition sm:text-sm ${
                  isActive ? 'h-8 px-3 sm:h-9 sm:px-3.5' : 'h-8 w-8 sm:h-9 sm:w-9'
                } ${
                  isActive
                    ? 'border-brand-lime/50 text-brand-dark dark:text-brand-white'
                    : isClickable
                      ? 'cursor-pointer border-app-border bg-app-elevated text-app-text hover:border-brand-lime dark:bg-app-card'
                      : 'cursor-not-allowed border-app-border bg-app-bg text-app-text-secondary opacity-60 dark:bg-app-elevated'
                }`}
              >
                {isActive ? (
                  <motion.span
                    layoutId="create-event-breadcrumb-active"
                    transition={BREADCRUMB_LAYOUT_TRANSITION}
                    className="absolute inset-0 rounded-full bg-brand-lime/10"
                  />
                ) : null}
                <span className="relative z-10 inline-flex items-center">
                  <span>{isActive ? `0${item.value}` : item.value}</span>
                  <AnimatePresence initial={false}>
                    {isActive ? (
                      <motion.span
                        key={`label-${item.value}`}
                        initial={{ width: 0, opacity: 0, x: -6 }}
                        animate={{ width: 'auto', opacity: 1, x: 0 }}
                        exit={{ width: 0, opacity: 0, x: 6 }}
                        transition={{ duration: 0.22, ease: STEP_SLIDE_EASE }}
                        className="ml-1 overflow-hidden whitespace-nowrap"
                      >
                        {item.label}
                      </motion.span>
                    ) : null}
                  </AnimatePresence>
                </span>
              </motion.button>
            );
          })}
        </div>
      </LayoutGroup>

      <div className="mx-auto w-full max-w-3xl">
        <AnimatePresence mode="wait" initial={false} custom={stepDirection}>
          {step === 1 ? (
            <motion.article
              key="step-1"
              custom={stepDirection}
              variants={STEP_SLIDE_VARIANTS}
              initial="enter"
              animate="center"
              exit="exit"
              className="p-1 sm:p-2"
            >
              <p className="mx-auto max-w-[70%] text-center text-sm text-app-text-secondary sm:max-w-[50%]">
                {t('eventsPage.createFlow.stepProviderBody')}
              </p>
              <div className="mt-5 flex items-center justify-center gap-6 sm:gap-8">
                <AnimatePresence initial={false}>
                  {providerSchema.options.map((value) => {
                    const isSelected = provider === value;
                    const isConnected = providerStatusByType[value] === 'connected';
                    const isHidden = provider !== null && !isSelected;
                    const label =
                      value === 'apple'
                        ? t('eventsPage.createFlow.providerApple')
                        : t('eventsPage.createFlow.providerSpotify');

                    if (isHidden) return null;

                    return (
                      <motion.div
                        key={value}
                        layout
                        initial={{ opacity: 0, scale: 0.88 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.88 }}
                        transition={{ duration: 0.22, ease: STEP_SLIDE_EASE }}
                        className="relative inline-flex flex-col items-center"
                      >
                        <span className="relative inline-flex p-2 sm:p-3">
                          {!isSelected ? (
                            <button
                              type="button"
                              onClick={() => {
                                setProvider(value);
                                if (providerStatusByType[value] !== 'connected') {
                                  void connectSelectedProvider(value);
                                }
                              }}
                              disabled={isConnectingProvider}
                              aria-label={label}
                              className={`relative inline-flex items-center justify-center rounded-full transition ${
                                isConnectingProvider
                                  ? 'cursor-not-allowed opacity-50'
                                  : 'cursor-pointer'
                              }`}
                            >
                              <EventProviderIcon
                                provider={value}
                                sizeClassName="h-24 w-24 sm:h-24 sm:w-24"
                                imgClassName={isConnected ? '' : 'grayscale saturate-0 opacity-70'}
                              />
                            </button>
                          ) : (
                            <span className="relative inline-flex">
                              <EventProviderIcon
                                provider={value}
                                sizeClassName="h-24 w-24 sm:h-24 sm:w-24"
                                imgClassName={isConnected ? '' : 'grayscale saturate-0 opacity-70'}
                                className="ring-2 ring-brand-lime/70 ring-offset-1 ring-offset-app-bg"
                              />
                            </span>
                          )}
                          <AnimatePresence initial={false} mode="wait">
                            {isSelected && isConnected ? (
                              <motion.span
                                key="check"
                                initial={{ opacity: 0, scale: 0.7 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.7 }}
                                transition={{ duration: 0.18, ease: STEP_SLIDE_EASE }}
                                className="absolute top-3.75 right-3.75 inline-flex h-6 w-6 items-center justify-center rounded-full border border-app-border bg-brand-lime text-brand-white shadow-soft-lift"
                              >
                                <Check size={15} strokeWidth={4} aria-hidden="true" />
                              </motion.span>
                            ) : isSelected && !isConnected ? (
                              <motion.button
                                key="close"
                                type="button"
                                initial={{ opacity: 0, scale: 0.7 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.7 }}
                                transition={{ duration: 0.18, ease: STEP_SLIDE_EASE }}
                                onClick={() => setProvider(null)}
                                aria-label="Unselect provider"
                                className="absolute top-3.75 right-3.75 inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-full bg-brand-pink text-white shadow-soft-lift transition hover:opacity-80"
                              >
                                <X size={13} strokeWidth={3} aria-hidden="true" />
                              </motion.button>
                            ) : null}
                          </AnimatePresence>
                        </span>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </motion.article>
          ) : null}

          {step === 2 ? (
            <motion.article
              key="step-2"
              custom={stepDirection}
              variants={STEP_SLIDE_VARIANTS}
              initial="enter"
              animate="center"
              exit="exit"
              className="p-1 sm:p-2"
            >
              <p className="mx-auto max-w-[70%] text-center text-sm text-app-text-secondary sm:max-w-[50%]">
                {t('eventsPage.createFlow.stepNameBody')}
              </p>
              <div className="mx-auto mt-5 w-[75vw] sm:w-full sm:max-w-xl">
                <label className="sr-only" htmlFor="event-name-input">
                  {t('eventsPage.eventName')}
                </label>
                <input
                  id="event-name-input"
                  required
                  maxLength={100}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="w-full rounded-xl border-2 border-app-border bg-app-bg px-3 py-2 text-app-text outline-none transition focus:border-brand-lime dark:bg-app-elevated"
                  placeholder={t('eventsPage.createFlow.eventNamePlaceholder')}
                />
              </div>
            </motion.article>
          ) : null}

          {step === 3 ? (
            <motion.article
              key="step-3"
              custom={stepDirection}
              variants={STEP_SLIDE_VARIANTS}
              initial="enter"
              animate="center"
              exit="exit"
              className="p-1 sm:p-2"
            >
              <p className="mx-auto max-w-[75%] text-center text-sm text-app-text-secondary sm:max-w-[50%]">
                {t('eventsPage.createFlow.stepDescriptionBody')}
              </p>
              <div className="mx-auto mt-5 w-[75vw] sm:w-full sm:max-w-xl">
                <label className="sr-only" htmlFor="event-description-input">
                  {t('eventsPage.eventDescription')}
                </label>
                <textarea
                  id="event-description-input"
                  maxLength={500}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  className="min-h-24 w-full rounded-xl border-2 border-app-border bg-app-bg px-3 py-2 text-app-text outline-none transition focus:border-brand-lime dark:bg-app-elevated"
                  placeholder={t('eventsPage.createFlow.eventDescriptionPlaceholder')}
                />
              </div>
            </motion.article>
          ) : null}

          {step === 4 ? (
            <motion.article
              key="step-4"
              custom={stepDirection}
              variants={STEP_SLIDE_VARIANTS}
              initial="enter"
              animate="center"
              exit="exit"
              className="rounded-2xl border border-app-border bg-app-elevated p-5 shadow-soft-lift dark:bg-app-card sm:p-6"
            >
              <p className="max-w-full text-sm text-app-text-secondary sm:max-w-[50%]">
                {t('eventsPage.createFlow.stepReviewBody')}
              </p>
              <div className="mt-4 grid gap-3 rounded-xl border border-app-border bg-app-bg p-4 text-sm dark:bg-app-elevated">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-app-text-secondary">
                    {t('eventsPage.createFlow.summaryProvider')}
                  </span>
                  {provider ? (
                    <EventProviderIcon provider={provider} sizeClassName="h-10 w-10" />
                  ) : (
                    <span className="font-bold text-app-text">{providerLabel}</span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-app-text-secondary">
                    {t('eventsPage.createFlow.summaryName')}
                  </span>
                  <span className="font-bold text-app-text">{trimmedName}</span>
                </div>
                <div className="grid gap-1">
                  <span className="text-app-text-secondary">
                    {t('eventsPage.createFlow.summaryDescription')}
                  </span>
                  <p className="text-app-text">
                    {description.trim().length > 0
                      ? description.trim()
                      : t('eventsPage.createFlow.summaryDescriptionEmpty')}
                  </p>
                </div>
              </div>

              <p className="mt-4 rounded-xl border border-brand-lime/50 bg-brand-lime/10 px-4 py-3 text-sm text-app-text">
                {t('eventsPage.createFlow.playlistNotice')}
              </p>

              {createdEvent ? (
                <div className="mt-4 grid gap-3">
                  <p className="text-base font-black text-brand-dark dark:text-brand-white">
                    {t('eventsPage.createFlow.magicLinkReady')}
                  </p>
                  <EventMagicLinkRow
                    magicLinkToken={createdEvent.magicLinkToken}
                    magicLinkRevokedAt={null}
                    shareMode="inline"
                  />
                  <CTALink to={`/playlists/${createdEvent.eventId}`} variant="primary">
                    <Eye size={14} aria-hidden="true" />
                    {t('eventsPage.createFlow.openEventDetails')}
                  </CTALink>
                  <CTALink to="/playlists" variant="secondary">
                    {t('eventsPage.backToEvents')}
                  </CTALink>
                </div>
              ) : (
                <div className="mt-4 flex justify-center">
                  <CTAButton
                    type="button"
                    onClick={handleCreateEvent}
                    disabled={isCreatingEvent || !provider}
                    variant="primary"
                  >
                    {isCreatingEvent
                      ? t('eventsPage.createFlow.creating')
                      : t('eventsPage.createFlow.create')}
                  </CTAButton>
                </div>
              )}
            </motion.article>
          ) : null}
        </AnimatePresence>

        <LayoutGroup id="create-event-actions">
          <motion.div
            layout
            transition={STEP_ACTIONS_LAYOUT_TRANSITION}
            className="mt-6 flex min-h-10 items-center justify-center gap-2"
          >
            <AnimatePresence initial={false} mode="popLayout">
              {step > 1 ? (
                <motion.div
                  key="create-step-back"
                  layout
                  transition={STEP_ACTIONS_LAYOUT_TRANSITION}
                  initial={{ opacity: 0, x: -18, scale: 0.96 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: -18, scale: 0.96 }}
                >
                  <CTAButton type="button" onClick={goBackStep} variant="secondary">
                    <CTAMobileIconLabel
                      icon={<ChevronLeft size={14} aria-hidden="true" />}
                      label={t('eventsPage.createFlow.back')}
                    />
                  </CTAButton>
                </motion.div>
              ) : null}

              {step < 4 ? (
                <motion.div
                  key="create-step-next"
                  layout
                  transition={STEP_ACTIONS_LAYOUT_TRANSITION}
                  initial={{ opacity: 0, x: 18, scale: 0.96 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 18, scale: 0.96 }}
                >
                  <CTAButton
                    type="button"
                    onClick={goNextStep}
                    disabled={
                      (step === 1 &&
                        (!provider || !selectedProviderConnected || isConnectingProvider)) ||
                      (step === 2 && trimmedName.length === 0) ||
                      isLoadingIntegrations
                    }
                    variant="primary"
                    className="group"
                  >
                    {t('eventsPage.createFlow.next')}
                    <ChevronRight
                      size={14}
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

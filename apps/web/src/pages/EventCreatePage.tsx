import {
  eventDraftResponseSchema,
  eventResponseSchema,
  integrationListResponseSchema,
  oauthCallbackResponseSchema,
  providerSchema,
} from '@synqit/shared';
import type { Variants } from 'framer-motion';
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import { Check, ChevronLeft, ChevronRight, Copy, Eye } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { EventProviderIcon } from '../components/events/EventProviderIcon';
import { CircleChevronBackButton } from '../components/ui/CircleChevronBackButton';
import { CTAButton, CTALink, CTAMobileIconLabel } from '../components/ui/cta';
import { useI18n } from '../hooks/useI18n';
import { useToast } from '../hooks/useToast';
import { trackAnalyticsEvent } from '../lib/analytics';
import { callApi, toApiError } from '../lib/api';
import { getAccessToken } from '../lib/auth';
import {
  AppleDeveloperTokenResponse,
  ensureMusicKitInstance,
  loadMusicKitScript,
} from '../lib/musickit';
import { openProviderOauthPopup } from '../lib/providerOauthPopup';
import { Provider } from '../lib/types';

type ProviderIntegrationStatus = 'connected' | 'not_connected';
type CreateStep = 1 | 2 | 3 | 4;

type CreatedEventState = {
  eventId: string;
  magicLinkUrl: string;
};

const INITIAL_PROVIDER_STATUS: Record<Provider, ProviderIntegrationStatus> = {
  spotify: 'not_connected',
  apple: 'not_connected',
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
  const [step, setStep] = useState<CreateStep>(1);
  const [stepDirection, setStepDirection] = useState<1 | -1>(1);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [provider, setProvider] = useState<Provider | null>(null);
  const [providerStatusByType, setProviderStatusByType] =
    useState<Record<Provider, ProviderIntegrationStatus>>(INITIAL_PROVIDER_STATUS);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [createdEvent, setCreatedEvent] = useState<CreatedEventState | null>(null);
  const [isLoadingIntegrations, setIsLoadingIntegrations] = useState(false);
  const [isConnectingProvider, setIsConnectingProvider] = useState(false);
  const [isCreatingEvent, setIsCreatingEvent] = useState(false);
  const isApplyingDraftRef = useRef(false);
  const draftHydrationDoneRef = useRef(false);

  const selectedProviderConnected = provider
    ? providerStatusByType[provider] === 'connected'
    : false;
  const trimmedName = name.trim();

  const stepItems = useMemo(
    () => [
      {
        value: 1 as const,
        label: t('eventsPage.createFlow.stepProvider'),
      },
      {
        value: 2 as const,
        label: t('eventsPage.createFlow.stepName'),
      },
      {
        value: 3 as const,
        label: t('eventsPage.createFlow.stepDescription'),
      },
      {
        value: 4 as const,
        label: t('eventsPage.createFlow.stepReview'),
      },
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

  const requireAccessToken = useCallback(
    (message: string): string | null => {
      const accessToken = getAccessToken();
      if (!accessToken) {
        showToast(message, { variant: 'error' });
        return null;
      }
      return accessToken;
    },
    [showToast],
  );

  const createDraft = useCallback(
    async (params: {
      step: CreateStep;
      provider: Provider | null;
      name: string;
      description: string;
    }) => {
      const accessToken = requireAccessToken(t('eventsPage.loginRequiredUpdate'));
      if (!accessToken) {
        return null;
      }

      const result = await callApi(
        '/v1/events/drafts',
        {
          method: 'POST',
          headers: {
            authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            step: params.step,
            provider: params.provider,
            name: params.name,
            description: params.description,
          }),
        },
        (payload) => eventDraftResponseSchema.parse(payload),
      );

      return result.draft;
    },
    [requireAccessToken, t],
  );

  const updateDraft = useCallback(
    async (params: {
      draftId: string;
      step: CreateStep;
      provider: Provider | null;
      name: string;
      description: string;
    }) => {
      const accessToken = requireAccessToken(t('eventsPage.loginRequiredUpdate'));
      if (!accessToken) {
        return null;
      }

      const result = await callApi(
        `/v1/events/drafts/${params.draftId}`,
        {
          method: 'PATCH',
          headers: {
            authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            step: params.step,
            provider: params.provider,
            name: params.name,
            description: params.description,
          }),
        },
        (payload) => eventDraftResponseSchema.parse(payload),
      );

      return result.draft;
    },
    [requireAccessToken, t],
  );

  const loadIntegrations = useCallback(async (): Promise<Record<
    Provider,
    ProviderIntegrationStatus
  > | null> => {
    const accessToken = requireAccessToken(t('eventsPage.loginRequiredLoad'));
    if (!accessToken) {
      return null;
    }

    setIsLoadingIntegrations(true);
    try {
      const result = await callApi(
        '/v1/integrations',
        {
          method: 'GET',
          headers: {
            authorization: `Bearer ${accessToken}`,
          },
        },
        (payload) => integrationListResponseSchema.parse(payload),
      );

      const nextMap: Record<Provider, ProviderIntegrationStatus> = {
        spotify: 'not_connected',
        apple: 'not_connected',
      };
      for (const integration of result.integrations) {
        nextMap[integration.provider] = integration.status;
      }
      setProviderStatusByType(nextMap);
      return nextMap;
    } catch (error) {
      const apiError = toApiError(error);
      showToast(t('eventsPage.error', { message: apiError.message }), { variant: 'error' });
      return null;
    } finally {
      setIsLoadingIntegrations(false);
    }
  }, [requireAccessToken, showToast, t]);

  const connectAppleMusic = useCallback(async () => {
    const accessToken = requireAccessToken(t('eventsPage.loginRequiredUpdate'));
    if (!accessToken) {
      return;
    }

    const tokenResponse = await callApi(
      '/v1/auth/apple/developer-token',
      {
        method: 'GET',
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      },
      (payload) => {
        const value = payload as Partial<AppleDeveloperTokenResponse>;
        if (
          value &&
          value.provider === 'apple' &&
          typeof value.developerToken === 'string' &&
          typeof value.musicKitIdentifier === 'string'
        ) {
          return value as AppleDeveloperTokenResponse;
        }

        throw new Error('invalid_apple_developer_token_response');
      },
    );

    await loadMusicKitScript();
    const musicKit = await ensureMusicKitInstance({
      developerToken: tokenResponse.developerToken,
      appName: tokenResponse.musicKitIdentifier || 'synqit',
    });
    const musicUserToken = await musicKit.authorize();
    if (!musicUserToken) {
      throw new Error('apple_music_user_token_missing');
    }

    await callApi(
      '/v1/auth/apple/connect',
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          musicUserToken,
        }),
      },
      (payload) => oauthCallbackResponseSchema.parse(payload),
    );
  }, [requireAccessToken, t]);

  const connectSelectedProvider = useCallback(
    async (selectedProvider: Provider) => {
      const accessToken = requireAccessToken(t('eventsPage.loginRequiredUpdate'));
      if (!accessToken) {
        return;
      }

      setIsConnectingProvider(true);
      trackAnalyticsEvent({
        eventName: 'provider_connect_started',
        target: 'providers',
        properties: {
          provider: selectedProvider,
          context: 'event_create',
        },
      });
      try {
        if (selectedProvider === 'apple') {
          await connectAppleMusic();
          const snapshot = await loadIntegrations();
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
              properties: {
                provider: selectedProvider,
                context: 'event_create',
              },
            });
          }
          return;
        }

        const popupResult = await openProviderOauthPopup({
          provider: 'spotify',
          accessToken,
          nextPath: '/auth/provider-connected',
        });
        const snapshot = await loadIntegrations();
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
            properties: {
              provider: selectedProvider,
              context: 'event_create',
            },
          });
          return;
        }

        if (popupResult === 'blocked' || popupResult === 'error' || popupResult === 'timeout') {
          showToast(
            t('profile.connectionFailed', { provider: t('eventsPage.createFlow.providerSpotify') }),
            {
              variant: 'error',
            },
          );
          trackAnalyticsEvent({
            eventName: 'provider_connect_failed',
            target: 'providers',
            properties: {
              provider: selectedProvider,
              context: 'event_create',
              popupResult,
            },
          });
        }
      } catch (error) {
        const apiError = toApiError(error);
        showToast(
          t('eventsPage.createFlow.connectionError', {
            message: apiError.message,
          }),
          { variant: 'error' },
        );
        trackAnalyticsEvent({
          eventName: 'provider_connect_failed',
          target: 'providers',
          properties: {
            provider: selectedProvider,
            context: 'event_create',
            code: apiError.code,
          },
        });
      } finally {
        setIsConnectingProvider(false);
      }
    },
    [connectAppleMusic, loadIntegrations, requireAccessToken, showToast, t],
  );

  const createEvent = useCallback(async () => {
    const accessToken = requireAccessToken(t('eventsPage.loginRequiredUpdate'));
    if (!accessToken || !provider) {
      return;
    }

    setIsCreatingEvent(true);
    trackAnalyticsEvent({
      eventName: 'event_create_submitted',
      target: 'events',
      properties: {
        provider,
        hasDescription: description.trim().length > 0,
      },
    });
    try {
      const result = await callApi(
        '/v1/events',
        {
          method: 'POST',
          headers: {
            authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            provider,
            name: trimmedName,
            description: description.trim(),
            draftId: draftId ?? undefined,
          }),
        },
        (payload) => eventResponseSchema.parse(payload),
      );

      setCreatedEvent({
        eventId: result.event.id,
        magicLinkUrl: result.magicLinkUrl,
      });
      trackAnalyticsEvent({
        eventName: 'event_create_succeeded',
        target: 'events',
        properties: {
          provider,
          eventId: result.event.id,
        },
      });
      setDraftId(null);
      syncDraftIdInQuery(null);
      showToast(t('eventsPage.createFlow.created', { name: result.event.name }), {
        variant: 'success',
      });
    } catch (error) {
      const apiError = toApiError(error);
      trackAnalyticsEvent({
        eventName: 'event_create_failed',
        target: 'events',
        properties: {
          provider,
          code: apiError.code,
        },
      });
      showToast(t('eventsPage.error', { message: apiError.message }), { variant: 'error' });
    } finally {
      setIsCreatingEvent(false);
    }
  }, [
    description,
    draftId,
    provider,
    requireAccessToken,
    showToast,
    syncDraftIdInQuery,
    t,
    trimmedName,
  ]);

  useEffect(() => {
    void loadIntegrations();
  }, [loadIntegrations]);

  useEffect(() => {
    trackAnalyticsEvent({
      eventName: 'event_create_step_changed',
      target: 'events',
      properties: {
        step,
      },
    });
  }, [step]);

  useEffect(() => {
    if (!provider) {
      return;
    }

    trackAnalyticsEvent({
      eventName: 'event_create_provider_selected',
      target: 'events',
      properties: {
        provider,
      },
    });
  }, [provider]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const draftIdParam = params.get('draftId');
    if (!draftIdParam) {
      draftHydrationDoneRef.current = true;
      setDraftId(null);
      return;
    }

    let cancelled = false;
    const loadDraft = async () => {
      const accessToken = requireAccessToken(t('eventsPage.loginRequiredLoad'));
      if (!accessToken) {
        draftHydrationDoneRef.current = true;
        return;
      }

      try {
        const result = await callApi(
          `/v1/events/drafts/${draftIdParam}`,
          {
            method: 'GET',
            headers: {
              authorization: `Bearer ${accessToken}`,
            },
          },
          (payload) => eventDraftResponseSchema.parse(payload),
        );
        if (cancelled) {
          return;
        }

        isApplyingDraftRef.current = true;
        setDraftId(result.draft.id);
        setProvider(result.draft.provider);
        setName(result.draft.name);
        setDescription(result.draft.description);
        setStep(result.draft.step as CreateStep);
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
      }
    };

    void loadDraft();

    return () => {
      cancelled = true;
    };
  }, [requireAccessToken, showToast, syncDraftIdInQuery, t]);

  useEffect(() => {
    if (!draftHydrationDoneRef.current || isApplyingDraftRef.current || createdEvent) {
      return;
    }

    const nextStep = step;
    const nextProvider = provider;
    const nextName = name;
    const nextDescription = description;
    const shouldPersistDraft = hasDraftContent(nextStep, nextProvider, nextName, nextDescription);
    if (!shouldPersistDraft && !draftId) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void (async () => {
        try {
          if (!draftId) {
            const createdDraft = await createDraft({
              step: nextStep,
              provider: nextProvider,
              name: nextName,
              description: nextDescription,
            });
            if (!createdDraft) {
              return;
            }
            setDraftId(createdDraft.id);
            syncDraftIdInQuery(createdDraft.id);
            return;
          }

          await updateDraft({
            draftId,
            step: nextStep,
            provider: nextProvider,
            name: nextName,
            description: nextDescription,
          });
        } catch (error) {
          const apiError = toApiError(error);
          showToast(t('eventsPage.error', { message: apiError.message }), { variant: 'error' });
        }
      })();
    }, 500);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    createDraft,
    createdEvent,
    description,
    draftId,
    hasDraftContent,
    name,
    provider,
    showToast,
    step,
    syncDraftIdInQuery,
    t,
    updateDraft,
  ]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const providerParam = params.get('provider');
    const status = params.get('status');
    const redirectStep = params.get('step');

    if (providerParam && providerSchema.options.includes(providerParam as Provider)) {
      setProvider(providerParam as Provider);
    }
    if (redirectStep === '1') {
      setStep(1);
    }

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
      void loadIntegrations();
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
  }, [loadIntegrations, showToast, t]);

  const copyMagicLink = async () => {
    if (!createdEvent || typeof navigator === 'undefined' || !navigator.clipboard) {
      showToast(t('eventsPage.copyFailed'), { variant: 'error' });
      return;
    }

    try {
      await navigator.clipboard.writeText(createdEvent.magicLinkUrl);
      showToast(t('eventsPage.copySuccess'), { variant: 'success' });
    } catch {
      showToast(t('eventsPage.copyFailed'), { variant: 'error' });
    }
  };

  const canOpenStep = (nextStep: CreateStep): boolean => {
    if (nextStep <= step) {
      return true;
    }
    if (nextStep === 2) {
      return selectedProviderConnected;
    }
    if (nextStep === 3 || nextStep === 4) {
      return selectedProviderConnected && trimmedName.length > 0;
    }
    return false;
  };

  const navigateToStep = (nextStep: CreateStep) => {
    if (nextStep === step) {
      return;
    }
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

  const providerLabel = provider
    ? provider === 'apple'
      ? t('eventsPage.createFlow.providerApple')
      : t('eventsPage.createFlow.providerSpotify')
    : t('eventsPage.createFlow.providerNotSelected');

  return (
    <section className="relative mx-auto w-full max-w-6xl px-4 pb-16 pt-28 sm:px-6 sm:pt-32 lg:px-8">
      <div className="relative grid gap-5">
        <article>
          <div className="flex items-start gap-4 px-5 py-7 sm:px-8 sm:py-9">
            <CircleChevronBackButton to="/events" label={t('eventsPage.backToEvents')} />
            <div className="grid w-full gap-2">
              <h1 className="text-2xl font-black tracking-tight text-brand-dark dark:text-brand-white sm:text-5xl">
                {t('eventsPage.createFlow.title')}
              </h1>
              <p className="max-w-full text-sm text-app-text-secondary sm:max-w-full sm:text-base">
                {t('eventsPage.createFlow.description')}
              </p>
            </div>
          </div>
          <LayoutGroup id="create-event-breadcrumbs">
            <div className="my-5 flex w-full flex-wrap items-center justify-center gap-2 sm:gap-3">
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
        </article>

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
                <div className="mt-5 flex flex-wrap items-center justify-center gap-6 sm:gap-8">
                  {providerSchema.options.map((value) => {
                    const isSelected = provider === value;
                    const isConnected = providerStatusByType[value] === 'connected';
                    const isOtherProviderLocked = provider !== null && provider !== value;
                    const label =
                      value === 'apple'
                        ? t('eventsPage.createFlow.providerApple')
                        : t('eventsPage.createFlow.providerSpotify');

                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => {
                          setProvider(value);
                          if (providerStatusByType[value] !== 'connected') {
                            void connectSelectedProvider(value);
                          }
                        }}
                        disabled={isConnectingProvider || isOtherProviderLocked}
                        aria-label={label}
                        className={`relative inline-flex items-center justify-center rounded-full p-2 sm:p-3 transition ${
                          isSelected ? 'scale-[1.03]' : ''
                        } ${
                          isConnectingProvider || isOtherProviderLocked
                            ? 'cursor-not-allowed opacity-50'
                            : 'cursor-pointer'
                        }`}
                      >
                        <span className="relative inline-flex">
                          <EventProviderIcon
                            provider={value}
                            sizeClassName="h-20 w-20 sm:h-24 sm:w-24"
                            className={
                              isSelected
                                ? 'ring-2 ring-brand-lime/70 ring-offset-1 ring-offset-app-bg'
                                : ''
                            }
                          />
                          {isConnected ? (
                            <span className="absolute bottom-0.75 right-0 inline-flex h-6 w-6 items-center justify-center rounded-full border border-app-border bg-brand-lime text-brand-white shadow-soft-lift">
                              <Check size={15} strokeWidth={4} aria-hidden="true" />
                            </span>
                          ) : null}
                        </span>
                      </button>
                    );
                  })}
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
                  <div className="mt-4 grid gap-3 rounded-xl border border-brand-lime/50 bg-brand-lime/10 p-4">
                    <p className="text-base font-black text-brand-dark dark:text-brand-white">
                      {t('eventsPage.createFlow.magicLinkReady')}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <a
                        href={createdEvent.magicLinkUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="truncate text-sm font-bold text-brand-pink hover:text-[#d12074]"
                      >
                        {createdEvent.magicLinkUrl}
                      </a>
                      <CTAButton
                        type="button"
                        onClick={() => void copyMagicLink()}
                        variant="secondary"
                      >
                        <Copy size={14} aria-hidden="true" />
                        {t('eventsPage.copy')}
                      </CTAButton>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <CTALink to={`/events/${createdEvent.eventId}`} variant="primary">
                        <CTAMobileIconLabel
                          icon={<Eye size={14} aria-hidden="true" />}
                          label={t('eventsPage.createFlow.openEventDetails')}
                        />
                      </CTALink>
                      <CTALink to="/events" variant="secondary">
                        {t('eventsPage.backToEvents')}
                      </CTALink>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 flex justify-center">
                    <CTAButton
                      type="button"
                      onClick={() => void createEvent()}
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
              className="mt-10 flex min-h-10 items-center justify-center gap-2"
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
                    >
                      <CTAMobileIconLabel
                        icon={<ChevronRight size={14} aria-hidden="true" />}
                        label={t('eventsPage.createFlow.next')}
                      />
                    </CTAButton>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </motion.div>
          </LayoutGroup>
        </div>
      </div>
    </section>
  );
};

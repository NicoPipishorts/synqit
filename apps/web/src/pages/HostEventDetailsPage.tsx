import {
  eventResponseSchema,
  eventTracksResponseSchema,
  removeEventTrackResponseSchema,
  updateEventRequestSchema,
} from '@synqit/shared';
import { useParams } from '@tanstack/react-router';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

import { EventEditFormCard } from '../components/events/EventEditFormCard';
import { EventMagicLinkCard } from '../components/events/EventMagicLinkCard';
import { EventTracksCard } from '../components/events/EventTracksCard';
import { HostEventDetailsHeader } from '../components/events/HostEventDetailsHeader';
import { CTAButton } from '../components/ui/cta';
import { Modal } from '../components/ui/Modal';
import { useI18n } from '../hooks/useI18n';
import { useToast } from '../hooks/useToast';
import { callApi, toApiError } from '../lib/api';
import { getAccessToken } from '../lib/auth';
import { EventTrackItem, getPublicEventUrl, HostEvent } from '../lib/events';

export const HostEventDetailsPage = () => {
  const { t, locale } = useI18n();
  const { showToast } = useToast();
  const params = useParams({ from: '/events/$eventId' });
  const { eventId } = params;

  const [event, setEvent] = useState<HostEvent | null>(null);
  const [tracks, setTracks] = useState<EventTrackItem[]>([]);
  const [isLoadingTracks, setIsLoadingTracks] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [isCloseConfirmOpen, setIsCloseConfirmOpen] = useState(false);
  const [trackActionKey, setTrackActionKey] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
    [locale],
  );

  const formatDateTime = useCallback(
    (value: string) => {
      try {
        return dateFormatter.format(new Date(value));
      } catch {
        return value;
      }
    },
    [dateFormatter],
  );

  const setStatusAndToast = useCallback(
    (message: string, variant: 'success' | 'error' | 'info' = 'info') => {
      showToast(message, { variant });
    },
    [showToast],
  );

  const requireAccessToken = useCallback(
    (message: string): string | null => {
      const accessToken = getAccessToken();
      if (!accessToken) {
        setStatusAndToast(message, 'error');
        return null;
      }
      return accessToken;
    },
    [setStatusAndToast],
  );

  const loadEvent = useCallback(async () => {
    const accessToken = requireAccessToken(t('eventsPage.loginRequiredLoad'));
    if (!accessToken) {
      return;
    }

    try {
      const result = await callApi(
        `/v1/events/${encodeURIComponent(eventId)}`,
        {
          method: 'GET',
          headers: {
            authorization: `Bearer ${accessToken}`,
          },
        },
        (payload) => eventResponseSchema.parse(payload),
      );

      setEvent({
        id: result.event.id,
        name: result.event.name,
        description: result.event.description,
        provider: result.event.provider,
        status: result.event.status,
        magicLinkToken: result.event.magicLinkToken,
        magicLinkRevokedAt: result.event.magicLinkRevokedAt,
        updatedAt: result.event.updatedAt,
      });
      setEditName(result.event.name);
      setEditDescription(result.event.description);
    } catch (error) {
      const apiError = toApiError(error);
      setStatusAndToast(t('eventsPage.error', { message: apiError.message }), 'error');
    }
  }, [eventId, requireAccessToken, setStatusAndToast, t]);

  const loadTracks = useCallback(async () => {
    const accessToken = requireAccessToken(t('eventsPage.loginRequiredTracks'));
    if (!accessToken) {
      return;
    }

    setIsLoadingTracks(true);
    try {
      const result = await callApi(
        `/v1/events/${encodeURIComponent(eventId)}/tracks`,
        {
          method: 'GET',
          headers: {
            authorization: `Bearer ${accessToken}`,
          },
        },
        (payload) => eventTracksResponseSchema.parse(payload),
      );
      setTracks(result.tracks);
    } catch (error) {
      const apiError = toApiError(error);
      setStatusAndToast(t('eventsPage.error', { message: apiError.message }), 'error');
    } finally {
      setIsLoadingTracks(false);
    }
  }, [eventId, requireAccessToken, setStatusAndToast, t]);

  useEffect(() => {
    void loadEvent();
    void loadTracks();
  }, [loadEvent, loadTracks]);

  const saveEvent = async (submitEvent: FormEvent<HTMLFormElement>) => {
    submitEvent.preventDefault();

    const accessToken = requireAccessToken(t('eventsPage.loginRequiredUpdate'));
    if (!accessToken || !event) {
      return;
    }

    setIsWorking(true);
    try {
      const payload = updateEventRequestSchema.parse({
        name: editName,
        description: editDescription,
      });

      const result = await callApi(
        `/v1/events/${encodeURIComponent(event.id)}`,
        {
          method: 'PATCH',
          headers: {
            authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(payload),
        },
        (responsePayload) => eventResponseSchema.parse(responsePayload),
      );

      setEvent((previousEvent) =>
        previousEvent
          ? {
              ...previousEvent,
              name: result.event.name,
              description: result.event.description,
              status: result.event.status,
              updatedAt: result.event.updatedAt,
            }
          : previousEvent,
      );
      setStatusAndToast(t('eventsPage.updated', { name: result.event.name }), 'success');
    } catch (error) {
      const apiError = toApiError(error);
      setStatusAndToast(t('eventsPage.error', { message: apiError.message }), 'error');
    } finally {
      setIsWorking(false);
    }
  };

  const closeEvent = async (): Promise<boolean> => {
    const accessToken = requireAccessToken(t('eventsPage.loginRequiredClose'));
    if (!accessToken || !event) {
      return false;
    }

    setIsWorking(true);
    try {
      const result = await callApi(
        `/v1/events/${encodeURIComponent(event.id)}/close`,
        {
          method: 'POST',
          headers: {
            authorization: `Bearer ${accessToken}`,
          },
        },
        (payload) => eventResponseSchema.parse(payload),
      );

      setEvent((previousEvent) =>
        previousEvent
          ? {
              ...previousEvent,
              status: result.event.status,
              updatedAt: result.event.updatedAt,
            }
          : previousEvent,
      );
      setStatusAndToast(t('eventsPage.closed', { name: result.event.name }), 'success');
      return true;
    } catch (error) {
      const apiError = toApiError(error);
      setStatusAndToast(t('eventsPage.error', { message: apiError.message }), 'error');
      return false;
    } finally {
      setIsWorking(false);
    }
  };

  const revokeMagicLink = async () => {
    const accessToken = requireAccessToken(t('eventsPage.loginRequiredRevoke'));
    if (!accessToken || !event) {
      return;
    }

    setIsWorking(true);
    try {
      const result = await callApi(
        `/v1/events/${encodeURIComponent(event.id)}/magic-link/revoke`,
        {
          method: 'POST',
          headers: {
            authorization: `Bearer ${accessToken}`,
          },
        },
        (payload) => eventResponseSchema.parse(payload),
      );

      setEvent((previousEvent) =>
        previousEvent
          ? {
              ...previousEvent,
              magicLinkToken: result.event.magicLinkToken,
              magicLinkRevokedAt: result.event.magicLinkRevokedAt,
              updatedAt: result.event.updatedAt,
            }
          : previousEvent,
      );
      setStatusAndToast(t('eventsPage.revoked', { name: result.event.name }), 'success');
    } catch (error) {
      const apiError = toApiError(error);
      setStatusAndToast(t('eventsPage.error', { message: apiError.message }), 'error');
    } finally {
      setIsWorking(false);
    }
  };

  const regenerateMagicLink = async () => {
    const accessToken = requireAccessToken(t('eventsPage.loginRequiredRegenerate'));
    if (!accessToken || !event) {
      return;
    }

    setIsWorking(true);
    try {
      const result = await callApi(
        `/v1/events/${encodeURIComponent(event.id)}/magic-link/regenerate`,
        {
          method: 'POST',
          headers: {
            authorization: `Bearer ${accessToken}`,
          },
        },
        (payload) => eventResponseSchema.parse(payload),
      );

      setEvent((previousEvent) =>
        previousEvent
          ? {
              ...previousEvent,
              magicLinkToken: result.event.magicLinkToken,
              magicLinkRevokedAt: result.event.magicLinkRevokedAt,
              updatedAt: result.event.updatedAt,
            }
          : previousEvent,
      );
      setStatusAndToast(t('eventsPage.regenerated', { name: result.event.name }), 'success');
    } catch (error) {
      const apiError = toApiError(error);
      setStatusAndToast(t('eventsPage.error', { message: apiError.message }), 'error');
    } finally {
      setIsWorking(false);
    }
  };

  const removeTrack = async (providerTrackId: string) => {
    const accessToken = requireAccessToken(t('eventsPage.loginRequiredTrackRemove'));
    if (!accessToken || !event) {
      return;
    }

    setTrackActionKey(providerTrackId);
    try {
      await callApi(
        `/v1/events/${encodeURIComponent(event.id)}/tracks/${encodeURIComponent(providerTrackId)}`,
        {
          method: 'DELETE',
          headers: {
            authorization: `Bearer ${accessToken}`,
          },
        },
        (payload) => removeEventTrackResponseSchema.parse(payload),
      );

      setTracks((previousTracks) =>
        previousTracks.filter((track) => track.providerTrackId !== providerTrackId),
      );
      setStatusAndToast(t('eventsPage.trackRemoved'), 'success');
    } catch (error) {
      const apiError = toApiError(error);
      setStatusAndToast(t('eventsPage.error', { message: apiError.message }), 'error');
    } finally {
      setTrackActionKey(null);
    }
  };

  const copyMagicLink = async () => {
    if (!event) {
      return;
    }
    const eventUrl = getPublicEventUrl(event.magicLinkToken);

    if (typeof navigator === 'undefined' || !navigator.clipboard) {
      setStatusAndToast(t('eventsPage.copyFailed'), 'error');
      return;
    }

    try {
      await navigator.clipboard.writeText(eventUrl);
      setStatusAndToast(t('eventsPage.copySuccess'), 'success');
    } catch {
      setStatusAndToast(t('eventsPage.copyFailed'), 'error');
    }
  };

  return (
    <section className="relative mx-auto w-full max-w-6xl px-4 pb-16 pt-28 sm:px-6 sm:pt-32 lg:px-8">
      <div className="relative grid gap-6">
        <HostEventDetailsHeader
          event={event}
          isWorking={isWorking}
          onOpenCloseConfirm={() => setIsCloseConfirmOpen(true)}
        />

        {event ? (
          <>
            <EventEditFormCard
              editName={editName}
              editDescription={editDescription}
              isWorking={isWorking}
              onSubmit={(submitEvent) => void saveEvent(submitEvent)}
              onNameChange={setEditName}
              onDescriptionChange={setEditDescription}
              onCancel={() => {
                setEditName(event.name);
                setEditDescription(event.description);
              }}
            />
            <Modal
              open={isCloseConfirmOpen}
              title={t('eventsPage.closeEventConfirmTitle')}
              onClose={() => setIsCloseConfirmOpen(false)}
            >
              <div className="grid gap-4">
                <p className="text-sm text-app-text-secondary">
                  {t('eventsPage.closeEventConfirmBody')}
                </p>
                <div className="flex flex-wrap justify-end gap-2">
                  <CTAButton
                    type="button"
                    variant="secondary"
                    disabled={isWorking}
                    onClick={() => setIsCloseConfirmOpen(false)}
                  >
                    {t('eventsPage.cancel')}
                  </CTAButton>
                  <CTAButton
                    type="button"
                    variant="danger"
                    disabled={isWorking || event.status !== 'open'}
                    onClick={() => {
                      void (async () => {
                        const didClose = await closeEvent();
                        if (didClose) {
                          setIsCloseConfirmOpen(false);
                        }
                      })();
                    }}
                  >
                    {isWorking ? t('eventsPage.working') : t('eventsPage.closeEventConfirmCta')}
                  </CTAButton>
                </div>
              </div>
            </Modal>

            <EventMagicLinkCard
              event={event}
              isWorking={isWorking}
              formatDateTime={formatDateTime}
              onCopy={() => void copyMagicLink()}
              onRevoke={() => void revokeMagicLink()}
              onRegenerate={() => void regenerateMagicLink()}
            />

            <EventTracksCard
              tracks={tracks}
              isLoadingTracks={isLoadingTracks}
              trackActionKey={trackActionKey}
              onRefreshTracks={() => void loadTracks()}
              onRemoveTrack={(providerTrackId) => void removeTrack(providerTrackId)}
            />
          </>
        ) : null}
      </div>
    </section>
  );
};

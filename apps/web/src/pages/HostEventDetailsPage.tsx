import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { AppPageLayout } from '../components/app/AppPageLayout';
import { EventEditFormCard } from '../components/events/EventEditFormCard';
import { EventMagicLinkCard } from '../components/events/EventMagicLinkCard';
import { EventTracksCard } from '../components/events/EventTracksCard';
import { HostEventDetailsHeader } from '../components/events/HostEventDetailsHeader';
import { CTAButton, CTALink } from '../components/ui/cta';
import { Modal } from '../components/ui/Modal';
import { useI18n } from '../hooks/useI18n';
import { useToast } from '../hooks/useToast';
import { trackAnalyticsEvent } from '../lib/analytics';
import { toApiError } from '../lib/api';
import { HostEvent } from '../lib/events';
import {
  closeEvent,
  deleteEventImage,
  fetchEvent,
  fetchEventTracks,
  queryKeys,
  reopenEvent,
  regenerateMagicLink,
  revokeMagicLink,
  updateEvent,
  uploadEventImage,
} from '../lib/queries';

export const HostEventDetailsPage = () => {
  const { t, locale } = useI18n();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const params = useParams({ from: '/playlists/$eventId' });
  const { eventId } = params;

  const [isCloseConfirmOpen, setIsCloseConfirmOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const trackedDisconnectedWarningEventIdsRef = useRef<Set<string>>(new Set());

  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }),
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

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------

  const eventQuery = useQuery({
    queryKey: queryKeys.events.detail(eventId),
    queryFn: () => fetchEvent(eventId),
  });

  const tracksQuery = useQuery({
    queryKey: queryKeys.events.tracks(eventId),
    queryFn: () => fetchEventTracks(eventId),
    enabled: eventQuery.isSuccess,
  });

  const event = eventQuery.data ?? null;
  const tracks = tracksQuery.data ?? [];

  // Initialise edit fields when event first loads
  useEffect(() => {
    if (event && editName === '' && editDescription === '') {
      setEditName(event.name);
      setEditDescription(event.description);
    }
  }, [event, editName, editDescription]);

  // Surface errors as toasts
  useEffect(() => {
    if (!eventQuery.isError) return;
    const apiError = toApiError(eventQuery.error);
    showToast(t('eventsPage.error', { message: apiError.message }), { variant: 'error' });
    trackAnalyticsEvent({
      eventName: 'event_host_load_failed',
      target: 'events',
      properties: { code: apiError.code, eventId },
    });
  }, [eventQuery.isError, eventQuery.error, showToast, t, eventId]);

  useEffect(() => {
    if (!tracksQuery.isError) return;
    const apiError = toApiError(tracksQuery.error);
    showToast(t('eventsPage.error', { message: apiError.message }), { variant: 'error' });
    trackAnalyticsEvent({
      eventName: 'event_tracks_load_failed',
      target: 'events',
      properties: { scope: 'host', code: apiError.code, eventId },
    });
  }, [tracksQuery.isError, tracksQuery.error, showToast, t, eventId]);

  // Analytics: disconnected warning (fire once per event id)
  useEffect(() => {
    if (!event || event.providerConnectionStatus !== 'not_connected') return;
    if (trackedDisconnectedWarningEventIdsRef.current.has(event.id)) return;
    trackedDisconnectedWarningEventIdsRef.current.add(event.id);
    trackAnalyticsEvent({
      eventName: 'event_provider_disconnected_warning',
      target: 'events',
      properties: { scope: 'host', eventId: event.id, provider: event.provider },
    });
  }, [event]);

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  const applyEventUpdate = (updated: HostEvent) => {
    queryClient.setQueryData<HostEvent>(queryKeys.events.detail(eventId), updated);
    void queryClient.invalidateQueries({ queryKey: queryKeys.events.list() });
  };

  // ---------------------------------------------------------------------------
  // Mutations
  // ---------------------------------------------------------------------------

  const saveEventMutation = useMutation({
    mutationFn: () => updateEvent({ eventId, name: editName, description: editDescription }),
    onSuccess: (updated) => {
      applyEventUpdate(updated);
      showToast(t('eventsPage.updated', { name: updated.name }), { variant: 'success' });
    },
    onError: (error) => {
      showToast(t('eventsPage.error', { message: toApiError(error).message }), {
        variant: 'error',
      });
    },
  });

  const closeEventMutation = useMutation({
    mutationFn: () => closeEvent(eventId),
    onSuccess: (updated) => {
      applyEventUpdate(updated);
      showToast(t('eventsPage.closed', { name: updated.name }), { variant: 'success' });
      setIsCloseConfirmOpen(false);
    },
    onError: (error) => {
      showToast(t('eventsPage.error', { message: toApiError(error).message }), {
        variant: 'error',
      });
    },
  });

  const reopenEventMutation = useMutation({
    mutationFn: () => reopenEvent(eventId),
    onSuccess: (updated) => {
      applyEventUpdate(updated);
      showToast(t('eventsPage.reopened', { name: updated.name }), { variant: 'success' });
    },
    onError: (error) => {
      showToast(t('eventsPage.error', { message: toApiError(error).message }), {
        variant: 'error',
      });
    },
  });

  const revokeMagicLinkMutation = useMutation({
    mutationFn: () => revokeMagicLink(eventId),
    onSuccess: (updated) => {
      applyEventUpdate(updated);
      showToast(t('eventsPage.revoked', { name: updated.name }), { variant: 'success' });
    },
    onError: (error) => {
      showToast(t('eventsPage.error', { message: toApiError(error).message }), {
        variant: 'error',
      });
    },
  });

  const regenerateMagicLinkMutation = useMutation({
    mutationFn: () => regenerateMagicLink(eventId),
    onSuccess: (updated) => {
      applyEventUpdate(updated);
      showToast(t('eventsPage.regenerated', { name: updated.name }), { variant: 'success' });
    },
    onError: (error) => {
      showToast(t('eventsPage.error', { message: toApiError(error).message }), {
        variant: 'error',
      });
    },
  });

  const uploadImageMutation = useMutation({
    mutationFn: (imageDataUrl: string) => uploadEventImage({ eventId, imageDataUrl }),
    onSuccess: (updated) => {
      applyEventUpdate(updated);
      showToast(t('eventsPage.coverImageUpdated'), { variant: 'success' });
    },
    onError: (error) => {
      showToast(t('eventsPage.error', { message: toApiError(error).message }), {
        variant: 'error',
      });
    },
  });

  const deleteImageMutation = useMutation({
    mutationFn: () => deleteEventImage(eventId),
    onSuccess: (updated) => {
      applyEventUpdate(updated);
      showToast(t('eventsPage.coverImageRemoved'), { variant: 'success' });
    },
    onError: (error) => {
      showToast(t('eventsPage.error', { message: toApiError(error).message }), {
        variant: 'error',
      });
    },
  });

  const isWorking =
    saveEventMutation.isPending ||
    closeEventMutation.isPending ||
    reopenEventMutation.isPending ||
    revokeMagicLinkMutation.isPending ||
    regenerateMagicLinkMutation.isPending;

  const isUploadingImage = uploadImageMutation.isPending || deleteImageMutation.isPending;

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleSave = (submitEvent: FormEvent<HTMLFormElement>) => {
    submitEvent.preventDefault();
    if (!event) return;
    saveEventMutation.mutate();
  };

  // ---------------------------------------------------------------------------
  // Render — AppPageLayout for consistency with all other authenticated pages
  // ---------------------------------------------------------------------------

  return (
    <AppPageLayout>
      <div className="relative grid gap-6">
        <HostEventDetailsHeader
          event={event}
          isWorking={isWorking}
          onOpenCloseConfirm={() => setIsCloseConfirmOpen(true)}
          onReopen={() => reopenEventMutation.mutate()}
        />

        {event ? (
          <>
            {event.providerConnectionStatus === 'not_connected' ? (
              <article className="rounded-2xl border border-amber-400/45 bg-amber-400/10 p-5 shadow-soft-lift dark:bg-amber-300/10">
                <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div className="grid gap-1">
                    <h2 className="text-base font-bold text-amber-800 dark:text-amber-200">
                      {t('eventsPage.providerDisconnectedTitle')}
                    </h2>
                    <p className="text-sm text-amber-700 dark:text-amber-200/90">
                      {t('eventsPage.providerDisconnectedBody')}
                    </p>
                  </div>
                  <CTALink to="/profile/platforms" variant="secondary" className="justify-center">
                    {t('eventsPage.providerDisconnectedCta')}
                  </CTALink>
                </div>
              </article>
            ) : null}

            <EventEditFormCard
              editName={editName}
              editDescription={editDescription}
              coverImageUrl={event.coverImageUrl ?? null}
              isWorking={isWorking}
              isUploadingImage={isUploadingImage}
              onSubmit={handleSave}
              onNameChange={setEditName}
              onDescriptionChange={setEditDescription}
              onCancel={() => {
                setEditName(event.name);
                setEditDescription(event.description);
              }}
              onImageUpload={(dataUrl) => uploadImageMutation.mutate(dataUrl)}
              onImageDelete={() => deleteImageMutation.mutate()}
              onImageError={(message) => showToast(message, { variant: 'error' })}
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
                    onClick={() => closeEventMutation.mutate()}
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
              onRevoke={() => revokeMagicLinkMutation.mutate()}
              onRegenerate={() => regenerateMagicLinkMutation.mutate()}
            />

            <EventTracksCard
              tracks={tracks}
              isLoadingTracks={tracksQuery.isFetching}
              onRefreshTracks={() => void tracksQuery.refetch()}
            />
          </>
        ) : null}
      </div>
    </AppPageLayout>
  );
};

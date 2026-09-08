import { Highlight, SurfaceCard, useToast } from '@synqit/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import { ImagePlus, Link2, ListMusic, Pencil } from 'lucide-react';
import { FormEvent, useEffect, useRef, useState } from 'react';

import { AppPageLayout } from '../components/app/AppPageLayout';
import { EventEditFormCard } from '../components/events/EventEditFormCard';
import { EventMagicLinkCard } from '../components/events/EventMagicLinkCard';
import { EventStatusIndicator } from '../components/events/EventStatusIndicator';
import { EventTracksCard } from '../components/events/EventTracksCard';
import { HostEventDetailsHeader } from '../components/events/HostEventDetailsHeader';
import { ProviderIcon } from '../components/providers/ProviderIcon';
import { CTAButton, CTALink } from '../components/ui/cta';
import { Modal } from '../components/ui/Modal';
import { useI18n } from '../hooks/useI18n';
import { trackAnalyticsEvent } from '../lib/analytics';
import { toApiError } from '../lib/api';
import { HostEvent } from '../lib/events';
import {
  closeEvent,
  deleteEventImage,
  fetchEvent,
  fetchEventTracks,
  queryKeys,
  regenerateMagicLink,
  reopenEvent,
  revokeMagicLink,
  updateEvent,
  uploadEventImage,
} from '../lib/queries';

type ManageTab = 'edit' | 'share' | 'tracks';

export const HostEventDetailsPage = () => {
  const { t } = useI18n();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const params = useParams({ from: '/playlists/$eventId' });
  const { eventId } = params;

  const [isCloseConfirmOpen, setIsCloseConfirmOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const initialTab = ((): ManageTab => {
    if (typeof window === 'undefined') return 'edit';
    const hash = window.location.hash.replace('#', '');
    if (hash === 'tracks' || hash === 'share') return hash;
    return 'edit';
  })();
  const [activeTab, setActiveTab] = useState<ManageTab>(initialTab);
  const trackedDisconnectedWarningEventIdsRef = useRef<Set<string>>(new Set());

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------

  const eventQuery = useQuery({
    queryKey: queryKeys.events.detail(eventId),
    queryFn: () => fetchEvent(eventId),
    staleTime: 0,
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
    if (apiError.code === 'provider_playlist_missing') {
      void queryClient.invalidateQueries({ queryKey: queryKeys.events.detail(eventId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.events.list() });
    }
    showToast(t('eventsPage.error', { message: apiError.message }), { variant: 'error' });
    trackAnalyticsEvent({
      eventName: 'event_tracks_load_failed',
      target: 'events',
      properties: { scope: 'host', code: apiError.code, eventId },
    });
  }, [tracksQuery.isError, tracksQuery.error, showToast, t, eventId, queryClient]);

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
      trackAnalyticsEvent({
        eventName: 'event_closed',
        target: 'events',
        properties: { eventId },
      });
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
      trackAnalyticsEvent({
        eventName: 'event_reopened',
        target: 'events',
        properties: { eventId },
      });
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

  const tabIndex = activeTab === 'tracks' ? 1 : activeTab === 'share' ? 2 : 0;
  const showEditMetaCard = activeTab === 'edit';
  const isReopenDisabled = event?.closeReason === 'provider_playlist_missing';
  const eventActionButtonClassName =
    event?.status === 'closed' && isReopenDisabled
      ? 'w-full justify-center disabled:hover:border-app-border disabled:hover:bg-app-surface dark:disabled:hover:border-app-border dark:disabled:hover:bg-app-elevated'
      : 'w-full justify-center';

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const heroImageInput = (
    <input
      id="hero-image-input"
      type="file"
      accept="image/jpeg,image/png,image/webp"
      className="sr-only"
      onChange={(e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 8_000_000) {
          showToast(t('eventsPage.coverImageTooLarge', { maxMb: 8 }), { variant: 'error' });
          e.target.value = '';
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === 'string') uploadImageMutation.mutate(reader.result);
        };
        reader.readAsDataURL(file);
        e.target.value = '';
      }}
    />
  );

  return (
    <AppPageLayout className="overflow-hidden pt-20 sm:pt-4">
      <div className="relative grid gap-4">
        {/* Back button */}
        <HostEventDetailsHeader
          event={event}
          isWorking={isWorking}
          onOpenCloseConfirm={() => setIsCloseConfirmOpen(true)}
          onReopen={() => reopenEventMutation.mutate()}
        />

        {/* Hero — centered avatar, big title, tab bar */}
        <header className="flex flex-col items-center gap-4 text-center">
          <div className="relative">
            {event?.coverImageUrl ? (
              <img
                src={event.coverImageUrl}
                alt=""
                className="h-23 w-23 rounded-full border-[3px] border-app-text object-cover shadow-sticker sm:h-28 sm:w-28"
              />
            ) : (
              <button
                type="button"
                disabled={isUploadingImage}
                onClick={() => document.getElementById('hero-image-input')?.click()}
                aria-label={t('eventsPage.changeCoverImage')}
                className="group flex h-20 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-full border-[3px] border-dashed border-app-text bg-app-elevated transition duration-200 hover:bg-brand-lime/20 sm:h-28 sm:w-28 dark:bg-app-card disabled:opacity-50"
              >
                <ImagePlus
                  className="h-6 w-6 text-app-text-secondary transition duration-200 group-hover:text-brand-pink sm:h-7 sm:w-7"
                  aria-hidden="true"
                />
              </button>
            )}
            {event?.coverImageUrl ? (
              <button
                type="button"
                disabled={isUploadingImage}
                onClick={() => document.getElementById('hero-image-input')?.click()}
                aria-label={t('eventsPage.changeCoverImage')}
                className="group absolute -bottom-2 left-1/2 inline-flex -translate-x-1/2 cursor-pointer items-center justify-center rounded-full border-2 border-app-text bg-app-elevated p-1.5 shadow-sticker-sm transition duration-200 hover:bg-brand-lime motion-safe:hover:-translate-y-0.5 dark:bg-app-card disabled:opacity-50"
              >
                <Pencil
                  className="h-3.5 w-3.5 transition-transform duration-200 ease-out motion-safe:group-hover:-rotate-12 motion-safe:group-hover:scale-110"
                  aria-hidden="true"
                />
              </button>
            ) : null}
            {heroImageInput}
          </div>

          <div className="grid gap-1 pt-1">
            <h1 className="text-3xl font-black leading-[1.05] tracking-tight text-balance text-brand-dark dark:text-brand-white sm:text-5xl">
              {event ? <Highlight>{event.name}</Highlight> : t('eventsPage.loadingDetails')}
            </h1>
            {event?.description ? (
              <p className="text-sm text-app-text-secondary sm:text-base">{event.description}</p>
            ) : null}
          </div>

          {/* Tab bar */}
          {event ? (
            <div className="relative grid w-full max-w-md grid-cols-3 rounded-full border-2 border-app-text bg-app-elevated p-1 shadow-sticker dark:bg-app-card">
              <div
                aria-hidden="true"
                className="absolute inset-y-1 rounded-full border-2 border-app-text bg-brand-lime transition-[left] duration-200 ease-in-out"
                style={{
                  left: `calc(${tabIndex * 33.333}% + 0.25rem)`,
                  width: 'calc(33.333% - 0.5rem)',
                }}
              />
              <button
                type="button"
                onClick={() => setActiveTab('edit')}
                className={`group relative z-10 inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-full py-2.5 text-xs font-black uppercase tracking-[0.06em] leading-none transition-colors duration-200 focus-ring-brand ${
                  activeTab === 'edit'
                    ? 'text-brand-dark'
                    : 'text-app-text-secondary hover:text-app-text'
                }`}
              >
                <span
                  className={`inline-flex transition-transform duration-200 ease-out motion-safe:group-hover:-translate-y-0.5 motion-safe:group-hover:-rotate-12 ${
                    activeTab === 'edit' ? '-rotate-6 -translate-y-0.5' : ''
                  }`}
                >
                  <Pencil size={13} aria-hidden="true" />
                </span>
                {t('eventsPage.edit')}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('tracks')}
                className={`group relative z-10 inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-full py-2.5 text-xs font-black uppercase tracking-[0.06em] leading-none transition-colors duration-200 focus-ring-brand ${
                  activeTab === 'tracks'
                    ? 'text-brand-dark'
                    : 'text-app-text-secondary hover:text-app-text'
                }`}
              >
                <span
                  className={`inline-flex transition-transform duration-200 ease-out motion-safe:group-hover:-translate-y-0.5 motion-safe:group-hover:scale-110 ${
                    activeTab === 'tracks' ? '-translate-y-0.5 scale-105' : ''
                  }`}
                >
                  <ListMusic size={13} aria-hidden="true" />
                </span>
                {t('eventsPage.track')}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('share')}
                className={`group relative z-10 inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-full py-2.5 text-xs font-black uppercase tracking-[0.06em] leading-none transition-colors duration-200 focus-ring-brand ${
                  activeTab === 'share'
                    ? 'text-brand-dark'
                    : 'text-app-text-secondary hover:text-app-text'
                }`}
              >
                <span
                  className={`inline-flex transition-transform duration-200 ease-out motion-safe:group-hover:translate-x-0.5 motion-safe:group-hover:-translate-y-0.5 motion-safe:group-hover:rotate-12 ${
                    activeTab === 'share' ? 'translate-x-0.5 -translate-y-0.5 rotate-6' : ''
                  }`}
                >
                  <Link2 size={13} aria-hidden="true" />
                </span>
                {t('eventsPage.share')}
              </button>
            </div>
          ) : null}
        </header>

        {/* Two-col: left sidebar + right content */}
        {event ? (
          <div className={`grid gap-4 ${showEditMetaCard ? 'sm:grid-cols-[1fr_2fr]' : ''}`}>
            {/* Left col — status, streaming service, close CTA */}
            {showEditMetaCard ? (
              <SurfaceCard className="flex flex-col gap-4">
                {/* Streaming service */}
                <div className="grid gap-1.5">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-app-text-secondary">
                    {t('eventsPage.streamingServiceLabel')}
                  </p>
                  <div className="flex items-center gap-2.5 px-0.5 py-1">
                    <ProviderIcon
                      provider={event.provider}
                      sizeClassName="h-7 w-7 shrink-0"
                      className="dark:shadow-glow-pink"
                    />
                    <span className="text-base font-black text-brand-dark dark:text-brand-white">
                      {event.provider === 'apple' ? 'Apple Music' : 'Spotify'}
                    </span>
                  </div>
                  {event.closeReason === 'provider_playlist_missing' ? (
                    <p className="rounded-xl border-2 border-app-text bg-brand-pink/15 px-3 py-2 text-xs font-semibold text-app-text">
                      {t('eventsPage.providerPlaylistDeletedBody')}
                    </p>
                  ) : null}
                </div>

                {/* Status */}
                <div className="grid gap-1.5">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-app-text-secondary">
                    {t('eventsPage.statusLabel')}
                  </p>
                  <div className="flex items-center gap-2.5 px-0.5 py-1">
                    <EventStatusIndicator
                      status={event.status}
                      closeReason={event.closeReason}
                      connectionStatus={event.providerConnectionStatus}
                      mode="dot"
                      dotSize="md"
                    />
                    <span className="text-base font-black text-brand-dark dark:text-brand-white">
                      {event.status === 'open'
                        ? t('eventsPage.statusOpen')
                        : event.closeReason === 'provider_playlist_missing'
                          ? t('eventsPage.statusDeleted')
                          : t('eventsPage.statusClosed')}
                    </span>
                  </div>
                </div>

                {/* Close/reopen CTA */}
                <div className="mt-auto pt-2">
                  <CTAButton
                    disabled={isWorking || (event.status === 'closed' && isReopenDisabled)}
                    onClick={() =>
                      event.status === 'open'
                        ? setIsCloseConfirmOpen(true)
                        : reopenEventMutation.mutate()
                    }
                    type="button"
                    variant={event.status === 'open' ? 'dangerSoft' : 'secondary'}
                    className={eventActionButtonClassName}
                  >
                    {isWorking
                      ? t('eventsPage.working')
                      : event.status === 'open'
                        ? t('eventsPage.closeEvent')
                        : t('eventsPage.reopenEvent')}
                  </CTAButton>
                </div>
              </SurfaceCard>
            ) : null}

            {/* Right col — disconnected warning + tab panel */}
            <div className="flex flex-col gap-4">
              {event.providerConnectionStatus === 'not_connected' ? (
                <article className="relative rounded-3xl border-2 border-app-text bg-[#ffc400]/25 p-5 shadow-sticker">
                  <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
                    <div className="grid gap-1">
                      <h2 className="text-base font-black text-brand-dark dark:text-brand-white">
                        {t('eventsPage.providerDisconnectedTitle')}
                      </h2>
                      <p className="text-sm text-app-text-secondary">
                        {t('eventsPage.providerDisconnectedBody')}
                      </p>
                    </div>
                    <CTALink to="/profile/platforms" variant="secondary" className="justify-center">
                      {t('eventsPage.providerDisconnectedCta')}
                    </CTALink>
                  </div>
                </article>
              ) : null}

              {activeTab === 'edit' ? (
                <EventEditFormCard
                  editName={editName}
                  editDescription={editDescription}
                  coverImageUrl={event.coverImageUrl ?? null}
                  isWorking={isWorking}
                  isUploadingImage={isUploadingImage}
                  provider={event.provider}
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
              ) : activeTab === 'share' ? (
                <EventMagicLinkCard
                  event={event}
                  isWorking={isWorking}
                  onRevoke={() => revokeMagicLinkMutation.mutate()}
                  onRegenerate={() => regenerateMagicLinkMutation.mutate()}
                />
              ) : (
                <div className="mx-auto w-full max-w-2xl">
                  <EventTracksCard
                    tracks={tracks}
                    isLoadingTracks={tracksQuery.isFetching}
                    onRefreshTracks={() => void tracksQuery.refetch()}
                  />
                </div>
              )}
            </div>
          </div>
        ) : null}

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
                disabled={isWorking || event?.status !== 'open'}
                onClick={() => closeEventMutation.mutate()}
              >
                {isWorking ? t('eventsPage.working') : t('eventsPage.closeEventConfirmCta')}
              </CTAButton>
            </div>
          </div>
        </Modal>
      </div>
    </AppPageLayout>
  );
};

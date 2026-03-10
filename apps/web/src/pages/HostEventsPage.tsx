import {
  deleteEventDraftResponseSchema,
  eventDraftListResponseSchema,
  eventListResponseSchema,
} from '@synqit/shared';
import { RefreshCcw, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { HostEventCard } from '../components/events/HostEventCard';
import { HostEventDraftCard } from '../components/events/HostEventDraftCard';
import { CTAButton, CTALink, CTAMobileIconLabel } from '../components/ui/cta';
import { Modal } from '../components/ui/Modal';
import { useI18n } from '../hooks/useI18n';
import { useToast } from '../hooks/useToast';
import { callApi, toApiError } from '../lib/api';
import { getAccessToken } from '../lib/auth';
import { getPublicEventUrl, HostEvent, HostEventDraft } from '../lib/events';

export const HostEventsPage = () => {
  const { t } = useI18n();
  const { showToast } = useToast();
  const [events, setEvents] = useState<HostEvent[]>([]);
  const [drafts, setDrafts] = useState<HostEventDraft[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeDraftDeleteId, setActiveDraftDeleteId] = useState<string | null>(null);
  const [draftToDelete, setDraftToDelete] = useState<HostEventDraft | null>(null);

  const listItems = useMemo(() => {
    const eventItems = events.map((event) => ({
      kind: 'event' as const,
      id: `event:${event.id}`,
      updatedAt: event.updatedAt,
      event,
    }));
    const draftItems = drafts.map((draft) => ({
      kind: 'draft' as const,
      id: `draft:${draft.id}`,
      updatedAt: draft.updatedAt,
      draft,
    }));

    return [...eventItems, ...draftItems].sort((left, right) => {
      return Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
    });
  }, [drafts, events]);

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

  const loadEvents = useCallback(async () => {
    const accessToken = requireAccessToken(t('eventsPage.loginRequiredLoad'));
    if (!accessToken) {
      return;
    }

    setIsLoading(true);
    try {
      const [eventResult, draftResult] = await Promise.all([
        callApi(
          '/v1/playlists',
          {
            method: 'GET',
            headers: {
              authorization: `Bearer ${accessToken}`,
            },
          },
          (payload) => eventListResponseSchema.parse(payload),
        ),
        callApi(
          '/v1/playlists/drafts',
          {
            method: 'GET',
            headers: {
              authorization: `Bearer ${accessToken}`,
            },
          },
          (payload) => eventDraftListResponseSchema.parse(payload),
        ),
      ]);

      setEvents(
        eventResult.events.map((event) => ({
          id: event.id,
          name: event.name,
          description: event.description,
          provider: event.provider,
          providerConnectionStatus: event.providerConnectionStatus,
          status: event.status,
          magicLinkToken: event.magicLinkToken,
          magicLinkRevokedAt: event.magicLinkRevokedAt,
          updatedAt: event.updatedAt,
        })),
      );
      setDrafts(
        draftResult.drafts.map((draft) => ({
          id: draft.id,
          provider: draft.provider,
          name: draft.name,
          description: draft.description,
          step: draft.step as 1 | 2 | 3 | 4,
          updatedAt: draft.updatedAt,
        })),
      );
    } catch (error) {
      const apiError = toApiError(error);
      setStatusAndToast(t('eventsPage.error', { message: apiError.message }), 'error');
    } finally {
      setIsLoading(false);
    }
  }, [requireAccessToken, setStatusAndToast, t]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  const copyMagicLink = async (magicLinkToken: string) => {
    const eventUrl = getPublicEventUrl(magicLinkToken);

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

  const deleteDraft = useCallback(
    async (draft: HostEventDraft): Promise<boolean> => {
      const accessToken = requireAccessToken(t('eventsPage.loginRequiredUpdate'));
      if (!accessToken) {
        return false;
      }

      const draftName = draft.name.trim().length > 0 ? draft.name : t('eventsPage.draftUntitled');

      setActiveDraftDeleteId(draft.id);
      try {
        await callApi(
          `/v1/playlists/drafts/${encodeURIComponent(draft.id)}`,
          {
            method: 'DELETE',
            headers: {
              authorization: `Bearer ${accessToken}`,
            },
          },
          (payload) => deleteEventDraftResponseSchema.parse(payload),
        );

        setDrafts((currentDrafts) =>
          currentDrafts.filter((currentDraft) => currentDraft.id !== draft.id),
        );
        setStatusAndToast(t('eventsPage.draftDeleted', { name: draftName }), 'success');
        return true;
      } catch (error) {
        const apiError = toApiError(error);
        setStatusAndToast(t('eventsPage.error', { message: apiError.message }), 'error');
        return false;
      } finally {
        setActiveDraftDeleteId(null);
      }
    },
    [requireAccessToken, setStatusAndToast, t],
  );

  return (
    <section className="relative mx-auto w-full max-w-6xl px-4 pb-16 pt-28 sm:px-6 sm:pt-32 lg:px-8">
      <div className="relative grid gap-6">
        <article>
          <div className="grid px-5 py-7 sm:px-8 sm:py-9">
            <div className="grid gap-1">
              <div className="flex items-start justify-between gap-3">
                <h1 className="text-2xl font-black tracking-tight text-brand-dark dark:text-brand-white sm:text-5xl">
                  {t('eventsPage.title')}
                </h1>
                <CTAButton
                  aria-label={t('eventsPage.refresh')}
                  disabled={isLoading}
                  onClick={() => void loadEvents()}
                  variant="secondary"
                  className="h-10 w-10 px-0 sm:h-auto sm:w-auto sm:px-3"
                >
                  <CTAMobileIconLabel
                    icon={
                      <RefreshCcw
                        size={14}
                        aria-hidden="true"
                        className={isLoading ? 'animate-spin' : ''}
                      />
                    }
                    label={isLoading ? t('eventsPage.loading') : t('eventsPage.refresh')}
                  />
                </CTAButton>
              </div>
              <p className="text-sm text-app-text-secondary sm:text-base">
                {t('eventsPage.description')}
              </p>
            </div>
          </div>
          <div className="py-4 justify-center flex">
            <CTALink
              to="/playlists/new"
              variant="primary"
              className="w-[90%] justify-center px-4 py-3 text-sm font-black sm:text-base"
            >
              {t('eventsPage.create')}
            </CTALink>
          </div>
        </article>

        {listItems.length === 0 ? (
          <article className="rounded-2xl border border-app-border bg-app-elevated p-6 text-center shadow-soft-lift dark:bg-app-card">
            <p className="text-base font-semibold text-brand-dark dark:text-brand-white">
              {t('eventsPage.emptyTitle')}
            </p>
            <p className="mt-2 text-sm text-app-text-secondary">{t('eventsPage.emptyBody')}</p>
            <div className="mt-4 flex justify-center">
              <CTALink to="/playlists/new" variant="primary">
                {t('eventsPage.create')}
              </CTALink>
            </div>
          </article>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {listItems.map((item) =>
              item.kind === 'event' ? (
                <HostEventCard
                  key={item.id}
                  event={item.event}
                  onCopyMagicLink={(magicLinkToken) => void copyMagicLink(magicLinkToken)}
                />
              ) : (
                <HostEventDraftCard
                  key={item.id}
                  draft={item.draft}
                  onDelete={(draft) => setDraftToDelete(draft)}
                  isDeleting={activeDraftDeleteId === item.draft.id}
                />
              ),
            )}
          </div>
        )}

        <Modal
          open={draftToDelete !== null}
          title={t('eventsPage.deleteDraft')}
          onClose={() => setDraftToDelete(null)}
        >
          <div className="grid gap-4">
            <p className="text-sm text-app-text-secondary">
              {t('eventsPage.deleteDraftConfirm', {
                name:
                  draftToDelete && draftToDelete.name.trim().length > 0
                    ? draftToDelete.name
                    : t('eventsPage.draftUntitled'),
              })}
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <CTAButton
                type="button"
                variant="secondary"
                disabled={activeDraftDeleteId !== null}
                onClick={() => setDraftToDelete(null)}
              >
                {t('eventsPage.cancel')}
              </CTAButton>
              <CTAButton
                type="button"
                variant="danger"
                disabled={!draftToDelete || activeDraftDeleteId !== null}
                aria-label={t('eventsPage.deleteDraft')}
                onClick={() => {
                  if (!draftToDelete) {
                    return;
                  }
                  void (async () => {
                    const didDelete = await deleteDraft(draftToDelete);
                    if (didDelete) {
                      setDraftToDelete(null);
                    }
                  })();
                }}
              >
                {activeDraftDeleteId !== null ? (
                  t('eventsPage.working')
                ) : (
                  <CTAMobileIconLabel
                    icon={<Trash2 size={14} />}
                    label={t('eventsPage.deleteDraft')}
                  />
                )}
              </CTAButton>
            </div>
          </div>
        </Modal>
      </div>
    </section>
  );
};

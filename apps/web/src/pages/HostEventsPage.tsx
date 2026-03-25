import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ListMusic, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';

import { AppPageHeader } from '../components/app/AppPageHeader';
import { AppPageLayout } from '../components/app/AppPageLayout';
import { HostEventCard } from '../components/events/HostEventCard';
import { HostEventDraftCard } from '../components/events/HostEventDraftCard';
import { BlurSpotLayer } from '../components/shell/BackgroundBlurSpots';
import { CTAButton, CTALink, CTAMobileIconLabel } from '../components/ui/cta';
import { Modal } from '../components/ui/Modal';
import { useI18n } from '../hooks/useI18n';
import { useToast } from '../hooks/useToast';
import { toApiError } from '../lib/api';
import { HostEventDraft } from '../lib/events';
import { deleteDraft, fetchDrafts, fetchEvents, queryKeys } from '../lib/queries';

export const HostEventsPage = () => {
  const { t } = useI18n();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [draftToDelete, setDraftToDelete] = useState<HostEventDraft | null>(null);

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------

  const eventsQuery = useQuery({
    queryKey: queryKeys.events.list(),
    queryFn: fetchEvents,
  });

  const draftsQuery = useQuery({
    queryKey: queryKeys.drafts.list(),
    queryFn: fetchDrafts,
  });

  const events = useMemo(() => eventsQuery.data ?? [], [eventsQuery.data]);
  const drafts = useMemo(() => draftsQuery.data ?? [], [draftsQuery.data]);

  // ---------------------------------------------------------------------------
  // Mutations
  // ---------------------------------------------------------------------------

  const deleteDraftMutation = useMutation({
    mutationFn: (draft: HostEventDraft) => deleteDraft(draft.id),
    onSuccess: (_data, draft) => {
      queryClient.setQueryData<HostEventDraft[]>(queryKeys.drafts.list(), (current) =>
        (current ?? []).filter((d) => d.id !== draft.id),
      );
      void queryClient.invalidateQueries({ queryKey: queryKeys.drafts.all() });

      const draftName = draft.name.trim().length > 0 ? draft.name : t('eventsPage.draftUntitled');
      showToast(t('eventsPage.draftDeleted', { name: draftName }), { variant: 'success' });
      setDraftToDelete(null);
    },
    onError: (error) => {
      const apiError = toApiError(error);
      showToast(t('eventsPage.error', { message: apiError.message }), { variant: 'error' });
    },
  });

  // ---------------------------------------------------------------------------
  // Derived
  // ---------------------------------------------------------------------------

  const activeItems = useMemo(() => {
    const eventItems = events
      .filter((e) => e.status === 'open')
      .map((event) => ({
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
    return [...eventItems, ...draftItems].sort(
      (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
    );
  }, [drafts, events]);

  const closedItems = useMemo(
    () =>
      events
        .filter((e) => e.status === 'closed')
        .map((event) => ({
          kind: 'event' as const,
          id: `event:${event.id}`,
          updatedAt: event.updatedAt,
          event,
        }))
        .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)),
    [events],
  );

  const hasAny = activeItems.length > 0 || closedItems.length > 0;
  const activeDraft = drafts[0] ?? null;

  const isDeleting = deleteDraftMutation.isPending;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <AppPageLayout
      bodyClassName="gap-8"
      backdrop={
        <BlurSpotLayer
          filterId="events-blur"
          className="pointer-events-none absolute inset-0 z-0"
          spots={[
            { id: 'events-a', size: 180, top: 15, left: 10, color: 'rgba(198,241,53,0.07)' },
            { id: 'events-b', size: 200, top: 60, left: 85, color: 'rgba(232,87,154,0.06)' },
          ]}
        />
      }
    >
      {hasAny ? (
        <AppPageHeader
          eyebrow={t('eventsPage.title')}
          title={t('eventsPage.myPlaylistsTitle')}
          description={t('eventsPage.description')}
          actions={
            <CTALink
              to={activeDraft ? `/playlists/new?draftId=${activeDraft.id}` : '/playlists/new'}
              variant="primary"
              className="w-full justify-center gap-2 px-4 py-2.5 text-sm font-black sm:w-auto"
            >
              <Plus size={14} aria-hidden="true" />
              {activeDraft ? t('dashboard.ctaResumeDraft') : t('eventsPage.create')}
            </CTALink>
          }
        />
      ) : null}

      {/* ── List / Empty ── */}
      {!hasAny ? (
        <div className="flex min-h-[calc(100svh-24rem)] items-start justify-center pt-8 sm:pt-16">
          <div className="relative w-85 p-6 sm:w-[35vw] sm:p-10">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute left-0 top-0 h-7 w-7 rounded-tl-lg border-l border-t border-brand-dark dark:border-brand-white"
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute right-0 top-0 h-7 w-7 rounded-tr-lg border-r border-t border-brand-dark dark:border-brand-white"
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute bottom-0 left-0 h-7 w-7 rounded-bl-lg border-b border-l border-brand-dark dark:border-brand-white"
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute bottom-0 right-0 h-7 w-7 rounded-br-lg border-b border-r border-brand-dark dark:border-brand-white"
            />
            <div className="flex flex-col items-center gap-6 text-center">
              <ListMusic size={36} className="text-app-text-secondary/40" aria-hidden="true" />
              <div className="flex flex-col items-center gap-2">
                <p className="text-2xl font-black tracking-tight text-brand-dark dark:text-brand-white sm:text-3xl">
                  {t('eventsPage.emptyTitle')}
                </p>
                <p className="text-sm text-app-text-secondary sm:text-base">
                  {t('eventsPage.emptyBody')}
                </p>
              </div>
              <CTALink
                to={activeDraft ? `/playlists/new?draftId=${activeDraft.id}` : '/playlists/new'}
                variant="primary"
                size="lg"
              >
                {activeDraft ? t('dashboard.ctaResumeDraft') : t('eventsPage.create')}
              </CTALink>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid gap-10">
          {activeItems.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2">
              {activeItems.map((item) =>
                item.kind === 'event' ? (
                  <HostEventCard key={item.id} event={item.event} />
                ) : (
                  <HostEventDraftCard
                    key={item.id}
                    draft={item.draft}
                    onDelete={(draft) => setDraftToDelete(draft)}
                    isDeleting={
                      deleteDraftMutation.isPending && draftToDelete?.id === item.draft.id
                    }
                  />
                ),
              )}
            </div>
          )}

          {closedItems.length > 0 && (
            <section className="grid gap-4">
              <p className="pl-1 text-xs font-semibold uppercase tracking-widest text-app-text-secondary">
                {t('eventsPage.closedSectionTitle')}
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                {closedItems.map((item) => (
                  <HostEventCard key={item.id} event={item.event} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* ── Delete draft modal ── */}
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
              disabled={isDeleting}
              onClick={() => setDraftToDelete(null)}
            >
              {t('eventsPage.cancel')}
            </CTAButton>
            <CTAButton
              type="button"
              variant="danger"
              disabled={!draftToDelete || isDeleting}
              aria-label={t('eventsPage.deleteDraft')}
              onClick={() => {
                if (!draftToDelete) return;
                deleteDraftMutation.mutate(draftToDelete);
              }}
            >
              {isDeleting ? (
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
    </AppPageLayout>
  );
};

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';

import { AppPageHeader } from '../components/app/AppPageHeader';
import { AppPageLayout } from '../components/app/AppPageLayout';
import { AppSurfaceCard } from '../components/app/AppSurfaceCard';
import { HostEventCard } from '../components/events/HostEventCard';
import { HostEventDraftCard } from '../components/events/HostEventDraftCard';
import { CTAButton, CTALink, CTAMobileIconLabel } from '../components/ui/cta';
import { Modal } from '../components/ui/Modal';
import { useI18n } from '../hooks/useI18n';
import { useToast } from '../hooks/useToast';
import { toApiError } from '../lib/api';
import { getPublicEventUrl, HostEventDraft } from '../lib/events';
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

  const events = eventsQuery.data ?? [];
  const drafts = draftsQuery.data ?? [];

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
    return [...eventItems, ...draftItems].sort(
      (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
    );
  }, [drafts, events]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const copyMagicLink = async (magicLinkToken: string) => {
    const eventUrl = getPublicEventUrl(magicLinkToken);
    if (typeof navigator === 'undefined' || !navigator.clipboard) {
      showToast(t('eventsPage.copyFailed'), { variant: 'error' });
      return;
    }
    try {
      await navigator.clipboard.writeText(eventUrl);
      showToast(t('eventsPage.copySuccess'), { variant: 'success' });
    } catch {
      showToast(t('eventsPage.copyFailed'), { variant: 'error' });
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const isDeleting = deleteDraftMutation.isPending;

  return (
    <AppPageLayout>
      <AppPageHeader title={t('eventsPage.title')} description={t('eventsPage.description')}>
        <div className="flex justify-center py-4">
          <CTALink
            to="/playlists/new"
            variant="primary"
            className="w-[90%] justify-center px-4 py-3 text-sm font-black sm:text-base"
          >
            {t('eventsPage.create')}
          </CTALink>
        </div>
      </AppPageHeader>

      {listItems.length === 0 ? (
        <div className="flex min-h-[calc(100svh-24rem)] items-center justify-center">
          <AppSurfaceCard className="w-full p-6 text-center">
            <p className="text-base font-semibold text-brand-dark dark:text-brand-white">
              {t('eventsPage.emptyTitle')}
            </p>
            <p className="mt-2 text-sm text-app-text-secondary">{t('eventsPage.emptyBody')}</p>
            <div className="mt-4 flex justify-center">
              <CTALink to="/playlists/new" variant="primary">
                {t('eventsPage.create')}
              </CTALink>
            </div>
          </AppSurfaceCard>
        </div>
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
                isDeleting={deleteDraftMutation.isPending && draftToDelete?.id === item.draft.id}
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

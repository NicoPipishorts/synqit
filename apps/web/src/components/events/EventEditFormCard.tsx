import { SurfaceCard } from '@synqit/ui';
import { FormEvent } from 'react';

import { useI18n } from '../../hooks/useI18n';
import { EventProvider } from '../../lib/events';
import { CTAButton } from '../ui/cta';

type EventEditFormCardProps = {
  editName: string;
  editDescription: string;
  coverImageUrl: string | null;
  isWorking: boolean;
  isUploadingImage: boolean;
  provider: EventProvider;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onCancel: () => void;
  onImageUpload: (dataUrl: string) => void;
  onImageDelete: () => void;
  onImageError: (message: string) => void;
};

export const EventEditFormCard = ({
  editName,
  editDescription,
  isWorking,
  provider,
  onSubmit,
  onNameChange,
  onDescriptionChange,
  onCancel,
}: EventEditFormCardProps) => {
  const { t } = useI18n();

  if (provider === 'apple') {
    return (
      <SurfaceCard className="flex h-full flex-col gap-3">
        <p className="text-sm font-bold text-brand-dark dark:text-brand-white">
          {t('eventsPage.appleEditDisabledTitle')}
        </p>
        <p className="text-sm text-app-text-secondary">{t('eventsPage.appleEditDisabledBody')}</p>
      </SurfaceCard>
    );
  }

  return (
    <SurfaceCard>
      <form onSubmit={onSubmit} className="grid gap-4">
        <label className="grid gap-1 text-sm">
          <span>{t('eventsPage.eventName')}</span>
          <input
            required
            maxLength={100}
            value={editName}
            onChange={(nextEvent) => onNameChange(nextEvent.target.value)}
            className="rounded-xl border border-app-border bg-app-bg px-3 py-2 text-app-text outline-none transition focus:border-brand-lime dark:bg-app-elevated"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span>{t('eventsPage.eventDescription')}</span>
          <textarea
            maxLength={500}
            value={editDescription}
            onChange={(nextEvent) => onDescriptionChange(nextEvent.target.value)}
            className="min-h-24 rounded-xl border border-app-border bg-app-bg px-3 py-2 text-app-text outline-none transition focus:border-brand-lime dark:bg-app-elevated"
          />
        </label>
        <div className="flex flex-wrap justify-end gap-2">
          <CTAButton disabled={isWorking} type="submit" variant="primary">
            {isWorking ? t('eventsPage.saving') : t('eventsPage.save')}
          </CTAButton>
          <CTAButton disabled={isWorking} onClick={onCancel} type="button" variant="secondary">
            {t('eventsPage.cancel')}
          </CTAButton>
        </div>
      </form>
    </SurfaceCard>
  );
};

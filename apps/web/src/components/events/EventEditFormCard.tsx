import { ImagePlus, Trash2 } from 'lucide-react';
import { ChangeEvent, FormEvent, useRef } from 'react';

import { useI18n } from '../../hooks/useI18n';
import { AppSurfaceCard } from '../app/AppSurfaceCard';
import { CTAButton } from '../ui/cta';

const IMAGE_MAX_BYTES = 8_000_000;
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];

type EventEditFormCardProps = {
  editName: string;
  editDescription: string;
  coverImageUrl: string | null;
  isWorking: boolean;
  isUploadingImage: boolean;
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
  coverImageUrl,
  isWorking,
  isUploadingImage,
  onSubmit,
  onNameChange,
  onDescriptionChange,
  onCancel,
  onImageUpload,
  onImageDelete,
  onImageError,
}: EventEditFormCardProps) => {
  const { t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_MIME.includes(file.type)) return;
    if (file.size > IMAGE_MAX_BYTES) {
      onImageError(t('eventsPage.coverImageTooLarge', { maxMb: IMAGE_MAX_BYTES / 1_000_000 }));
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onImageUpload(reader.result);
      }
    };
    reader.readAsDataURL(file);
    // reset so the same file can be re-selected
    e.target.value = '';
  };

  const imageActions = (
    <div className="absolute inset-0 flex items-center justify-center gap-2 opacity-0 transition-opacity hover:opacity-100">
      <button
        type="button"
        disabled={isWorking || isUploadingImage}
        onClick={() => fileInputRef.current?.click()}
        className="rounded-lg bg-black/60 p-1.5 text-white backdrop-blur-sm transition hover:bg-black/80 disabled:opacity-50"
        aria-label={t('eventsPage.changeCoverImage')}
      >
        <ImagePlus size={14} aria-hidden="true" />
      </button>
      <button
        type="button"
        disabled={isWorking || isUploadingImage}
        onClick={onImageDelete}
        className="rounded-lg bg-black/60 p-1.5 text-brand-pink backdrop-blur-sm transition hover:bg-black/80 disabled:opacity-50"
        aria-label={t('eventsPage.deleteCoverImage')}
      >
        <Trash2 size={14} aria-hidden="true" />
      </button>
    </div>
  );

  return (
    <AppSurfaceCard>
      <form onSubmit={onSubmit} className="grid gap-4">
        {/* Cover image */}
        <div className="grid gap-1.5 text-sm">
          <span className="font-medium">{t('eventsPage.coverImage')}</span>
          {coverImageUrl ? (
            <div className="relative h-24 w-24 overflow-hidden rounded-xl">
              <img src={coverImageUrl} alt="" className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-linear-to-t from-black/40 to-transparent" />
              {imageActions}
            </div>
          ) : (
            <button
              type="button"
              disabled={isWorking || isUploadingImage}
              onClick={() => fileInputRef.current?.click()}
              className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-app-border bg-app-bg text-app-text-secondary transition hover:border-brand-lime hover:text-app-text disabled:cursor-not-allowed disabled:opacity-50 dark:bg-app-elevated"
            >
              <ImagePlus size={20} aria-hidden="true" />
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={handleFileChange}
          />
        </div>

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
    </AppSurfaceCard>
  );
};

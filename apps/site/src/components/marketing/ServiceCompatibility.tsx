import {
  CONNECT_SERVICES,
  LINK_SERVICES,
  type MusicService,
  ServiceLogo,
  Sticker,
  type StickerTone,
  TapeStrip,
  type TapeTone,
} from '@synqit/ui';
import { Check, KeyRound, Link2 } from 'lucide-react';
import { type ComponentType } from 'react';

import { useI18n } from '../../lib/i18n';

type AccessCardProps = {
  icon: ComponentType<{ size?: number; className?: string; 'aria-hidden'?: boolean }>;
  sticker: string;
  stickerTone: StickerTone;
  tapeTone: TapeTone;
  iconClassName: string;
  title: string;
  body: string;
  services: readonly MusicService[];
  points: readonly string[];
};

const AccessCard = ({
  icon: Icon,
  sticker,
  stickerTone,
  tapeTone,
  iconClassName,
  title,
  body,
  services,
  points,
}: AccessCardProps) => (
  <article className="relative flex h-full flex-col gap-5 rounded-3xl border-2 border-app-text bg-app-elevated p-6 shadow-sticker dark:bg-app-card sm:p-7">
    <TapeStrip tone={tapeTone} />

    <div className="flex items-center gap-3">
      <span
        className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border-2 border-app-text ${iconClassName}`}
      >
        <Icon size={20} aria-hidden />
      </span>
      <Sticker tone={stickerTone} tilt="-rotate-1">
        {sticker}
      </Sticker>
    </div>

    <div className="flex flex-wrap items-center gap-3">
      {services.map((service) => (
        <span key={service.id} className="flex items-center gap-2">
          <ServiceLogo service={service.id} alt="" className="h-10 w-10" />
          <span className="text-sm font-black text-app-text">{service.name}</span>
        </span>
      ))}
    </div>

    <div className="grid gap-2">
      <h3 className="text-xl font-black tracking-tight text-brand-dark dark:text-brand-white sm:text-2xl">
        {title}
      </h3>
      <p className="text-sm leading-relaxed text-app-text-secondary sm:text-base">{body}</p>
    </div>

    <ul className="mt-auto grid gap-2">
      {points.map((point) => (
        <li key={point} className="flex items-start gap-2 text-sm text-app-text">
          <Check size={16} className="mt-0.5 shrink-0 text-brand-pink" aria-hidden />
          <span>{point}</span>
        </li>
      ))}
    </ul>
  </article>
);

/**
 * Answers "does this work with my music service?" — and, just as importantly,
 * what each answer means: an account you connect versus a link you paste.
 */
export const ServiceCompatibility = () => {
  const { t } = useI18n();

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <AccessCard
        icon={KeyRound}
        sticker={t('home.compat.connect.sticker')}
        stickerTone="lime"
        tapeTone="lime"
        iconClassName="bg-brand-lime text-brand-dark"
        title={t('home.compat.connect.title')}
        body={t('home.compat.connect.body')}
        services={CONNECT_SERVICES}
        points={[
          t('home.compat.connect.point1'),
          t('home.compat.connect.point2'),
          t('home.compat.connect.point3'),
        ]}
      />

      <AccessCard
        icon={Link2}
        sticker={t('home.compat.link.sticker')}
        stickerTone="pink"
        tapeTone="pink"
        iconClassName="bg-brand-pink text-brand-white"
        title={t('home.compat.link.title')}
        body={t('home.compat.link.body')}
        services={LINK_SERVICES}
        points={[
          t('home.compat.link.point1'),
          t('home.compat.link.point2'),
          t('home.compat.link.point3'),
        ]}
      />
    </div>
  );
};

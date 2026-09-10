import { Sticker } from '@synqit/ui';

import { LegalDocumentBody } from './components/marketing/LegalDocumentBody';
import { MarketingPageShell } from './components/marketing/MarketingPageShell';
import { HeroLink } from './components/ui/HeroLink';
import { LEGAL_DOCUMENTS, LEGAL_ROUTES, type LegalSlug } from './content/legal';
import { useI18n } from './lib/i18n';

const LOCALE_TAGS: Record<string, string> = { en: 'en-GB', fr: 'fr-FR', es: 'es-ES' };

const formatUpdated = (iso: string, locale: string): string => {
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return new Intl.DateTimeFormat(LOCALE_TAGS[locale] ?? locale, {
    dateStyle: 'long',
    timeZone: 'UTC',
  }).format(date);
};

export const LegalPage = ({ slug }: { slug: LegalSlug }) => {
  const { t, locale } = useI18n();
  const document = LEGAL_DOCUMENTS[slug][locale];
  const otherSlugs = (Object.keys(LEGAL_DOCUMENTS) as LegalSlug[]).filter((key) => key !== slug);

  return (
    <MarketingPageShell contentClassName="relative z-10 mx-auto w-full max-w-3xl px-5 pb-28 pt-28 sm:px-6 sm:pt-40 lg:px-8">
      <header className="mb-12 flex flex-col items-start gap-4 sm:mb-16">
        <Sticker tone="paper" tilt="-rotate-2">
          {formatUpdated(document.updated, locale)}
        </Sticker>
        <h1 className="text-4xl font-black leading-[1.02] tracking-tight text-brand-dark dark:text-brand-white sm:text-5xl">
          {document.title}
        </h1>
        <p className="max-w-xl text-base leading-relaxed text-app-text-secondary sm:text-lg">
          {document.subtitle}
        </p>
      </header>

      <nav
        aria-label={document.tocLabel}
        className="mb-14 rounded-3xl border-2 border-app-text bg-app-elevated p-5 shadow-sticker dark:bg-app-card sm:mb-20 sm:p-6"
      >
        <p className="text-xs font-black uppercase tracking-wide text-app-text-muted">
          {document.tocLabel}
        </p>
        {/* Columns rather than a grid, so the numbering runs down each column
            instead of across the rows. */}
        <ol className="mt-3 sm:columns-2 sm:gap-x-6">
          {document.sections.map((section, index) => (
            <li key={section.id} className="flex break-inside-avoid gap-2 py-1 text-sm">
              <span aria-hidden="true" className="font-black text-brand-pink">
                {String(index + 1).padStart(2, '0')}
              </span>
              <a
                href={`#${section.id}`}
                className="focus-ring-brand rounded font-bold text-app-text underline decoration-brand-lime decoration-2 underline-offset-4 transition hover:text-brand-pink"
              >
                {section.heading}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <LegalDocumentBody sections={document.sections} />

      <aside className="mt-16 border-t-2 border-app-text pt-8 sm:mt-24">
        <p className="text-xs font-black uppercase tracking-wide text-app-text-muted">
          {t('legal.otherPages')}
        </p>
        <ul className="mt-4 flex flex-wrap gap-3">
          {otherSlugs.map((other) => (
            <li key={other}>
              <a
                href={LEGAL_ROUTES[other]}
                className="focus-ring-brand inline-flex rounded-full border-2 border-app-text bg-app-elevated px-4 py-2 text-sm font-bold text-app-text shadow-sticker-sm transition hover:bg-brand-lime hover:text-brand-dark motion-safe:hover:-translate-y-0.5 dark:bg-app-card"
              >
                {LEGAL_DOCUMENTS[other][locale].title}
              </a>
            </li>
          ))}
        </ul>
        <div className="mt-10">
          <HeroLink href="/" variant="outline" size="sm">
            ← {t('home.pricing.backHome')}
          </HeroLink>
        </div>
      </aside>
    </MarketingPageShell>
  );
};

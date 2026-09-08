import { CONNECT_SERVICES, LINK_SERVICES, type MusicServiceId, ServiceLogo } from '@synqit/ui';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown, Minus } from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';

import { useI18n } from '../../lib/i18n';

// Columns of the capability matrix, in the order a reader asks about them.
const CAPABILITIES = ['connect', 'events', 'sync', 'transferIn', 'importFrom'] as const;
type Capability = (typeof CAPABILITIES)[number];

// What each service can actually do today. Link services are import sources only.
const MATRIX: Record<MusicServiceId, Record<Capability, boolean>> = {
  spotify: { connect: true, events: true, sync: true, transferIn: true, importFrom: true },
  apple: { connect: true, events: true, sync: true, transferIn: true, importFrom: true },
  // Connect, sync and transfer work; guest event hosting is still Spotify and
  // Apple Music only, so this row is deliberately not all-yes.
  tidal: { connect: true, events: false, sync: true, transferIn: true, importFrom: true },
  deezer: { connect: false, events: false, sync: false, transferIn: false, importFrom: true },
  youtube: { connect: false, events: false, sync: false, transferIn: false, importFrom: true },
};

const ALL_SERVICES = [...CONNECT_SERVICES, ...LINK_SERVICES];

/** Entry ids double as URL fragments, so other pages can link to one answer. */
export const FAQ_ENTRY_IDS = [
  'matrix',
  'connect',
  'link',
  'guests',
  'syncDirection',
  'skipped',
  'linkPrivacy',
  'leaving',
] as const;
export type FaqEntryId = (typeof FAQ_ENTRY_IDS)[number];

const Supported = ({ supported, label }: { supported: boolean; label: string }) => (
  <>
    {supported ? (
      <Check size={16} className="text-brand-pink" aria-hidden />
    ) : (
      <Minus size={16} className="text-app-text-muted" aria-hidden />
    )}
    <span className="sr-only">{label}</span>
  </>
);

const CapabilityMatrix = () => {
  const { t } = useI18n();
  const yes = t('home.faq.matrix.yes');
  const no = t('home.faq.matrix.no');

  return (
    <>
      {/* Phones: a card per service. Five columns never fit, and a sideways
          scroll hides half the answer behind a gesture. */}
      <ul className="grid gap-3 sm:hidden">
        {ALL_SERVICES.map((service) => (
          <li key={service.id} className="rounded-xl border border-app-border p-3">
            <p className="flex items-center gap-2 text-sm font-black text-app-text">
              <ServiceLogo service={service.id} alt="" className="h-6 w-6" />
              {service.name}
            </p>
            <dl className="mt-2.5 grid gap-1.5">
              {CAPABILITIES.map((capability) => (
                <div key={capability} className="flex items-center justify-between gap-3 text-sm">
                  <dt>{t(`home.faq.matrix.${capability}`)}</dt>
                  <dd className="flex items-center">
                    <Supported
                      supported={MATRIX[service.id][capability]}
                      label={MATRIX[service.id][capability] ? yes : no}
                    />
                  </dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full border-collapse text-left text-sm">
          <caption className="sr-only">{t('home.faq.matrix.caption')}</caption>
          <thead>
            <tr className="border-b-2 border-app-text">
              <th scope="col" className="py-2 pr-3 font-black">
                {t('home.faq.matrix.service')}
              </th>
              {CAPABILITIES.map((capability) => (
                <th
                  key={capability}
                  scope="col"
                  className="px-2 py-2 text-center text-xs font-black uppercase tracking-[0.06em]"
                >
                  {t(`home.faq.matrix.${capability}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ALL_SERVICES.map((service) => (
              <tr key={service.id} className="border-b border-app-border last:border-b-0">
                <th scope="row" className="py-2.5 pr-3 font-bold">
                  <span className="flex items-center gap-2 whitespace-nowrap">
                    <ServiceLogo service={service.id} alt="" className="h-6 w-6" />
                    {service.name}
                  </span>
                </th>
                {CAPABILITIES.map((capability) => (
                  <td key={capability} className="px-2 py-2.5">
                    <span className="flex justify-center">
                      <Supported
                        supported={MATRIX[service.id][capability]}
                        label={MATRIX[service.id][capability] ? yes : no}
                      />
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
};

const readEntryIdFromHash = (): FaqEntryId | null => {
  if (typeof window === 'undefined') {
    return null;
  }
  const id = decodeURIComponent(window.location.hash.replace('#', ''));
  return (FAQ_ENTRY_IDS as readonly string[]).includes(id) ? (id as FaqEntryId) : null;
};

/** Answers the questions the compatibility cards raise but cannot fit. */
export const FaqSection = () => {
  const { t } = useI18n();
  // Opens on the entry named in the URL, else on the matrix so the page is
  // never an empty list of closed rows.
  const [openId, setOpenId] = useState<FaqEntryId | null>(() => readEntryIdFromHash() ?? 'matrix');

  useEffect(() => {
    const revealFromHash = () => {
      const id = readEntryIdFromHash();
      if (!id) {
        return;
      }
      setOpenId(id);
      // Wait for the panel to expand before scrolling to it.
      requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: 'start' }));
    };

    revealFromHash();
    window.addEventListener('hashchange', revealFromHash);
    return () => window.removeEventListener('hashchange', revealFromHash);
  }, []);

  const answers: Record<FaqEntryId, ReactNode> = {
    matrix: <CapabilityMatrix />,
    connect: t('home.faq.connect.answer'),
    link: t('home.faq.link.answer'),
    guests: t('home.faq.guests.answer'),
    syncDirection: t('home.faq.syncDirection.answer'),
    skipped: t('home.faq.skipped.answer'),
    linkPrivacy: t('home.faq.linkPrivacy.answer'),
    leaving: t('home.faq.leaving.answer'),
  };

  return (
    <div className="grid gap-3">
      {FAQ_ENTRY_IDS.map((entryId) => {
        const isOpen = openId === entryId;
        return (
          <div
            key={entryId}
            id={entryId}
            className="scroll-mt-28 rounded-2xl border-2 border-app-text bg-app-elevated shadow-sticker-sm dark:bg-app-card"
          >
            <h3>
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={`${entryId}-panel`}
                onClick={() => setOpenId(isOpen ? null : entryId)}
                className="focus-ring-brand flex w-full items-start justify-between gap-3 rounded-2xl px-4 py-4 text-left text-[15px] font-black text-app-text transition hover:text-brand-pink sm:gap-4 sm:px-5 sm:text-lg"
              >
                <span className="text-balance">{t(`home.faq.${entryId}.question`)}</span>
                <ChevronDown
                  size={20}
                  aria-hidden
                  className={`mt-0.5 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                />
              </button>
            </h3>
            <AnimatePresence initial={false}>
              {isOpen ? (
                <motion.div
                  id={`${entryId}-panel`}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-4 text-sm leading-relaxed text-app-text-secondary sm:px-5 sm:pb-5 sm:text-base">
                    {answers[entryId]}
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
};

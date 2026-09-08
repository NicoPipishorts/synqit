import { CONNECT_SERVICES, LINK_SERVICES, type MusicServiceId, ServiceLogo } from '@synqit/ui';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown, Minus } from 'lucide-react';
import { type ReactNode, useId, useState } from 'react';

import { useI18n } from '../../lib/i18n';

// Columns of the capability matrix, in the order a reader asks about them.
const CAPABILITIES = ['connect', 'events', 'sync', 'transferIn', 'importFrom'] as const;
type Capability = (typeof CAPABILITIES)[number];

// What each service can actually do today. Link services are import sources only.
const MATRIX: Record<MusicServiceId, Record<Capability, boolean>> = {
  spotify: { connect: true, events: true, sync: true, transferIn: true, importFrom: true },
  apple: { connect: true, events: true, sync: true, transferIn: true, importFrom: true },
  deezer: { connect: false, events: false, sync: false, transferIn: false, importFrom: true },
  youtube: { connect: false, events: false, sync: false, transferIn: false, importFrom: true },
};

const ALL_SERVICES = [...CONNECT_SERVICES, ...LINK_SERVICES];

const CapabilityMatrix = () => {
  const { t } = useI18n();

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
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
                className="px-2 py-2 text-center text-xs font-black uppercase tracking-[0.08em]"
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
                <span className="flex items-center gap-2">
                  <ServiceLogo service={service.id} alt="" className="h-6 w-6" />
                  {service.name}
                </span>
              </th>
              {CAPABILITIES.map((capability) => {
                const supported = MATRIX[service.id][capability];
                return (
                  <td key={capability} className="px-2 py-2.5 text-center">
                    {supported ? (
                      <Check size={16} className="mx-auto text-brand-pink" aria-hidden />
                    ) : (
                      <Minus size={16} className="mx-auto text-app-text-muted" aria-hidden />
                    )}
                    <span className="sr-only">
                      {t(supported ? 'home.faq.matrix.yes' : 'home.faq.matrix.no')}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

type FaqEntry = { id: string; answer: ReactNode };

/** Answers the questions the compatibility cards raise but cannot fit. */
export const FaqSection = () => {
  const { t } = useI18n();
  const baseId = useId();
  // The first entry is open at rest, so the section never reads as an empty list.
  const [openId, setOpenId] = useState<string | null>('matrix');

  const entries: FaqEntry[] = [
    { id: 'matrix', answer: <CapabilityMatrix /> },
    { id: 'connect', answer: t('home.faq.connect.answer') },
    { id: 'link', answer: t('home.faq.link.answer') },
    { id: 'guests', answer: t('home.faq.guests.answer') },
    { id: 'syncDirection', answer: t('home.faq.syncDirection.answer') },
    { id: 'skipped', answer: t('home.faq.skipped.answer') },
    { id: 'linkPrivacy', answer: t('home.faq.linkPrivacy.answer') },
    { id: 'leaving', answer: t('home.faq.leaving.answer') },
  ];

  return (
    <div className="grid gap-3">
      {entries.map((entry) => {
        const isOpen = openId === entry.id;
        const panelId = `${baseId}-${entry.id}`;
        return (
          <div
            key={entry.id}
            className="rounded-2xl border-2 border-app-text bg-app-elevated shadow-sticker-sm dark:bg-app-card"
          >
            <h3>
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpenId(isOpen ? null : entry.id)}
                className="focus-ring-brand flex w-full items-center justify-between gap-4 rounded-2xl px-5 py-4 text-left text-base font-black text-app-text transition hover:text-brand-pink sm:text-lg"
              >
                <span>{t(`home.faq.${entry.id}.question`)}</span>
                <ChevronDown
                  size={20}
                  aria-hidden
                  className={`shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                />
              </button>
            </h3>
            <AnimatePresence initial={false}>
              {isOpen ? (
                <motion.div
                  id={panelId}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <div className="px-5 pb-5 text-sm leading-relaxed text-app-text-secondary sm:text-base">
                    {entry.answer}
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

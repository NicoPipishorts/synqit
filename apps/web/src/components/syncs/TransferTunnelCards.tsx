import { MUSIC_SERVICES, ServiceLogo, type MusicServiceId } from '@synqit/ui';
import { AnimatePresence, motion } from 'framer-motion';
import { FileText, LoaderCircle, X } from 'lucide-react';
import { useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react';

import { useI18n } from '../../hooks/useI18n';
import { PROVIDER_LABELS } from '../../lib/providers';
import type { Provider } from '../../lib/types';
import { CTAButton } from '../ui/cta';

/**
 * Where a playlist can come from. Two lines, because the two lines behave
 * differently: a connected account is read through its API, while a link source
 * is a public URL read anonymously and can only ever be a source — Synqit holds
 * no write access there.
 */
export type LinkSourceId = MusicServiceId;

const MARK_MORPH_MS = 560;
// A long, even glide rather than a snap: the mark travels most of the card's
// width, and a fast curve read as a jump.
const MARK_MORPH_EASE = 'cubic-bezier(0.32, 0.72, 0, 1)';
/** The fields wait for the mark to be most of the way home before arriving. */
const FIELD_FADE = { duration: 0.34, delay: 0.22, ease: [0.32, 0.72, 0, 1] } as const;

/** Plays an element's previous box off its new one. No-op without a "from". */
const playFlip = (
  element: HTMLElement | null,
  from: DOMRect | null,
  { withScale }: { withScale: boolean },
): void => {
  if (!element || !from) {
    return;
  }
  const to = element.getBoundingClientRect();
  if (to.width === 0 || from.width === 0) {
    return;
  }
  const dx = from.left - to.left;
  const dy = from.top - to.top;
  const scale = withScale ? from.width / to.width : 1;
  if (Math.abs(dx) < 1 && Math.abs(dy) < 1 && Math.abs(scale - 1) < 0.01) {
    return;
  }
  element.animate(
    [
      { transformOrigin: 'top left', transform: `translate(${dx}px, ${dy}px) scale(${scale})` },
      { transformOrigin: 'top left', transform: 'none' },
    ],
    { duration: MARK_MORPH_MS, easing: MARK_MORPH_EASE },
  );
};

/**
 * Carries a card through a pick: the mark flies from its row into the header,
 * and the wording glides from where it stood to where the collapsed card puts
 * it, instead of jumping as the rows leave.
 *
 * A measured FLIP rather than a shared-layout animation: the row mark and the
 * header mark are different elements in different parents, and framer's
 * `layoutId` handoff between them froze mid-flight. Boxes are captured on click
 * and played off the new ones in a layout effect, so the first painted frame is
 * already the old position.
 */
const useCardMorph = (selectionKey: string | null) => {
  const markRef = useRef<HTMLSpanElement | null>(null);
  const textRef = useRef<HTMLDivElement | null>(null);
  const fromRef = useRef<{ mark: DOMRect | null; text: DOMRect | null } | null>(null);

  /** Call in the click handler, before the state that re-lays the card out. */
  const capture = (markFrom: DOMRect | null) => {
    fromRef.current = {
      mark: markFrom,
      text: textRef.current?.getBoundingClientRect() ?? null,
    };
  };

  useLayoutEffect(() => {
    const from = fromRef.current;
    fromRef.current = null;
    if (!from) {
      return;
    }
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    playFlip(markRef.current, from.mark, { withScale: true });
    playFlip(textRef.current, from.text, { withScale: false });
    // Re-runs on every pick and on clearing one.
  }, [selectionKey]);

  return { markRef, textRef, capture };
};

type ServiceChoiceProps = {
  /** Accessible name: the mark carries no visible label. */
  label: string;
  mark: ReactNode;
  isSelected: boolean;
  disabled?: boolean;
  /** Receives where the mark sat, so the header can fly it in from there. */
  onSelect: (fromRect: DOMRect) => void;
};

/**
 * A bare mark, no pill around it. The choice reads from the logos alone: the
 * ones not picked drop to grey so the selected service is the only one in
 * colour.
 */
const ServiceChoice = ({
  label,
  mark,
  isSelected,
  disabled = false,
  onSelect,
}: ServiceChoiceProps) => (
  <button
    type="button"
    role="radio"
    aria-checked={isSelected}
    aria-label={label}
    title={label}
    disabled={disabled}
    onClick={(event) => onSelect(event.currentTarget.getBoundingClientRect())}
    className={`inline-flex cursor-pointer items-center justify-center rounded-full p-1 transition disabled:cursor-not-allowed disabled:opacity-40 ${
      isSelected
        ? 'text-app-text'
        : 'text-app-text opacity-60 grayscale hover:scale-105 hover:opacity-100 hover:grayscale-0'
    }`}
  >
    {mark}
  </button>
);

const CardShell = ({ children }: { children: ReactNode }) => (
  // Both cards stretch to the taller of the pair, so the content rides the
  // middle rather than hanging from the top of a half-empty card.
  <article className="grid h-full content-center gap-4 rounded-[1.9rem] border border-app-border bg-white/80 p-5 shadow-soft-lift dark:bg-app-elevated/80">
    {children}
  </article>
);

const CardHeader = ({
  eyebrow,
  title,
  status,
  mark,
  markRef,
  textRef,
  clearLabel,
  onClear,
  textKey,
}: {
  eyebrow: string;
  title: string;
  status: string;
  /** Changes with the pick, so the wording cross-fades instead of snapping. */
  textKey: string;
  mark: ReactNode;
  markRef?: RefObject<HTMLSpanElement | null>;
  textRef?: RefObject<HTMLDivElement | null>;
  clearLabel?: string;
  /** When set, the mark wears the same corner badge the event picker uses to undo a pick. */
  onClear?: () => void;
}) => (
  // Nothing picked yet: the marks follow underneath, so the header reads from
  // the top. Once picked, the mark is the card's subject and sits on the
  // text's centre line.
  <div className={`flex justify-between gap-4 ${onClear ? 'items-center' : 'items-start'}`}>
    <div ref={textRef} className="grid">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-app-text-secondary">
        {eyebrow}
      </p>
      {/* Both wordings share one grid cell so the old fades out under the new
          rather than the new waiting its turn: a paused exit (a backgrounded
          tab throttles the frames it needs) would otherwise leave the previous
          service's name on screen. */}
      <div className="grid">
        <AnimatePresence initial={false}>
          <motion.div
            key={textKey}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.32, ease: 'easeInOut' }}
            className="col-start-1 row-start-1 grid content-start gap-1 pt-1"
          >
            <p className="text-2xl font-black text-brand-dark dark:text-brand-white">{title}</p>
            <p className="text-sm text-app-text-secondary">{status}</p>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
    <span ref={markRef} className="relative inline-flex shrink-0">
      {mark}
      {onClear ? (
        <button
          type="button"
          onClick={onClear}
          aria-label={clearLabel}
          className="absolute -right-1 -top-1 inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border-2 border-app-text bg-brand-pink text-white shadow-sticker-sm transition hover:opacity-80"
        >
          <X size={13} strokeWidth={3} aria-hidden="true" />
        </button>
      ) : null}
    </span>
  </div>
);

const RowLabel = ({ children }: { children: ReactNode }) => (
  <p className="text-xs font-bold uppercase tracking-[0.16em] text-app-text-muted">{children}</p>
);

export type TransferSourceCardProps = {
  /** Services that can be read *and* written: the direct-transfer line. */
  directProviders: readonly Provider[];
  /** Public-link sources the API currently accepts: the second line. */
  linkServices: readonly MusicServiceId[];
  selectedProvider: Provider | null;
  selectedLinkSource: LinkSourceId | null;
  providerStatusByType: Record<Provider, 'connected' | 'not_connected'>;
  isBusy: boolean;
  linkUrl: string;
  onSelectProvider: (provider: Provider) => void;
  onSelectLinkSource: (source: LinkSourceId) => void;
  onChangeLinkUrl: (url: string) => void;
  onClearSelection: () => void;
  onConnect: (provider: Provider) => void;
};

/** Left half of the tunnel: where the playlist comes from. */
export const TransferSourceCard = ({
  directProviders,
  linkServices,
  selectedProvider,
  selectedLinkSource,
  providerStatusByType,
  isBusy,
  linkUrl,
  onSelectProvider,
  onSelectLinkSource,
  onChangeLinkUrl,
  onClearSelection,
  onConnect,
}: TransferSourceCardProps) => {
  const { t } = useI18n();
  const isConnected =
    selectedProvider !== null && providerStatusByType[selectedProvider] === 'connected';
  // Once a source is picked the marks give way to what that choice needs — the
  // link field, or nothing at all for a connected service. Clearing the pick
  // brings them back.
  const hasSelection = selectedProvider !== null || selectedLinkSource !== null;
  const { markRef, textRef, capture } = useCardMorph(
    selectedProvider ?? selectedLinkSource ?? null,
  );

  const title = selectedProvider
    ? PROVIDER_LABELS[selectedProvider]
    : selectedLinkSource
      ? MUSIC_SERVICES[selectedLinkSource].name
      : t('transferPage.sourceEmptyTitle');

  const status = selectedProvider
    ? isConnected
      ? t('transferPage.alreadyConnected')
      : t('transferPage.notConnected')
    : selectedLinkSource
      ? t('transferPage.sourceLinkStatus')
      : t('transferPage.sourceEmptyStatus');

  const mark = selectedProvider ? (
    <ServiceLogo service={selectedProvider} className="h-14 w-14 sm:h-16 sm:w-16" alt="" />
  ) : selectedLinkSource ? (
    <ServiceLogo service={selectedLinkSource} className="h-14 w-14 sm:h-16 sm:w-16" alt="" />
  ) : (
    <span className="inline-flex h-14 w-14 items-center justify-center rounded-full border-2 border-dashed border-app-border text-app-text-muted sm:h-16 sm:w-16">
      <FileText size={22} aria-hidden="true" />
    </span>
  );

  return (
    <CardShell>
      <CardHeader
        eyebrow={t('transferPage.sourceTitle')}
        title={title}
        status={status}
        textKey={selectedProvider ?? selectedLinkSource ?? 'empty'}
        mark={mark}
        markRef={markRef}
        textRef={textRef}
        clearLabel={t('transferPage.changeSource')}
        onClear={
          hasSelection
            ? () => {
                // No mark to fly back, but the wording still slides up as the
                // rows come back and the card grows.
                capture(null);
                onClearSelection();
              }
            : undefined
        }
      />

      {hasSelection ? null : (
        <>
          <div
            className="grid gap-2"
            role="radiogroup"
            aria-label={t('transferPage.sourceDirectLabel')}
          >
            <RowLabel>{t('transferPage.sourceDirectLabel')}</RowLabel>
            <div className="flex flex-wrap items-center gap-3">
              {directProviders.map((provider) => (
                <ServiceChoice
                  key={provider}
                  label={PROVIDER_LABELS[provider]}
                  mark={<ServiceLogo service={provider} className="h-10 w-10" alt="" />}
                  isSelected={selectedProvider === provider}
                  disabled={isBusy}
                  onSelect={(fromRect) => {
                    capture(fromRect);
                    onSelectProvider(provider);
                  }}
                />
              ))}
            </div>
          </div>

          {linkServices.length > 0 ? (
            <div
              className="grid gap-2"
              role="radiogroup"
              aria-label={t('transferPage.sourceLinkLabel')}
            >
              <RowLabel>{t('transferPage.sourceLinkLabel')}</RowLabel>
              <div className="flex flex-wrap items-center gap-3">
                {linkServices.map((service) => (
                  <ServiceChoice
                    key={service}
                    label={MUSIC_SERVICES[service].name}
                    mark={<ServiceLogo service={service} className="h-10 w-10" alt="" />}
                    isSelected={selectedLinkSource === service}
                    disabled={isBusy}
                    onSelect={(fromRect) => {
                      capture(fromRect);
                      onSelectLinkSource(service);
                    }}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </>
      )}

      {selectedProvider && !isConnected ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={FIELD_FADE}>
          <CTAButton
            variant="secondary"
            className="w-full justify-center rounded-xl"
            onClick={() => onConnect(selectedProvider)}
            disabled={isBusy}
          >
            {isBusy ? <LoaderCircle size={14} className="animate-spin" aria-hidden="true" /> : null}
            {t('transferPage.connectSource')}
          </CTAButton>
        </motion.div>
      ) : null}

      {selectedLinkSource ? (
        <motion.label
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={FIELD_FADE}
          className="grid gap-2 text-sm font-semibold text-app-text"
        >
          {t('transferPage.linkUrlLabel')}
          <input
            type="url"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            value={linkUrl}
            onChange={(event) => onChangeLinkUrl(event.target.value)}
            placeholder={t('transferPage.linkUrlPlaceholder')}
            className="w-full rounded-xl border border-app-border bg-app-bg px-3 py-2.5 font-normal text-app-text outline-none transition focus:border-brand-pink"
          />
          <span className="text-xs font-normal text-app-text-secondary">
            {t('transferPage.linkUrlHint')}
          </span>
        </motion.label>
      ) : null}
    </CardShell>
  );
};

export type TransferDestinationCardProps = {
  /** Services Synqit can write into, already filtered against the chosen source. */
  options: readonly Provider[];
  selected: Provider | null;
  /** True until a source is picked: the right card stays blank on purpose. */
  isWaitingForSource: boolean;
  providerStatusByType: Record<Provider, 'connected' | 'not_connected'>;
  isBusy: boolean;
  onSelect: (provider: Provider) => void;
  onClearSelection: () => void;
  onConnect: (provider: Provider) => void;
};

/** Right half of the tunnel: where it lands. Filled in once a source is chosen. */
export const TransferDestinationCard = ({
  options,
  selected,
  isWaitingForSource,
  providerStatusByType,
  isBusy,
  onSelect,
  onClearSelection,
  onConnect,
}: TransferDestinationCardProps) => {
  const { t } = useI18n();
  const isConnected = selected !== null && providerStatusByType[selected] === 'connected';
  const { markRef, textRef, capture } = useCardMorph(selected);

  return (
    <CardShell>
      <CardHeader
        eyebrow={t('transferPage.destinationTitle')}
        title={selected ? PROVIDER_LABELS[selected] : t('transferPage.destinationEmptyTitle')}
        textKey={selected ?? (isWaitingForSource ? 'waiting' : 'empty')}
        status={
          isWaitingForSource
            ? t('transferPage.destinationWaiting')
            : selected
              ? isConnected
                ? t('transferPage.alreadyConnected')
                : t('transferPage.notConnected')
              : t('transferPage.destinationEmptyStatus')
        }
        mark={
          selected ? (
            <ServiceLogo service={selected} className="h-14 w-14 sm:h-16 sm:w-16" alt="" />
          ) : (
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-full border-2 border-dashed border-app-border text-app-text-muted sm:h-16 sm:w-16">
              ?
            </span>
          )
        }
        markRef={markRef}
        textRef={textRef}
        clearLabel={t('transferPage.changeDestination')}
        onClear={
          selected !== null
            ? () => {
                capture(null);
                onClearSelection();
              }
            : undefined
        }
      />

      {isWaitingForSource ? (
        <p className="rounded-2xl border border-dashed border-app-border px-4 py-6 text-center text-sm text-app-text-secondary">
          {t('transferPage.destinationWaitingHint')}
        </p>
      ) : selected !== null ? null : (
        <div
          className="grid gap-2"
          role="radiogroup"
          aria-label={t('transferPage.destinationWriteLabel')}
        >
          <RowLabel>{t('transferPage.destinationWriteLabel')}</RowLabel>
          <div className="flex flex-wrap items-center gap-3">
            {options.map((provider) => (
              <ServiceChoice
                key={provider}
                label={PROVIDER_LABELS[provider]}
                mark={<ServiceLogo service={provider} className="h-10 w-10" alt="" />}
                isSelected={selected === provider}
                disabled={isBusy}
                onSelect={(fromRect) => {
                  capture(fromRect);
                  onSelect(provider);
                }}
              />
            ))}
          </div>
        </div>
      )}

      {selected && !isConnected ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={FIELD_FADE}>
          <CTAButton
            variant="secondary"
            className="w-full justify-center rounded-xl"
            onClick={() => onConnect(selected)}
            disabled={isBusy}
          >
            {isBusy ? <LoaderCircle size={14} className="animate-spin" aria-hidden="true" /> : null}
            {t('transferPage.connectDestination')}
          </CTAButton>
        </motion.div>
      ) : null}
    </CardShell>
  );
};

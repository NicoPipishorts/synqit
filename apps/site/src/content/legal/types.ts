import { type Locale } from '../../lib/i18n';

/**
 * Legal prose lives in typed modules rather than in `common.json`: the site
 * reads the web app's locale files, and long-form legal text there would bloat
 * the app bundle's translations and make `yarn i18n:check` parity unreadable.
 * Keeping it here also lets both locales share the `ENTITY` constants.
 */
export type LegalBlock =
  | { kind: 'p'; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'table'; head: string[]; rows: string[][] }
  | { kind: 'note'; text: string };

export type LegalSection = {
  /** Stable across locales — it is the anchor id, so never translate it. */
  id: string;
  heading: string;
  blocks: LegalBlock[];
};

export type LegalDocument = {
  title: string;
  subtitle: string;
  /** ISO date; the renderer formats it for the active locale. */
  updated: string;
  tocLabel: string;
  sections: LegalSection[];
};

export type LegalDocumentSet = Record<Locale, LegalDocument>;

/** The routes these documents are served on. */
export const LEGAL_SLUGS = ['privacy', 'terms', 'legal-notice', 'cookies'] as const;
export type LegalSlug = (typeof LEGAL_SLUGS)[number];

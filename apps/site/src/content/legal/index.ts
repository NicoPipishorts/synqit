import { cookiesDocument } from './cookies';
import { legalNoticeDocument } from './legal-notice';
import { privacyDocument } from './privacy';
import { termsDocument } from './terms';
import { type LegalDocumentSet, type LegalSlug } from './types';

export const LEGAL_DOCUMENTS: Record<LegalSlug, LegalDocumentSet> = {
  privacy: privacyDocument,
  terms: termsDocument,
  'legal-notice': legalNoticeDocument,
  cookies: cookiesDocument,
};

/** Route path for each document, in the order they appear in the footer. */
export const LEGAL_ROUTES: Record<LegalSlug, string> = {
  privacy: '/privacy',
  terms: '/terms',
  'legal-notice': '/legal-notice',
  cookies: '/cookies',
};

const SLUG_BY_ROUTE = new Map<string, LegalSlug>(
  Object.entries(LEGAL_ROUTES).map(([slug, route]) => [route, slug as LegalSlug]),
);

export const legalSlugForPath = (pathname: string): LegalSlug | null =>
  SLUG_BY_ROUTE.get(pathname) ?? null;

export * from './types';
export { ENTITY } from './entity';

// Single source of truth for the identity details every legal page repeats.
//
// TODO(legal): the four TODO values below must be filled in before these pages
// go live. French law (LCEN art. 6-III) requires a site operated commercially to
// publish the publisher's identity and the host's name and address; a micro-
// entreprise publishes the operator's own name, SIREN, and declared address.
export const ENTITY = {
  /** Trading name shown in prose. */
  brand: 'Synqit',
  /** The natural person operating the micro-entreprise — the data controller. */
  publisher: 'Nicolas Pisar',
  /** Micro-entreprise, so the operator is also the publication director. */
  publicationDirector: 'Nicolas Pisar',
  /** TODO(legal): 9-digit SIREN from your micro-entreprise registration. */
  siren: 'TODO — SIREN',
  /** TODO(legal): the address declared to the INSEE / RCS. */
  address: 'TODO — declared business address',
  /** Micro-entreprises under the VAT franchise have no intracommunity number. */
  vat: null as string | null,
  /** TODO(legal): hosting provider legal name + address (LCEN requires both). */
  host: {
    name: 'TODO — hosting provider legal name',
    address: 'TODO — hosting provider address',
  },
  domain: 'synqit.fr',
  siteUrl: 'https://synqit.fr',
  appUrl: 'https://app.synqit.fr',
  email: {
    privacy: 'privacy@synqit.fr',
    legal: 'legal@synqit.fr',
  },
} as const;

/** Last substantive revision of the legal pages. Bump when the text changes. */
export const LEGAL_UPDATED_AT = '2026-09-07';

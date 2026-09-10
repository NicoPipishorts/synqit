/**
 * The form field the auth pages established: a two-weight border that turns to
 * the text colour on focus and throws a lime sticker shadow, at a size a thumb
 * can hit. Shared as a class rather than a component because the fields differ
 * — input, select, the password field's own wrapper — while the treatment
 * should not.
 */
export const FIELD_CLASS =
  'w-full rounded-xl border-2 border-app-border-strong bg-app-bg px-3 py-2.5 text-base leading-6 text-app-text outline-none transition focus:border-app-text focus:shadow-[3px_3px_0_0_var(--color-brand-lime)] disabled:cursor-not-allowed disabled:opacity-60 dark:bg-app-elevated';

/** A field showing something the owner cannot change here, e.g. their email. */
export const FIELD_LOCKED_CLASS =
  'w-full rounded-xl border-2 border-dashed border-app-text/40 bg-app-surface px-3 py-2.5 text-base leading-6 text-app-text-secondary outline-none dark:bg-app-elevated';

/** Label wrapper: the caption above the field, at the same rhythm everywhere. */
export const FIELD_LABEL_CLASS = 'grid gap-2 text-sm font-medium text-app-text';

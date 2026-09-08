import { Highlight } from '@synqit/ui';
import { Fragment, type ReactNode } from 'react';

/**
 * Marks the phrase a title should swipe with the highlighter. It lives inside the
 * translated string rather than in separate lead/highlight keys, so a translator
 * can move the emphasis to whichever words carry it in their language — French
 * rarely stresses the same word English does, and word order moves with it.
 */
const MARKED_PHRASE = /\[\[(.+?)\]\]/g;

/** Renders a translated string, turning its `[[marked]]` phrase into a swipe. */
export const HighlightedText = ({ value }: { value: string }): ReactNode => (
  <>
    {value.split(MARKED_PHRASE).map((part, index) =>
      // split() with one capture group alternates: plain, marked, plain, marked…
      index % 2 === 1 ? (
        <Highlight key={index}>{part}</Highlight>
      ) : (
        <Fragment key={index}>{part}</Fragment>
      ),
    )}
  </>
);

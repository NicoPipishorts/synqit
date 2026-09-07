import type { ReactNode } from 'react';

import { cn } from '../utils/cn';

type HighlightProps = {
  children: ReactNode;
  /** Highlighter colour. */
  tone?: 'lime' | 'pink';
  className?: string;
};

/**
 * Highlighter swipe behind a word or phrase: a slightly skewed, tilted lime block
 * that reads like a marker pass. Use inside headings to make one phrase stand out.
 */
export const Highlight = ({ children, tone = 'lime', className }: HighlightProps) => (
  <span className={cn('relative inline-block px-2', className)}>
    <span
      aria-hidden="true"
      className={cn(
        'absolute inset-x-0 inset-y-[8%] -skew-x-6 -rotate-1 rounded-md',
        tone === 'lime' ? 'bg-brand-lime' : 'bg-brand-pink',
      )}
    />
    <span className={cn('relative', tone === 'lime' ? 'text-brand-dark' : 'text-brand-white')}>
      {children}
    </span>
  </span>
);

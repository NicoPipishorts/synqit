import { type ReactNode } from 'react';

type SectionHeadingProps = {
  title: string;
  description?: string;
  aside?: ReactNode;
};

export const SectionHeading = ({ title, description, aside }: SectionHeadingProps) => (
  <div className="flex flex-wrap items-end justify-between gap-3">
    <div className="grid gap-2">
      <h2 className="text-2xl font-bold text-brand-dark dark:text-brand-white sm:text-3xl">
        {title}
      </h2>
      {description ? (
        <p className="max-w-2xl text-sm text-app-text-secondary sm:text-base">{description}</p>
      ) : null}
    </div>
    {aside}
  </div>
);

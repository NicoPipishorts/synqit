import { type ReactNode } from 'react';

type SectionHeadingProps = {
  title: string;
  description?: string;
  aside?: ReactNode;
  align?: 'left' | 'center';
  titleClassName?: string;
  descriptionClassName?: string;
};

export const SectionHeading = ({
  title,
  description,
  aside,
  align = 'left',
  titleClassName,
  descriptionClassName,
}: SectionHeadingProps) => (
  <div
    className={`flex flex-wrap items-end gap-3 ${
      align === 'center' ? 'justify-center text-center' : 'justify-between'
    }`}
  >
    <div className="grid gap-2">
      <h2
        className={`text-2xl font-bold text-brand-dark dark:text-brand-white sm:text-3xl ${
          titleClassName ?? ''
        }`.trim()}
      >
        {title}
      </h2>
      {description ? (
        <p
          className={`max-w-2xl text-sm text-app-text-secondary sm:text-base ${
            descriptionClassName ?? ''
          }`.trim()}
        >
          {description}
        </p>
      ) : null}
    </div>
    {aside}
  </div>
);

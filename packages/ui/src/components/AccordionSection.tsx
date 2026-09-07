import { ChevronDown } from 'lucide-react';
import { type ReactNode, useState } from 'react';

type AccordionSectionProps = {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
};

export const AccordionSection = ({
  title,
  children,
  defaultOpen = false,
}: AccordionSectionProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <section className="rounded-2xl border-2 border-app-text bg-app-elevated p-3 shadow-sticker-sm dark:bg-app-card">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        aria-expanded={isOpen}
        className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg text-left text-sm font-black text-app-text transition hover:text-brand-pink"
      >
        <span>{title}</span>
        <ChevronDown
          size={16}
          aria-hidden="true"
          className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen ? <div className="mt-3 grid gap-2">{children}</div> : null}
    </section>
  );
};

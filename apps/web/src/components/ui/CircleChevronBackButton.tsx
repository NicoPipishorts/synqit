import { Link } from '@tanstack/react-router';
import { ChevronLeft } from 'lucide-react';

type CircleChevronBackButtonProps = {
  to: string;
  label: string;
};

export const CircleChevronBackButton = ({ to, label }: CircleChevronBackButtonProps) => {
  return (
    <Link
      to={to}
      aria-label={label}
      className="absolute inline-flex h-10 w-10 items-center justify-center rounded-full border-2 border-app-text bg-app-elevated text-app-text shadow-sticker-sm transition hover:bg-brand-lime hover:text-brand-dark motion-safe:hover:-translate-y-0.5 dark:bg-app-card"
    >
      <ChevronLeft size={18} aria-hidden="true" />
    </Link>
  );
};

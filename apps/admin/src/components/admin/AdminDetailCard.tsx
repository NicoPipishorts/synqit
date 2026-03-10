import { type ReactNode } from 'react';

type AdminDetailCardProps = {
  title: string;
  children: ReactNode;
};

export const AdminDetailCard = ({ title, children }: AdminDetailCardProps) => {
  return (
    <section className="grid content-start gap-4 rounded-2xl border border-app-border bg-app-surface/70 p-4 dark:bg-app-card">
      <h2 className="text-lg font-black text-app-text">{title}</h2>
      {children}
    </section>
  );
};

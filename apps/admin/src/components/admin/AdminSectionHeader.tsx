type AdminSectionHeaderProps = {
  eyebrow: string;
  title: string;
  description: string;
};

export const AdminSectionHeader = ({ eyebrow, title, description }: AdminSectionHeaderProps) => {
  return (
    <header className="grid gap-2">
      <span className="text-[11px] font-black uppercase tracking-[0.28em] text-app-text-muted">
        {eyebrow}
      </span>
      <div className="grid gap-1">
        <h1 className="text-3xl font-black tracking-tight text-brand-dark dark:text-brand-white">
          {title}
        </h1>
        <p className="max-w-3xl text-sm text-app-text-secondary sm:text-base">{description}</p>
      </div>
    </header>
  );
};

type AdminSectionHeaderProps = {
  title: string;
  description?: string;
};

export const AdminSectionHeader = ({ title, description }: AdminSectionHeaderProps) => {
  return (
    <header className="grid content-start gap-1">
      <h1 className="text-2xl font-black tracking-tight text-brand-dark sm:text-3xl dark:text-brand-white">
        {title}
      </h1>
      {description ? (
        <p className="max-w-3xl text-sm text-app-text-secondary sm:text-base">{description}</p>
      ) : null}
    </header>
  );
};

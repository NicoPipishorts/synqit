import { StatGrid, type StatItem } from '@synqit/ui';
import { type LucideIcon } from 'lucide-react';

export type DashboardStat = {
  id: string;
  label: string;
  value: number;
  hint: string;
  hintActive?: boolean;
  icon: LucideIcon;
};

type DashboardStatsProps = {
  stats: DashboardStat[];
};

/** Dashboard KPIs rendered with the shared StatGrid. */
export const DashboardStats = ({ stats }: DashboardStatsProps) => {
  const items: StatItem[] = stats.map(({ icon: Icon, ...stat }) => ({
    ...stat,
    icon: <Icon size={14} aria-hidden="true" />,
  }));
  return <StatGrid stats={items} />;
};

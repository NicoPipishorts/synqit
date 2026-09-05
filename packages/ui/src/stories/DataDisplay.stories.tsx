import type { Story } from '@ladle/react';
import { ListMusic, Music2, Users } from 'lucide-react';

import { CTAButton } from '../components/cta';
import { DataTable } from '../components/DataTable';
import { EmptyState } from '../components/EmptyState';
import { OnboardingPanel } from '../components/OnboardingPanel';
import { StatGrid } from '../components/StatCard';
import { SurfaceCard } from '../components/SurfaceCard';

export const Stats: Story = () => (
  <StatGrid
    stats={[
      {
        id: 'events',
        label: 'Events',
        value: 12,
        hint: '+2 this week',
        hintActive: true,
        icon: <ListMusic size={14} aria-hidden="true" />,
      },
      {
        id: 'syncs',
        label: 'Synced lists',
        value: 4,
        hint: 'Up to date',
        icon: <Music2 size={14} aria-hidden="true" />,
      },
      {
        id: 'subs',
        label: 'Subscribers',
        value: 1834,
        hint: '+41 today',
        hintActive: true,
        icon: <Users size={14} aria-hidden="true" />,
      },
      { id: 'status', label: 'Status', value: 'Live' },
    ]}
  />
);

type UserRow = { id: string; email: string; role: string; createdAt: string };

const rows: UserRow[] = [
  { id: '1', email: 'host@example.com', role: 'user', createdAt: '2026-06-01' },
  { id: '2', email: 'ops@synqit.test', role: 'admin', createdAt: '2026-05-12' },
];

export const Table: Story = () => (
  <DataTable
    caption="Users"
    rows={rows}
    getRowKey={(row) => row.id}
    onRowClick={(row) => alert(row.email)}
    columns={[
      {
        id: 'email',
        header: 'Email',
        cell: (row) => row.email,
        className: 'text-sm font-black text-app-text',
      },
      { id: 'role', header: 'Role', cell: (row) => row.role },
      { id: 'created', header: 'Created', cell: (row) => row.createdAt },
    ]}
  />
);

export const TableEmpty: Story = () => (
  <DataTable
    rows={[] as UserRow[]}
    getRowKey={(row) => row.id}
    emptyMessage="No users match this filter."
    columns={[{ id: 'email', header: 'Email', cell: (row) => row.email }]}
  />
);

export const Empty: Story = () => (
  <div className="flex justify-center">
    <EmptyState
      title="No playlists yet"
      body="Create your first event playlist to get started."
      icon={<ListMusic size={48} aria-hidden="true" />}
      action={<CTAButton variant="primary">Create playlist</CTAButton>}
    />
  </div>
);

export const Onboarding: Story = () => (
  <OnboardingPanel
    eyebrow="Get started"
    title="Sync your first playlist"
    body="Connect Spotify or Apple Music, pick a playlist, and share the link."
    icon={<Music2 size={24} aria-hidden="true" />}
    actions={
      <>
        <CTAButton variant="primary">Connect a service</CTAButton>
        <CTAButton>Learn more</CTAButton>
      </>
    }
  />
);

export const Surface: Story = () => (
  <SurfaceCard>
    <p className="text-sm">Any content on an elevated surface.</p>
  </SurfaceCard>
);

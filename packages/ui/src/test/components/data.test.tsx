import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DataTable, type DataTableColumn } from '../../components/DataTable';
import { EmptyState } from '../../components/EmptyState';
import { StatGrid } from '../../components/StatCard';

type Row = { id: string; email: string; role: string };

const columns: DataTableColumn<Row>[] = [
  { id: 'email', header: 'Email', cell: (row) => row.email },
  { id: 'role', header: 'Role', cell: (row) => row.role },
];

describe('DataTable', () => {
  it('renders headers and rows, and reports row clicks', async () => {
    const onRowClick = vi.fn();
    render(
      <DataTable
        columns={columns}
        rows={[{ id: '1', email: 'a@example.com', role: 'admin' }]}
        getRowKey={(row) => row.id}
        onRowClick={onRowClick}
        caption="Users"
      />,
    );
    expect(screen.getByRole('table', { name: 'Users' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Email' })).toBeInTheDocument();

    const row = screen.getByText('a@example.com').closest('tr');
    expect(row).toHaveAttribute('tabindex', '0');
    await userEvent.click(screen.getByText('a@example.com'));
    expect(onRowClick).toHaveBeenCalledWith({ id: '1', email: 'a@example.com', role: 'admin' });

    row?.focus();
    await userEvent.keyboard('{Enter}');
    expect(onRowClick).toHaveBeenCalledTimes(2);
  });

  it('shows the empty message when there are no rows', () => {
    render(
      <DataTable
        columns={columns}
        rows={[]}
        getRowKey={(row) => row.id}
        emptyMessage="Nobody yet"
      />,
    );
    expect(screen.getByText('Nobody yet')).toBeInTheDocument();
  });
});

describe('StatGrid', () => {
  it('formats numeric values and highlights active hints', () => {
    render(
      <StatGrid
        stats={[
          { id: 'a', label: 'Playlists', value: 1234, hint: '+3 today', hintActive: true },
          { id: 'b', label: 'Status', value: 'Live' },
        ]}
      />,
    );
    expect(screen.getByText('1,234')).toBeInTheDocument();
    expect(screen.getByText('+3 today').className).toContain('font-semibold');
    expect(screen.getByText('Live')).toBeInTheDocument();
  });
});

describe('EmptyState', () => {
  it('renders title, body, and action', () => {
    render(<EmptyState title="Nothing here" body="Create one" action={<button>Create</button>} />);
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument();
  });
});

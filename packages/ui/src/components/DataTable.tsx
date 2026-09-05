import type { ReactNode } from 'react';

import { cn } from '../utils/cn';

export type DataTableColumn<T> = {
  id: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  /** Extra classes for body cells in this column. */
  className?: string;
  headerClassName?: string;
};

export type DataTableProps<T> = {
  columns: readonly DataTableColumn<T>[];
  rows: readonly T[];
  getRowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  /** Shown as a single full-width row when `rows` is empty. */
  emptyMessage?: ReactNode;
  caption?: string;
  /** Minimum table width before horizontal scrolling kicks in. */
  minWidthClassName?: string;
  className?: string;
};

/**
 * Dense data table with the admin list styling. Rows become clickable (and
 * keyboard-focusable) when `onRowClick` is provided. Wrap in your own
 * responsive container if you need a card layout on small screens.
 */
export const DataTable = <T,>({
  columns,
  rows,
  getRowKey,
  onRowClick,
  emptyMessage,
  caption,
  minWidthClassName = 'min-w-[760px]',
  className,
}: DataTableProps<T>) => (
  <div className={cn('overflow-x-auto rounded-2xl border border-app-border', className)}>
    <table className={cn('w-full border-collapse text-left', minWidthClassName)}>
      {caption ? <caption className="sr-only">{caption}</caption> : null}
      <thead className="bg-app-surface dark:bg-app-card">
        <tr className="border-b border-app-border text-[11px] uppercase tracking-wide text-app-text-secondary">
          {columns.map((column) => (
            <th
              key={column.id}
              scope="col"
              className={cn('px-3 py-2 font-black', column.headerClassName)}
            >
              {column.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td
              colSpan={columns.length}
              className="px-3 py-6 text-center text-sm text-app-text-secondary"
            >
              {emptyMessage ?? '—'}
            </td>
          </tr>
        ) : (
          rows.map((row) => {
            const clickable = typeof onRowClick === 'function';
            return (
              <tr
                key={getRowKey(row)}
                className={cn(
                  'border-b border-app-border last:border-b-0',
                  clickable &&
                    'cursor-pointer hover:bg-app-surface/70 focus-within:bg-app-surface/70 dark:hover:bg-app-card',
                )}
                onClick={clickable ? () => onRowClick(row) : undefined}
                onKeyDown={
                  clickable
                    ? (event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          onRowClick(row);
                        }
                      }
                    : undefined
                }
                tabIndex={clickable ? 0 : undefined}
              >
                {columns.map((column) => (
                  <td
                    key={column.id}
                    className={cn(
                      'px-3 py-2 text-xs font-semibold text-app-text-secondary',
                      column.className,
                    )}
                  >
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            );
          })
        )}
      </tbody>
    </table>
  </div>
);

'use client';

import * as React from 'react';
import { Button } from './Button';
import { StatusBadge, StatusVariant } from './StatusBadge';

export interface Column<T> {
  key: string;
  header: string;
  render?: (item: T, index: number) => React.ReactNode;
  className?: string;
  headerClassName?: string;
  hideOnMobile?: boolean;
}

export interface ResponsiveDataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string | number;
  rowClassName?: (item: T) => string;
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
  emptyAction?: React.ReactNode;
  cardLayout?: {
    primaryKey: string;
    secondaryKeys: string[];
    statusKey?: string;
    actionKeys?: string[];
    renderCard?: (item: T) => React.ReactNode;
  };
  className?: string;
  loading?: boolean;
}

function TableHeader<T>({ columns }: { columns: Column<T>[] }) {
  return (
    <thead className="border-b-2 border-ink font-display text-ink uppercase tracking-wider text-xs">
      <tr>
        {columns.map((col) => (
          <th key={col.key} className={`p-4 font-bold align-middle ${col.headerClassName || ''}`}>
            {col.header}
          </th>
        ))}
      </tr>
    </thead>
  );
}

function TableBody<T>({
  columns,
  data,
  keyExtractor,
  rowClassName,
  onRowClick,
}: {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string | number;
  rowClassName?: (item: T) => string;
  onRowClick?: (item: T) => void;
}) {
  if (data.length === 0) {
    return null;
  }

  return (
    <tbody className="divide-y divide-clay/30 font-mono text-ink">
      {data.map((item, index) => {
        const key = keyExtractor(item);
        return (
          <tr
            key={key}
            className={`transition-colors hover:bg-clay/5 ${rowClassName ? rowClassName(item) : ''} ${onRowClick ? 'cursor-pointer' : ''}`}
            onClick={() => onRowClick?.(item)}
          >
            {columns.map((col) => {
              return (
                <td key={col.key} className={`p-4 align-middle ${col.className || ''}`}>
                  {col.render ? col.render(item, index) : String((item as any)[col.key] ?? '')}
                </td>
              );
            })}
          </tr>
        );
      })}
    </tbody>
  );
}

function CardLayout<T>({
  columns,
  data,
  keyExtractor,
  cardLayout,
  onRowClick
}: {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string | number;
  cardLayout: NonNullable<ResponsiveDataTableProps<T>['cardLayout']>;
  onRowClick?: (item: T) => void;
}) {
  const { primaryKey, secondaryKeys, statusKey, actionKeys, renderCard } = cardLayout;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" role="list">
      {data.map((item, index) => {
        const key = keyExtractor(item);

        if (renderCard) {
          return (
            <div key={key} className="border-2 border-ink bg-paper p-4" role="listitem">
              {renderCard(item)}
            </div>
          );
        }

        const primaryCol = columns.find(c => c.key === primaryKey);
        const statusCol = statusKey ? columns.find(c => c.key === statusKey) : null;
        const primaryValue = primaryCol?.render ? primaryCol.render(item, index) : String((item as any)[primaryKey] ?? '');
        const statusValue = statusCol?.render ? statusCol.render(item, index) : statusKey ? (item as any)[statusKey] : null;

        return (
          <article
            key={key}
            className="border-2 border-ink bg-paper p-4 flex flex-col"
            role="listitem"
            onClick={() => onRowClick?.(item)}
            style={{ cursor: onRowClick ? 'pointer' : 'default' }}
          >
            <div className="font-display text-lg font-bold text-ink mb-2">{primaryValue}</div>

            <div className="flex-1 space-y-1.5 text-sm">
              {secondaryKeys.map((sk) => {
                const col = columns.find(c => c.key === sk);
                if (!col) return null;
                const value = col.render ? col.render(item, index) : String((item as any)[sk] ?? '');
                return (
                  <div key={sk} className="font-mono text-ink/70">
                    <span className="font-bold text-ink">{col.header}: </span>
                    {value}
                  </div>
                );
              })}
            </div>

            {statusValue && (
              <div className="mt-3 pt-3 border-t border-clay/30">
                {statusCol?.render ? (
                  statusCol.render(item, index)
                ) : (
                  <StatusBadge status={statusValue as StatusVariant} />
                )}
              </div>
            )}

            {actionKeys && actionKeys.length > 0 && (
              <div className="mt-3 pt-3 border-t border-clay/30 flex flex-wrap gap-2">
                {actionKeys.map((ak) => {
                  const col = columns.find(c => c.key === ak);
                  if (!col?.render) return null;
                  return <div key={ak}>{col.render(item, index)}</div>;
                })}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}

export function ResponsiveDataTable<T>({
  columns,
  data,
  keyExtractor,
  rowClassName,
  onRowClick,
  emptyMessage = 'No data found.',
  emptyAction,
  cardLayout,
  className = '',
  loading = false
}: ResponsiveDataTableProps<T>) {
  if (loading) {
    return (
      <div className={`flex justify-center py-16 ${className}`}>
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-stamp" />
      </div>
    );
  }

  const visibleColumns = columns.filter(c => !c.hideOnMobile);
  const hasCardLayout = cardLayout && (typeof window === 'undefined' || window.innerWidth < 1024);

  return (
    <div className={className}>
      {hasCardLayout ? (
        <CardLayout
          columns={columns}
          data={data}
          keyExtractor={keyExtractor}
          cardLayout={cardLayout}
          onRowClick={onRowClick}
        />
      ) : (
        <div className="w-full overflow-auto border-y border-ink">
          <table className="w-full text-left text-sm">
            <TableHeader columns={visibleColumns} />
            <TableBody
              columns={visibleColumns}
              data={data}
              keyExtractor={keyExtractor}
              rowClassName={rowClassName}
              onRowClick={onRowClick}
            />
          </table>
        </div>
      )}

      {data.length === 0 && !loading && (
        <div className="border-2 border-dashed border-ink bg-paper py-16 px-4 text-center">
          <p className="font-display font-medium text-ink/70 mb-4">{emptyMessage}</p>
          {emptyAction}
        </div>
      )}
    </div>
  );
}
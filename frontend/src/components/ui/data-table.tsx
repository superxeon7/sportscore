'use client';

import React from 'react';
import { Skeleton } from './skeleton';

export interface Column<T> {
  key: string;
  header: string;
  width?: string;
  render?: (item: T, index: number) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  skeletonRows?: number;
  emptyMessage?: string;
  onRowClick?: (item: T) => void;
  keyExtractor?: (item: T, index: number) => string;
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  loading = false,
  skeletonRows = 5,
  emptyMessage = 'No data available',
  onRowClick,
  keyExtractor,
}: DataTableProps<T>) {
  if (loading) {
    return (
      <div className="w-full overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-slate-800/60">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="px-4 py-3 font-medium text-slate-400"
                  style={col.width ? { width: col.width } : undefined}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: skeletonRows }).map((_, rowIdx) => (
              <tr key={rowIdx} className="border-b border-white/5">
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3">
                    <Skeleton variant="line" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="w-full rounded-lg border border-white/10 bg-slate-900/60 px-4 py-12 text-center text-sm text-slate-500">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-white/10 bg-slate-800/60">
            {columns.map((col) => (
              <th
                key={col.key}
                className="px-4 py-3 font-medium text-slate-400"
                style={col.width ? { width: col.width } : undefined}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item, idx) => (
            <tr
              key={keyExtractor ? keyExtractor(item, idx) : idx}
              className={`border-b border-white/5 transition-colors ${onRowClick
                  ? 'cursor-pointer hover:bg-white/5'
                  : ''
                }`}
              onClick={() => onRowClick?.(item)}
            >
              {columns.map((col) => (
                <td key={col.key} className="px-4 py-3 text-slate-300">
                  {col.render
                    ? col.render(item, idx)
                    : (item[col.key] as React.ReactNode)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

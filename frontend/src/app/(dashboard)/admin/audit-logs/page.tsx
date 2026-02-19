'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { apiGet } from '@/lib/api/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Pagination } from '@/components/ui/pagination';

interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName?: string;
  action: string;
  entity: string;
  entityId: string;
  changes?: Record<string, unknown>;
}

interface AuditLogsResponse {
  data: AuditLogEntry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const ENTITY_TYPES = ['', 'USER', 'EVENT', 'TEAM', 'MATCH', 'TOURNAMENT', 'SPORT', 'PLAYER'];
const ACTION_TYPES = ['', 'CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT'];

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // Filters
  const [entityType, setEntityType] = useState('');
  const [action, setAction] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [userId, setUserId] = useState('');

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', limit.toString());
      if (entityType) params.set('entity', entityType);
      if (action) params.set('action', action);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      if (userId.trim()) params.set('userId', userId.trim());

      const res = await apiGet<AuditLogsResponse | AuditLogEntry[]>(
        `/admin/audit-logs?${params.toString()}`
      );
      if (Array.isArray(res)) {
        setLogs(res);
        setTotal(res.length);
        setTotalPages(1);
      } else {
        setLogs(res.data ?? []);
        setTotal(res.total ?? 0);
        setTotalPages(res.totalPages ?? 1);
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to load audit logs';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [page, limit, entityType, action, dateFrom, dateTo, userId]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleFilter = () => {
    setPage(1);
    fetchLogs();
  };

  const handleClearFilters = () => {
    setEntityType('');
    setAction('');
    setDateFrom('');
    setDateTo('');
    setUserId('');
    setPage(1);
  };

  const toggleExpand = (logId: string) => {
    setExpandedRow((prev) => (prev === logId ? null : logId));
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-100">Audit Logs</h1>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Entity Type
            </label>
            <Select
              value={entityType}
              onChange={(e) => setEntityType(e.target.value)}
              className="w-full"
            >
              <option value="">All Entities</option>
              {ENTITY_TYPES.filter(Boolean).map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Action
            </label>
            <Select
              value={action}
              onChange={(e) => setAction(e.target.value)}
              className="w-full"
            >
              <option value="">All Actions</option>
              {ACTION_TYPES.filter(Boolean).map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Date From
            </label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Date To
            </label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              User ID
            </label>
            <Input
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="Filter by user ID"
            />
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <Button size="sm" onClick={handleFilter}>
            Apply Filters
          </Button>
          <Button size="sm" variant="outline" onClick={handleClearFilters}>
            Clear Filters
          </Button>
        </div>
      </Card>

      {/* Results */}
      {loading ? (
        <Skeleton className="h-96 rounded-lg" />
      ) : error ? (
        <Card className="p-6">
          <p className="text-red-600">Error: {error}</p>
          <Button className="mt-4" onClick={fetchLogs}>Retry</Button>
        </Card>
      ) : (
        <>
          <Card className="overflow-hidden">
            <div className="px-4 py-3 border-b border-white/10">
              <p className="text-sm text-slate-400">{total} entries found</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-800/60 border-b border-white/10">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider w-8" />
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Timestamp
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Action
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Entity
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Entity ID
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {logs.map((log) => (
                    <React.Fragment key={log.id}>
                      <tr
                        className="hover:bg-white/5 cursor-pointer"
                        onClick={() => toggleExpand(log.id)}
                      >
                        <td className="px-4 py-3 text-slate-500">
                          <span
                            className={`inline-block transition-transform ${expandedRow === log.id ? 'rotate-90' : ''
                              }`}
                          >
                            &#9654;
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {log.userName || log.userId}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="secondary">{log.action}</Badge>
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-slate-200">
                          {log.entity}
                        </td>
                        <td className="px-4 py-3 text-sm font-mono">
                          {log.entityId}
                        </td>
                      </tr>
                      {expandedRow === log.id && (
                        <tr>
                          <td colSpan={6} className="px-4 py-4 bg-slate-800/60">
                            <div className="max-w-full overflow-x-auto">
                              <p className="text-xs font-medium text-slate-400 mb-2">
                                Changes:
                              </p>
                              <pre className="text-xs bg-slate-900/80 text-slate-300 p-3 rounded border border-white/10 font-mono whitespace-pre-wrap break-words">
                                {log.changes
                                  ? JSON.stringify(log.changes, null, 2)
                                  : 'No changes recorded'}
                              </pre>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            {logs.length === 0 && (
              <div className="p-8 text-center text-slate-500">
                No audit log entries found matching your filters.
              </div>
            )}
          </Card>

          {totalPages > 1 && (
            <div className="flex justify-center">
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                onPageChange={setPage}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

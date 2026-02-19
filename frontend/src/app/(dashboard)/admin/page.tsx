'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/stores/auth.store';
import { apiGet } from '@/lib/api/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { Users, Calendar, Flag, Zap } from 'lucide-react';

interface DashboardStats {
  totalUsers: number;
  totalEvents: number;
  totalTeams: number;
  activeMatches: number;
}

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

const statConfig = [
  { key: 'totalUsers', label: 'Total Pengguna', Icon: Users, color: 'from-blue-500 to-blue-700' },
  { key: 'totalEvents', label: 'Total Acara', Icon: Calendar, color: 'from-emerald-500 to-emerald-700' },
  { key: 'totalTeams', label: 'Total Tim', Icon: Flag, color: 'from-purple-500 to-purple-700' },
  { key: 'activeMatches', label: 'Pertandingan Aktif', Icon: Zap, color: 'from-orange-500 to-orange-700' },
] as const;

const quickLinks = [
  { label: 'Kelola Pengguna', href: '/admin/users' },
  { label: 'Kelola Olahraga', href: '/admin/sports' },
  { label: 'Lihat Log Audit', href: '/admin/audit-logs' },
];

export default function AdminDashboardPage() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDashboardData() {
      setLoading(true);
      setError(null);
      try {
        const [statsRes, logsRes] = await Promise.all([
          apiGet<DashboardStats>('/admin/dashboard-stats'),
          apiGet<{ data: AuditLogEntry[] }>('/admin/audit-logs?limit=5'),
        ]);
        setStats(statsRes);
        const logsData = Array.isArray(logsRes) ? logsRes : (logsRes.data ?? []);
        setAuditLogs(logsData as AuditLogEntry[]);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to load dashboard data';
        setError(message);
      } finally {
        setLoading(false);
      }
    }
    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-100">Dasbor Admin</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-100">Dasbor Admin</h1>
        <Card className="p-6">
          <p className="text-red-400">Error: {error}</p>
          <Button className="mt-4" onClick={() => window.location.reload()}>
            Coba Lagi
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-100">Dasbor Admin</h1>
        {user && (
          <p className="text-sm text-slate-400">
            Selamat datang kembali, {user.firstName ?? user.email}
          </p>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statConfig.map((stat) => {
          const value = stats?.[stat.key] ?? 0;
          const { Icon } = stat;
          return (
            <Card key={stat.key} className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">{stat.label}</p>
                  <p className="text-2xl font-bold text-slate-100 mt-1">{value}</p>
                </div>
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br ${stat.color}`}>
                  <Icon className="h-5 w-5 text-white" />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Quick Links */}
      <Card className="p-5">
        <h2 className="text-lg font-semibold text-slate-100 mb-3">Tautan Cepat</h2>
        <div className="flex flex-wrap gap-2">
          {quickLinks.map((link) => (
            <Link key={link.href} href={link.href}>
              <Button variant="outline" size="sm">{link.label}</Button>
            </Link>
          ))}
        </div>
      </Card>

      {/* Recent Audit Logs */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-slate-100">Log Audit Terbaru</h2>
          <Link href="/admin/audit-logs">
            <Button variant="ghost" size="sm">Lihat Semua</Button>
          </Link>
        </div>
        {auditLogs.length === 0 ? (
          <p className="text-slate-500 text-sm">Tidak ada log audit terbaru.</p>
        ) : (
          <div className="space-y-2">
            {auditLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between border-b border-white/5 pb-2 last:border-0"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{log.action}</Badge>
                    <span className="text-sm font-medium text-slate-200 truncate">
                      {log.entity} ({log.entityId})
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    by {log.userName ?? log.userId}
                  </p>
                </div>
                <span className="text-xs text-slate-500 whitespace-nowrap ml-4">
                  {new Date(log.timestamp).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

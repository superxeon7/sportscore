'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/stores/auth.store';
import { apiGet } from '@/lib/api/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';

interface Event {
  id: string;
  name: string;
  slug: string;
  sportId: string;
  sport?: { id: string; name: string; slug: string };
  status: string;
  startDate: string;
  endDate: string;
  location?: string;
  venue?: string;
  _count?: { tournaments: number; eventTeams: number };
}

interface EventStatusCount {
  status: string;
  count: number;
}

const statusColors: Record<string, string> = {
  DRAFT: 'bg-slate-700/60 text-slate-300',
  PUBLISHED: 'bg-blue-900/50 text-blue-400',
  ONGOING: 'bg-orange-900/50 text-orange-400',
  COMPLETED: 'bg-purple-900/50 text-purple-400',
  CANCELLED: 'bg-red-900/50 text-red-400',
};

export default function OrganizerDashboardPage() {
  const { user } = useAuthStore();
  const [events, setEvents] = useState<Event[]>([]);
  const [statusCounts, setStatusCounts] = useState<EventStatusCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const res = await apiGet<{ data: Event[] } | Event[]>('/events?limit=5&sort=createdAt&order=desc');
        const data = Array.isArray(res) ? res : res.data;
        setEvents(data);

        const allEventsRes = await apiGet<{ data: Event[] } | Event[]>('/events');
        const allEvents = Array.isArray(allEventsRes) ? allEventsRes : allEventsRes.data;
        const counts: Record<string, number> = {};
        allEvents.forEach((e) => {
          counts[e.status] = (counts[e.status] || 0) + 1;
        });
        setStatusCounts(
          Object.entries(counts).map(([status, count]) => ({ status, count }))
        );
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to load dashboard data';
        setError(message);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-100">Dasbor Penyelenggara</h1>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
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
        <h1 className="text-2xl font-bold text-slate-100">Dasbor Penyelenggara</h1>
        <Card className="p-6">
          <p className="text-red-400">Error: {error}</p>
          <Button className="mt-4" onClick={() => window.location.reload()}>
            Coba Lagi
          </Button>
        </Card>
      </div>
    );
  }

  const totalEvents = statusCounts.reduce((sum, sc) => sum + sc.count, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-100">Dasbor Penyelenggara</h1>
        {user && (
          <p className="text-sm text-slate-400">
            Selamat datang, {user.firstName ?? user.email}
          </p>
        )}
      </div>

      {/* Event Status Summary */}
      <Card className="p-5">
        <h2 className="text-lg font-semibold text-slate-100 mb-3">Ringkasan Acara Saya</h2>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-3xl font-bold text-slate-100">{totalEvents}</span>
          <span className="text-slate-400">total acara</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {statusCounts.map((sc) => (
            <Badge
              key={sc.status}
              className={statusColors[sc.status] || 'bg-slate-700/60 text-slate-300'}
            >
              {sc.status.replace(/_/g, ' ')}: {sc.count}
            </Badge>
          ))}
          {statusCounts.length === 0 && (
            <p className="text-sm text-slate-500">Belum ada acara.</p>
          )}
        </div>
      </Card>

      {/* Quick Actions */}
      <Card className="p-5">
        <h2 className="text-lg font-semibold text-slate-100 mb-3">Aksi Cepat</h2>
        <div className="flex flex-wrap gap-2">
          <Link href="/organizer/events/new">
            <Button>Buat Acara</Button>
          </Link>
          <Link href="/organizer/live-scoring">
            <Button variant="outline">Lihat Pertandingan Langsung</Button>
          </Link>
          <Link href="/organizer/events">
            <Button variant="outline">Semua Acara</Button>
          </Link>
        </div>
      </Card>

      {/* Recent Events */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-slate-100">Acara Terbaru</h2>
          <Link href="/organizer/events">
            <Button variant="ghost" size="sm">Lihat Semua</Button>
          </Link>
        </div>
        {events.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-slate-500 mb-4">Belum ada acara. Buat acara pertama Anda!</p>
            <Link href="/organizer/events/new">
              <Button>Buat Acara</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {events.map((event) => (
              <Link
                key={event.id}
                href={`/organizer/events/${event.id}`}
                className="block"
              >
                <div className="flex items-center justify-between p-3 rounded-lg border border-slate-700/40 hover:bg-white/5 hover:border-slate-600/60 transition-all">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-slate-100 truncate">{event.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      {event.sport?.name && (
                        <span className="text-xs text-emerald-400">{event.sport?.name}</span>
                      )}
                      <span className="text-xs text-slate-500">
                        {new Date(event.startDate).toLocaleDateString()} -{' '}
                        {new Date(event.endDate).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <Badge
                    className={statusColors[event.status] || 'bg-slate-700/60 text-slate-300'}
                  >
                    {event.status.replace(/_/g, ' ')}
                  </Badge>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

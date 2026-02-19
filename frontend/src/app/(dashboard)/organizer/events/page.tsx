'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiGet } from '@/lib/api/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  description?: string;
}

const statusColors: Record<string, string> = {
  DRAFT: 'bg-slate-700/60 text-slate-300',
  PUBLISHED: 'bg-blue-900/50 text-blue-400',
  ONGOING: 'bg-orange-900/50 text-orange-400',
  COMPLETED: 'bg-purple-900/50 text-purple-400',
  CANCELLED: 'bg-red-900/50 text-red-400',
};

export default function OrganizerEventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet<{ data: Event[] } | Event[]>('/events');
      const data = Array.isArray(res) ? res : res.data;
      setEvents(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load events';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-100">Acara Saya</h1>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-100">Acara Saya</h1>
        <Card className="p-6">
          <p className="text-red-400">Error: {error}</p>
          <Button className="mt-4" onClick={fetchEvents}>
            Coba Lagi
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-100">Acara Saya</h1>
        <div className="flex items-center gap-3">
          <div className="flex border border-slate-600/60 rounded-lg overflow-hidden">
            <button
              className={`px-3 py-1.5 text-sm transition-colors ${viewMode === 'grid'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-transparent text-slate-400 hover:bg-white/5 hover:text-slate-200'
                }`}
              onClick={() => setViewMode('grid')}
            >
              Kotak
            </button>
            <button
              className={`px-3 py-1.5 text-sm transition-colors ${viewMode === 'list'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-transparent text-slate-400 hover:bg-white/5 hover:text-slate-200'
                }`}
              onClick={() => setViewMode('list')}
            >
              Daftar
            </button>
          </div>
          <Link href="/organizer/events/new">
            <Button>Buat Acara</Button>
          </Link>
        </div>
      </div>

      {events.length === 0 ? (
        <Card className="p-12 text-center">
          <h3 className="text-lg font-medium text-slate-300 mb-2">
            Belum ada acara
          </h3>
          <p className="text-slate-500 mb-6">
            Buat acara pertama Anda untuk memulai.
          </p>
          <Link href="/organizer/events/new">
            <Button>Buat Acara</Button>
          </Link>
        </Card>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {events.map((event) => (
            <Card key={event.id} hoverable className="p-6 flex flex-col">
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-semibold text-lg text-slate-100 truncate flex-1">
                  {event.name}
                </h3>
                <Badge
                  className={`ml-2 shrink-0 ${statusColors[event.status] || 'bg-slate-700/60 text-slate-300'
                    }`}
                >
                  {event.status.replace(/_/g, ' ')}
                </Badge>
              </div>

              {event.sport?.name && (
                <p className="text-sm text-emerald-400 font-medium mb-2">
                  {event.sport?.name}
                </p>
              )}

              <div className="text-sm text-slate-400 space-y-1 mb-4 flex-1">
                <p>
                  {new Date(event.startDate).toLocaleDateString()} -{' '}
                  {new Date(event.endDate).toLocaleDateString()}
                </p>
                {event.location && <p className="text-slate-500">{event.location}</p>}
                {event.venue && <p className="text-slate-500">{event.venue}</p>}
                {event._count?.eventTeams !== undefined && (
                  <p className="text-slate-500">{event._count?.eventTeams} tim</p>
                )}
              </div>

              <div className="flex gap-2">
                <Link href={`/organizer/events/${event.id}`} className="flex-1">
                  <Button variant="outline" size="sm" className="w-full">
                    Lihat
                  </Button>
                </Link>
                <Link href={`/organizer/events/${event.id}`} className="flex-1">
                  <Button size="sm" className="w-full">
                    Kelola
                  </Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((event) => (
            <Card key={event.id} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-slate-100 truncate">{event.name}</h3>
                    <Badge
                      className={
                        statusColors[event.status] ||
                        'bg-slate-700/60 text-slate-300'
                      }
                    >
                      {event.status.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-sm text-slate-500">
                    {event.sport?.name && <span className="text-emerald-400">{event.sport?.name}</span>}
                    <span>
                      {new Date(event.startDate).toLocaleDateString()} -{' '}
                      {new Date(event.endDate).toLocaleDateString()}
                    </span>
                    {event._count?.eventTeams !== undefined && (
                      <span>{event._count?.eventTeams} tim</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 ml-4">
                  <Link href={`/organizer/events/${event.id}`}>
                    <Button variant="outline" size="sm">
                      Ubah
                    </Button>
                  </Link>
                  <Link href={`/organizer/events/${event.id}`}>
                    <Button size="sm">Kelola</Button>
                  </Link>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

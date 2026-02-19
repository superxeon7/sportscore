'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiGet } from '@/lib/api/client';
import { Event, Sport, EventStatus } from '@/lib/types';
import EventCard from '@/components/event-card';
import { Search, SlidersHorizontal } from 'lucide-react';

const STATUS_OPTIONS: { label: string; value: string }[] = [
  { label: 'All Statuses', value: '' },
  { label: 'Published', value: EventStatus.PUBLISHED },
  { label: 'Ongoing', value: EventStatus.ONGOING },
  { label: 'Completed', value: EventStatus.COMPLETED },
];

const PAGE_SIZE = 12;

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [sports, setSports] = useState<Sport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalPages, setTotalPages] = useState(1);

  // Filters
  const [search, setSearch] = useState('');
  const [sportFilter, setSportFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  // Fetch sports for filter dropdown
  useEffect(() => {
    async function fetchSports() {
      try {
        const response = await apiGet<any>('/sports');
        setSports(Array.isArray(response) ? response : (response?.data || []));
      } catch {
        // Silently fail - sports filter just won't work
      }
    }
    fetchSports();
  }, []);

  // Fetch events
  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (sportFilter) params.append('sportId', sportFilter);
      if (statusFilter) params.append('status', statusFilter);
      params.append('page', String(page));
      params.append('limit', String(PAGE_SIZE));

      const response = await apiGet<any>(`/events/public?${params.toString()}`);
      const data = Array.isArray(response) ? response : (response?.data || []);
      setEvents(data);
      setTotalPages(response?.meta?.totalPages || 1);
    } catch {
      setError('Failed to load events. Please try again.');
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [search, sportFilter, statusFilter, page]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [search, sportFilter, statusFilter]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-white tracking-tight">Events</h1>
        <p className="mt-2 text-slate-400">Browse and discover sports events</p>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-8">
        {/* Search */}
        <div className="flex-1 relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search events..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-dark pl-10"
          />
        </div>

        {/* Sport Filter */}
        <div className="sm:w-48">
          <select
            value={sportFilter}
            onChange={(e) => setSportFilter(e.target.value)}
            className="select-dark"
          >
            <option value="">All Sports</option>
            {sports.map((sport) => (
              <option key={sport.id} value={sport.id}>
                {sport.name}
              </option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div className="sm:w-48">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="select-dark"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
          <p className="text-red-400 text-sm">{error}</p>
          <button
            onClick={fetchEvents}
            className="mt-2 text-sm font-semibold text-red-400 hover:text-red-300 underline underline-offset-2"
          >
            Try again
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-56 rounded-xl bg-white/[0.03] border border-white/[0.06] animate-skeleton-shimmer bg-gradient-to-r from-white/[0.03] via-white/[0.06] to-white/[0.03] bg-[length:200%_100%]"
            />
          ))}
        </div>
      ) : events.length > 0 ? (
        <>
          {/* Events Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {events.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-12">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2.5 rounded-xl border border-white/[0.08] text-sm font-semibold text-slate-400 hover:bg-white/[0.06] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                Previous
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(
                    (p) =>
                      p === 1 ||
                      p === totalPages ||
                      Math.abs(p - page) <= 1
                  )
                  .reduce<(number | string)[]>((acc, p, idx, arr) => {
                    if (idx > 0 && p - (arr[idx - 1] as number) > 1) {
                      acc.push('...');
                    }
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((item, idx) =>
                    item === '...' ? (
                      <span key={`ellipsis-${idx}`} className="px-2 text-slate-600">
                        ...
                      </span>
                    ) : (
                      <button
                        key={item}
                        onClick={() => setPage(item as number)}
                        className={`w-10 h-10 rounded-xl text-sm font-bold transition-all ${page === item
                          ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'
                          : 'text-slate-400 hover:bg-white/[0.06] hover:text-white'
                          }`}
                      >
                        {item}
                      </button>
                    )
                  )}
              </div>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-4 py-2.5 rounded-xl border border-white/[0.08] text-sm font-semibold text-slate-400 hover:bg-white/[0.06] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                Next
              </button>
            </div>
          )}
        </>
      ) : (
        /* Empty State */
        <div className="text-center py-20 glass-card">
          <svg
            className="mx-auto h-12 w-12 text-slate-600 mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            />
          </svg>
          <h3 className="text-lg font-bold text-white mb-1">No events found</h3>
          <p className="text-slate-400">Try adjusting your search or filter criteria.</p>
        </div>
      )}
    </div>
  );
}

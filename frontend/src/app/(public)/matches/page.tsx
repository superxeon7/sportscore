'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiGet } from '@/lib/api/client';
import { Match, MatchStatus } from '@/lib/types';
import MatchCard from '@/components/match-card';
import { Filter, X } from 'lucide-react';

const STATUS_OPTIONS: { label: string; value: string }[] = [
  { label: 'All Statuses', value: '' },
  { label: 'Live', value: MatchStatus.LIVE },
  { label: 'Scheduled', value: MatchStatus.SCHEDULED },
  { label: 'Completed', value: MatchStatus.COMPLETED },
  { label: 'Postponed', value: MatchStatus.POSTPONED },
];

const PAGE_SIZE = 20;

function formatGroupDate(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';

  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function getMatchDateKey(match: Match): string {
  const dateStr = match.scheduledAt;
  if (!dateStr) return 'Unscheduled';
  const date = new Date(dateStr);
  return date.toISOString().split('T')[0]; // YYYY-MM-DD
}

export default function MatchesPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalPages, setTotalPages] = useState(1);

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);

  const fetchMatches = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      if (dateFrom) params.append('dateFrom', dateFrom);
      if (dateTo) params.append('dateTo', dateTo);
      params.append('page', String(page));
      params.append('limit', String(PAGE_SIZE));

      const response = await apiGet<any>(`/matches/public?${params.toString()}`);
      const data = Array.isArray(response) ? response : (response?.data || []);
      setMatches(data);
      setTotalPages(response?.meta?.totalPages || 1);
    } catch {
      setError('Failed to load matches. Please try again.');
      setMatches([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, dateFrom, dateTo, page]);

  useEffect(() => {
    fetchMatches();
  }, [fetchMatches]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, dateFrom, dateTo]);

  // Group matches by date
  const matchesByDate = matches.reduce<Record<string, Match[]>>((acc, match) => {
    const dateKey = getMatchDateKey(match);
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(match);
    return acc;
  }, {});

  // Sort date groups (most recent first for completed, soonest first otherwise)
  const sortedDateKeys = Object.keys(matchesByDate).sort((a, b) => {
    if (a === 'Unscheduled') return 1;
    if (b === 'Unscheduled') return -1;
    return a.localeCompare(b);
  });

  const hasFilters = statusFilter || dateFrom || dateTo;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-white tracking-tight">Matches</h1>
        <p className="mt-2 text-slate-400">Browse and follow matches across all sports</p>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-8">
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

        {/* Date From */}
        <div className="sm:w-48">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            placeholder="From date"
            className="input-dark"
          />
        </div>

        {/* Date To */}
        <div className="sm:w-48">
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            placeholder="To date"
            className="input-dark"
          />
        </div>

        {/* Clear Filters */}
        {hasFilters && (
          <button
            onClick={() => {
              setStatusFilter('');
              setDateFrom('');
              setDateTo('');
            }}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-400 hover:text-emerald-300 transition-colors self-center"
          >
            <X className="h-3.5 w-3.5" />
            Clear filters
          </button>
        )}
      </div>

      {/* Error State */}
      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
          <p className="text-red-400 text-sm">{error}</p>
          <button
            onClick={fetchMatches}
            className="mt-2 text-sm font-semibold text-red-400 hover:text-red-300 underline underline-offset-2"
          >
            Try again
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="space-y-8">
          {[1, 2].map((group) => (
            <div key={group}>
              <div className="h-6 w-40 bg-white/[0.03] rounded mb-4 animate-pulse" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-36 rounded-xl bg-white/[0.03] border border-white/[0.06] animate-skeleton-shimmer bg-gradient-to-r from-white/[0.03] via-white/[0.06] to-white/[0.03] bg-[length:200%_100%]"
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : sortedDateKeys.length > 0 ? (
        <>
          {/* Matches Grouped by Date */}
          <div className="space-y-10">
            {sortedDateKeys.map((dateKey) => (
              <div key={dateKey}>
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-3">
                  <span className="w-1 h-6 bg-emerald-500 rounded-full" />
                  {dateKey === 'Unscheduled' ? (
                    'Unscheduled'
                  ) : (
                    formatGroupDate(dateKey)
                  )}
                  <span className="text-sm font-medium text-slate-500">
                    ({matchesByDate[dateKey].length} {matchesByDate[dateKey].length === 1 ? 'match' : 'matches'})
                  </span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {matchesByDate[dateKey].map((match) => (
                    <MatchCard key={match.id} match={match} />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-12">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2.5 rounded-xl border border-white/[0.08] text-sm font-semibold text-slate-400 hover:bg-white/[0.06] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                Previous
              </button>
              <span className="text-sm font-medium text-slate-500">
                Page {page} of {totalPages}
              </span>
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
              d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
          <h3 className="text-lg font-bold text-white mb-1">No matches available</h3>
          <p className="text-slate-400">Try adjusting your filters or check back later.</p>
        </div>
      )}
    </div>
  );
}

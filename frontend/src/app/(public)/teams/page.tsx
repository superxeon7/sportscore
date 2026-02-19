'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { apiGet } from '@/lib/api/client';
import { Team } from '@/lib/types';
import InitialsAvatar from '@/components/ui/initials-avatar';
import { Search } from 'lucide-react';

const PAGE_SIZE = 12;

// Deterministic color based on team name
function getTeamColor(name: string): string {
  const colors = [
    'bg-red-500/15 text-red-400 border-red-500/20',
    'bg-blue-500/15 text-blue-400 border-blue-500/20',
    'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
    'bg-purple-500/15 text-purple-400 border-purple-500/20',
    'bg-amber-500/15 text-amber-400 border-amber-500/20',
    'bg-pink-500/15 text-pink-400 border-pink-500/20',
    'bg-indigo-500/15 text-indigo-400 border-indigo-500/20',
    'bg-teal-500/15 text-teal-400 border-teal-500/20',
    'bg-orange-500/15 text-orange-400 border-orange-500/20',
    'bg-cyan-500/15 text-cyan-400 border-cyan-500/20',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchTeams = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      params.append('page', String(page));
      params.append('limit', String(PAGE_SIZE));

      const response = await apiGet<any>(`/teams?${params.toString()}`);
      const data = Array.isArray(response) ? response : (response?.data || []);
      setTeams(data);
      setTotalPages(response?.meta?.totalPages || 1);
    } catch {
      setError('Failed to load teams. Please try again.');
      setTeams([]);
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-white tracking-tight">Teams</h1>
        <p className="mt-2 text-slate-400">Explore teams across all sports</p>
      </div>

      {/* Search Bar */}
      <div className="mb-8 relative max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
        <input
          type="text"
          placeholder="Search teams..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-dark pl-10"
        />
      </div>

      {/* Error State */}
      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
          <p className="text-red-400 text-sm">{error}</p>
          <button
            onClick={fetchTeams}
            className="mt-2 text-sm font-semibold text-red-400 hover:text-red-300 underline underline-offset-2"
          >
            Try again
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-44 rounded-xl bg-white/[0.03] border border-white/[0.06] animate-skeleton-shimmer bg-gradient-to-r from-white/[0.03] via-white/[0.06] to-white/[0.03] bg-[length:200%_100%]"
            />
          ))}
        </div>
      ) : teams.length > 0 ? (
        <>
          {/* Teams Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {teams.map((team) => {
              const colorClasses = getTeamColor(team.name || '');
              const initials = (team.shortName || team.name || '??')
                .substring(0, 2)
                .toUpperCase();

              return (
                <Link
                  key={team.id}
                  href={`/teams/${team.slug || team.id}`}
                  className="group glass-card p-6 text-center hover:scale-[1.03] transition-all duration-200"
                >
                  {/* Team Logo */}
                  <div className="flex justify-center mb-4">
                    <InitialsAvatar
                      name={team.shortName || team.name || '??'}
                      imageUrl={team.logoUrl}
                      size="xl"
                      className="group-hover:scale-110 transition-transform"
                    />
                  </div>

                  {/* Team Name */}
                  <h3 className="font-bold text-white group-hover:text-emerald-400 transition-colors">
                    {team.name}
                  </h3>

                  {/* Short Name */}
                  {team.shortName && (
                    <p className="text-xs text-slate-500 mt-0.5 font-medium">{team.shortName}</p>
                  )}

                  {/* Location */}
                  <div className="mt-2 text-sm text-slate-400">
                    {team.city && team.country
                      ? `${team.city}, ${team.country}`
                      : team.city || team.country || ''}
                  </div>
                </Link>
              );
            })}
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
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
          <h3 className="text-lg font-bold text-white mb-1">No teams found</h3>
          <p className="text-slate-400">Try adjusting your search criteria.</p>
        </div>
      )}
    </div>
  );
}

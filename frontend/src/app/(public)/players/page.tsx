'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { apiGet } from '@/lib/api/client';
import {
  Search, X, User, Shield, ChevronLeft, ChevronRight,
  Users, SlidersHorizontal, Flag,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────

interface PlayerItem {
  id: string;
  fullName: string;
  jerseyNumber: number | null;
  position: string | null;
  nationality: string | null;
  photoUrl: string | null;
  team: {
    id: string;
    name: string;
    shortName: string | null;
    slug: string;
    logoUrl: string | null;
  };
  division: { id: string; name: string } | null;
}

interface Meta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ─── Helpers ─────────────────────────────────────────────

const POSITIONS = [
  'Semua Posisi',
  'Kiper',
  'Bek',
  'Gelandang',
  'Penyerang',
  'Pivot',
  'Flank',
  'Anchor',
];

function getPositionColor(pos?: string | null): string {
  if (!pos) return 'bg-slate-500/15 text-slate-400 border-slate-500/20';
  const p = pos.toLowerCase();
  if (p.includes('goal') || p.includes('kiper') || p.includes('gk')) return 'bg-amber-500/15 text-amber-400 border-amber-500/20';
  if (p.includes('defend') || p.includes('back') || p.includes('bek') || p.includes('anchor')) return 'bg-blue-500/15 text-blue-400 border-blue-500/20';
  if (p.includes('mid') || p.includes('flank') || p.includes('gelandang')) return 'bg-purple-500/15 text-purple-400 border-purple-500/20';
  if (p.includes('forw') || p.includes('pivot') || p.includes('striker') || p.includes('penyerang')) return 'bg-red-500/15 text-red-400 border-red-500/20';
  return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20';
}

// ─── Skeleton ─────────────────────────────────────────────

function PlayerCardSkeleton() {
  return (
    <div className="glass-card p-4 animate-pulse">
      <div className="flex flex-col items-center text-center">
        <div className="w-20 h-20 rounded-2xl bg-white/[0.05] mb-3" />
        <div className="h-4 w-28 bg-white/[0.05] rounded mb-1.5" />
        <div className="h-3 w-20 bg-white/[0.04] rounded mb-2" />
        <div className="h-5 w-16 bg-white/[0.04] rounded" />
      </div>
    </div>
  );
}

// ─── Player Card ─────────────────────────────────────────

function PlayerCard({ player }: { player: PlayerItem }) {
  return (
    <Link
      href={`/player/${player.id}`}
      className="glass-card p-4 flex flex-col items-center text-center group hover:border-emerald-500/25 hover:shadow-[0_0_20px_rgba(16,185,129,0.07)] transition-all duration-200"
    >
      {/* Photo */}
      <div className="relative mb-3">
        <div className="w-20 h-20 rounded-2xl overflow-hidden bg-[#0c1222] border border-white/[0.07] group-hover:border-emerald-500/30 transition-colors">
          {player.photoUrl ? (
            <Image
              src={player.photoUrl}
              alt={player.fullName}
              width={80}
              height={80}
              className="w-full h-full object-cover"
              unoptimized
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-emerald-500/5">
              <User className="w-8 h-8 text-slate-600" />
            </div>
          )}
        </div>
        {/* Jersey number badge */}
        {player.jerseyNumber != null && (
          <div className="absolute -top-2 -right-2 w-7 h-7 rounded-lg bg-emerald-500 flex items-center justify-center shadow-md shadow-emerald-900/40">
            <span className="text-[11px] font-black text-white">{player.jerseyNumber}</span>
          </div>
        )}
      </div>

      {/* Name */}
      <p className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors leading-tight truncate w-full">
        {player.fullName}
      </p>

      {/* Team */}
      <div className="flex items-center gap-1.5 mt-1 min-w-0 max-w-full">
        {player.team.logoUrl ? (
          <Image
            src={player.team.logoUrl}
            alt={player.team.name}
            width={14}
            height={14}
            className="w-3.5 h-3.5 rounded-sm object-contain flex-shrink-0"
            unoptimized
          />
        ) : (
          <Shield className="w-3 h-3 text-slate-600 flex-shrink-0" />
        )}
        <span className="text-[11px] text-slate-500 truncate">
          {player.team.shortName || player.team.name}
        </span>
      </div>

      {/* Position + Division */}
      <div className="flex items-center gap-1.5 mt-2.5 flex-wrap justify-center">
        {player.position && (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border ${getPositionColor(player.position)}`}>
            {player.position}
          </span>
        )}
        {player.division && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border bg-white/[0.04] border-white/[0.08] text-slate-500">
            {player.division.name}
          </span>
        )}
      </div>

      {/* Nationality */}
      {player.nationality && (
        <div className="flex items-center gap-1 mt-2">
          <Flag className="w-3 h-3 text-slate-600" />
          <span className="text-[10px] text-slate-600">{player.nationality}</span>
        </div>
      )}
    </Link>
  );
}

// ─── Main Page ───────────────────────────────────────────

export default function PlayersPage() {
  const [players, setPlayers] = useState<PlayerItem[]>([]);
  const [meta, setMeta] = useState<Meta>({ total: 0, page: 1, limit: 24, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [position, setPosition] = useState('');
  const [page, setPage] = useState(1);
  const [filterOpen, setFilterOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchPlayers = useCallback(async (q: string, pos: string, pg: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set('search', q);
      if (pos) params.set('position', pos);
      params.set('page', String(pg));
      params.set('limit', '24');

      const res = await apiGet<{ data: PlayerItem[]; meta: Meta }>(`/players?${params.toString()}`);
      setPlayers(res.data ?? []);
      setMeta(res.meta ?? { total: 0, page: pg, limit: 24, totalPages: 0 });
    } catch {
      setPlayers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchPlayers('', '', 1);
  }, [fetchPlayers]);

  // Debounced search
  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchPlayers(value, position, 1);
    }, 350);
  };

  const handlePositionChange = (pos: string) => {
    const val = pos === 'Semua Posisi' ? '' : pos;
    setPosition(val);
    setPage(1);
    setFilterOpen(false);
    fetchPlayers(search, val, 1);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    fetchPlayers(search, position, newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const clearSearch = () => {
    setSearch('');
    setPage(1);
    fetchPlayers('', position, 1);
  };

  const activePosition = position || 'Semua Posisi';

  return (
    <div className="min-h-screen pb-16">

      {/* ── HERO ── */}
      <section className="relative overflow-hidden border-b border-white/[0.06]">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-950/25 via-transparent to-blue-950/15" />
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Users className="w-5 h-5 text-emerald-400" />
            </div>
            <h1 className="text-3xl font-black text-white tracking-tight">Direktori Pemain</h1>
          </div>
          <p className="text-slate-400 text-sm ml-[52px]">
            {meta.total > 0 ? `${meta.total.toLocaleString('id-ID')} pemain terdaftar` : 'Temukan pemain dari semua tim'}
          </p>
        </div>
      </section>

      {/* ── SEARCH + FILTER BAR ── */}
      <div className="sticky top-0 z-20 border-b border-white/[0.06] bg-[#070c1a]/85 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Cari nama pemain, kebangsaan..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="input-dark w-full pl-9 pr-9 text-sm py-2.5"
            />
            {search && (
              <button
                onClick={clearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Position filter */}
          <div className="relative">
            <button
              onClick={() => setFilterOpen((v) => !v)}
              className={`inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border text-sm font-semibold transition-all ${
                position
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-white/[0.04] border-white/[0.08] text-slate-400 hover:text-white hover:bg-white/[0.07]'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span className="hidden sm:inline">{activePosition}</span>
            </button>

            {filterOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setFilterOpen(false)} />
                <div className="absolute right-0 top-full mt-1.5 w-48 rounded-xl bg-[#0d1628] border border-white/[0.1] shadow-2xl z-20 overflow-hidden py-1">
                  {POSITIONS.map((p) => (
                    <button
                      key={p}
                      onClick={() => handlePositionChange(p)}
                      className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold transition-colors text-left ${
                        activePosition === p
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : 'text-slate-300 hover:bg-white/[0.05]'
                      }`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${activePosition === p ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                      {p}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Result count (desktop) */}
          {!loading && meta.total > 0 && (
            <span className="hidden sm:block text-xs text-slate-500 ml-auto whitespace-nowrap">
              {meta.total} pemain
            </span>
          )}
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

        {/* Loading skeleton */}
        {loading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {Array.from({ length: 24 }).map((_, i) => (
              <PlayerCardSkeleton key={i} />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && players.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-4">
              <Users className="w-8 h-8 text-slate-600" />
            </div>
            <h3 className="text-base font-bold text-white mb-1">Tidak Ada Pemain</h3>
            <p className="text-sm text-slate-500">
              {search || position ? 'Coba ubah filter pencarian.' : 'Belum ada pemain terdaftar.'}
            </p>
            {(search || position) && (
              <button
                onClick={() => { clearSearch(); handlePositionChange('Semua Posisi'); }}
                className="mt-4 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-semibold hover:bg-emerald-500/20 transition-colors"
              >
                Reset Filter
              </button>
            )}
          </div>
        )}

        {/* Player grid */}
        {!loading && players.length > 0 && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {players.map((player) => (
                <PlayerCard key={player.id} player={player} />
              ))}
            </div>

            {/* Pagination */}
            {meta.totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-10">
                <button
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page <= 1}
                  className="p-2 rounded-xl bg-white/[0.04] border border-white/[0.07] text-slate-400 hover:text-white hover:bg-white/[0.08] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {/* Page numbers */}
                {Array.from({ length: Math.min(meta.totalPages, 7) }).map((_, i) => {
                  let pageNum: number;
                  const total = meta.totalPages;
                  if (total <= 7) {
                    pageNum = i + 1;
                  } else if (page <= 4) {
                    pageNum = i + 1;
                  } else if (page >= total - 3) {
                    pageNum = total - 6 + i;
                  } else {
                    pageNum = page - 3 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => handlePageChange(pageNum)}
                      className={`w-9 h-9 rounded-xl text-sm font-bold transition-all border ${
                        pageNum === page
                          ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                          : 'bg-white/[0.04] border-white/[0.07] text-slate-400 hover:text-white hover:bg-white/[0.08]'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}

                <button
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page >= meta.totalPages}
                  className="p-2 rounded-xl bg-white/[0.04] border border-white/[0.07] text-slate-400 hover:text-white hover:bg-white/[0.08] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Page info */}
            {meta.totalPages > 1 && (
              <p className="text-center text-[11px] text-slate-600 mt-3">
                Halaman {page} dari {meta.totalPages} · {meta.total} pemain
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

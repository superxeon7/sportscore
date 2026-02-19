'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { apiGet } from '@/lib/api/client';
import {
  Match,
  MatchStatus,
  Standing,
  TournamentType,
  EventStatus,
} from '@/lib/types';
import MatchCard from '@/components/match-card';
import StandingsTable from '@/components/standings-table';
import BracketView from '@/components/tournament/bracket-view';
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Trophy,
  Users,
  Target,
  Zap,
  Clock,
  Star,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────

interface TournamentEvent {
  id: string;
  name: string;
  slug: string;
  location?: string;
  venue?: string;
  startDate?: string;
  endDate?: string;
  status?: EventStatus;
  bannerUrl?: string;
  sport?: { id: string; name: string; slug: string; icon?: string };
}

interface TournamentData {
  id: string;
  name: string;
  type: TournamentType;
  status: string;
  config: any;
  eventId: string;
  event: TournamentEvent;
  matches: Match[];
  standings: Standing[];
}

interface TopScorer {
  rank: number;
  goals: number;
  player: {
    id: string;
    fullName: string;
    jerseyNumber?: number;
    position?: string;
    photoUrl?: string;
    team?: { id: string; name: string; shortName?: string; logoUrl?: string };
  } | null;
}

interface TournamentSummary {
  totalTeams: number;
  totalMatches: number;
  completedMatches: number;
  totalGoals: number;
  topScorer: { player: any; goals: number } | null;
  nextMatch: Match | null;
}

// ─── Helpers ────────────────────────────────────────────────────────

function formatDate(dateStr?: string) {
  if (!dateStr) return 'TBD';
  return new Date(dateStr).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatDateShort(dateStr?: string) {
  if (!dateStr) return 'TBD';
  return new Date(dateStr).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
  });
}

function getEventStatusBadge(status?: EventStatus) {
  if (!status) return null;
  const styles: Record<string, string> = {
    [EventStatus.DRAFT]: 'bg-slate-500/15 text-slate-400 border-slate-500/20',
    [EventStatus.PUBLISHED]: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
    [EventStatus.ONGOING]:
      'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
    [EventStatus.COMPLETED]:
      'bg-slate-500/15 text-slate-400 border-slate-500/20',
    [EventStatus.CANCELLED]: 'bg-red-500/15 text-red-400 border-red-500/20',
  };
  const labels: Record<string, string> = {
    [EventStatus.DRAFT]: 'Draf',
    [EventStatus.PUBLISHED]: 'Dipublikasikan',
    [EventStatus.ONGOING]: 'Berlangsung',
    [EventStatus.COMPLETED]: 'Selesai',
    [EventStatus.CANCELLED]: 'Dibatalkan',
  };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${styles[status] || 'bg-slate-500/15 text-slate-400 border-slate-500/20'}`}
    >
      {labels[status] || status}
    </span>
  );
}

function getTournamentTypeBadge(type: TournamentType) {
  const labels: Record<string, string> = {
    [TournamentType.LEAGUE]: 'Liga',
    [TournamentType.KNOCKOUT]: 'Gugur',
    [TournamentType.GROUP_KNOCKOUT]: 'Grup + Gugur',
    [TournamentType.CUSTOM]: 'Kustom',
  };
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/15 text-purple-400 border border-purple-500/20">
      {labels[type] || type}
    </span>
  );
}

// ─── Component ──────────────────────────────────────────────────────

export default function TournamentPage() {
  const params = useParams();
  const id = params.id as string;

  const [tournament, setTournament] = useState<TournamentData | null>(null);
  const [topScorers, setTopScorers] = useState<TopScorer[]>([]);
  const [summary, setSummary] = useState<TournamentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAllCompleted, setShowAllCompleted] = useState(false);

  useEffect(() => {
    if (!id) return;

    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const [tournamentRes, topScorersRes, summaryRes] =
          await Promise.allSettled([
            apiGet<TournamentData>(`/tournaments/${id}/public`),
            apiGet<TopScorer[]>(
              `/statistics/tournaments/${id}/top-scorers?limit=10`,
            ),
            apiGet<TournamentSummary>(
              `/statistics/tournaments/${id}/summary`,
            ),
          ]);

        if (tournamentRes.status === 'fulfilled') {
          const data = tournamentRes.value as any;
          setTournament(data?.data || data);
        } else {
          throw new Error('Tournament not found');
        }

        if (topScorersRes.status === 'fulfilled') {
          const data = topScorersRes.value as any;
          setTopScorers(Array.isArray(data) ? data : data?.data || []);
        }

        if (summaryRes.status === 'fulfilled') {
          const data = summaryRes.value as any;
          setSummary(data?.data || data);
        }
      } catch {
        setError(
          'Gagal memuat turnamen. Turnamen mungkin tidak ada atau terjadi kesalahan jaringan.',
        );
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [id]);

  // ─── Loading State ──────────────────────────────────────────────

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="animate-pulse space-y-8">
          {/* Hero skeleton */}
          <div className="h-52 bg-white/[0.03] rounded-xl border border-white/[0.06]" />
          {/* Stats strip skeleton */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-24 bg-white/[0.03] rounded-xl border border-white/[0.06]"
              />
            ))}
          </div>
          {/* Content skeleton */}
          <div className="h-64 bg-white/[0.03] rounded-xl border border-white/[0.06]" />
          <div className="h-48 bg-white/[0.03] rounded-xl border border-white/[0.06]" />
        </div>
      </div>
    );
  }

  // ─── Error State ────────────────────────────────────────────────

  if (error || !tournament) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 text-center">
        <Trophy className="mx-auto h-12 w-12 text-slate-600 mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">
          Turnamen Tidak Ditemukan
        </h2>
        <p className="text-slate-400 mb-6">
          {error || 'Turnamen yang Anda cari tidak ditemukan.'}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center px-5 py-2.5 rounded-xl bg-emerald-500 text-white font-semibold hover:bg-emerald-400 transition-colors mr-3"
        >
          Coba Lagi
        </button>
        <Link
          href="/events"
          className="inline-flex items-center px-5 py-2.5 rounded-xl bg-white/[0.06] text-slate-300 font-semibold hover:bg-white/[0.1] transition-colors"
        >
          Kembali ke Acara
        </Link>
      </div>
    );
  }

  // ─── Data Derivations ──────────────────────────────────────────

  const { event, matches = [], standings = [] } = tournament;
  const hasLeaguePhase =
    tournament.type === TournamentType.LEAGUE ||
    tournament.type === TournamentType.GROUP_KNOCKOUT;
  const hasKnockoutPhase =
    tournament.type === TournamentType.KNOCKOUT ||
    tournament.type === TournamentType.GROUP_KNOCKOUT;

  // Group standings by group for GROUP_KNOCKOUT
  const standingsByGroup: Record<string, Standing[]> = {};
  if (hasLeaguePhase && standings.length > 0) {
    for (const s of standings) {
      const group = s.group || 'default';
      if (!standingsByGroup[group]) standingsByGroup[group] = [];
      standingsByGroup[group].push(s);
    }
  }
  const groupKeys = Object.keys(standingsByGroup).sort();

  // Knockout matches: for GROUP_KNOCKOUT, filter to matches that have round but no matchDay
  const knockoutMatches = hasKnockoutPhase
    ? tournament.type === TournamentType.GROUP_KNOCKOUT
      ? matches.filter((m) => (m.round ?? 0) > 0 && !m.matchDay)
      : matches
    : [];

  // Categorize matches by status
  const liveMatches = matches.filter((m) => m.status === MatchStatus.LIVE);
  const scheduledMatches = matches.filter(
    (m) => m.status === MatchStatus.SCHEDULED,
  );
  const completedMatches = matches
    .filter((m) => m.status === MatchStatus.COMPLETED)
    .reverse(); // Most recent first
  const visibleCompleted = showAllCompleted
    ? completedMatches
    : completedMatches.slice(0, 10);

  return (
    <div className="min-h-screen">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-8 py-8">
        {/* ─── Section 1: Hero Tournament Header ─────────────────── */}
        <section className="relative overflow-hidden glass-card p-0">
          <div className="hero-mesh absolute inset-0" />
          <div className="pattern-dots absolute inset-0" />
          <div className="relative p-6 sm:p-8">
            {/* Back link */}
            {event.slug && (
              <Link
                href={`/events/${event.slug}`}
                className="inline-flex items-center text-slate-400 hover:text-white text-sm mb-5 transition-colors gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                {event.name}
              </Link>
            )}

            {/* Badges */}
            <div className="flex flex-wrap items-center gap-2 mb-3">
              {event.sport && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {event.sport.icon && (
                    <span>{event.sport.icon}</span>
                  )}
                  {event.sport.name}
                </span>
              )}
              {getTournamentTypeBadge(tournament.type)}
              {getEventStatusBadge(event.status)}
            </div>

            {/* Tournament Name */}
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-white mb-4">
              {tournament.name}
            </h1>

            {/* Meta Info */}
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-400">
              {(event.location || event.venue) && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-slate-500" />
                  <span>
                    {[event.venue, event.location].filter(Boolean).join(', ')}
                  </span>
                </div>
              )}
              {event.startDate && (
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-500" />
                  <span>
                    {formatDate(event.startDate)}
                    {event.endDate &&
                      event.endDate !== event.startDate &&
                      ` - ${formatDate(event.endDate)}`}
                  </span>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ─── Section 2: Quick Stats Strip ──────────────────────── */}
        {summary && (
          <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 animate-slide-up">
            <div className="glass-card p-4 text-center">
              <Users className="w-5 h-5 text-emerald-400 mx-auto mb-2" />
              <div className="text-2xl font-extrabold text-white">
                {summary.totalTeams}
              </div>
              <div className="text-xs text-slate-400 mt-1">Tim</div>
            </div>
            <div className="glass-card p-4 text-center">
              <Target className="w-5 h-5 text-blue-400 mx-auto mb-2" />
              <div className="text-2xl font-extrabold text-white">
                {summary.totalMatches}
              </div>
              <div className="text-xs text-slate-400 mt-1">Pertandingan</div>
            </div>
            <div className="glass-card p-4 text-center">
              <Zap className="w-5 h-5 text-amber-400 mx-auto mb-2" />
              <div className="text-2xl font-extrabold text-white">
                {summary.totalGoals}
              </div>
              <div className="text-xs text-slate-400 mt-1">Total Gol</div>
            </div>
            {summary.topScorer ? (
              <div className="glass-card p-4 text-center">
                <Star className="w-5 h-5 text-yellow-400 mx-auto mb-2" />
                <div className="text-lg font-extrabold text-white truncate">
                  {summary.topScorer.player?.fullName || '-'}
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  Top Skor ({summary.topScorer.goals} gol)
                </div>
              </div>
            ) : (
              <div className="glass-card p-4 text-center">
                <Star className="w-5 h-5 text-slate-500 mx-auto mb-2" />
                <div className="text-lg font-extrabold text-slate-500">-</div>
                <div className="text-xs text-slate-400 mt-1">Top Skor</div>
              </div>
            )}
            {summary.nextMatch ? (
              <div className="glass-card p-4 text-center">
                <Clock className="w-5 h-5 text-cyan-400 mx-auto mb-2" />
                <div className="text-sm font-bold text-white truncate">
                  {summary.nextMatch.homeTeam?.shortName ||
                    summary.nextMatch.homeTeam?.name ||
                    'TBD'}{' '}
                  vs{' '}
                  {summary.nextMatch.awayTeam?.shortName ||
                    summary.nextMatch.awayTeam?.name ||
                    'TBD'}
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  {summary.nextMatch.scheduledAt
                    ? formatDateShort(summary.nextMatch.scheduledAt)
                    : 'TBD'}
                </div>
              </div>
            ) : (
              <div className="glass-card p-4 text-center">
                <Clock className="w-5 h-5 text-slate-500 mx-auto mb-2" />
                <div className="text-sm font-bold text-slate-500">-</div>
                <div className="text-xs text-slate-400 mt-1">
                  Jadwal Berikutnya
                </div>
              </div>
            )}
          </section>
        )}

        {/* ─── Section 3: Standings Table ────────────────────────── */}
        {hasLeaguePhase && standings.length > 0 && (
          <section>
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-3">
              <span className="w-1 h-6 bg-emerald-500 rounded-full" />
              Klasemen
            </h2>
            {tournament.type === TournamentType.GROUP_KNOCKOUT &&
            groupKeys.length > 1 ? (
              <div className="space-y-6">
                {groupKeys.map((group) => (
                  <div key={group} className="glass-card p-4 sm:p-6">
                    <StandingsTable
                      standings={standingsByGroup[group]}
                      title={
                        group === 'default'
                          ? undefined
                          : `Grup ${group.toUpperCase()}`
                      }
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="glass-card p-4 sm:p-6">
                <StandingsTable standings={standings} />
              </div>
            )}
          </section>
        )}

        {/* ─── Section 4: Tournament Bracket ─────────────────────── */}
        {hasKnockoutPhase && knockoutMatches.length > 0 && (
          <section>
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-3">
              <span className="w-1 h-6 bg-emerald-500 rounded-full" />
              {tournament.type === TournamentType.GROUP_KNOCKOUT
                ? 'Fase Gugur'
                : 'Bagan Turnamen'}
            </h2>
            <div className="glass-card p-4 sm:p-6 overflow-hidden">
              <BracketView matches={knockoutMatches} />
            </div>
          </section>
        )}

        {/* ─── Section 5: Top Players ────────────────────────────── */}
        {topScorers.length > 0 && (
          <section>
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-3">
              <span className="w-1 h-6 bg-emerald-500 rounded-full" />
              Top Skor
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {topScorers.map((scorer) => {
                const isTop3 = scorer.rank <= 3;
                const rankColors: Record<number, string> = {
                  1: 'bg-yellow-500 text-yellow-900',
                  2: 'bg-slate-300 text-slate-800',
                  3: 'bg-amber-600 text-amber-100',
                };
                return (
                  <div
                    key={scorer.player?.id || scorer.rank}
                    className={`glass-card p-4 flex items-center gap-4 transition-all ${
                      isTop3
                        ? 'border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.06)]'
                        : ''
                    }`}
                  >
                    {/* Rank Badge */}
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold ${
                        rankColors[scorer.rank] ||
                        'bg-white/[0.06] text-slate-400'
                      }`}
                    >
                      {scorer.rank}
                    </div>

                    {/* Player Info */}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-white truncate">
                        {scorer.player?.fullName || 'Tidak Diketahui'}
                      </div>
                      {scorer.player?.team && (
                        <div className="text-xs text-slate-400 truncate">
                          {scorer.player.team.name}
                        </div>
                      )}
                    </div>

                    {/* Goals Count */}
                    <div className="text-right flex-shrink-0">
                      <div className="text-xl font-extrabold text-emerald-400">
                        {scorer.goals}
                      </div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider">
                        Gol
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ─── Section 6: Matches ────────────────────────────────── */}
        {matches.length > 0 && (
          <section>
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-3">
              <span className="w-1 h-6 bg-emerald-500 rounded-full" />
              Pertandingan
            </h2>

            <div className="space-y-6">
              {/* Live Matches */}
              {liveMatches.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-red-400 mb-3 uppercase tracking-wider">
                    Pertandingan Live
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {liveMatches.map((match) => (
                      <MatchCard key={match.id} match={match} />
                    ))}
                  </div>
                </div>
              )}

              {/* Scheduled Matches */}
              {scheduledMatches.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-blue-400 mb-3 uppercase tracking-wider">
                    Jadwal Mendatang
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {scheduledMatches.map((match) => (
                      <MatchCard key={match.id} match={match} />
                    ))}
                  </div>
                </div>
              )}

              {/* Completed Matches */}
              {completedMatches.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-400 mb-3 uppercase tracking-wider">
                    Hasil Terbaru
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {visibleCompleted.map((match) => (
                      <MatchCard key={match.id} match={match} />
                    ))}
                  </div>
                  {completedMatches.length > 10 && (
                    <button
                      onClick={() => setShowAllCompleted((prev) => !prev)}
                      className="mt-4 px-4 py-2 rounded-lg bg-white/[0.06] text-slate-300 text-sm font-semibold hover:bg-white/[0.1] transition-colors"
                    >
                      {showAllCompleted
                        ? 'Tampilkan Lebih Sedikit'
                        : `Lihat Semua (${completedMatches.length})`}
                    </button>
                  )}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Empty state if no matches at all */}
        {matches.length === 0 && standings.length === 0 && (
          <section className="glass-card p-12 text-center">
            <Trophy className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-white mb-2">
              Belum Ada Data
            </h3>
            <p className="text-slate-400">
              Turnamen ini belum memiliki pertandingan atau klasemen.
            </p>
          </section>
        )}
      </div>
    </div>
  );
}

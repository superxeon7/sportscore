'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiGet } from '@/lib/api/client';
import { Match, MatchEvent, MatchStatus } from '@/lib/types';
import { useLiveMatch } from '@/hooks/use-live-match';
import { MatchTimerDisplay } from '@/components/live/match-timer-display';
import { Badge } from '@/components/ui/badge';
import type { MatchEventRecord } from '@/lib/stores/live-match.store';

/* ─── Extra types for lineup & officials ─────────────────────────── */

interface LineupPlayer {
  jerseyNumber: number;
  isStarter: boolean;
  isCaptain: boolean;
  player: {
    id: string;
    fullName: string;
    position?: string;
  };
}

interface MatchLineupData {
  id: string;
  teamId: string;
  team: { id: string; name: string; shortName?: string; logoUrl?: string };
  players: LineupPlayer[];
}

interface MatchOfficialData {
  id: string;
  teamId: string;
  isHeadCoach: boolean;
  official?: {
    id: string;
    fullName: string;
    role: string;
    photoUrl?: string;
  };
}

const ROLE_LABELS: Record<string, string> = {
  COACH: 'Coach',
  ASSISTANT_COACH: 'Asst. Coach',
  MANAGER: 'Manager',
  PHYSIO: 'Physio',
  OTHER: 'Staff',
};

/* ─── Event icon helpers ─────────────────────────────────────────── */

function getEventEmoji(type: string): string {
  switch (type?.toUpperCase()) {
    case 'GOAL':
    case 'POINT':
      return '⚽';
    case 'OWN_GOAL':
      return '⚽';
    case 'YELLOW_CARD':
      return '🟨';
    case 'RED_CARD':
      return '🟥';
    case 'GREEN_CARD':
      return '🟩';
    case 'SUBSTITUTION':
      return '🔁';
    case 'FOUL':
    case 'PENALTY':
      return '⚠️';
    case 'PERIOD_START':
    case 'PERIOD_END':
      return '⏱️';
    default:
      return '📋';
  }
}

function getEventAccent(type: string): string {
  switch (type?.toUpperCase()) {
    case 'GOAL':
    case 'POINT':
      return 'text-emerald-400';
    case 'OWN_GOAL':
      return 'text-red-400';
    case 'YELLOW_CARD':
      return 'text-yellow-400';
    case 'RED_CARD':
      return 'text-red-400';
    case 'GREEN_CARD':
      return 'text-green-400';
    case 'SUBSTITUTION':
      return 'text-blue-400';
    default:
      return 'text-slate-400';
  }
}

function getEventBorder(type: string): string {
  switch (type?.toUpperCase()) {
    case 'GOAL':
    case 'POINT':
      return 'border-emerald-500/30';
    case 'OWN_GOAL':
      return 'border-red-500/30';
    case 'YELLOW_CARD':
      return 'border-yellow-500/30';
    case 'RED_CARD':
      return 'border-red-500/30';
    case 'SUBSTITUTION':
      return 'border-blue-500/30';
    default:
      return 'border-slate-700/30';
  }
}

/* ─── Status badge for scoreboard ────────────────────────────────── */

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'LIVE':
      return <Badge variant="danger" size="md" dot>LIVE</Badge>;
    case 'HALF_TIME':
      return <Badge variant="warning" size="md">HT</Badge>;
    case 'PAUSED':
      return <Badge variant="warning" size="md">Paused</Badge>;
    case 'COMPLETED':
      return <Badge variant="default" size="md">FT</Badge>;
    case 'SCHEDULED':
    case 'PUBLISHED':
      return <Badge variant="info" size="md">Scheduled</Badge>;
    default:
      return <Badge variant="default" size="md">{status?.replace(/_/g, ' ') || 'Unknown'}</Badge>;
  }
}

/* ─── Team logo / initials circle ────────────────────────────────── */

function TeamLogo({
  team,
  size = 'lg',
}: {
  team?: { name: string; shortName?: string; logoUrl?: string };
  size?: 'md' | 'lg';
}) {
  const sizeClass = size === 'lg' ? 'w-16 h-16 md:w-20 md:h-20' : 'w-10 h-10';
  const textClass = size === 'lg' ? 'text-lg md:text-xl font-bold' : 'text-xs font-bold';
  const initials = (team?.shortName || team?.name || '?').substring(0, 3).toUpperCase();

  if (team?.logoUrl) {
    return (
      <div className={`${sizeClass} rounded-full overflow-hidden border-2 border-white/10 bg-slate-800/60 flex-shrink-0`}>
        <img src={team.logoUrl} alt={team.name} className="w-full h-full object-cover" />
      </div>
    );
  }

  return (
    <div className={`${sizeClass} rounded-full border-2 border-white/10 bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center flex-shrink-0`}>
      <span className={`${textClass} text-slate-300`}>{initials}</span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN PAGE COMPONENT
   ═══════════════════════════════════════════════════════════════════ */

export default function MatchDetailPage() {
  const params = useParams();
  const router = useRouter();
  const matchId = params.id as string;

  const handleBack = useCallback(() => {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push('/matches');
    }
  }, [router]);

  const [match, setMatch] = useState<Match | null>(null);
  const [matchEvents, setMatchEvents] = useState<MatchEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Real-time hook
  const isMatchLive =
    match?.status === MatchStatus.LIVE ||
    match?.status === MatchStatus.HALF_TIME ||
    match?.status === MatchStatus.PAUSED;

  const {
    matchState,
    isConnected: liveConnected,
  } = useLiveMatch(isMatchLive ? matchId : null);

  // Fetch initial match data
  useEffect(() => {
    async function fetchMatch() {
      setLoading(true);
      setError(null);
      try {
        const response = await apiGet<Match | { data: Match }>(
          `/matches/public/${matchId}`,
        );
        const matchData = (response as any).data || (response as Match);
        setMatch(matchData);

        try {
          const eventsRes = await apiGet<MatchEvent[] | { data: MatchEvent[] }>(
            `/matches/${matchData.id}/events`,
          );
          setMatchEvents(
            Array.isArray(eventsRes) ? eventsRes : (eventsRes as any).data || [],
          );
        } catch {
          setMatchEvents([]);
        }
      } catch {
        setError('Failed to load match details.');
      } finally {
        setLoading(false);
      }
    }

    if (matchId) fetchMatch();
  }, [matchId]);

  /* ─── Loading State ────────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="h-6 w-32 bg-slate-800/60 rounded animate-pulse" />
        <div className="h-52 bg-slate-800/40 rounded-2xl animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-64 bg-slate-800/40 rounded-2xl animate-pulse" />
          <div className="h-64 bg-slate-800/40 rounded-2xl animate-pulse" />
        </div>
        <div className="h-40 bg-slate-800/40 rounded-2xl animate-pulse" />
      </div>
    );
  }

  /* ─── Error State ──────────────────────────────────────────────── */
  if (error || !match) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <div className="w-16 h-16 mx-auto rounded-full bg-slate-800/60 border border-slate-700/40 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-slate-100 mb-2">Match Not Found</h2>
        <p className="text-slate-400 mb-6">{error || 'The match you are looking for does not exist.'}</p>
        <button
          onClick={handleBack}
          className="inline-flex items-center px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-500 transition-colors"
        >
          ← Kembali
        </button>
      </div>
    );
  }

  /* ─── Derived Values ───────────────────────────────────────────── */
  const liveStatus = matchState?.status || match.status;
  const isLive = liveStatus === 'LIVE' || liveStatus === MatchStatus.LIVE || liveStatus === 'HALF_TIME' || liveStatus === 'PAUSED';
  const showScore = isLive || liveStatus === 'COMPLETED' || liveStatus === MatchStatus.COMPLETED;
  const homeScore = matchState?.score?.homeScore ?? match.matchScore?.homeScore ?? 0;
  const awayScore = matchState?.score?.awayScore ?? match.matchScore?.awayScore ?? 0;
  const currentPeriod = matchState?.currentPeriod ?? match.currentPeriod;
  const homeTeamId = matchState?.homeTeamId ?? match.homeTeam?.id ?? '';
  const awayTeamId = matchState?.awayTeamId ?? match.awayTeam?.id ?? '';

  // Lineup data
  const matchLineups: MatchLineupData[] = (match as any).matchLineups || [];
  const homeLineup = matchLineups.find((l) => l.teamId === homeTeamId) || null;
  const awayLineup = matchLineups.find((l) => l.teamId === awayTeamId) || null;

  // Officials data
  const matchOfficials: MatchOfficialData[] = (match as any).matchOfficials || [];
  const homeOfficials = matchOfficials.filter((o) => o.teamId === homeTeamId);
  const awayOfficials = matchOfficials.filter((o) => o.teamId === awayTeamId);

  // Events for timeline
  const displayEvents: MatchEventRecord[] = matchState?.events
    ? matchState.events
    : matchEvents.map((e) => ({
      id: e.id,
      type: e.type,
      minute: e.minute ?? null,
      period: e.period ?? null,
      playerId: e.player?.id ?? null,
      playerName: e.player ? e.player.fullName : null,
      jerseyNumber: e.player?.jerseyNumber ?? null,
      teamId: e.teamId ?? null,
      description: e.description ?? null,
      data: e.data ?? {},
      timestamp: e.timestamp,
      homeScoreSnapshot: e.homeScoreSnapshot ?? null,
      awayScoreSnapshot: e.awayScoreSnapshot ?? null,
    }));

  const sortedEvents = [...displayEvents].sort((a, b) => {
    const mA = a.minute ?? 0;
    const mB = b.minute ?? 0;
    if (mA !== mB) return mA - mB;
    return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
  });

  const homeName = match.homeTeam?.name || 'Home';
  const awayName = match.awayTeam?.name || 'Away';

  /* ─── Lineup Renderer ──────────────────────────────────────────── */
  const renderLineupCard = (
    lineup: MatchLineupData | null,
    officials: MatchOfficialData[],
    teamName: string,
    team: Match['homeTeam'],
    accentColor: string,
  ) => {
    const accentBorder = accentColor === 'blue' ? 'border-blue-500/30' : 'border-emerald-500/30';
    const accentDot = accentColor === 'blue' ? 'bg-blue-500' : 'bg-emerald-500';
    const accentText = accentColor === 'blue' ? 'text-blue-400' : 'text-emerald-400';
    const starterBg = accentColor === 'blue' ? 'bg-blue-950/20 border-blue-500/15' : 'bg-emerald-950/20 border-emerald-500/15';

    return (
      <div className={`glass-card border ${accentBorder} overflow-hidden`}>
        {/* Team header */}
        <div className="px-5 py-4 border-b border-white/5 flex items-center gap-3">
          <TeamLogo team={team as any} size="md" />
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-100 truncate">{teamName}</h3>
            {lineup && (
              <p className="text-[11px] text-slate-500">
                {lineup.players.filter(p => p.isStarter).length} starters · {lineup.players.filter(p => !p.isStarter).length} bench
              </p>
            )}
          </div>
        </div>

        <div className="p-5 space-y-5">
          {!lineup ? (
            <div className="flex flex-col items-center py-6 text-center">
              <div className="w-10 h-10 rounded-full bg-slate-800/60 border border-slate-700/40 flex items-center justify-center mb-2">
                <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <p className="text-xs text-slate-500">Lineup not available</p>
            </div>
          ) : (
            <>
              {/* Starters */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-1.5 h-1.5 rounded-full ${accentDot}`} />
                  <span className={`text-[11px] font-bold uppercase tracking-wider ${accentText}`}>
                    Starter ({lineup.players.filter(p => p.isStarter).length})
                  </span>
                </div>
                <div className="space-y-1">
                  {lineup.players
                    .filter((p) => p.isStarter)
                    .map((lp) => {
                      const isGK = lp.player.position?.toUpperCase().includes('GK') || lp.player.position?.toUpperCase().includes('GOALKEEPER') || lp.player.position?.toUpperCase().includes('KIPER');
                      return (
                        <div
                          key={lp.player.id}
                          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border ${starterBg}`}
                        >
                          <span className={`w-7 text-center text-xs font-bold tabular-nums ${accentText}`}>
                            {lp.jerseyNumber}
                          </span>
                          <span className="text-sm text-slate-200 flex-1 truncate">
                            {lp.player.fullName}
                          </span>
                          {lp.isCaptain && (
                            <span className="px-1.5 py-0.5 text-[9px] font-black bg-amber-500/20 text-amber-400 rounded border border-amber-500/30 leading-none">
                              C
                            </span>
                          )}
                          {isGK && (
                            <span className="px-1.5 py-0.5 text-[9px] font-black bg-purple-500/20 text-purple-400 rounded border border-purple-500/30 leading-none">
                              GK
                            </span>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Bench */}
              {lineup.players.filter(p => !p.isStarter).length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      Bench ({lineup.players.filter(p => !p.isStarter).length})
                    </span>
                  </div>
                  <div className="space-y-1">
                    {lineup.players
                      .filter((p) => !p.isStarter)
                      .map((lp) => (
                        <div
                          key={lp.player.id}
                          className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-slate-800/30 border border-white/5"
                        >
                          <span className="w-7 text-center text-xs font-medium text-slate-500 tabular-nums">
                            {lp.jerseyNumber}
                          </span>
                          <span className="text-sm text-slate-400 flex-1 truncate">
                            {lp.player.fullName}
                          </span>
                          {lp.player.position && (
                            <span className="text-[10px] text-slate-600 uppercase">
                              {lp.player.position}
                            </span>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Officials */}
          {officials.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Officials ({officials.length})
                </span>
              </div>
              <div className="space-y-1">
                {officials.map((o) => {
                  const name = o.official?.fullName || '—';
                  const role = o.official?.role || '';
                  return (
                    <div
                      key={o.id}
                      className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-slate-800/20 border border-white/5"
                    >
                      <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0">
                        {o.official?.photoUrl ? (
                          <img src={o.official.photoUrl} alt={name} className="w-full h-full rounded-full object-cover" />
                        ) : (
                          <span className="text-[9px] font-bold text-slate-400">
                            {name.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <span className="text-sm text-slate-300 flex-1 truncate">{name}</span>
                      {o.isHeadCoach && (
                        <span className="px-1.5 py-0.5 text-[9px] font-black bg-blue-500/20 text-blue-400 rounded border border-blue-500/30 leading-none">
                          HC
                        </span>
                      )}
                      <span className="text-[10px] text-slate-500">
                        {ROLE_LABELS[role] || role}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  /* ═══════════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════════ */
  return (
    <div className="min-h-screen pb-12">
      {/* ──── Back nav ──── */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-4">
        <button
          onClick={handleBack}
          className="inline-flex items-center text-slate-400 hover:text-slate-200 text-sm transition-colors group"
        >
          <svg className="w-4 h-4 mr-1.5 transition-transform group-hover:-translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Kembali
        </button>
      </div>

      {/* ════════════════════════════════════════════════════════════════
         SECTION 1 — HERO SCOREBOARD
         ════════════════════════════════════════════════════════════════ */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mb-8">
        <div className="relative rounded-2xl overflow-hidden">
          {/* Background */}
          <div className={`absolute inset-0 ${isLive
              ? 'bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950'
              : liveStatus === 'COMPLETED' || liveStatus === MatchStatus.COMPLETED
                ? 'bg-gradient-to-br from-slate-800 to-slate-950'
                : 'bg-gradient-to-br from-slate-800 via-indigo-950/30 to-slate-950'
            }`} />

          {/* Live neon strip */}
          {isLive && (
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-500 animate-pulse" />
          )}

          <div className="relative p-6 md:p-8">
            {/* Status + Timer + Period */}
            <div className="flex items-center justify-center gap-3 mb-6">
              <StatusBadge status={String(liveStatus)} />
              {isLive && matchState?.timerState && (
                <MatchTimerDisplay
                  timerState={matchState.timerState}
                  size="lg"
                  className="text-slate-100"
                />
              )}
              {isLive && currentPeriod > 0 && (
                <span className="text-sm font-medium text-slate-400">
                  Period {currentPeriod}
                </span>
              )}
            </div>

            {/* Live connection */}
            {isMatchLive && (
              <div className="flex items-center justify-center gap-2 mb-4">
                {liveConnected ? (
                  <>
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                    </span>
                    <span className="text-[11px] font-medium text-emerald-400/80">Real-time updates active</span>
                  </>
                ) : (
                  <>
                    <span className="h-2 w-2 rounded-full bg-yellow-500" />
                    <span className="text-[11px] font-medium text-yellow-400/80">Connecting...</span>
                  </>
                )}
              </div>
            )}

            {/* Teams + Score */}
            <div className="flex items-center justify-center gap-4 md:gap-8">
              {/* Home Team */}
              <div className="flex-1 flex flex-col items-end gap-2">
                <TeamLogo team={match.homeTeam as any} />
                <p className="text-base md:text-lg font-bold text-slate-100 text-right truncate max-w-[140px] md:max-w-[200px]">
                  {homeName}
                </p>
              </div>

              {/* Score Center */}
              <div className="flex items-center gap-3 md:gap-6 flex-shrink-0">
                {showScore ? (
                  <>
                    <span className="text-4xl md:text-6xl font-black tabular-nums text-white">
                      {homeScore}
                    </span>
                    <span className="text-xl md:text-2xl text-slate-600 font-light select-none">:</span>
                    <span className="text-4xl md:text-6xl font-black tabular-nums text-white">
                      {awayScore}
                    </span>
                  </>
                ) : (
                  <span className="text-2xl font-bold text-slate-500 select-none">vs</span>
                )}
              </div>

              {/* Away Team */}
              <div className="flex-1 flex flex-col items-start gap-2">
                <TeamLogo team={match.awayTeam as any} />
                <p className="text-base md:text-lg font-bold text-slate-100 text-left truncate max-w-[140px] md:max-w-[200px]">
                  {awayName}
                </p>
              </div>
            </div>

            {/* Period Scores */}
            {matchState?.score?.periodScores && matchState.score.periodScores.length > 0 && (
              <div className="mt-5 flex justify-center">
                <div className="flex gap-2">
                  {matchState.score.periodScores.map((ps: any) => (
                    <div key={ps.period} className="text-center bg-white/5 rounded-lg px-3 py-1.5 border border-white/5">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider">{ps.label}</p>
                      <p className="text-sm font-bold tabular-nums text-slate-300">{ps.homeScore} - {ps.awayScore}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Venue + Date subtitle */}
            <div className="mt-5 flex items-center justify-center gap-3 flex-wrap">
              {match.venue && (
                <span className="flex items-center gap-1.5 text-xs text-slate-500">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {match.venue}
                </span>
              )}
              {match.scheduledAt && (
                <span className="flex items-center gap-1.5 text-xs text-slate-500">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {new Date(match.scheduledAt).toLocaleDateString(undefined, {
                    weekday: 'short',
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              )}
              {(match as any).tournament?.name && (
                <span className="flex items-center gap-1.5 text-xs text-slate-500">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                  {(match as any).tournament.name}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">

        {/* ════════════════════════════════════════════════════════════════
           SECTION 1.5 — PLAYER OF THE MATCH
           ════════════════════════════════════════════════════════════════ */}
        {(match as any).potmLocked && (match as any).playerOfTheMatch && (() => {
          const potm = (match as any).playerOfTheMatch as {
            id: string;
            fullName: string;
            jerseyNumber: number | null;
            photoUrl: string | null;
            team: { id: string; name: string; shortName?: string; logoUrl?: string };
          };
          const potmGoals = sortedEvents.filter(
            (e) => e.playerId === potm.id && e.type === 'GOAL',
          ).length;
          const potmAssists = sortedEvents.filter(
            (e) => e.playerId === potm.id && e.type === 'ASSIST',
          ).length;

          return (
            <div>
              {/* Gold glow card */}
              <div className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-950/40 via-slate-900 to-slate-950 p-5 shadow-lg shadow-amber-900/10">
                {/* Shimmer strip */}
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-amber-400/60 to-transparent" />
                {/* Faint star burst bg */}
                <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, #fbbf24 0%, transparent 70%)' }} />

                <div className="relative flex items-center gap-4">
                  {/* Photo */}
                  <div className="relative flex-shrink-0">
                    <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-amber-500/40 bg-slate-800">
                      {potm.photoUrl ? (
                        <img src={potm.photoUrl} alt={potm.fullName} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-amber-500/10">
                          <svg className="w-8 h-8 text-amber-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                      )}
                    </div>
                    {/* Jersey badge */}
                    {potm.jerseyNumber != null && (
                      <div className="absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-full bg-amber-500 border-2 border-slate-900 flex items-center justify-center">
                        <span className="text-[9px] font-black text-slate-900">{potm.jerseyNumber}</span>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    {/* Badge */}
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-amber-400 text-sm">⭐</span>
                      <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">Player of The Match</span>
                    </div>
                    <p className="text-lg font-black text-white truncate leading-tight">{potm.fullName}</p>
                    <p className="text-xs text-slate-400 mt-0.5 truncate">
                      {potm.team?.shortName || potm.team?.name}
                    </p>
                  </div>

                  {/* Stats */}
                  <div className="flex-shrink-0 flex gap-3">
                    <div className="text-center px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                      <div className="text-xl font-black text-emerald-400 leading-none">{potmGoals}</div>
                      <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mt-0.5">Gol</div>
                    </div>
                    <div className="text-center px-3 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20">
                      <div className="text-xl font-black text-blue-400 leading-none">{potmAssists}</div>
                      <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mt-0.5">Assist</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ════════════════════════════════════════════════════════════════
           SECTION 2 — LINEUPS
           ════════════════════════════════════════════════════════════════ */}
        {(homeLineup || awayLineup || homeOfficials.length > 0 || awayOfficials.length > 0) && (
          <div>
            <h2 className="text-lg font-bold text-slate-100 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Lineups
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {renderLineupCard(homeLineup, homeOfficials, homeName, match.homeTeam, 'blue')}
              {renderLineupCard(awayLineup, awayOfficials, awayName, match.awayTeam, 'green')}
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════
           SECTION 3 — MATCH TIMELINE
           ════════════════════════════════════════════════════════════════ */}
        {sortedEvents.length > 0 && (
          <div>
            <h2 className="text-lg font-bold text-slate-100 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Match Timeline
              <span className="text-sm font-normal text-slate-500">({sortedEvents.length})</span>
            </h2>

            <div className="glass-card p-5">
              {/* Timeline */}
              <div className="relative space-y-2">
                {/* Center line */}
                <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-700/40 hidden md:block" />

                {sortedEvents.map((event) => {
                  const isHome = event.teamId === homeTeamId;
                  const isAway = event.teamId === awayTeamId;
                  const isPeriod = event.type === 'PERIOD_START' || event.type === 'PERIOD_END';
                  const emoji = getEventEmoji(event.type);
                  const accent = getEventAccent(event.type);
                  const borderClass = getEventBorder(event.type);

                  if (isPeriod) {
                    return (
                      <div key={event.id} className="flex justify-center py-2 relative z-10">
                        <div className="flex items-center gap-2 px-4 py-1.5 bg-slate-800/80 rounded-full border border-slate-600/30">
                          <span className="text-xs">{emoji}</span>
                          <span className="text-xs font-medium text-slate-400">
                            {event.description || (event.type === 'PERIOD_START' ? 'Period Start' : 'Period End')}
                          </span>
                        </div>
                      </div>
                    );
                  }

                  // Build event text line
                  let eventLine = '';
                  if (event.minute != null) eventLine += `${event.minute}' `;
                  if (event.playerName) {
                    eventLine += event.playerName;
                    if (event.jerseyNumber != null) eventLine += ` (#${event.jerseyNumber})`;
                  }

                  const eventTypeName = event.type?.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase());

                  return (
                    <div
                      key={event.id}
                      className={`flex items-center gap-3 relative z-10 ${isAway ? 'md:flex-row-reverse md:text-right' : ''
                        }`}
                    >
                      {/* Event card */}
                      <div className={`flex-1 flex items-center gap-3 px-4 py-2.5 rounded-xl border bg-slate-900/60 ${borderClass} ${isAway ? 'md:flex-row-reverse' : ''
                        }`}>
                        {/* Minute */}
                        {event.minute != null && (
                          <span className="text-xs font-bold tabular-nums text-slate-300 w-8 text-center flex-shrink-0">
                            {event.minute}&apos;
                          </span>
                        )}

                        {/* Emoji */}
                        <span className="text-base flex-shrink-0">{emoji}</span>

                        {/* Info */}
                        <div className={`flex-1 min-w-0 ${isAway ? 'md:text-right' : ''}`}>
                          {event.playerName && (
                            <p className="text-sm font-semibold text-slate-100 truncate">
                              {event.playerName}
                              {event.jerseyNumber != null && (
                                <span className="text-slate-500 font-normal ml-1">(#{event.jerseyNumber})</span>
                              )}
                            </p>
                          )}
                          <p className={`text-xs font-medium ${accent}`}>
                            {event.type === 'OWN_GOAL' ? 'Own Goal' : eventTypeName}
                          </p>
                          {event.description && (
                            <p className="text-[11px] text-slate-500 truncate mt-0.5">{event.description}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Empty events state */}
        {sortedEvents.length === 0 && showScore && (
          <div className="glass-card p-8 text-center">
            <div className="w-12 h-12 mx-auto rounded-full bg-slate-800/60 border border-slate-700/40 flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <p className="text-sm text-slate-400 font-medium">No match events recorded yet</p>
            <p className="text-xs text-slate-500 mt-1">Events will appear here as the match progresses</p>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════
           SECTION 4 — MATCH INFO
           ════════════════════════════════════════════════════════════════ */}
        <div className="glass-card p-6">
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Match Info</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {match.venue && (
              <div>
                <dt className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Venue</dt>
                <dd className="mt-1 text-sm text-slate-200">{match.venue}</dd>
              </div>
            )}
            {match.scheduledAt && (
              <div>
                <dt className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Date</dt>
                <dd className="mt-1 text-sm text-slate-200">
                  {new Date(match.scheduledAt).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </dd>
              </div>
            )}
            {(match as any).tournament?.name && (
              <div>
                <dt className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Tournament</dt>
                <dd className="mt-1 text-sm text-slate-200">{(match as any).tournament.name}</dd>
              </div>
            )}
            {match.round && (
              <div>
                <dt className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Round</dt>
                <dd className="mt-1 text-sm text-slate-200">{match.round}</dd>
              </div>
            )}
            {match.matchDay && (
              <div>
                <dt className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Match Day</dt>
                <dd className="mt-1 text-sm text-slate-200">{match.matchDay}</dd>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

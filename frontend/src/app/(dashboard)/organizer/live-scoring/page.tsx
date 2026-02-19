'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { apiGet, apiPatch } from '@/lib/api/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Skeleton } from '@/components/ui/skeleton';
import { ScoreBoard } from '@/components/live/score-board';
import { EventLog } from '@/components/live/event-log';
import { ScoringPanel } from '@/components/live/scoring-panel';
import { MatchControls } from '@/components/live/match-controls';
import { useLiveMatch } from '@/hooks/use-live-match';
import type { Player } from '@/lib/types';

// ─── Types ──────────────────────────────────────────────────────────

interface EventListItem {
  id: string;
  name: string;
  status: string;
  startDate: string;
}

interface CategoryListItem {
  id: string;
  name: string;
  sportType: string;
  gender: string;
}

interface MatchListItem {
  id: string;
  homeTeamId: string;
  awayTeamId: string;
  homeTeam?: { id: string; name: string; shortName?: string; logoUrl?: string };
  awayTeam?: { id: string; name: string; shortName?: string; logoUrl?: string };
  matchScore?: { homeScore: number; awayScore: number };
  status: string;
  currentPeriod?: number;
  scheduledAt?: string;
  stageType?: string | null;
  groupName?: string | null;
  group?: string | null;
  round?: number | null;
  tournament?: { id: string; name: string; type: string };
  eventCategory?: { id: string; name: string; sportType: string; gender: string } | null;
}

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

interface TeamLineup {
  id: string;
  teamId: string;
  team: { id: string; name: string; shortName?: string; logoUrl?: string };
  players: LineupPlayer[];
}

interface PotmCandidate {
  playerId: string;
  fullName: string;
  jerseyNumber: number | null;
  position: string | null;
  photoUrl: string | null;
  teamId: string;
  teamName: string;
  isStarter: boolean;
}

interface Official {
  id: string;
  officialId?: string;
  fullName?: string;
  role: string;
  photoUrl?: string;
  isHeadCoach: boolean;
  official?: {
    id: string;
    fullName: string;
    role: string;
    photoUrl?: string;
  };
}

// ─── Constants ──────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  COACH: 'Pelatih',
  ASSISTANT_COACH: 'Asisten Pelatih',
  MANAGER: 'Manajer',
  PHYSIO: 'Fisioterapis',
  OTHER: 'Lainnya',
};

// ─── Match Label Formatting ──────────────────────────────────────────

function getKnockoutLabel(round: number | null | undefined, groupField: string | null | undefined): string {
  // Use the free-text `group` column first (organizers set this to e.g. "FINAL", "SEMIFINAL")
  if (groupField) {
    const g = groupField.toUpperCase();
    if (g.includes('FINAL') && !g.includes('SEMI') && !g.includes('3RD') && !g.includes('THIRD')) return 'FINAL';
    if (g.includes('SEMI')) return 'SEMIFINAL';
    if (g.includes('3RD') || g.includes('THIRD')) return '3RD PLACE';
    return g;
  }
  if (round != null) return `BABAK ${round}`;
  return 'KNOCKOUT';
}

function getMatchLabel(match: MatchListItem): string {
  const home = match.homeTeam?.name ?? match.homeTeamId;
  const away = match.awayTeam?.name ?? match.awayTeamId;
  const vs = `${home} vs ${away}`;

  if (match.stageType === 'GROUP' && match.groupName) {
    return `[${match.groupName.toUpperCase()}] ${vs}`;
  }

  if (match.stageType === 'KNOCKOUT') {
    const label = getKnockoutLabel(match.round, match.group);
    return `[${label}] ${vs}`;
  }

  return vs;
}

// ─── Component ──────────────────────────────────────────────────────

export default function LiveScoringPage() {
  // ── Step 1: Events ──
  const [eventList, setEventList] = useState<EventListItem[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [loadingEvents, setLoadingEvents] = useState(true);

  // ── Step 2: Categories ──
  const [categories, setCategories] = useState<CategoryListItem[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [loadingCategories, setLoadingCategories] = useState(false);

  // ── Step 3: Matches ──
  const [matches, setMatches] = useState<MatchListItem[]>([]);
  const [showCompleted, setShowCompleted] = useState(false);
  const [loadingMatches, setLoadingMatches] = useState(false);

  // ── Selected Match ──
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [selectedMatchMeta, setSelectedMatchMeta] = useState<MatchListItem | null>(null);
  const [homePlayers, setHomePlayers] = useState<Player[]>([]);
  const [awayPlayers, setAwayPlayers] = useState<Player[]>([]);
  const [homeLineup, setHomeLineup] = useState<TeamLineup | null>(null);
  const [awayLineup, setAwayLineup] = useState<TeamLineup | null>(null);
  const [homeOfficials, setHomeOfficials] = useState<Official[]>([]);
  const [awayOfficials, setAwayOfficials] = useState<Official[]>([]);
  const [timeConfig, setTimeConfig] = useState<{
    matchDurationMinutes: number;
    halfCount: number;
    breakDurationMinutes: number;
    injuryTimeMinutes: number;
    source: string;
  } | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // ── POTM state ──
  const [potmCandidates, setPotmCandidates] = useState<PotmCandidate[]>([]);
  const [potmSelectedId, setPotmSelectedId] = useState<string>('');
  const [potmCurrentId, setPotmCurrentId] = useState<string | null>(null);
  const [potmLocked, setPotmLocked] = useState(false);
  const [potmSaving, setPotmSaving] = useState(false);
  const [potmLocking, setPotmLocking] = useState(false);
  const [potmError, setPotmError] = useState<string | null>(null);
  const potmFetchedForMatch = useRef<string | null>(null);

  // Real-time hook
  const {
    matchState,
    isConnected,
    error: socketError,
    sendEvent,
    undoEvent,
    startMatch,
    endMatch,
    startPeriod,
    endPeriod,
    startTimer,
    pauseTimer,
    setAddedTime,
    setTimerDirection,
    adjustTimer,
  } = useLiveMatch(selectedMatchId);

  // ── Fetch: Events ──
  const fetchEvents = useCallback(async () => {
    setLoadingEvents(true);
    setFetchError(null);
    try {
      const res = await apiGet<EventListItem[] | { data: EventListItem[] }>('/events');
      const data = Array.isArray(res) ? res : (res as { data: EventListItem[] }).data ?? [];
      setEventList(data);
    } catch (err: unknown) {
      setFetchError(err instanceof Error ? err.message : 'Gagal memuat acara');
    } finally {
      setLoadingEvents(false);
    }
  }, []);

  // ── Fetch: Categories for selected event ──
  const fetchCategories = useCallback(async (eventId: string) => {
    setLoadingCategories(true);
    setCategories([]);
    setSelectedCategoryId(null);
    setMatches([]);
    setSelectedMatchId(null);
    try {
      const res = await apiGet<CategoryListItem[] | { data: CategoryListItem[] }>(
        `/events/${eventId}/categories`,
      );
      const data = Array.isArray(res) ? res : (res as { data: CategoryListItem[] }).data ?? [];
      setCategories(data);
    } catch (err: unknown) {
      setFetchError(err instanceof Error ? err.message : 'Gagal memuat kategori');
    } finally {
      setLoadingCategories(false);
    }
  }, []);

  // ── Fetch: Matches for selected event + category ──
  const fetchMatches = useCallback(
    async (eventId: string, categoryId: string, includeCompleted: boolean) => {
      setLoadingMatches(true);
      setMatches([]);
      setSelectedMatchId(null);
      try {
        const params = new URLSearchParams({ eventCategoryId: categoryId });
        if (includeCompleted) params.set('includeCompleted', 'true');
        const res = await apiGet<MatchListItem[] | { data: MatchListItem[] }>(
          `/events/${eventId}/matches?${params.toString()}`,
        );
        const data = Array.isArray(res) ? res : (res as { data: MatchListItem[] }).data ?? [];
        setMatches(data);
      } catch (err: unknown) {
        setFetchError(err instanceof Error ? err.message : 'Gagal memuat pertandingan');
      } finally {
        setLoadingMatches(false);
      }
    },
    [],
  );

  // ── Effects: cascade ──
  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  useEffect(() => {
    if (!selectedEventId) {
      setCategories([]);
      setSelectedCategoryId(null);
      setMatches([]);
      setSelectedMatchId(null);
      return;
    }
    fetchCategories(selectedEventId);
  }, [selectedEventId, fetchCategories]);

  useEffect(() => {
    if (!selectedEventId || !selectedCategoryId) {
      setMatches([]);
      setSelectedMatchId(null);
      return;
    }
    fetchMatches(selectedEventId, selectedCategoryId, showCompleted);
  }, [selectedEventId, selectedCategoryId, showCompleted, fetchMatches]);

  // ── Fetch match metadata when a match is selected ──
  useEffect(() => {
    if (!selectedMatchId) {
      setSelectedMatchMeta(null);
      setHomePlayers([]);
      setAwayPlayers([]);
      setHomeLineup(null);
      setAwayLineup(null);
      setHomeOfficials([]);
      setAwayOfficials([]);
      setTimeConfig(null);
      return;
    }

    const meta = matches.find((m) => m.id === selectedMatchId) || null;
    setSelectedMatchMeta(meta);

    if (!meta) return;

    const extractPlayers = (lineup: any): Player[] => {
      if (!lineup || !lineup.players) return [];
      return lineup.players.map((lp: any) => ({
        ...lp.player,
        jerseyNumber: lp.jerseyNumber,
      }));
    };

    setLoadingMeta(true);
    Promise.all([
      apiGet<any>(`/matches/${selectedMatchId}/lineups/${meta.homeTeamId}`).catch(() => null),
      apiGet<any>(`/matches/${selectedMatchId}/lineups/${meta.awayTeamId}`).catch(() => null),
      apiGet<{
        matchDurationMinutes: number;
        halfCount: number;
        breakDurationMinutes: number;
        injuryTimeMinutes: number;
        source: string;
      }>(`/matches/${selectedMatchId}/time-config`).catch(() => null),
      apiGet<Official[]>(`/matches/${selectedMatchId}/officials/${meta.homeTeamId}`).catch(() =>
        apiGet<Official[]>(
          `/matches/${selectedMatchId}/lineups/${meta.homeTeamId}/officials`,
        ).catch(() => [] as Official[]),
      ),
      apiGet<Official[]>(`/matches/${selectedMatchId}/officials/${meta.awayTeamId}`).catch(() =>
        apiGet<Official[]>(
          `/matches/${selectedMatchId}/lineups/${meta.awayTeamId}/officials`,
        ).catch(() => [] as Official[]),
      ),
    ])
      .then(([homeLineupRes, awayLineupRes, timeConfigRes, homeOffRes, awayOffRes]) => {
        setHomePlayers(extractPlayers(homeLineupRes));
        setAwayPlayers(extractPlayers(awayLineupRes));
        setHomeLineup(homeLineupRes as TeamLineup | null);
        setAwayLineup(awayLineupRes as TeamLineup | null);
        setTimeConfig(timeConfigRes);
        setHomeOfficials(Array.isArray(homeOffRes) ? homeOffRes : []);
        setAwayOfficials(Array.isArray(awayOffRes) ? awayOffRes : []);
      })
      .finally(() => setLoadingMeta(false));
  }, [selectedMatchId, matches]);

  // ── Fetch POTM candidates when match is COMPLETED ──
  useEffect(() => {
    const currentStatus = matchState?.status || selectedMatchMeta?.status;
    if (
      currentStatus !== 'COMPLETED' ||
      !selectedMatchId ||
      potmFetchedForMatch.current === selectedMatchId
    ) return;

    potmFetchedForMatch.current = selectedMatchId;
    setPotmError(null);

    Promise.all([
      apiGet<PotmCandidate[]>(`/matches/${selectedMatchId}/potm/candidates`).catch(() => [] as PotmCandidate[]),
      apiGet<any>(`/matches/${selectedMatchId}`).catch(() => null),
    ]).then(([candidates, matchDetail]) => {
      setPotmCandidates(Array.isArray(candidates) ? candidates : []);
      const potmId = matchDetail?.playerOfTheMatchId ?? matchDetail?.playerOfTheMatch?.id ?? null;
      const locked = matchDetail?.potmLocked ?? false;
      setPotmCurrentId(potmId);
      setPotmSelectedId(potmId ?? '');
      setPotmLocked(locked);
    });
  }, [matchState?.status, selectedMatchMeta?.status, selectedMatchId]);

  // Reset POTM state when match changes
  useEffect(() => {
    potmFetchedForMatch.current = null;
    setPotmCandidates([]);
    setPotmSelectedId('');
    setPotmCurrentId(null);
    setPotmLocked(false);
    setPotmError(null);
  }, [selectedMatchId]);

  // ── Derived display values ──
  const status = matchState?.status || selectedMatchMeta?.status || 'SCHEDULED';
  const homeScore = matchState?.score?.homeScore ?? selectedMatchMeta?.matchScore?.homeScore ?? 0;
  const awayScore = matchState?.score?.awayScore ?? selectedMatchMeta?.matchScore?.awayScore ?? 0;
  const currentPeriod = matchState?.currentPeriod ?? selectedMatchMeta?.currentPeriod ?? 1;
  const events = matchState?.events ?? [];
  const sportSlug = matchState?.sportSlug ?? '';
  const homeName = selectedMatchMeta?.homeTeam?.name || 'Home';
  const awayName = selectedMatchMeta?.awayTeam?.name || 'Away';
  const homeTeamId = matchState?.homeTeamId ?? selectedMatchMeta?.homeTeamId ?? '';
  const awayTeamId = matchState?.awayTeamId ?? selectedMatchMeta?.awayTeamId ?? '';

  const isLiveStatus =
    status === 'LIVE' || status === 'HALF_TIME' || status === 'PAUSED';

  const isCompletedStatus = status === 'COMPLETED';

  const handleSavePotm = useCallback(async () => {
    if (!selectedMatchId || !potmSelectedId) return;
    setPotmSaving(true);
    setPotmError(null);
    try {
      const res = await apiPatch<any>(`/matches/${selectedMatchId}/potm`, { playerId: potmSelectedId });
      const newId = res?.playerOfTheMatchId ?? res?.playerOfTheMatch?.id ?? potmSelectedId;
      setPotmCurrentId(newId);
    } catch (err: any) {
      setPotmError(err?.message || 'Gagal menyimpan POTM.');
    } finally {
      setPotmSaving(false);
    }
  }, [selectedMatchId, potmSelectedId]);

  const handleLockPotm = useCallback(async () => {
    if (!selectedMatchId) return;
    if (!potmCurrentId) {
      setPotmError('Pilih Player of The Match dulu sebelum mengunci.');
      return;
    }
    setPotmLocking(true);
    setPotmError(null);
    try {
      await apiPatch<any>(`/matches/${selectedMatchId}/potm/lock`);
      setPotmLocked(true);
    } catch (err: any) {
      setPotmError(err?.message || 'Gagal mengunci POTM.');
    } finally {
      setPotmLocking(false);
    }
  }, [selectedMatchId, potmCurrentId]);

  // ─── Lineup Renderer ──────────────────────────────────────────────

  const renderTeamLineup = (
    lineup: TeamLineup | null,
    officials: Official[],
    teamName: string,
    side: 'home' | 'away',
  ) => {
    if (!lineup) {
      return (
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
            {teamName}
          </h3>
          <div className="flex flex-col items-center py-6 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-800/60 border border-slate-700/40 flex items-center justify-center mb-2">
              <svg className="w-6 h-6 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <p className="text-sm text-slate-500">Lineup belum disubmit</p>
          </div>
        </Card>
      );
    }

    const starters = lineup.players.filter((p) => p.isStarter);
    const bench = lineup.players.filter((p) => !p.isStarter);

    return (
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
          {teamName}
        </h3>

        {/* Starters */}
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
              ⚽ Starter ({starters.length})
            </span>
          </div>
          <div className="space-y-1.5">
            {starters.map((lp) => (
              <div
                key={lp.player.id}
                className="flex items-center gap-3 px-3 py-2 rounded-lg bg-emerald-900/10 border border-emerald-500/20"
              >
                <span className="w-8 text-center text-sm font-bold text-emerald-400">
                  {lp.jerseyNumber}
                </span>
                <span className="text-sm text-slate-200 flex-1">
                  {lp.player.fullName}
                </span>
                {lp.isCaptain && (
                  <span className="px-1.5 py-0.5 text-[10px] font-bold bg-amber-500/20 text-amber-400 rounded border border-amber-500/30">
                    C
                  </span>
                )}
                {lp.player.position && (
                  <span className="text-[10px] text-slate-500 uppercase">
                    {lp.player.position}
                  </span>
                )}
              </div>
            ))}
            {starters.length === 0 && (
              <p className="text-xs text-slate-500 italic py-2">Tidak ada starter</p>
            )}
          </div>
        </div>

        {/* Bench */}
        {bench.length > 0 && (
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                🪑 Cadangan ({bench.length})
              </span>
            </div>
            <div className="space-y-1.5">
              {bench.map((lp) => (
                <div
                  key={lp.player.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-800/40 border border-white/5"
                >
                  <span className="w-8 text-center text-sm font-medium text-slate-400">
                    {lp.jerseyNumber}
                  </span>
                  <span className="text-sm text-slate-300 flex-1">
                    {lp.player.fullName}
                  </span>
                  {lp.player.position && (
                    <span className="text-[10px] text-slate-500 uppercase">
                      {lp.player.position}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Officials */}
        {officials.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                👔 Ofisial ({officials.length})
              </span>
            </div>
            <div className="space-y-1.5">
              {officials.map((o) => {
                const displayName = o.official?.fullName || o.fullName || '-';
                const displayRole = o.official?.role || o.role;
                const displayPhoto = o.official?.photoUrl || o.photoUrl;
                return (
                  <div
                    key={o.id || o.officialId}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-800/30 border border-white/5"
                  >
                    <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden border border-slate-600 shrink-0">
                      {displayPhoto ? (
                        <img src={displayPhoto} alt={displayName} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-[10px] font-semibold text-slate-400">
                          {displayName.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <span className="text-sm text-slate-200 flex-1">{displayName}</span>
                    {o.isHeadCoach && (
                      <span className="px-1.5 py-0.5 text-[10px] font-bold bg-blue-500/20 text-blue-400 rounded border border-blue-500/30">
                        HC
                      </span>
                    )}
                    <span className="text-[10px] text-slate-500">
                      {ROLE_LABELS[displayRole] || displayRole}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Card>
    );
  };

  // ─── Loading skeleton ─────────────────────────────────────────────
  if (loadingEvents) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48 rounded-lg" />
        </div>
        <Skeleton className="h-36 rounded-xl" />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-48 rounded-2xl" />
            <Skeleton className="h-24 rounded-xl" />
          </div>
          <Skeleton className="h-72 rounded-xl" />
        </div>
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* ──── Top Bar: Title + Connection Status ──── */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-100">Skor Langsung</h1>
        {selectedMatchId && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/60 border border-slate-700/40">
            <div
              className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50' : 'bg-red-500'
              }`}
            />
            <span className="text-xs font-medium text-slate-400">
              {isConnected ? 'Terhubung' : 'Terputus'}
            </span>
          </div>
        )}
      </div>

      {/* ──── Errors ──── */}
      {(fetchError || socketError) && (
        <div className="rounded-xl p-4 border border-red-700/40 bg-red-950/30">
          <p className="text-red-400 text-sm">{fetchError || socketError}</p>
          {fetchError && (
            <Button size="sm" className="mt-2" onClick={fetchEvents}>
              Coba Lagi
            </Button>
          )}
        </div>
      )}

      {/* ──── Match Selector: 3-step cascade ──── */}
      <div className="rounded-xl border border-slate-700/50 bg-slate-900/60 p-5 space-y-5">

        {/* Step 1: Event */}
        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Pilih Acara (Event)
          </label>
          <select
            value={selectedEventId || ''}
            onChange={(e) => setSelectedEventId(e.target.value || null)}
            className="block w-full rounded-xl border border-slate-600/60 bg-slate-800 px-4 py-3 text-base text-slate-100 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-0 focus:border-emerald-500 focus:ring-emerald-500/30"
          >
            <option value="" className="bg-slate-900 text-slate-100">-- Pilih acara --</option>
            {eventList.map((ev) => (
              <option key={ev.id} value={ev.id} className="bg-slate-900 text-slate-100">
                {ev.name}
              </option>
            ))}
          </select>
          {eventList.length === 0 && (
            <p className="text-xs text-slate-500 mt-2">
              Tidak ada acara. Buat acara terlebih dahulu.
            </p>
          )}
        </div>

        {/* Step 2: Category — shown after event selected */}
        {selectedEventId && (
          <div className="border-t border-white/5 pt-5">
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Pilih Kategori
            </label>
            {loadingCategories ? (
              <div className="flex items-center gap-2 py-2">
                <Spinner className="w-4 h-4 text-emerald-500" />
                <span className="text-xs text-slate-500">Memuat kategori...</span>
              </div>
            ) : (
              <>
                <select
                  value={selectedCategoryId || ''}
                  onChange={(e) => setSelectedCategoryId(e.target.value || null)}
                  className="block w-full rounded-xl border border-slate-600/60 bg-slate-800 px-4 py-3 text-base text-slate-100 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-0 focus:border-emerald-500 focus:ring-emerald-500/30"
                >
                  <option value="" className="bg-slate-900 text-slate-100">-- Pilih kategori --</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id} className="bg-slate-900 text-slate-100">
                      {cat.name}
                    </option>
                  ))}
                </select>
                {categories.length === 0 && (
                  <p className="text-xs text-slate-500 mt-2">
                    Tidak ada kategori untuk acara ini.
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {/* Step 3: Match — shown after category selected */}
        {selectedCategoryId && (
          <div className="border-t border-white/5 pt-5">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Pilih Pertandingan
              </label>
              {/* Completed toggle */}
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showCompleted}
                  onChange={(e) => setShowCompleted(e.target.checked)}
                  className="accent-emerald-500 w-4 h-4 cursor-pointer"
                />
                <span className="text-xs text-slate-400">Tampilkan selesai</span>
              </label>
            </div>

            {loadingMatches ? (
              <div className="flex items-center gap-2 py-2">
                <Spinner className="w-4 h-4 text-emerald-500" />
                <span className="text-xs text-slate-500">Memuat pertandingan...</span>
              </div>
            ) : matches.length > 0 ? (
              <select
                value={selectedMatchId || ''}
                onChange={(e) => setSelectedMatchId(e.target.value || null)}
                className="block w-full rounded-xl border border-slate-600/60 bg-slate-800 px-4 py-3 text-base text-slate-100 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-0 focus:border-emerald-500 focus:ring-emerald-500/30"
              >
                <option value="" className="bg-slate-900 text-slate-100">-- Pilih pertandingan --</option>
                {matches.map((match) => (
                  <option key={match.id} value={match.id} className="bg-slate-900 text-slate-100">
                    {`${getMatchLabel(match)} — ${match.status}`}
                  </option>
                ))}
              </select>
            ) : (
              <div className="flex flex-col items-center py-6 text-center">
                <div className="w-12 h-12 rounded-full bg-slate-800/60 border border-slate-700/40 flex items-center justify-center mb-2">
                  <svg className="w-6 h-6 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-sm text-slate-400 font-medium">Tidak ada pertandingan aktif</p>
                <p className="text-xs text-slate-500 mt-1">
                  {showCompleted
                    ? 'Belum ada pertandingan di kategori ini.'
                    : 'Aktifkan "Tampilkan selesai" untuk melihat pertandingan yang sudah selesai.'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ──── Loading Match Meta ──── */}
      {loadingMeta && selectedMatchId && (
        <div className="flex justify-center py-12">
          <Spinner className="w-8 h-8 text-emerald-500" />
        </div>
      )}

      {/* ──── Match Content ──── */}
      {selectedMatchId && selectedMatchMeta && !loadingMeta && (
        <>
          {/* Zone 1 + 2: Scoreboard/Controls (left) + Scoring Panel (right) */}
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Left Column (2/3): Scoreboard + Time Config + Controls */}
            <div className="lg:col-span-2 space-y-5">
              {/* Scoreboard */}
              <ScoreBoard
                homeTeam={homeName}
                awayTeam={awayName}
                score={{ homeScore, awayScore }}
                status={status}
                currentPeriod={currentPeriod}
                periodScores={matchState?.score?.periodScores}
                timerState={matchState?.timerState}
              />

              {/* Time Config — subtle info bar */}
              {timeConfig && (
                <div className="flex items-center justify-between rounded-xl bg-slate-800/40 border border-slate-700/30 px-4 py-3">
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                    <span>⏱ {timeConfig.matchDurationMinutes} menit</span>
                    <span>📋 {timeConfig.halfCount} babak</span>
                    <span>☕ {timeConfig.breakDurationMinutes} menit istirahat</span>
                    {timeConfig.injuryTimeMinutes > 0 && (
                      <span>🩹 +{timeConfig.injuryTimeMinutes} menit injury</span>
                    )}
                    <span className="text-slate-500">
                      ({Math.round(timeConfig.matchDurationMinutes / timeConfig.halfCount)} menit/babak)
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider whitespace-nowrap ml-4">
                    {timeConfig.source === 'match'
                      ? 'Pertandingan'
                      : timeConfig.source === 'category'
                        ? 'Kategori'
                        : 'Default'}
                  </span>
                </div>
              )}

              {/* Match Controls */}
              <Card className="p-6">
                <MatchControls
                  matchId={selectedMatchId}
                  status={status}
                  onStartMatch={startMatch}
                  onEndMatch={endMatch}
                  onStartPeriod={() => startPeriod()}
                  onEndPeriod={() => endPeriod()}
                  timerState={matchState?.timerState}
                  onStartTimer={startTimer}
                  onPauseTimer={pauseTimer}
                  onSetAddedTime={setAddedTime}
                  onSetDirection={setTimerDirection}
                  onAdjustTimer={adjustTimer}
                />
              </Card>
            </div>

            {/* Right Column (1/3): Scoring Panel + Undo */}
            <div className="space-y-4">
              {isLiveStatus && (
                <Card className="p-5">
                  <ScoringPanel
                    sportSlug={sportSlug}
                    matchId={selectedMatchId}
                    homeTeam={{
                      id: homeTeamId,
                      name: homeName,
                      players: homePlayers,
                    }}
                    awayTeam={{
                      id: awayTeamId,
                      name: awayName,
                      players: awayPlayers,
                    }}
                    onEvent={sendEvent}
                  />

                  {/* Undo Button */}
                  {events.length > 0 && (
                    <div className="mt-5 pt-4 border-t border-slate-700/40">
                      <Button
                        variant="ghost"
                        onClick={undoEvent}
                        className="w-full h-11 border border-slate-600/40 text-slate-400 hover:text-red-400 hover:border-red-700/40 hover:bg-red-950/20 rounded-xl transition-all"
                      >
                        ↩ Batalkan Aksi Terakhir
                      </Button>
                    </div>
                  )}
                </Card>
              )}

              {/* Placeholder when not live */}
              {!isLiveStatus && (
                <Card className="p-8">
                  <div className="flex flex-col items-center text-center py-4">
                    <div className="w-14 h-14 rounded-full bg-slate-800/80 border border-slate-700/50 flex items-center justify-center mb-3">
                      <svg className="w-7 h-7 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <p className="text-sm text-slate-400 font-medium">Panel Skor</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Mulai pertandingan untuk mengakses kontrol pencatatan skor
                    </p>
                  </div>
                </Card>
              )}
            </div>
          </div>

          {/* ──── Team Lineups — Two Column (below scoreboard) ──── */}
          <div className="grid gap-6 md:grid-cols-2">
            {renderTeamLineup(homeLineup, homeOfficials, `🏠 ${homeName}`, 'home')}
            {renderTeamLineup(awayLineup, awayOfficials, `✈️ ${awayName}`, 'away')}
          </div>

          {/* ──── POTM Section — visible when COMPLETED ──── */}
          {isCompletedStatus && (
            <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-950/30 via-slate-900 to-slate-950 overflow-hidden">
              {/* Header strip */}
              <div className="flex items-center gap-3 px-5 py-4 border-b border-amber-500/20 bg-amber-950/20">
                <span className="text-amber-400 text-lg">⭐</span>
                <div>
                  <h3 className="text-sm font-bold text-amber-300 uppercase tracking-widest">Player of The Match</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {homeScore !== awayScore
                      ? potmCurrentId
                        ? 'Auto-generated — dapat diubah sebelum dikunci'
                        : 'Pilih pemain terbaik pertandingan ini'
                      : 'Seri — pilih POTM secara manual'}
                  </p>
                </div>
                {potmLocked && (
                  <span className="ml-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[11px] font-bold">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    Terpublikasi
                  </span>
                )}
              </div>

              <div className="p-5 space-y-4">
                {/* Current POTM preview */}
                {potmCurrentId && (() => {
                  const c = potmCandidates.find((p) => p.playerId === potmCurrentId);
                  if (!c) return null;
                  return (
                    <div className="flex items-center gap-3 rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-3">
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-700 border border-amber-500/30 flex-shrink-0">
                        {c.photoUrl ? (
                          <img src={c.photoUrl} alt={c.fullName} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white truncate">{c.fullName}</p>
                        <p className="text-[11px] text-slate-400">{c.teamName}{c.jerseyNumber != null ? ` · #${c.jerseyNumber}` : ''}</p>
                      </div>
                      <span className="text-amber-400 text-lg flex-shrink-0">⭐</span>
                    </div>
                  );
                })()}

                {/* Dropdown selector */}
                {!potmLocked && (
                  <div className="space-y-3">
                    <select
                      value={potmSelectedId}
                      onChange={(e) => setPotmSelectedId(e.target.value)}
                      className="block w-full rounded-xl border border-slate-600/60 bg-slate-800 px-4 py-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/60"
                    >
                      <option value="" className="bg-slate-900">-- Pilih pemain --</option>
                      {potmCandidates.length > 0 && [
                        ...new Set(potmCandidates.map((c) => c.teamName)),
                      ].map((teamName) => (
                        <optgroup key={teamName} label={teamName} className="bg-slate-900 text-slate-400">
                          {potmCandidates
                            .filter((c) => c.teamName === teamName)
                            .map((c) => (
                              <option key={c.playerId} value={c.playerId} className="bg-slate-900 text-slate-100">
                                {c.isStarter ? '' : '[C] '}{c.fullName}{c.jerseyNumber != null ? ` #${c.jerseyNumber}` : ''}
                              </option>
                            ))}
                        </optgroup>
                      ))}
                    </select>

                    {potmError && (
                      <p className="text-xs text-red-400 flex items-center gap-1">
                        <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 3a9 9 0 100 18A9 9 0 0012 3z" />
                        </svg>
                        {potmError}
                      </p>
                    )}

                    <div className="flex gap-2">
                      <Button
                        onClick={handleSavePotm}
                        disabled={!potmSelectedId || potmSaving}
                        className="flex-1 h-10 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold disabled:opacity-50"
                      >
                        {potmSaving ? 'Menyimpan...' : 'Simpan Draft'}
                      </Button>
                      <Button
                        onClick={handleLockPotm}
                        disabled={!potmCurrentId || potmLocking}
                        className="flex-1 h-10 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-semibold disabled:opacity-50"
                      >
                        {potmLocking ? 'Mengunci...' : 'Publikasikan'}
                      </Button>
                    </div>
                  </div>
                )}

                {potmLocked && !potmCurrentId && (
                  <p className="text-xs text-slate-500 italic text-center py-2">Tidak ada POTM yang dipilih.</p>
                )}
              </div>
            </div>
          )}

          {/* Zone 3: Full-width Event Log */}
          <EventLog
            events={events}
            homeTeamId={homeTeamId}
            awayTeamId={awayTeamId}
          />
        </>
      )}

      {/* ──── No Match Selected — Empty State ──── */}
      {!selectedMatchId && !loadingMatches && (
        <div className="rounded-2xl border border-dashed border-slate-700/50 bg-slate-900/30 p-12">
          <div className="flex flex-col items-center text-center">
            <div className="w-20 h-20 rounded-2xl bg-slate-800/60 border border-slate-700/40 flex items-center justify-center mb-5">
              <svg className="w-10 h-10 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-slate-300">
              {!selectedEventId
                ? 'Pilih acara untuk memulai'
                : !selectedCategoryId
                  ? 'Pilih kategori untuk melihat pertandingan'
                  : 'Pilih pertandingan untuk mencatat skor'}
            </h3>
            <p className="text-sm text-slate-500 mt-2 max-w-sm">
              {!selectedEventId
                ? 'Pilih acara dari dropdown di atas, lalu pilih kategori dan pertandingan yang ingin Anda catat.'
                : 'Gunakan dropdown di atas untuk melanjutkan.'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

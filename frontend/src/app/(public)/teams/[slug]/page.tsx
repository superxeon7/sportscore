'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { apiGet } from '@/lib/api/client';
import { Team, Player, Match } from '@/lib/types';
import InitialsAvatar from '@/components/ui/initials-avatar';
import {
  ArrowLeft, MapPin, Calendar, Users, Trophy, Swords,
  Search, X, Shield, Star, User, Flag, Briefcase,
  ChevronRight, ChevronDown, Target, Award, Zap, ExternalLink,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────

type TabKey = 'squad' | 'events' | 'statistics';

interface TeamOfficialData {
  id: string;
  fullName: string;
  role: string;
  photoUrl?: string | null;
}

interface TeamStats {
  played?: number;
  won?: number;
  drawn?: number;
  lost?: number;
  goalsFor?: number;
  goalsAgainst?: number;
  cleanSheets?: number;
  winRate?: number;
  [key: string]: unknown;
}

interface StatPlayer {
  id: string;
  fullName: string;
  jerseyNumber: number | null;
  photoUrl: string | null;
}

interface DivisionStat {
  divisionId: string;
  divisionName: string;
  topScorer: { player: StatPlayer; goals: number } | null;
  topAssist: { player: StatPlayer; assists: number } | null;
}

// ─── Constants ───────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  HEAD_COACH: 'Pelatih Kepala',
  ASSISTANT_COACH: 'Asisten Pelatih',
  MANAGER: 'Manajer',
  GOALKEEPER_COACH: 'Pelatih Kiper',
  FITNESS_COACH: 'Pelatih Fisik',
  PHYSIOTHERAPIST: 'Fisioterapi',
  DOCTOR: 'Dokter Tim',
  OTHER: 'Ofisial',
};

/** Sort priority: age divisions (U-numbers) first by number, then 'senior', then alphabetical. */
function getDivisionSortKey(name: string): string {
  const lower = name.toLowerCase();
  const uMatch = lower.match(/u(\d+)/);
  if (uMatch) return `0_${uMatch[1].padStart(3, '0')}`; // U12→0_012, U18→0_018
  if (lower.includes('senior')) return '1_senior';
  return `2_${lower}`;
}

function getAge(dob: string): number {
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function getPositionColor(pos?: string): string {
  if (!pos) return 'bg-slate-500/15 text-slate-400 border-slate-500/20';
  const p = pos.toLowerCase();
  if (p.includes('goal') || p.includes('kiper') || p.includes('gk')) return 'bg-amber-500/15 text-amber-400 border-amber-500/20';
  if (p.includes('defend') || p.includes('back') || p.includes('bek') || p.includes('anchor')) return 'bg-blue-500/15 text-blue-400 border-blue-500/20';
  if (p.includes('mid') || p.includes('flank') || p.includes('gelandang')) return 'bg-purple-500/15 text-purple-400 border-purple-500/20';
  if (p.includes('forw') || p.includes('pivot') || p.includes('striker') || p.includes('penyerang')) return 'bg-red-500/15 text-red-400 border-red-500/20';
  return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20';
}

function getPositionShort(pos?: string): string {
  if (!pos) return '-';
  const p = pos.toLowerCase();
  if (p.includes('goal') || p.includes('kiper')) return 'GK';
  if (p.includes('defender') || p.includes('back') || p.includes('bek')) return 'DF';
  if (p.includes('anchor')) return 'AN';
  if (p.includes('flank')) return 'FL';
  if (p.includes('mid') || p.includes('gelandang')) return 'MF';
  if (p.includes('pivot')) return 'PV';
  if (p.includes('forw') || p.includes('striker') || p.includes('penyerang')) return 'FW';
  return pos.substring(0, 2).toUpperCase();
}

// ─── Main Page ───────────────────────────────────────────

export default function TeamDetailPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [team, setTeam] = useState<Team | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [officials, setOfficials] = useState<TeamOfficialData[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [statistics, setStatistics] = useState<TeamStats | null>(null);
  const [divisionStats, setDivisionStats] = useState<DivisionStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<TabKey>('squad');
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedDivisions, setCollapsedDivisions] = useState<Record<string, boolean>>({});
  const [showMobileDetail, setShowMobileDetail] = useState(false);

  useEffect(() => {
    async function fetchTeam() {
      setLoading(true);
      setError(null);
      try {
        const res = await apiGet<any>(`/teams/by-slug/${slug}`);
        const teamData = Array.isArray(res) ? res[0] : (res?.data || res);
        setTeam(teamData);

        // Extract inline data
        const inlinePlayers: Player[] = teamData.players || [];
        setPlayers(inlinePlayers);
        setOfficials((teamData as any).teamOfficials || []);
        if (inlinePlayers.length > 0) setSelectedPlayer(inlinePlayers[0]);

        // Fetch additional data (parallel, non-blocking)
        const [matchesRes, statsRes, divStatsRes] = await Promise.allSettled([
          apiGet<any>(`/matches/public?teamId=${teamData.id}&limit=20`),
          apiGet<any>(`/statistics/teams/${teamData.id}`),
          apiGet<any>(`/statistics/teams/${teamData.id}/divisions`),
        ]);

        if (matchesRes.status === 'fulfilled') {
          setMatches(Array.isArray(matchesRes.value) ? matchesRes.value : (matchesRes.value?.data || []));
        }
        if (statsRes.status === 'fulfilled') {
          setStatistics(statsRes.value?.data || statsRes.value || null);
        }
        if (divStatsRes.status === 'fulfilled') {
          const raw = divStatsRes.value;
          setDivisionStats(Array.isArray(raw) ? raw : (raw?.data || []));
        }
      } catch {
        setError('Gagal memuat detail tim.');
      } finally {
        setLoading(false);
      }
    }

    if (slug) fetchTeam();
  }, [slug]);

  // Search-filter players
  const searchResults = useMemo(() => {
    if (!searchQuery) return players;
    const q = searchQuery.toLowerCase();
    return players.filter((p) =>
      p.fullName.toLowerCase().includes(q) ||
      (p.jerseyNumber != null && String(p.jerseyNumber).includes(q))
    );
  }, [players, searchQuery]);

  // Group players by division, sorted
  const groupedByDivision = useMemo(() => {
    const map: Record<string, Player[]> = {};
    searchResults.forEach((p) => {
      const key = (p as any).division?.name || 'Tanpa Divisi';
      if (!map[key]) map[key] = [];
      map[key].push(p);
    });
    // Sort within each division by jersey number
    Object.values(map).forEach((arr) => arr.sort((a, b) => (a.jerseyNumber ?? 999) - (b.jerseyNumber ?? 999)));
    // Sort division keys
    const sorted = Object.keys(map).sort((a, b) => getDivisionSortKey(a).localeCompare(getDivisionSortKey(b)));
    return sorted.map((name) => ({ name, players: map[name] }));
  }, [searchResults]);

  // Map divisionName -> DivisionStat for fast lookup
  const divisionStatsMap = useMemo(() => {
    const map = new Map<string, DivisionStat>();
    for (const ds of divisionStats) {
      map.set(ds.divisionName, ds);
    }
    return map;
  }, [divisionStats]);

  const toggleDivision = useCallback((name: string) => {
    setCollapsedDivisions((prev) => ({ ...prev, [name]: !prev[name] }));
  }, []);

  // Derived tournament events from matches
  const tournamentEvents = useMemo(() => {
    const map = new Map<string, { name: string; id: string; type: string; matchCount: number; status?: string }>();
    matches.forEach((m) => {
      if (m.tournament) {
        const key = m.tournament.id;
        if (!map.has(key)) {
          map.set(key, {
            id: m.tournament.id,
            name: m.tournament.name,
            type: m.tournament.type,
            matchCount: 0,
            status: m.tournament.status,
          });
        }
        map.get(key)!.matchCount++;
      }
    });
    return Array.from(map.values());
  }, [matches]);

  const handlePlayerSelect = useCallback((player: Player) => {
    setSelectedPlayer(player);
    setShowMobileDetail(true);
  }, []);

  // ─── Loading State ─────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="animate-pulse space-y-6">
            <div className="flex items-center gap-6">
              <div className="w-24 h-24 rounded-full bg-white/[0.03] border border-white/[0.06]" />
              <div className="space-y-3 flex-1">
                <div className="h-8 w-56 bg-white/[0.03] rounded-lg" />
                <div className="h-4 w-40 bg-white/[0.03] rounded" />
              </div>
            </div>
            <div className="flex gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 w-28 bg-white/[0.03] rounded-lg" />
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 h-96 bg-white/[0.03] rounded-xl border border-white/[0.06]" />
              <div className="h-96 bg-white/[0.03] rounded-xl border border-white/[0.06]" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Error State ───────────────────────────────────────
  if (error || !team) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Tim Tidak Ditemukan</h2>
          <p className="text-slate-400 mb-6">{error || 'Tim yang Anda cari tidak ditemukan.'}</p>
          <Link
            href="/teams"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Kembali ke Tim
          </Link>
        </div>
      </div>
    );
  }

  const headCoach = officials.find((o) => o.role === 'HEAD_COACH');

  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: 'squad', label: 'Skuad', icon: <Users className="w-4 h-4" /> },
    { key: 'events', label: 'Events', icon: <Trophy className="w-4 h-4" /> },
    { key: 'statistics', label: 'Statistik', icon: <Target className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen pb-16">
      {/* ═══ HERO HEADER ═══ */}
      <section className="relative overflow-hidden border-b border-white/[0.06]">
        {/* Background mesh */}
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/20 via-transparent to-blue-900/10" />
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Back link */}
          <Link href="/teams" className="inline-flex items-center text-slate-400 hover:text-white text-sm mb-6 transition-colors gap-1.5 group">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            Kembali ke Tim
          </Link>

          <div className="flex flex-col lg:flex-row lg:items-start gap-6 lg:gap-8">
            {/* LEFT: Club Identity */}
            <div className="flex items-start gap-5 flex-1">
              {/* Logo */}
              <div className="relative flex-shrink-0">
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden border-2 border-emerald-500/30 bg-[#0c1222] shadow-lg shadow-emerald-900/20">
                  {team.logoUrl ? (
                    <Image src={team.logoUrl} alt={team.name} width={112} height={112} className="w-full h-full object-cover" unoptimized />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-emerald-500/10">
                      <span className="text-3xl font-black text-emerald-400">
                        {(team.shortName || team.name || '??').substring(0, 2).toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>
                {/* Glow ring */}
                <div className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-blue-500/20 -z-10 blur-sm" />
              </div>

              {/* Info */}
              <div className="min-w-0 pt-1">
                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight truncate">
                  {team.name}
                </h1>
                {team.shortName && (
                  <p className="text-sm text-slate-500 font-semibold mt-0.5">{team.shortName}</p>
                )}

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2.5 text-sm text-slate-400">
                  {(team.city || team.country) && (
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-500" />
                      {team.city && team.country ? `${team.city}, ${team.country}` : team.city || team.country}
                    </span>
                  )}
                  {team.foundedYear && (
                    <span className="inline-flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-500" />
                      Est. {team.foundedYear}
                    </span>
                  )}
                  {headCoach && (
                    <span className="inline-flex items-center gap-1.5">
                      <Briefcase className="w-3.5 h-3.5 text-slate-500" />
                      {headCoach.fullName}
                    </span>
                  )}
                </div>

                {team.description && (
                  <p className="text-xs text-slate-500 mt-2 max-w-lg line-clamp-2">{team.description}</p>
                )}
              </div>
            </div>

            {/* RIGHT: Quick Stats Card */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4 gap-2.5 lg:w-80 xl:w-auto">
              {[
                { label: 'Pemain', value: players.length, icon: <Users className="w-4 h-4" />, color: 'text-emerald-400' },
                { label: 'Turnamen', value: tournamentEvents.length, icon: <Trophy className="w-4 h-4" />, color: 'text-blue-400' },
                { label: 'Pertandingan', value: statistics?.played ?? matches.length, icon: <Swords className="w-4 h-4" />, color: 'text-purple-400' },
                { label: 'Menang', value: statistics?.won ?? '-', icon: <Award className="w-4 h-4" />, color: 'text-amber-400' },
              ].map((stat) => (
                <div key={stat.label} className="bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3 text-center hover:bg-white/[0.05] transition-colors">
                  <div className={`text-2xl font-black ${stat.color}`}>{stat.value}</div>
                  <div className="text-[11px] text-slate-500 font-medium mt-0.5 flex items-center justify-center gap-1">
                    {stat.icon}
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══ TAB NAVIGATION ═══ */}
      <div className="border-b border-white/[0.06] bg-[#080d1a]/80 backdrop-blur-lg sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex gap-1 -mb-px" aria-label="Tabs">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`
                  flex items-center gap-2 whitespace-nowrap py-3.5 px-4 border-b-2 text-sm font-semibold transition-all
                  ${activeTab === tab.key
                    ? 'border-emerald-400 text-emerald-400'
                    : 'border-transparent text-slate-500 hover:text-slate-300 hover:border-slate-700'
                  }
                `}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* ═══ TAB CONTENT ═══ */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

        {/* ─── SQUAD TAB ─── */}
        {activeTab === 'squad' && (
          <div className="flex flex-col lg:flex-row gap-6">
            {/* LEFT: Player List */}
            <div className="flex-1 min-w-0">
              {/* Search Bar */}
              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Cari pemain di semua divisi..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="input-dark w-full pl-9 pr-8 text-sm"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Division Groups */}
              {groupedByDivision.length > 0 ? (
                <div className="space-y-4">
                  {groupedByDivision.map((group) => {
                    const isCollapsed = collapsedDivisions[group.name] ?? false;
                    return (
                      <div key={group.name} className="glass-card p-0 overflow-hidden">
                        {/* Division Header — collapsible */}
                        <button
                          onClick={() => toggleDivision(group.name)}
                          className="w-full flex items-center justify-between px-4 py-3 bg-white/[0.02] hover:bg-white/[0.04] transition-colors border-b border-white/[0.06]"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-2 h-2 rounded-full bg-emerald-400" />
                            <h3 className="text-sm font-bold text-white uppercase tracking-wide">{group.name}</h3>
                            <span className="text-[11px] text-slate-500 font-medium">
                              {group.players.length} pemain
                            </span>
                          </div>
                          <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`} />
                        </button>

                        {/* Player Rows */}
                        {!isCollapsed && (
                          <div className="divide-y divide-white/[0.04]">
                            {group.players.map((player) => {
                              const isSelected = selectedPlayer?.id === player.id;
                              return (
                                <div
                                  key={player.id}
                                  className={`flex items-center transition-all group/row ${isSelected
                                      ? 'bg-emerald-500/[0.08] border-l-2 border-l-emerald-400'
                                      : 'hover:bg-white/[0.03] border-l-2 border-l-transparent'
                                    }`}
                                >
                                  {/* Select player button (panel) */}
                                  <button
                                    onClick={() => handlePlayerSelect(player)}
                                    className="flex-1 flex items-center gap-3 px-4 py-3 text-left min-w-0"
                                  >
                                    {/* Jersey Number */}
                                    <div className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center flex-shrink-0">
                                      <span className="text-xs font-bold text-white">
                                        {player.jerseyNumber ?? '-'}
                                      </span>
                                    </div>

                                    {/* Photo */}
                                    <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 bg-white/[0.04]">
                                      {player.photoUrl ? (
                                        <Image src={player.photoUrl} alt={player.fullName} width={36} height={36} className="w-full h-full object-cover" unoptimized />
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                          <User className="w-4 h-4 text-slate-600" />
                                        </div>
                                      )}
                                    </div>

                                    {/* Name + Position */}
                                    <div className="flex-1 min-w-0">
                                      <span className={`text-sm font-semibold truncate block ${isSelected ? 'text-emerald-400' : 'text-white'}`}>
                                        {player.fullName}
                                      </span>
                                      {player.position && (
                                        <span className="text-[11px] text-slate-500">{player.position}</span>
                                      )}
                                    </div>

                                    {/* Position badge */}
                                    <span className={`hidden sm:inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border ${getPositionColor(player.position)}`}>
                                      {getPositionShort(player.position)}
                                    </span>

                                    <ChevronRight className={`w-4 h-4 flex-shrink-0 transition-colors ${isSelected ? 'text-emerald-400' : 'text-slate-600 group-hover/row:text-slate-400'}`} />
                                  </button>

                                  {/* Profile link icon */}
                                  <Link
                                    href={`/player/${player.id}`}
                                    className="pr-3 pl-1 self-stretch flex items-center opacity-0 group-hover/row:opacity-100 transition-opacity"
                                    title="Lihat profil pemain"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
                                  </Link>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="glass-card py-12 text-center text-slate-500">
                  <Search className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                  <p className="text-sm">Tidak ada pemain ditemukan.</p>
                </div>
              )}

              {/* Staff / Officials */}
              {officials.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Briefcase className="w-3.5 h-3.5" />
                    Ofisial Tim
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {officials.map((official) => (
                      <div key={official.id} className="glass-card p-3.5 flex items-center gap-3">
                        <InitialsAvatar
                          name={official.fullName}
                          imageUrl={official.photoUrl}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-white truncate">{official.fullName}</p>
                          <p className="text-[11px] text-slate-500">{ROLE_LABELS[official.role] || official.role}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT: Player Detail Panel (Desktop) */}
            <div className="hidden lg:block w-80 xl:w-96 flex-shrink-0">
              <div className="sticky top-16">
                {selectedPlayer ? (
                  <PlayerDetailCard player={selectedPlayer} />
                ) : (
                  <div className="glass-card p-8 text-center">
                    <User className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                    <p className="text-sm text-slate-500">Pilih pemain untuk melihat detail</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ─── EVENTS TAB ─── */}
        {activeTab === 'events' && (
          <div>
            {tournamentEvents.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {tournamentEvents.map((event) => (
                  <div key={event.id} className="glass-card p-5 group hover:border-emerald-500/20 transition-all">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
                        <Trophy className="w-5 h-5 text-emerald-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-bold text-white truncate group-hover:text-emerald-400 transition-colors">
                          {event.name}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[11px] text-slate-500 font-medium capitalize">
                            {event.type.toLowerCase().replace('_', ' ')}
                          </span>
                          {event.status && (
                            <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold border ${event.status === 'IN_PROGRESS' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20'
                              : event.status === 'COMPLETED' ? 'bg-slate-500/15 text-slate-400 border-slate-500/20'
                                : 'bg-blue-500/15 text-blue-400 border-blue-500/20'
                              }`}>
                              {event.status === 'IN_PROGRESS' ? 'Berlangsung' : event.status === 'COMPLETED' ? 'Selesai' : event.status}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-600 mt-1.5">
                          {event.matchCount} pertandingan
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : matches.length > 0 ? (
              /* Fallback: show recent matches */
              <div>
                <h3 className="text-sm font-bold text-slate-400 mb-4">Pertandingan Terbaru</h3>
                <div className="space-y-2.5">
                  {matches.slice(0, 10).map((match) => (
                    <Link key={match.id} href={`/matches/${match.id}`} className="glass-card p-4 flex items-center justify-between group hover:border-emerald-500/20 transition-all block">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <Swords className="w-4 h-4 text-slate-500 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-white truncate group-hover:text-emerald-400 transition-colors">
                            {match.homeTeam?.name || 'Home'} vs {match.awayTeam?.name || 'Away'}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {match.tournament?.name || 'Turnamen'} • {match.venue || '-'}
                          </p>
                        </div>
                      </div>
                      {match.matchScore && (
                        <span className="text-sm font-bold text-white ml-3">
                          {match.matchScore.homeScore} - {match.matchScore.awayScore}
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-16">
                <Trophy className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400 font-medium">Belum ada event terdaftar.</p>
              </div>
            )}
          </div>
        )}

        {/* ─── STATISTICS TAB ─── */}
        {activeTab === 'statistics' && (
          <div className="space-y-8">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { label: 'Main', value: statistics?.played ?? 0, color: 'text-white', accent: 'from-slate-500/20 to-slate-500/5' },
                { label: 'Menang', value: statistics?.won ?? 0, color: 'text-emerald-400', accent: 'from-emerald-500/20 to-emerald-500/5' },
                { label: 'Seri', value: statistics?.drawn ?? 0, color: 'text-amber-400', accent: 'from-amber-500/20 to-amber-500/5' },
                { label: 'Kalah', value: statistics?.lost ?? 0, color: 'text-red-400', accent: 'from-red-500/20 to-red-500/5' },
                { label: 'Gol Masuk', value: statistics?.goalsFor ?? 0, color: 'text-blue-400', accent: 'from-blue-500/20 to-blue-500/5' },
                { label: 'Kebobolan', value: statistics?.goalsAgainst ?? 0, color: 'text-orange-400', accent: 'from-orange-500/20 to-orange-500/5' },
              ].map((stat) => (
                <div key={stat.label} className="relative overflow-hidden glass-card p-4 text-center">
                  <div className={`absolute inset-0 bg-gradient-to-b ${stat.accent} opacity-50`} />
                  <div className="relative">
                    <div className={`text-3xl font-black ${stat.color}`}>{stat.value}</div>
                    <div className="text-[11px] text-slate-500 font-semibold mt-1 uppercase tracking-wider">{stat.label}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Win Rate */}
            {statistics && (statistics.played ?? 0) > 0 && (
              <div className="glass-card p-5">
                <h3 className="text-sm font-bold text-slate-400 mb-3">Rasio Kemenangan</h3>
                <div className="flex items-center gap-4">
                  <div className="flex-1 h-3 bg-white/[0.06] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-700"
                      style={{ width: `${statistics.played ? ((statistics.won ?? 0) / statistics.played) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="text-lg font-black text-emerald-400 tabular-nums">
                    {statistics.played ? (((statistics.won ?? 0) / statistics.played) * 100).toFixed(0) : 0}%
                  </span>
                </div>
              </div>
            )}

            {/* Per-Division Player Stats */}
            {divisionStats.length > 0 ? (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-400 flex items-center gap-2">
                  <Star className="w-4 h-4 text-amber-400" />
                  Statistik Pemain per Divisi
                </h3>
                {divisionStats
                  .slice()
                  .sort((a, b) => getDivisionSortKey(a.divisionName).localeCompare(getDivisionSortKey(b.divisionName)))
                  .map((ds) => (
                    <div key={ds.divisionId} className="glass-card overflow-hidden">
                      {/* Division header */}
                      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/[0.06] bg-white/[0.02]">
                        <div className="w-2 h-2 rounded-full bg-emerald-400" />
                        <h4 className="text-sm font-bold text-white uppercase tracking-wide">{ds.divisionName}</h4>
                      </div>

                      {/* Stat cards */}
                      {!ds.topScorer && !ds.topAssist ? (
                        <div className="px-4 py-5 text-center">
                          <Target className="w-7 h-7 text-slate-700 mx-auto mb-1.5" />
                          <p className="text-xs text-slate-600">Belum ada statistik pemain</p>
                        </div>
                      ) : (
                        <div className="p-4 flex flex-col sm:flex-row gap-3">
                          {ds.topScorer && ds.topAssist && ds.topScorer.player.id === ds.topAssist.player.id ? (
                            <CombinedStatCard
                              player={ds.topScorer.player}
                              goals={ds.topScorer.goals}
                              assists={ds.topAssist.assists}
                            />
                          ) : (
                            <>
                              {ds.topScorer && (
                                <StatCard type="scorer" player={ds.topScorer.player} value={ds.topScorer.goals} />
                              )}
                              {ds.topAssist && (
                                <StatCard type="assist" player={ds.topAssist.player} value={ds.topAssist.assists} />
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            ) : (
              <div className="glass-card p-5">
                <h3 className="text-sm font-bold text-slate-400 mb-3 flex items-center gap-2">
                  <Star className="w-4 h-4 text-amber-400" />
                  Statistik Pemain per Divisi
                </h3>
                <div className="text-center py-8">
                  <Target className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">Belum ada statistik pemain.</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══ MOBILE PLAYER DETAIL MODAL ═══ */}
      {showMobileDetail && selectedPlayer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowMobileDetail(false)} />
          <div className="absolute bottom-0 left-0 right-0 max-h-[85vh] overflow-y-auto rounded-t-2xl bg-[#0c1222] border-t border-white/[0.08] animate-slide-up">
            <div className="sticky top-0 flex items-center justify-between px-5 py-3 bg-[#0c1222]/90 backdrop-blur-md border-b border-white/[0.06]">
              <h3 className="text-sm font-bold text-white">Detail Pemain</h3>
              <button onClick={() => setShowMobileDetail(false)} className="p-1.5 rounded-lg bg-white/[0.06] text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5">
              <PlayerDetailCard player={selectedPlayer} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Division Stat Cards Component ───────────────────────

function DivisionStatCards({ stat }: { stat: DivisionStat | null }) {
  if (!stat) return null;

  const { topScorer, topAssist } = stat;

  // If no stats at all, show empty state
  if (!topScorer && !topAssist) {
    return (
      <div className="px-4 py-3 border-b border-white/[0.04]">
        <p className="text-xs text-slate-600 italic">Belum ada statistik pemain</p>
      </div>
    );
  }

  // Check if same player holds both top scorer and top assist
  const isSamePlayer =
    topScorer &&
    topAssist &&
    topScorer.player.id === topAssist.player.id;

  return (
    <div className="px-4 py-3 border-b border-white/[0.04] flex flex-wrap gap-2.5">
      {isSamePlayer ? (
        /* Single card: player has both badges */
        <CombinedStatCard player={topScorer!.player} goals={topScorer!.goals} assists={topAssist!.assists} />
      ) : (
        <>
          {topScorer && (
            <StatCard
              type="scorer"
              player={topScorer.player}
              value={topScorer.goals}
            />
          )}
          {topAssist && (
            <StatCard
              type="assist"
              player={topAssist.player}
              value={topAssist.assists}
            />
          )}
        </>
      )}
    </div>
  );
}

interface StatCardProps {
  type: 'scorer' | 'assist';
  player: StatPlayer;
  value: number;
}

function StatCard({ type, player, value }: StatCardProps) {
  const isScorer = type === 'scorer';
  const accentBorder = isScorer ? 'border-emerald-500/30' : 'border-blue-500/30';
  const accentBg = isScorer ? 'from-emerald-500/10 to-transparent' : 'from-blue-500/10 to-transparent';
  const accentText = isScorer ? 'text-emerald-400' : 'text-blue-400';
  const accentBadgeBg = isScorer ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' : 'bg-blue-500/15 border-blue-500/30 text-blue-300';
  const label = isScorer ? 'Top Scorer Tim' : 'Top Assist Tim';
  const countLabel = isScorer ? 'Gol' : 'Assist';

  return (
    <Link
      href={`/player/${player.id}`}
      className={`relative overflow-hidden flex items-center gap-3 rounded-xl border ${accentBorder} bg-gradient-to-r ${accentBg} bg-[#0a1020] px-3 py-2.5 min-w-0 w-full sm:w-auto hover:brightness-110 transition-all group`}
    >
      {/* Photo */}
      <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 bg-white/[0.04] border border-white/[0.08]">
        {player.photoUrl ? (
          <Image src={player.photoUrl} alt={player.fullName} width={36} height={36} className="w-full h-full object-cover" unoptimized />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <User className="w-4 h-4 text-slate-600" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold border uppercase tracking-wide ${accentBadgeBg}`}>
            {isScorer ? <Target className="w-2.5 h-2.5" /> : <Zap className="w-2.5 h-2.5" />}
            {label}
          </span>
        </div>
        <p className="text-sm font-bold text-white truncate leading-tight group-hover:text-emerald-400 transition-colors">{player.fullName}</p>
        <p className="text-[11px] text-slate-500">
          {player.jerseyNumber != null ? `#${player.jerseyNumber}` : ''}
        </p>
      </div>

      {/* Count */}
      <div className="flex-shrink-0 text-right">
        <div className={`text-2xl font-black ${accentText} leading-none`}>{value}</div>
        <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">{countLabel}</div>
      </div>
    </Link>
  );
}

interface CombinedStatCardProps {
  player: StatPlayer;
  goals: number;
  assists: number;
}

function CombinedStatCard({ player, goals, assists }: CombinedStatCardProps) {
  return (
    <Link
      href={`/player/${player.id}`}
      className="relative overflow-hidden flex items-center gap-3 rounded-xl border border-purple-500/30 bg-gradient-to-r from-purple-500/10 to-transparent bg-[#0a1020] px-3 py-2.5 w-full sm:w-auto hover:brightness-110 transition-all group"
    >
      {/* Photo */}
      <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 bg-white/[0.04] border border-white/[0.08]">
        {player.photoUrl ? (
          <Image src={player.photoUrl} alt={player.fullName} width={36} height={36} className="w-full h-full object-cover" unoptimized />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <User className="w-4 h-4 text-slate-600" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-1 mb-0.5">
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold border bg-emerald-500/15 border-emerald-500/30 text-emerald-300 uppercase tracking-wide">
            <Target className="w-2.5 h-2.5" />
            Top Scorer Tim
          </span>
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold border bg-blue-500/15 border-blue-500/30 text-blue-300 uppercase tracking-wide">
            <Zap className="w-2.5 h-2.5" />
            Top Assist Tim
          </span>
        </div>
        <p className="text-sm font-bold text-white truncate leading-tight group-hover:text-emerald-400 transition-colors">{player.fullName}</p>
        <p className="text-[11px] text-slate-500">
          {player.jerseyNumber != null ? `#${player.jerseyNumber}` : ''}
        </p>
      </div>

      {/* Counts */}
      <div className="flex-shrink-0 flex gap-3">
        <div className="text-right">
          <div className="text-xl font-black text-emerald-400 leading-none">{goals}</div>
          <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Gol</div>
        </div>
        <div className="text-right">
          <div className="text-xl font-black text-blue-400 leading-none">{assists}</div>
          <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Assist</div>
        </div>
      </div>
    </Link>
  );
}

// ─── Player Detail Card Component ────────────────────────

function PlayerDetailCard({ player }: { player: Player }) {
  const age = player.dateOfBirth ? getAge(player.dateOfBirth) : null;

  return (
    <div className="space-y-4">
      {/* Main Card */}
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.04] to-transparent">
        {/* Gradient accent */}
        <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-emerald-500/10 to-transparent" />

        <div className="relative p-5 text-center">
          {/* Photo */}
          <div className="w-24 h-24 rounded-2xl mx-auto mb-3 overflow-hidden border-2 border-emerald-500/20 bg-[#0c1222]">
            {player.photoUrl ? (
              <Image src={player.photoUrl} alt={player.fullName} width={96} height={96} className="w-full h-full object-cover" unoptimized />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-emerald-500/5">
                <User className="w-10 h-10 text-slate-600" />
              </div>
            )}
          </div>

          {/* Jersey Number */}
          {player.jerseyNumber != null && (
            <div className="absolute top-4 right-4 w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
              <span className="text-lg font-black text-emerald-400">{player.jerseyNumber}</span>
            </div>
          )}

          {/* Name */}
          <h2 className="text-lg font-black text-white">{player.fullName}</h2>

          {/* Position Badge */}
          {player.position && (
            <span className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-bold border mt-2 ${getPositionColor(player.position)}`}>
              {player.position}
            </span>
          )}
        </div>
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-2 gap-2.5">
        {[
          { label: 'Usia', value: age ? `${age} tahun` : '-', icon: <Calendar className="w-3.5 h-3.5" /> },
          { label: 'Posisi', value: player.position || '-', icon: <Shield className="w-3.5 h-3.5" /> },
          { label: 'No. Punggung', value: player.jerseyNumber ?? '-', icon: <Star className="w-3.5 h-3.5" /> },
          { label: 'Kebangsaan', value: player.nationality || '-', icon: <Flag className="w-3.5 h-3.5" /> },
        ].map((item) => (
          <div key={item.label} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
            <div className="flex items-center gap-1.5 text-slate-500 mb-1">
              {item.icon}
              <span className="text-[10px] font-semibold uppercase tracking-wider">{item.label}</span>
            </div>
            <p className="text-sm font-bold text-white truncate">{item.value}</p>
          </div>
        ))}
      </div>

      {/* Profile link */}
      <Link
        href={`/player/${player.id}`}
        className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-bold hover:bg-emerald-500/20 hover:border-emerald-500/40 transition-all group"
      >
        <ExternalLink className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
        Lihat Profil Lengkap
      </Link>
    </div>
  );
}

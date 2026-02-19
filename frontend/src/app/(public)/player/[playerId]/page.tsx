'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import { apiGet } from '@/lib/api/client';
import {
  ArrowLeft, Share2, Copy, Check, User, Shield, Star, Flag,
  Calendar, Target, Zap, Trophy, Award, Swords, ChevronRight,
  BarChart2, TrendingUp, ChevronDown, Activity,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────

interface TeamInfo {
  id: string;
  name: string;
  shortName: string | null;
  slug: string;
  logoUrl: string | null;
}

interface PlayerData {
  id: string;
  fullName: string;
  jerseyNumber: number | null;
  position: string | null;
  dateOfBirth: string;
  placeOfBirth: string | null;
  nationality: string | null;
  height: number | null;
  weight: number | null;
  photoUrl: string | null;
  team: TeamInfo;
  division: {
    id: string;
    name: string;
    sportType: string | null;
    ageGroup: string | null;
    gender: string | null;
  } | null;
}

interface PlayerTotals {
  goals: number;
  assists: number;
  appearances: number;
  yellowCards: number;
  redCards: number;
  potm: number;
  ownGoals: number;
}

interface CategoryStat {
  categoryId: string;
  categoryName: string;
  sportType: string;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  appearances: number;
  ownGoals: number;
  potm: number;
}

interface MatchHistoryItem {
  matchId: string;
  scheduledAt: string;
  homeTeam: { id: string; name: string; shortName: string | null; logoUrl: string | null };
  awayTeam: { id: string; name: string; shortName: string | null; logoUrl: string | null };
  homeScore: number | null;
  awayScore: number | null;
  categoryId: string;
  categoryName: string;
  tournamentName: string;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  ownGoals: number;
  isPotm: boolean;
  status: string;
}

interface PotmMatch {
  id: string;
  scheduledAt: string;
  homeTeam: { name: string; shortName: string | null };
  awayTeam: { name: string; shortName: string | null };
  matchScore: { homeScore: number; awayScore: number } | null;
  eventCategory: { name: string } | null;
  tournament: { name: string } | null;
}

interface PlayerProfile {
  player: PlayerData;
  totals: PlayerTotals;
  categoryStats: CategoryStat[];
  matchHistory: MatchHistoryItem[];
  potmMatches: PotmMatch[];
}

type TabKey = 'overview' | 'history' | 'statistics' | 'achievements';

// ─── Helpers ─────────────────────────────────────────────

function getAge(dob: string): number {
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function getPositionColor(pos?: string | null): string {
  if (!pos) return 'bg-slate-500/15 text-slate-400 border-slate-500/20';
  const p = pos.toLowerCase();
  if (p.includes('goal') || p.includes('kiper') || p.includes('gk')) return 'bg-amber-500/15 text-amber-400 border-amber-500/20';
  if (p.includes('defend') || p.includes('back') || p.includes('bek') || p.includes('anchor')) return 'bg-blue-500/15 text-blue-400 border-blue-500/20';
  if (p.includes('mid') || p.includes('flank') || p.includes('gelandang')) return 'bg-purple-500/15 text-purple-400 border-purple-500/20';
  if (p.includes('forw') || p.includes('pivot') || p.includes('striker') || p.includes('penyerang')) return 'bg-red-500/15 text-red-400 border-red-500/20';
  return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20';
}

// ─── Custom Tooltip for Charts ───────────────────────────

function CustomChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#0c1525] border border-white/10 rounded-xl p-3 text-xs shadow-xl">
      <p className="text-slate-400 mb-1.5 font-semibold">{label}</p>
      {payload.map((entry: any) => (
        <p key={entry.dataKey} style={{ color: entry.color }} className="font-bold">
          {entry.name}: {entry.value}
        </p>
      ))}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────

export default function PlayerProfilePage() {
  const params = useParams();
  const playerId = params.playerId as string;

  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [copied, setCopied] = useState(false);
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);

  useEffect(() => {
    if (!playerId) return;
    setLoading(true);
    setError(null);
    apiGet<PlayerProfile>(`/players/${playerId}/profile`)
      .then((data) => setProfile(data))
      .catch(() => setError('Gagal memuat profil pemain.'))
      .finally(() => setLoading(false));
  }, [playerId]);

  const categories = useMemo(() => {
    if (!profile) return [];
    return profile.categoryStats.map((c) => ({
      id: c.categoryId,
      name: c.categoryName,
    }));
  }, [profile]);

  const activeCatStat = useMemo((): CategoryStat | null => {
    if (!profile) return null;
    if (selectedCategory === 'all') return null;
    return profile.categoryStats.find((c) => c.categoryId === selectedCategory) ?? null;
  }, [profile, selectedCategory]);

  const displayTotals = useMemo(() => {
    if (!profile) return null;
    if (activeCatStat) return activeCatStat;
    return profile.totals;
  }, [profile, activeCatStat]);

  const filteredHistory = useMemo(() => {
    if (!profile) return [];
    if (selectedCategory === 'all') return profile.matchHistory;
    return profile.matchHistory.filter((m) => m.categoryId === selectedCategory);
  }, [profile, selectedCategory]);

  const last5 = useMemo(() => filteredHistory.slice(0, 5), [filteredHistory]);

  const chartData = useMemo(() => {
    const items = filteredHistory.slice(0, 15).reverse();
    return items.map((m) => ({
      match: `vs ${(m.homeTeam.shortName || m.homeTeam.name).substring(0, 8)}`,
      goals: m.goals,
      assists: m.assists,
    }));
  }, [filteredHistory]);

  const handleShare = useCallback(async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: profile?.player.fullName, url });
      } else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [profile]);

  const selectedCategoryName = useMemo(() => {
    if (selectedCategory === 'all') return 'Semua Kategori';
    return categories.find((c) => c.id === selectedCategory)?.name ?? 'Kategori';
  }, [selectedCategory, categories]);

  // ─── Loading ───────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="animate-pulse space-y-6">
            <div className="h-5 w-32 bg-white/[0.04] rounded" />
            <div className="flex gap-6 items-start">
              <div className="w-32 h-32 rounded-2xl bg-white/[0.04]" />
              <div className="flex-1 space-y-3 pt-2">
                <div className="h-9 w-60 bg-white/[0.04] rounded-lg" />
                <div className="h-5 w-40 bg-white/[0.04] rounded" />
                <div className="h-5 w-28 bg-white/[0.04] rounded" />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-24 bg-white/[0.04] rounded-xl" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Error / Not Found ─────────────────────────────────
  if (error || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
            <User className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-xl font-black text-white mb-2">Pemain Tidak Ditemukan</h2>
          <p className="text-slate-400 text-sm mb-6">{error || 'Profil pemain tidak tersedia.'}</p>
          <Link
            href="/teams"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Kembali
          </Link>
        </div>
      </div>
    );
  }

  const { player, totals, potmMatches } = profile;
  const age = player.dateOfBirth ? getAge(player.dateOfBirth) : null;

  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: 'overview', label: 'Overview', icon: <Activity className="w-4 h-4" /> },
    { key: 'history', label: 'Riwayat', icon: <Swords className="w-4 h-4" /> },
    { key: 'statistics', label: 'Statistik', icon: <BarChart2 className="w-4 h-4" /> },
    { key: 'achievements', label: 'Prestasi', icon: <Trophy className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen pb-16">

      {/* ── HERO HEADER ── */}
      <section className="relative overflow-hidden border-b border-white/[0.06]">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-950/30 via-slate-950 to-blue-950/20" />
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Back + Share row */}
          <div className="flex items-center justify-between mb-6">
            <Link
              href={`/teams/${player.team.slug}`}
              className="inline-flex items-center text-slate-400 hover:text-white text-sm transition-colors gap-1.5 group"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
              {player.team.shortName || player.team.name}
            </Link>

            <button
              onClick={handleShare}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/[0.06] border border-white/[0.08] text-slate-300 hover:text-white hover:bg-white/[0.1] text-xs font-semibold transition-all"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
              {copied ? 'Tersalin!' : 'Bagikan'}
            </button>
          </div>

          <div className="flex flex-col lg:flex-row gap-8 lg:items-start">
            {/* LEFT — Photo + Info */}
            <div className="flex items-start gap-5 flex-1 min-w-0">
              {/* Player photo */}
              <div className="relative flex-shrink-0">
                <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-2xl overflow-hidden border-2 border-emerald-500/30 bg-[#0c1222] shadow-lg shadow-emerald-900/20">
                  {player.photoUrl ? (
                    <Image
                      src={player.photoUrl}
                      alt={player.fullName}
                      width={144}
                      height={144}
                      className="w-full h-full object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-emerald-500/5">
                      <User className="w-14 h-14 text-slate-600" />
                    </div>
                  )}
                </div>
                {/* Jersey number badge */}
                {player.jerseyNumber != null && (
                  <div className="absolute -top-2.5 -right-2.5 w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-900/40">
                    <span className="text-base font-black text-white leading-none">
                      {player.jerseyNumber}
                    </span>
                  </div>
                )}
                <div className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-emerald-500/15 to-blue-500/10 -z-10 blur-md" />
              </div>

              {/* Name + meta */}
              <div className="min-w-0 pt-1">
                <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight leading-tight">
                  {player.fullName}
                </h1>

                {/* Team */}
                <Link
                  href={`/teams/${player.team.slug}`}
                  className="inline-flex items-center gap-2 mt-2 group"
                >
                  {player.team.logoUrl ? (
                    <Image
                      src={player.team.logoUrl}
                      alt={player.team.name}
                      width={20}
                      height={20}
                      className="w-5 h-5 rounded-md object-contain"
                      unoptimized
                    />
                  ) : (
                    <div className="w-5 h-5 rounded-md bg-emerald-500/20 flex items-center justify-center">
                      <Shield className="w-3 h-3 text-emerald-400" />
                    </div>
                  )}
                  <span className="text-sm font-semibold text-slate-300 group-hover:text-emerald-400 transition-colors">
                    {player.team.name}
                  </span>
                </Link>

                <div className="flex flex-wrap items-center gap-2 mt-3">
                  {player.division && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/15 border border-blue-500/20 text-blue-300 text-xs font-bold">
                      <Star className="w-3 h-3" />
                      {player.division.name}
                    </span>
                  )}
                  {player.position && (
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg border text-xs font-bold ${getPositionColor(player.position)}`}>
                      {player.position}
                    </span>
                  )}
                  {player.nationality && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.05] border border-white/[0.08] text-slate-300 text-xs font-semibold">
                      <Flag className="w-3 h-3 text-slate-500" />
                      {player.nationality}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* RIGHT — Stat card grid */}
            <div className="grid grid-cols-4 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4 gap-2.5 lg:w-80 xl:w-auto">
              {[
                {
                  label: 'Usia',
                  value: age ? `${age}` : '-',
                  sub: age ? 'tahun' : '',
                  icon: <Calendar className="w-4 h-4" />,
                  color: 'text-white',
                  iconColor: 'text-slate-400',
                },
                {
                  label: 'Tinggi',
                  value: player.height ? `${player.height}` : '-',
                  sub: player.height ? 'cm' : '',
                  icon: <TrendingUp className="w-4 h-4" />,
                  color: 'text-white',
                  iconColor: 'text-slate-400',
                },
                {
                  label: 'Berat',
                  value: player.weight ? `${player.weight}` : '-',
                  sub: player.weight ? 'kg' : '',
                  icon: <Activity className="w-4 h-4" />,
                  color: 'text-white',
                  iconColor: 'text-slate-400',
                },
                {
                  label: 'Penampilan',
                  value: `${totals.appearances}`,
                  sub: 'match',
                  icon: <Swords className="w-4 h-4" />,
                  color: 'text-purple-400',
                  iconColor: 'text-purple-400',
                },
                {
                  label: 'Gol',
                  value: `${totals.goals}`,
                  sub: '',
                  icon: <Target className="w-4 h-4" />,
                  color: 'text-emerald-400',
                  iconColor: 'text-emerald-400',
                },
                {
                  label: 'Assist',
                  value: `${totals.assists}`,
                  sub: '',
                  icon: <Zap className="w-4 h-4" />,
                  color: 'text-blue-400',
                  iconColor: 'text-blue-400',
                },
                {
                  label: 'K. Kuning',
                  value: `${totals.yellowCards}`,
                  sub: '',
                  icon: <Shield className="w-4 h-4" />,
                  color: 'text-amber-400',
                  iconColor: 'text-amber-400',
                },
                {
                  label: 'POTM',
                  value: `${totals.potm}`,
                  sub: '',
                  icon: <Star className="w-4 h-4" />,
                  color: 'text-yellow-400',
                  iconColor: 'text-yellow-400',
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-3 text-center hover:bg-white/[0.05] transition-colors group"
                >
                  <div className={`flex items-center justify-center mb-1 ${stat.iconColor} opacity-60 group-hover:opacity-100 transition-opacity`}>
                    {stat.icon}
                  </div>
                  <div className={`text-xl font-black ${stat.color} leading-none`}>
                    {stat.value}
                    {stat.sub && <span className="text-[10px] font-semibold text-slate-500 ml-0.5">{stat.sub}</span>}
                  </div>
                  <div className="text-[10px] text-slate-600 font-semibold mt-0.5 uppercase tracking-wider">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── CATEGORY SELECTOR + TABS ── */}
      <div className="border-b border-white/[0.06] bg-[#070c1a]/80 backdrop-blur-lg sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4 py-2">
            {/* Tabs */}
            <nav className="flex gap-0.5 -mb-px" aria-label="Tabs">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`
                    flex items-center gap-1.5 whitespace-nowrap py-3 px-3 border-b-2 text-xs sm:text-sm font-semibold transition-all
                    ${activeTab === tab.key
                      ? 'border-emerald-400 text-emerald-400'
                      : 'border-transparent text-slate-500 hover:text-slate-300 hover:border-slate-700'
                    }
                  `}
                >
                  {tab.icon}
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              ))}
            </nav>

            {/* Category dropdown */}
            {categories.length > 1 && (
              <div className="relative flex-shrink-0">
                <button
                  onClick={() => setCategoryDropdownOpen((v) => !v)}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.05] border border-white/[0.08] text-slate-300 hover:bg-white/[0.08] text-xs font-semibold transition-all max-w-[160px] sm:max-w-[200px]"
                >
                  <Star className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                  <span className="truncate">{selectedCategoryName}</span>
                  <ChevronDown className={`w-3.5 h-3.5 flex-shrink-0 transition-transform ${categoryDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {categoryDropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setCategoryDropdownOpen(false)}
                    />
                    <div className="absolute right-0 top-full mt-1.5 w-56 rounded-xl bg-[#0d1628] border border-white/[0.1] shadow-2xl z-20 overflow-hidden">
                      <div className="py-1">
                        <button
                          onClick={() => { setSelectedCategory('all'); setCategoryDropdownOpen(false); }}
                          className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm font-semibold transition-colors ${selectedCategory === 'all' ? 'bg-emerald-500/10 text-emerald-400' : 'text-slate-300 hover:bg-white/[0.05]'}`}
                        >
                          <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${selectedCategory === 'all' ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                          Semua Kategori
                        </button>
                        {categories.map((cat) => (
                          <button
                            key={cat.id}
                            onClick={() => { setSelectedCategory(cat.id); setCategoryDropdownOpen(false); }}
                            className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm font-semibold transition-colors ${selectedCategory === cat.id ? 'bg-emerald-500/10 text-emerald-400' : 'text-slate-300 hover:bg-white/[0.05]'}`}
                          >
                            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${selectedCategory === cat.id ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                            <span className="truncate">{cat.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── TAB CONTENT ── */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

        {/* ── TAB: OVERVIEW ── */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Summary stat cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { label: 'Gol', value: displayTotals?.goals ?? 0, color: 'text-emerald-400', accent: 'from-emerald-500/15 to-emerald-500/0', border: 'border-emerald-500/15', icon: <Target className="w-5 h-5" /> },
                { label: 'Assist', value: displayTotals?.assists ?? 0, color: 'text-blue-400', accent: 'from-blue-500/15 to-blue-500/0', border: 'border-blue-500/15', icon: <Zap className="w-5 h-5" /> },
                { label: 'Penampilan', value: displayTotals?.appearances ?? 0, color: 'text-purple-400', accent: 'from-purple-500/15 to-purple-500/0', border: 'border-purple-500/15', icon: <Swords className="w-5 h-5" /> },
                { label: 'K. Kuning', value: displayTotals?.yellowCards ?? 0, color: 'text-amber-400', accent: 'from-amber-500/15 to-amber-500/0', border: 'border-amber-500/15', icon: <Shield className="w-5 h-5" /> },
                { label: 'K. Merah', value: displayTotals?.redCards ?? 0, color: 'text-red-400', accent: 'from-red-500/15 to-red-500/0', border: 'border-red-500/15', icon: <Shield className="w-5 h-5" /> },
                { label: 'POTM', value: displayTotals?.potm ?? 0, color: 'text-yellow-400', accent: 'from-yellow-500/15 to-yellow-500/0', border: 'border-yellow-500/15', icon: <Award className="w-5 h-5" /> },
              ].map((stat) => (
                <div key={stat.label} className={`relative overflow-hidden glass-card p-4 text-center border ${stat.border}`}>
                  <div className={`absolute inset-0 bg-gradient-to-b ${stat.accent} opacity-60`} />
                  <div className="relative">
                    <div className={`${stat.color} opacity-50 flex justify-center mb-1`}>{stat.icon}</div>
                    <div className={`text-3xl font-black ${stat.color}`}>{stat.value}</div>
                    <div className="text-[11px] text-slate-500 font-semibold mt-1 uppercase tracking-wider">{stat.label}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Last 5 matches */}
            <div className="glass-card p-5">
              <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                <Swords className="w-4 h-4 text-emerald-400" />
                5 Pertandingan Terakhir
                {selectedCategory !== 'all' && (
                  <span className="text-xs font-normal text-slate-500">— {selectedCategoryName}</span>
                )}
              </h3>

              {last5.length === 0 ? (
                <EmptyState icon={<Swords className="w-8 h-8" />} text="Belum ada riwayat pertandingan." />
              ) : (
                <div className="space-y-2">
                  {last5.map((match) => (
                    <MatchRow key={match.matchId} match={match} playerId={playerId} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB: MATCH HISTORY ── */}
        {activeTab === 'history' && (
          <div className="glass-card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Swords className="w-4 h-4 text-emerald-400" />
                Riwayat Pertandingan
              </h3>
              <span className="text-xs text-slate-500">{filteredHistory.length} match</span>
            </div>

            {filteredHistory.length === 0 ? (
              <div className="p-8">
                <EmptyState icon={<Swords className="w-8 h-8" />} text="Belum ada riwayat pertandingan." />
              </div>
            ) : (
              <>
                {/* Table header */}
                <div className="hidden sm:grid grid-cols-[1fr_80px_60px_60px_60px_36px] gap-3 px-5 py-2.5 bg-white/[0.02] border-b border-white/[0.04] text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                  <span>Pertandingan</span>
                  <span className="text-center">Skor</span>
                  <span className="text-center">Gol</span>
                  <span className="text-center">Assist</span>
                  <span className="text-center">Kartu</span>
                  <span className="text-center">MVP</span>
                </div>

                <div className="divide-y divide-white/[0.04]">
                  {filteredHistory.map((match) => (
                    <div key={match.matchId}>
                      <MatchTableRow match={match} playerId={playerId} />
                      <MatchTableRowMobile match={match} playerId={playerId} />
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── TAB: STATISTICS ── */}
        {activeTab === 'statistics' && (
          <div className="space-y-6">
            {/* Big stat cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { label: 'Gol', value: displayTotals?.goals ?? 0, color: 'text-emerald-400', gradient: 'from-emerald-500/20 to-transparent' },
                { label: 'Assist', value: displayTotals?.assists ?? 0, color: 'text-blue-400', gradient: 'from-blue-500/20 to-transparent' },
                { label: 'Penampilan', value: displayTotals?.appearances ?? 0, color: 'text-purple-400', gradient: 'from-purple-500/20 to-transparent' },
                { label: 'K. Kuning', value: displayTotals?.yellowCards ?? 0, color: 'text-amber-400', gradient: 'from-amber-500/20 to-transparent' },
                { label: 'K. Merah', value: displayTotals?.redCards ?? 0, color: 'text-red-400', gradient: 'from-red-500/20 to-transparent' },
                { label: 'POTM', value: displayTotals?.potm ?? 0, color: 'text-yellow-400', gradient: 'from-yellow-500/20 to-transparent' },
              ].map((s) => (
                <div key={s.label} className="relative overflow-hidden glass-card p-5 text-center">
                  <div className={`absolute inset-0 bg-gradient-to-b ${s.gradient} opacity-50`} />
                  <div className="relative">
                    <div className={`text-4xl font-black ${s.color}`}>{s.value}</div>
                    <div className="text-[11px] text-slate-500 font-semibold mt-1.5 uppercase tracking-wider">{s.label}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Goals ratio bar */}
            {(displayTotals?.appearances ?? 0) > 0 && (
              <div className="glass-card p-5 grid sm:grid-cols-2 gap-5">
                <div>
                  <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-2">Rata-rata Gol per Match</p>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2.5 bg-white/[0.06] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full"
                        style={{ width: `${Math.min(((displayTotals?.goals ?? 0) / Math.max(displayTotals?.appearances ?? 1, 1)) * 100 * 3, 100)}%` }}
                      />
                    </div>
                    <span className="text-lg font-black text-emerald-400 tabular-nums w-14 text-right">
                      {((displayTotals?.goals ?? 0) / Math.max(displayTotals?.appearances ?? 1, 1)).toFixed(2)}
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-2">Rata-rata Assist per Match</p>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2.5 bg-white/[0.06] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full"
                        style={{ width: `${Math.min(((displayTotals?.assists ?? 0) / Math.max(displayTotals?.appearances ?? 1, 1)) * 100 * 3, 100)}%` }}
                      />
                    </div>
                    <span className="text-lg font-black text-blue-400 tabular-nums w-14 text-right">
                      {((displayTotals?.assists ?? 0) / Math.max(displayTotals?.appearances ?? 1, 1)).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Chart */}
            {chartData.length > 0 ? (
              <div className="glass-card p-5">
                <h3 className="text-sm font-bold text-white mb-5 flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-emerald-400" />
                  Kontribusi per Pertandingan
                  <span className="text-xs text-slate-500 font-normal">(15 terakhir)</span>
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} barGap={2} barCategoryGap="30%">
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis
                        dataKey="match"
                        tick={{ fill: '#64748b', fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fill: '#64748b', fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                        width={20}
                      />
                      <Tooltip content={<CustomChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                      <Legend
                        wrapperStyle={{ fontSize: '11px', color: '#94a3b8', paddingTop: '12px' }}
                      />
                      <Bar dataKey="goals" name="Gol" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={24} />
                      <Bar dataKey="assists" name="Assist" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={24} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <div className="glass-card p-8">
                <EmptyState icon={<BarChart2 className="w-8 h-8" />} text="Belum ada data statistik." />
              </div>
            )}

            {/* Per-category breakdown */}
            {profile.categoryStats.length > 1 && (
              <div className="glass-card overflow-hidden">
                <div className="px-5 py-4 border-b border-white/[0.06]">
                  <h3 className="text-sm font-bold text-white">Breakdown per Kategori</h3>
                </div>
                <div className="divide-y divide-white/[0.04]">
                  {profile.categoryStats.map((cs) => (
                    <div key={cs.categoryId} className="px-5 py-4 flex items-center gap-4 hover:bg-white/[0.02] transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white">{cs.categoryName}</p>
                        <p className="text-[11px] text-slate-500">{cs.appearances} penampilan</p>
                      </div>
                      <div className="flex items-center gap-4 text-right">
                        <div>
                          <div className="text-lg font-black text-emerald-400">{cs.goals}</div>
                          <div className="text-[10px] text-slate-600 uppercase">Gol</div>
                        </div>
                        <div>
                          <div className="text-lg font-black text-blue-400">{cs.assists}</div>
                          <div className="text-[10px] text-slate-600 uppercase">Assist</div>
                        </div>
                        <div>
                          <div className="text-lg font-black text-amber-400">{cs.yellowCards}</div>
                          <div className="text-[10px] text-slate-600 uppercase">KK</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TAB: ACHIEVEMENTS ── */}
        {activeTab === 'achievements' && (
          <div className="space-y-6">
            {/* Achievement badges */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {totals.potm > 0 && (
                <AchievementBadge
                  icon="🏆"
                  title="Player of the Match"
                  subtitle={`${totals.potm}x diraih`}
                  color="from-yellow-500/20 to-amber-500/10"
                  border="border-yellow-500/20"
                />
              )}
              {totals.goals >= 5 && (
                <AchievementBadge
                  icon="⚽"
                  title="Top Goalscorer"
                  subtitle={`${totals.goals} gol dicetak`}
                  color="from-emerald-500/20 to-green-500/10"
                  border="border-emerald-500/20"
                />
              )}
              {totals.assists >= 3 && (
                <AchievementBadge
                  icon="🎯"
                  title="Playmaker"
                  subtitle={`${totals.assists} assist diberikan`}
                  color="from-blue-500/20 to-cyan-500/10"
                  border="border-blue-500/20"
                />
              )}
              {totals.appearances >= 10 && (
                <AchievementBadge
                  icon="🥇"
                  title="Veteran"
                  subtitle={`${totals.appearances} pertandingan dimainkan`}
                  color="from-purple-500/20 to-violet-500/10"
                  border="border-purple-500/20"
                />
              )}
              {(totals.goals + totals.assists) === 0 && totals.appearances === 0 && totals.potm === 0 && (
                <div className="sm:col-span-2 lg:col-span-3">
                  <EmptyState icon={<Trophy className="w-8 h-8" />} text="Belum ada prestasi yang dicatat." />
                </div>
              )}
            </div>

            {/* POTM match list */}
            {potmMatches.length > 0 && (
              <div className="glass-card overflow-hidden">
                <div className="flex items-center gap-2.5 px-5 py-4 border-b border-white/[0.06] bg-white/[0.02]">
                  <Trophy className="w-4 h-4 text-yellow-400" />
                  <h3 className="text-sm font-bold text-white">Player of the Match</h3>
                  <span className="ml-auto text-xs text-slate-500">{potmMatches.length}x</span>
                </div>
                <div className="divide-y divide-white/[0.04]">
                  {potmMatches.map((match) => (
                    <div key={match.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-white/[0.02] transition-colors">
                      <div className="w-8 h-8 rounded-full bg-yellow-500/15 border border-yellow-500/20 flex items-center justify-center flex-shrink-0">
                        <Star className="w-4 h-4 text-yellow-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white truncate">
                          {match.homeTeam.shortName || match.homeTeam.name} vs {match.awayTeam.shortName || match.awayTeam.name}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[11px] text-slate-500">{formatDate(match.scheduledAt)}</span>
                          {match.eventCategory && (
                            <span className="text-[11px] text-slate-600">· {match.eventCategory.name}</span>
                          )}
                        </div>
                      </div>
                      {match.matchScore && (
                        <span className="text-sm font-black text-white flex-shrink-0">
                          {match.matchScore.homeScore} – {match.matchScore.awayScore}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-slate-600">
      <div className="mb-3 opacity-40">{icon}</div>
      <p className="text-sm text-slate-500">{text}</p>
    </div>
  );
}

function AchievementBadge({
  icon, title, subtitle, color, border,
}: {
  icon: string; title: string; subtitle: string; color: string; border: string;
}) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border ${border} bg-gradient-to-br ${color} p-5 flex items-center gap-4`}>
      <span className="text-4xl flex-shrink-0">{icon}</span>
      <div>
        <p className="text-sm font-black text-white">{title}</p>
        <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
      </div>
    </div>
  );
}

function MatchRow({ match, playerId }: { match: MatchHistoryItem; playerId: string }) {
  const isHome = true; // display is always from neutral view
  return (
    <Link href={`/matches/${match.matchId}`} className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/[0.04] transition-colors group">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors truncate">
            {match.homeTeam.shortName || match.homeTeam.name}
          </span>
          <span className="text-xs font-black text-slate-400">
            {match.homeScore != null ? `${match.homeScore} – ${match.awayScore}` : 'vs'}
          </span>
          <span className="text-sm font-bold text-white truncate">
            {match.awayTeam.shortName || match.awayTeam.name}
          </span>
          {match.isPotm && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-yellow-500/15 border border-yellow-500/20 text-yellow-400 text-[9px] font-bold">
              <Star className="w-2.5 h-2.5" />MVP
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[11px] text-slate-500">{formatDate(match.scheduledAt)}</span>
          {match.categoryName && <span className="text-[11px] text-slate-600">· {match.categoryName}</span>}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0 text-xs font-bold">
        {match.goals > 0 && (
          <span className="inline-flex items-center gap-0.5 text-emerald-400">
            <Target className="w-3 h-3" />{match.goals}
          </span>
        )}
        {match.assists > 0 && (
          <span className="inline-flex items-center gap-0.5 text-blue-400">
            <Zap className="w-3 h-3" />{match.assists}
          </span>
        )}
        {match.yellowCards > 0 && (
          <span className="w-3.5 h-4.5 bg-amber-400 rounded-sm inline-block" title="K. Kuning" />
        )}
        {match.redCards > 0 && (
          <span className="w-3.5 h-4.5 bg-red-500 rounded-sm inline-block" title="K. Merah" />
        )}
        <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors" />
      </div>
    </Link>
  );
}

function MatchTableRow({ match, playerId }: { match: MatchHistoryItem; playerId: string }) {
  return (
    <Link
      href={`/matches/${match.matchId}`}
      className="hidden sm:grid grid-cols-[1fr_80px_60px_60px_60px_36px] gap-3 px-5 py-3.5 hover:bg-white/[0.03] transition-colors group items-center"
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold text-white group-hover:text-emerald-400 transition-colors truncate">
          {match.homeTeam.shortName || match.homeTeam.name} vs {match.awayTeam.shortName || match.awayTeam.name}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[11px] text-slate-500">{formatDate(match.scheduledAt)}</span>
          {match.categoryName && <span className="text-[11px] text-slate-600 truncate">· {match.categoryName}</span>}
        </div>
      </div>
      <div className="text-center text-sm font-black text-white">
        {match.homeScore != null ? `${match.homeScore} – ${match.awayScore}` : '—'}
      </div>
      <div className="text-center">
        <span className={`text-sm font-black ${match.goals > 0 ? 'text-emerald-400' : 'text-slate-600'}`}>
          {match.goals}
        </span>
      </div>
      <div className="text-center">
        <span className={`text-sm font-black ${match.assists > 0 ? 'text-blue-400' : 'text-slate-600'}`}>
          {match.assists}
        </span>
      </div>
      <div className="flex items-center justify-center gap-1">
        {match.yellowCards > 0 && (
          <span className="w-3.5 h-5 bg-amber-400 rounded-sm flex-shrink-0" />
        )}
        {match.redCards > 0 && (
          <span className="w-3.5 h-5 bg-red-500 rounded-sm flex-shrink-0" />
        )}
        {match.yellowCards === 0 && match.redCards === 0 && (
          <span className="text-slate-700 text-xs">—</span>
        )}
      </div>
      <div className="flex justify-center">
        {match.isPotm ? (
          <Star className="w-4 h-4 text-yellow-400" />
        ) : (
          <span className="text-slate-700 text-xs">—</span>
        )}
      </div>
    </Link>
  );
}

// Mobile fallback for table rows
function MatchTableRowMobile({ match, playerId }: { match: MatchHistoryItem; playerId: string }) {
  return (
    <Link
      href={`/matches/${match.matchId}`}
      className="sm:hidden flex items-start gap-3 px-4 py-3.5 hover:bg-white/[0.03] transition-colors group"
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white group-hover:text-emerald-400 transition-colors truncate">
          {match.homeTeam.shortName || match.homeTeam.name} vs {match.awayTeam.shortName || match.awayTeam.name}
        </p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-[11px] text-slate-500">{formatDate(match.scheduledAt)}</span>
          {match.homeScore != null && (
            <span className="text-[11px] font-black text-white">{match.homeScore} – {match.awayScore}</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0 text-xs font-bold">
        {match.goals > 0 && <span className="text-emerald-400">{match.goals}G</span>}
        {match.assists > 0 && <span className="text-blue-400">{match.assists}A</span>}
        {match.isPotm && <Star className="w-3.5 h-3.5 text-yellow-400" />}
      </div>
    </Link>
  );
}

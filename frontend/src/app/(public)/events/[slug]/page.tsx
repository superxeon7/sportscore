'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { apiGet } from '@/lib/api/client';
import { Match as LibMatch } from '@/lib/types';
import BracketView from '@/components/tournament/bracket-view';
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Building2,
  Shield,
  Trophy,
  Users,
  Target,
  X,
} from 'lucide-react';

// ─── Response types ───────────────────────────────────────────────────────────

interface PublicTeam {
  id: string;
  name: string;
  shortName?: string | null;
  logoUrl?: string | null;
}

interface PublicMatchScore {
  homeScore: number;
  awayScore: number;
}

interface PublicMatch {
  id: string;
  status: string;
  scheduledAt: string;
  stageType?: string | null;
  groupName?: string | null;
  round?: number | null;
  matchDay?: number | null;
  homeTeamId: string;
  awayTeamId: string;
  homeTeam?: PublicTeam | null;
  awayTeam?: PublicTeam | null;
  matchScore?: PublicMatchScore | null;
}

interface StandingRow {
  position: number;
  teamId: string;
  teamName: string;
  teamShortName?: string | null;
  teamLogoUrl?: string | null;
  teamSlug: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

interface TopScorer {
  playerId: string;
  playerName: string;
  photoUrl?: string | null;
  teamId: string;
  teamName: string;
  teamShortName?: string | null;
  teamLogoUrl?: string | null;
  goals: number;
}

interface TeamItem {
  teamId: string;
  teamName: string;
  teamShortName?: string | null;
  teamLogoUrl?: string | null;
  teamSlug: string;
  teamCity?: string | null;
  groupId?: string | null;
  groupName?: string | null;
}

interface CategoryData {
  id: string;
  name: string;
  gender: string;
  sportType: string;
  stages: Array<{ stageOrder: number; stageType: string; groupCount?: number | null }>;
  categoryGroups: Array<{ id: string; name: string }>;
  teams: TeamItem[];
  groupStandings: Record<string, StandingRow[]>;
  allMatches: PublicMatch[];
  knockoutMatches: PublicMatch[];
  topScorers: TopScorer[];
}

interface TournamentData {
  event: {
    id: string;
    name: string;
    slug: string;
    status: string;
    description?: string | null;
    location?: string | null;
    venue?: string | null;
    startDate: string;
    endDate: string;
    sport?: { id: string; name: string; slug: string; icon?: string | null } | null;
    organizer?: { id: string; firstName: string; lastName: string } | null;
  };
  categories: CategoryData[];
}

// ─── Modal types ──────────────────────────────────────────────────────────────

interface ModalLineupPlayer {
  jerseyNumber: number;
  isStarter: boolean;
  isCaptain: boolean;
  player: { id: string; fullName: string; position?: string | null };
}

interface ModalLineup {
  id: string;
  teamId: string;
  team: { id: string; name: string; shortName?: string | null; logoUrl?: string | null };
  players: ModalLineupPlayer[];
}

interface ModalMatchEvent {
  id: string;
  type: string;
  minute?: number | null;
  period?: number | null;
  teamId?: string | null;
  description?: string | null;
  timestamp: string;
  player?: { id: string; fullName: string; jerseyNumber?: number | null } | null;
}

interface ModalMatchDetail {
  id: string;
  status: string;
  scheduledAt: string;
  stageType?: string | null;
  groupName?: string | null;
  round?: number | null;
  matchDay?: number | null;
  venue?: string | null;
  homeTeam?: PublicTeam | null;
  awayTeam?: PublicTeam | null;
  matchScore?: PublicMatchScore | null;
  potmLocked?: boolean;
  playerOfTheMatch?: {
    id: string;
    fullName: string;
    jerseyNumber?: number | null;
    photoUrl?: string | null;
    team: { id: string; name: string; shortName?: string | null; logoUrl?: string | null };
  } | null;
  matchLineups?: ModalLineup[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('id-ID', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatDateTime(d: string) {
  return new Date(d).toLocaleString('id-ID', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const EVENT_STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-slate-500/15 text-slate-400 border-slate-500/20',
  PUBLISHED: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  ONGOING: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  COMPLETED: 'bg-slate-500/15 text-slate-400 border-slate-500/20',
  CANCELLED: 'bg-red-500/15 text-red-400 border-red-500/20',
};

const MATCH_STATUS_MAP: Record<string, { label: string; cls: string }> = {
  SCHEDULED:  { label: 'Terjadwal', cls: 'bg-slate-500/15 text-slate-400' },
  WARMUP:     { label: 'Pemanasan', cls: 'bg-amber-500/15 text-amber-400' },
  LIVE:       { label: 'LIVE',      cls: 'bg-red-500/15 text-red-400 animate-pulse' },
  HALF_TIME:  { label: 'Jeda',      cls: 'bg-amber-500/15 text-amber-400' },
  PAUSED:     { label: 'Ditunda',   cls: 'bg-amber-500/15 text-amber-400' },
  COMPLETED:  { label: 'Selesai',   cls: 'bg-emerald-500/15 text-emerald-400' },
  CANCELLED:  { label: 'Batal',     cls: 'bg-red-500/15 text-red-400' },
  POSTPONED:  { label: 'Ditunda',   cls: 'bg-orange-500/15 text-orange-400' },
};

function MatchStatusBadge({ status }: { status: string }) {
  const s = MATCH_STATUS_MAP[status] ?? { label: status, cls: 'bg-slate-500/15 text-slate-400' };
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${s.cls}`}>
      {s.label}
    </span>
  );
}

function TeamAvatar({ team, size = 8 }: { team?: PublicTeam | null; size?: number }) {
  const sizeClass = `w-${size} h-${size}`;
  const abbr = (team?.shortName || team?.name || '?').substring(0, 2).toUpperCase();
  return (
    <div className={`${sizeClass} rounded-full bg-white/[0.06] border border-white/[0.08] flex items-center justify-center flex-shrink-0 overflow-hidden`}>
      {team?.logoUrl ? (
        <img src={team.logoUrl} alt={team.name} className="w-full h-full object-cover" />
      ) : (
        <span className="text-[9px] font-bold text-slate-400">{abbr}</span>
      )}
    </div>
  );
}

// ─── Modal event helpers ───────────────────────────────────────────────────────

function getModalEventEmoji(type: string): string {
  switch (type?.toUpperCase()) {
    case 'GOAL':
    case 'POINT':
      return '⚽';
    case 'OWN_GOAL':
      return '⚽';
    case 'ASSIST':
      return '🎯';
    case 'YELLOW_CARD':
      return '🟨';
    case 'RED_CARD':
      return '🟥';
    case 'GREEN_CARD':
      return '🟩';
    case 'SUBSTITUTION':
      return '🔁';
    case 'PERIOD_START':
    case 'PERIOD_END':
      return '⏱️';
    default:
      return '📋';
  }
}

function getModalEventAccent(type: string): string {
  switch (type?.toUpperCase()) {
    case 'GOAL':
    case 'POINT':
      return 'text-emerald-400';
    case 'OWN_GOAL':
      return 'text-red-400';
    case 'ASSIST':
      return 'text-blue-300';
    case 'YELLOW_CARD':
      return 'text-yellow-400';
    case 'RED_CARD':
      return 'text-red-400';
    case 'GREEN_CARD':
      return 'text-green-400';
    case 'SUBSTITUTION':
      return 'text-blue-400';
    default:
      return 'text-slate-500';
  }
}

// ─── Match card ───────────────────────────────────────────────────────────────

function MatchCard({ match, onSelect }: { match: PublicMatch; onSelect: (id: string) => void }) {
  const hs = match.matchScore?.homeScore ?? null;
  const as_ = match.matchScore?.awayScore ?? null;
  const done = match.status === 'COMPLETED';
  const homeWon = done && hs !== null && as_ !== null && hs > as_;
  const awayWon = done && hs !== null && as_ !== null && as_ > hs;

  return (
    <div
      className="glass-card overflow-hidden cursor-pointer hover:border-emerald-500/30 hover:bg-white/[0.03] transition-all group"
      onClick={() => onSelect(match.id)}
    >
      <div className="px-3 pt-2.5 pb-1.5 flex items-center justify-between text-[11px] text-slate-500">
        <span>{formatDateTime(match.scheduledAt)}</span>
        <MatchStatusBadge status={match.status} />
      </div>
      <div className="border-t border-white/[0.05] px-3 py-2 space-y-1">
        {/* Home */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <TeamAvatar team={match.homeTeam} size={6} />
            <span className={`text-sm truncate ${homeWon ? 'font-bold text-white' : 'text-slate-300'}`}>
              {match.homeTeam?.name ?? 'TBD'}
            </span>
          </div>
          <span className={`text-sm font-bold min-w-[1.5rem] text-right ${homeWon ? 'text-emerald-400' : 'text-slate-400'}`}>
            {hs ?? '-'}
          </span>
        </div>
        {/* Away */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <TeamAvatar team={match.awayTeam} size={6} />
            <span className={`text-sm truncate ${awayWon ? 'font-bold text-white' : 'text-slate-300'}`}>
              {match.awayTeam?.name ?? 'TBD'}
            </span>
          </div>
          <span className={`text-sm font-bold min-w-[1.5rem] text-right ${awayWon ? 'text-emerald-400' : 'text-slate-400'}`}>
            {as_ ?? '-'}
          </span>
        </div>
      </div>
      {/* Click hint */}
      <div className="px-3 pb-2 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
        <span className="text-[10px] text-emerald-500 font-semibold">Lihat detail →</span>
      </div>
    </div>
  );
}

// ─── Standings table ──────────────────────────────────────────────────────────

function StandingsTable({ rows }: { rows: StandingRow[] }) {
  if (!rows || rows.length === 0) {
    return (
      <p className="text-slate-500 text-sm text-center py-4">Belum ada tim terdaftar.</p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/[0.06]">
            <th className="py-2 pr-2 text-left text-xs font-semibold text-slate-500 w-8">#</th>
            <th className="py-2 text-left text-xs font-semibold text-slate-500">Tim</th>
            <th className="py-2 px-2 text-center text-xs font-semibold text-slate-500 w-8" title="Dimainkan">D</th>
            <th className="py-2 px-2 text-center text-xs font-semibold text-slate-500 w-8" title="Menang">M</th>
            <th className="py-2 px-2 text-center text-xs font-semibold text-slate-500 w-8" title="Seri">S</th>
            <th className="py-2 px-2 text-center text-xs font-semibold text-slate-500 w-8" title="Kalah">K</th>
            <th className="py-2 px-2 text-center text-xs font-semibold text-slate-500 w-12" title="Gol">Gol</th>
            <th className="py-2 px-2 text-center text-xs font-semibold text-slate-500 w-8" title="Selisih Gol">SG</th>
            <th className="py-2 pl-2 text-center text-xs font-semibold text-slate-500 w-10">Poin</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.teamId} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
              <td className="py-2 pr-2 text-slate-500 text-xs font-medium">{row.position}</td>
              <td className="py-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-white/[0.06] border border-white/[0.08] flex items-center justify-center overflow-hidden flex-shrink-0">
                    {row.teamLogoUrl ? (
                      <img src={row.teamLogoUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[8px] font-bold text-slate-400">
                        {(row.teamShortName || row.teamName).substring(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <span className="font-medium text-white text-xs truncate max-w-[120px]">
                    {row.teamName}
                  </span>
                </div>
              </td>
              <td className="py-2 px-2 text-center text-slate-400 text-xs">{row.played}</td>
              <td className="py-2 px-2 text-center text-slate-400 text-xs">{row.won}</td>
              <td className="py-2 px-2 text-center text-slate-400 text-xs">{row.drawn}</td>
              <td className="py-2 px-2 text-center text-slate-400 text-xs">{row.lost}</td>
              <td className="py-2 px-2 text-center text-slate-400 text-xs">
                {row.goalsFor}:{row.goalsAgainst}
              </td>
              <td className={`py-2 px-2 text-center text-xs font-semibold ${row.goalDifference > 0 ? 'text-emerald-400' : row.goalDifference < 0 ? 'text-red-400' : 'text-slate-400'}`}>
                {row.goalDifference > 0 ? '+' : ''}{row.goalDifference}
              </td>
              <td className="py-2 pl-2 text-center font-bold text-white text-sm">{row.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Category section header ──────────────────────────────────────────────────

function CategoryHeader({ category }: { category: CategoryData }) {
  const genderLabel = category.gender === 'MALE' ? 'Putra' : category.gender === 'FEMALE' ? 'Putri' : 'Campuran';
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="w-1.5 h-8 bg-emerald-500 rounded-full" />
      <div>
        <h2 className="text-lg font-black text-white">{category.name}</h2>
        <p className="text-xs text-slate-500">{genderLabel}</p>
      </div>
    </div>
  );
}

// ─── Section label ────────────────────────────────────────────────────────────

function SectionLabel({ label, icon }: { label: string; icon?: ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      {icon}
      <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">{label}</h3>
    </div>
  );
}

// ─── Tab: Turnamen ────────────────────────────────────────────────────────────

function TurnamanTab({ categories }: { categories: CategoryData[] }) {
  if (categories.length === 0) {
    return <EmptyState message="Belum ada kategori turnamen." />;
  }

  return (
    <div className="space-y-12">
      {categories.map((cat) => {
        const hasGroups = Object.keys(cat.groupStandings).length > 0;
        const hasKnockout = cat.knockoutMatches.length > 0;

        return (
          <div key={cat.id}>
            <CategoryHeader category={cat} />

            {/* Group standings */}
            {hasGroups && (
              <div className="mb-8 space-y-6">
                <SectionLabel label="Fase Grup" icon={<Users className="w-4 h-4 text-slate-400" />} />
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  {Object.entries(cat.groupStandings)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([groupName, rows]) => (
                      <div key={groupName} className="glass-card p-4">
                        <h4 className="text-sm font-bold text-emerald-400 mb-3">{groupName}</h4>
                        <StandingsTable rows={rows} />
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Knockout bracket */}
            {hasKnockout && (
              <div>
                <SectionLabel label="Fase Gugur" icon={<Trophy className="w-4 h-4 text-slate-400" />} />
                <div className="glass-card p-4">
                  <BracketView matches={cat.knockoutMatches as unknown as LibMatch[]} />
                </div>
              </div>
            )}

            {!hasGroups && !hasKnockout && (
              <EmptyState message="Pertandingan belum dimulai." />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Tab: Tim ─────────────────────────────────────────────────────────────────

function TimTab({ categories }: { categories: CategoryData[] }) {
  if (categories.length === 0) {
    return <EmptyState message="Belum ada kategori turnamen." />;
  }

  return (
    <div className="space-y-12">
      {categories.map((cat) => {
        const hasGroups = cat.categoryGroups.length > 0;

        // Build group → teams map
        const byGroup: Record<string, TeamItem[]> = {};
        const unassigned: TeamItem[] = [];

        if (hasGroups) {
          cat.categoryGroups.forEach((cg) => {
            byGroup[cg.name] = [];
          });
          cat.teams.forEach((t) => {
            if (t.groupName && byGroup[t.groupName] !== undefined) {
              byGroup[t.groupName].push(t);
            } else {
              unassigned.push(t);
            }
          });
        }

        return (
          <div key={cat.id}>
            <CategoryHeader category={cat} />

            {cat.teams.length === 0 ? (
              <EmptyState message="Belum ada tim terdaftar di kategori ini." />
            ) : hasGroups ? (
              <div className="space-y-6">
                {Object.entries(byGroup)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([groupName, teams]) => (
                    <div key={groupName}>
                      <SectionLabel label={groupName} />
                      {teams.length === 0 ? (
                        <p className="text-slate-600 text-sm">Belum ada tim di grup ini.</p>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                          {teams.map((team) => <TeamCard key={team.teamId} team={team} />)}
                        </div>
                      )}
                    </div>
                  ))}
                {unassigned.length > 0 && (
                  <div>
                    <SectionLabel label="Belum Ditetapkan" />
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                      {unassigned.map((team) => <TeamCard key={team.teamId} team={team} />)}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {cat.teams.map((team) => <TeamCard key={team.teamId} team={team} />)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function TeamCard({ team }: { team: TeamItem }) {
  return (
    <Link
      href={`/teams/${team.teamSlug}`}
      className="glass-card p-4 text-center hover:scale-[1.03] transition-all group"
    >
      <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-2.5 overflow-hidden group-hover:bg-emerald-500/20 transition-colors">
        {team.teamLogoUrl ? (
          <img src={team.teamLogoUrl} alt={team.teamName} className="w-full h-full object-cover" />
        ) : (
          <span className="text-base font-bold text-emerald-400">
            {(team.teamShortName || team.teamName).substring(0, 2).toUpperCase()}
          </span>
        )}
      </div>
      <p className="text-xs font-bold text-white group-hover:text-emerald-400 transition-colors leading-tight">
        {team.teamName}
      </p>
      {team.teamCity && (
        <p className="text-[10px] text-slate-500 mt-0.5">{team.teamCity}</p>
      )}
    </Link>
  );
}

// ─── Tab: Pertandingan ────────────────────────────────────────────────────────

function PertandinganTab({
  categories,
  onSelectMatch,
}: {
  categories: CategoryData[];
  onSelectMatch: (id: string) => void;
}) {
  if (categories.length === 0) {
    return <EmptyState message="Belum ada kategori turnamen." />;
  }

  return (
    <div className="space-y-12">
      {categories.map((cat) => {
        // Group matches into sections
        const sections: Array<{ label: string; matches: PublicMatch[] }> = [];
        const byGroup: Record<string, PublicMatch[]> = {};
        const knockouts: PublicMatch[] = [];

        cat.allMatches.forEach((m) => {
          if (m.stageType === 'GROUP') {
            const key = m.groupName ?? 'Grup';
            if (!byGroup[key]) byGroup[key] = [];
            byGroup[key].push(m);
          } else {
            knockouts.push(m);
          }
        });

        Object.entries(byGroup)
          .sort(([a], [b]) => a.localeCompare(b))
          .forEach(([name, matches]) => sections.push({ label: name, matches }));

        if (knockouts.length > 0) {
          sections.push({ label: 'Fase Gugur', matches: knockouts });
        }

        return (
          <div key={cat.id}>
            <CategoryHeader category={cat} />

            {sections.length === 0 ? (
              <EmptyState message="Belum ada pertandingan terjadwal." />
            ) : (
              <div className="space-y-8">
                {sections.map(({ label, matches }) => (
                  <div key={label}>
                    <SectionLabel label={label} />
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {matches.map((m) => (
                        <MatchCard key={m.id} match={m} onSelect={onSelectMatch} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Tab: Top Skor ────────────────────────────────────────────────────────────

function TopSkorTab({ categories }: { categories: CategoryData[] }) {
  if (categories.length === 0) {
    return <EmptyState message="Belum ada kategori turnamen." />;
  }

  return (
    <div className="space-y-12">
      {categories.map((cat) => (
        <div key={cat.id}>
          <CategoryHeader category={cat} />

          {cat.topScorers.length === 0 ? (
            <EmptyState message="Belum ada gol tercatat." />
          ) : (
            <div className="glass-card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 w-10">#</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">Pemain</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 hidden sm:table-cell">Tim</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 w-16">Gol</th>
                  </tr>
                </thead>
                <tbody>
                  {cat.topScorers.map((scorer, idx) => (
                    <tr key={scorer.playerId} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3 text-slate-500 text-xs font-medium">{idx + 1}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-white/[0.06] border border-white/[0.08] flex items-center justify-center overflow-hidden flex-shrink-0">
                            {scorer.photoUrl ? (
                              <img src={scorer.photoUrl} alt={scorer.playerName} className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-[10px] font-bold text-slate-400">
                                {scorer.playerName.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div>
                            <p className="font-semibold text-white text-sm">{scorer.playerName}</p>
                            <p className="text-[10px] text-slate-500 sm:hidden">{scorer.teamName}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-full bg-white/[0.06] border border-white/[0.08] flex items-center justify-center overflow-hidden flex-shrink-0">
                            {scorer.teamLogoUrl ? (
                              <img src={scorer.teamLogoUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-[7px] font-bold text-slate-400">
                                {(scorer.teamShortName || scorer.teamName).substring(0, 2).toUpperCase()}
                              </span>
                            )}
                          </div>
                          <span className="text-slate-300 text-xs">{scorer.teamName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center gap-1 font-bold text-white">
                          <Target className="w-3.5 h-3.5 text-emerald-400" />
                          {scorer.goals}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-12 text-slate-500">
      <p className="text-sm">{message}</p>
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="animate-pulse">
        <div className="h-40 bg-white/[0.03] rounded-xl mb-6 border border-white/[0.06]" />
        <div className="flex gap-4 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-10 w-28 bg-white/[0.03] rounded-lg border border-white/[0.06]" />
          ))}
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-white/[0.03] rounded-xl border border-white/[0.06]" />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Match Detail Modal ───────────────────────────────────────────────────────

function MatchDetailModal({ matchId, onClose }: { matchId: string; onClose: () => void }) {
  const [detail, setDetail] = useState<ModalMatchDetail | null>(null);
  const [events, setEvents] = useState<ModalMatchEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFetchError(false);

    Promise.all([
      apiGet<any>(`/matches/public/${matchId}`),
      apiGet<any>(`/matches/${matchId}/events`).catch(() => null),
    ])
      .then(([matchRes, eventsRes]) => {
        if (cancelled) return;
        setDetail((matchRes as any).data ?? matchRes);
        if (eventsRes) {
          const arr = Array.isArray(eventsRes) ? eventsRes : ((eventsRes as any).data ?? []);
          setEvents(arr);
        }
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) { setFetchError(true); setLoading(false); }
      });

    return () => { cancelled = true; };
  }, [matchId]);

  // Lock body scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const sortedEvents = [...events].sort((a, b) => {
    const mA = a.minute ?? 0;
    const mB = b.minute ?? 0;
    if (mA !== mB) return mA - mB;
    return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
  });

  const homeTeamId = detail?.homeTeam?.id ?? '';
  const awayTeamId = detail?.awayTeam?.id ?? '';
  const matchLineups = detail?.matchLineups ?? [];
  const homeLineup = matchLineups.find((l) => l.teamId === homeTeamId) ?? null;
  const awayLineup = matchLineups.find((l) => l.teamId === awayTeamId) ?? null;
  const hs = detail?.matchScore?.homeScore ?? null;
  const as_ = detail?.matchScore?.awayScore ?? null;

  const potm = detail?.potmLocked && detail?.playerOfTheMatch ? detail.playerOfTheMatch : null;
  const potmGoals = potm
    ? sortedEvents.filter((e) => e.player?.id === potm.id && e.type === 'GOAL').length
    : 0;
  const potmAssists = potm
    ? sortedEvents.filter((e) => e.player?.id === potm.id && e.type === 'ASSIST').length
    : 0;

  const stageLabel = detail?.stageType === 'GROUP'
    ? `Grup ${detail.groupName ?? ''}`
    : detail?.stageType === 'KNOCKOUT'
      ? `Fase Gugur${detail.round ? ` · Ronde ${detail.round}` : ''}`
      : detail?.matchDay
        ? `Pertandingan Hari ${detail.matchDay}`
        : null;

  const showScore =
    detail?.status === 'LIVE' ||
    detail?.status === 'HALF_TIME' ||
    detail?.status === 'PAUSED' ||
    detail?.status === 'COMPLETED';

  const isLive = detail?.status === 'LIVE';

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 py-8">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal panel */}
      <div className="relative w-full max-w-3xl rounded-2xl bg-[#080d1a] border border-white/[0.08] shadow-2xl my-auto">
        {/* Close button */}
        <button
          onClick={onClose}
          aria-label="Tutup"
          className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-white/[0.07] hover:bg-white/[0.13] border border-white/[0.08] flex items-center justify-center transition-colors"
        >
          <X className="w-4 h-4 text-slate-400" />
        </button>

        {loading ? (
          <div className="p-8 space-y-4 animate-pulse">
            <div className="h-40 bg-white/[0.04] rounded-xl" />
            <div className="grid grid-cols-2 gap-4">
              <div className="h-48 bg-white/[0.04] rounded-xl" />
              <div className="h-48 bg-white/[0.04] rounded-xl" />
            </div>
            <div className="h-32 bg-white/[0.04] rounded-xl" />
          </div>
        ) : fetchError || !detail ? (
          <div className="p-10 text-center text-slate-500">
            <p className="text-sm">Gagal memuat detail pertandingan.</p>
          </div>
        ) : (
          <>
            {/* ── Scoreboard ── */}
            <div className="relative overflow-hidden rounded-t-2xl bg-gradient-to-br from-slate-800/80 via-slate-900 to-slate-950 border-b border-white/[0.06]">
              {isLive && (
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-500 animate-pulse" />
              )}
              <div className="px-6 pt-6 pb-5 pr-14">
                {/* Status + stage */}
                <div className="flex items-center justify-center gap-2 mb-5 flex-wrap">
                  <MatchStatusBadge status={detail.status} />
                  {stageLabel && (
                    <span className="text-[11px] text-slate-500 font-medium">{stageLabel}</span>
                  )}
                </div>

                {/* Teams + score */}
                <div className="flex items-center justify-center gap-3 md:gap-6">
                  {/* Home */}
                  <div className="flex-1 flex flex-col items-end gap-2 min-w-0">
                    <div className="w-14 h-14 rounded-full border-2 border-white/10 bg-white/[0.06] flex items-center justify-center overflow-hidden flex-shrink-0">
                      {detail.homeTeam?.logoUrl ? (
                        <img src={detail.homeTeam.logoUrl} alt={detail.homeTeam.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-sm font-bold text-slate-300">
                          {(detail.homeTeam?.shortName || detail.homeTeam?.name || '?').substring(0, 3).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-bold text-white text-right leading-tight truncate max-w-[110px]">
                      {detail.homeTeam?.name ?? 'Home'}
                    </p>
                  </div>

                  {/* Score */}
                  <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
                    {showScore ? (
                      <>
                        <span className="text-4xl md:text-5xl font-black text-white tabular-nums">{hs ?? 0}</span>
                        <span className="text-xl text-slate-600 select-none">:</span>
                        <span className="text-4xl md:text-5xl font-black text-white tabular-nums">{as_ ?? 0}</span>
                      </>
                    ) : (
                      <span className="text-xl font-bold text-slate-500 px-4 select-none">vs</span>
                    )}
                  </div>

                  {/* Away */}
                  <div className="flex-1 flex flex-col items-start gap-2 min-w-0">
                    <div className="w-14 h-14 rounded-full border-2 border-white/10 bg-white/[0.06] flex items-center justify-center overflow-hidden flex-shrink-0">
                      {detail.awayTeam?.logoUrl ? (
                        <img src={detail.awayTeam.logoUrl} alt={detail.awayTeam.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-sm font-bold text-slate-300">
                          {(detail.awayTeam?.shortName || detail.awayTeam?.name || '?').substring(0, 3).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-bold text-white text-left leading-tight truncate max-w-[110px]">
                      {detail.awayTeam?.name ?? 'Away'}
                    </p>
                  </div>
                </div>

                {/* Date + venue */}
                <div className="flex items-center justify-center gap-4 mt-4 flex-wrap">
                  <span className="text-xs text-slate-500">{formatDateTime(detail.scheduledAt)}</span>
                  {detail.venue && (
                    <span className="text-xs text-slate-500">📍 {detail.venue}</span>
                  )}
                </div>
              </div>
            </div>

            <div className="p-5 space-y-6">
              {/* ── POTM ── */}
              {potm && (
                <div className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-950/40 via-slate-900 to-slate-950 p-4">
                  <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-amber-400/60 to-transparent" />
                  <div className="flex items-center gap-3">
                    {/* Photo */}
                    <div className="relative flex-shrink-0">
                      <div className="w-14 h-14 rounded-xl overflow-hidden border-2 border-amber-500/40 bg-slate-800">
                        {potm.photoUrl ? (
                          <img src={potm.photoUrl} alt={potm.fullName} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-amber-500/10">
                            <span className="text-amber-700 text-xl">👤</span>
                          </div>
                        )}
                      </div>
                      {potm.jerseyNumber != null && (
                        <div className="absolute -bottom-1.5 -right-1.5 w-5 h-5 rounded-full bg-amber-500 border-2 border-[#080d1a] flex items-center justify-center">
                          <span className="text-[8px] font-black text-slate-900">{potm.jerseyNumber}</span>
                        </div>
                      )}
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 mb-0.5">
                        <span className="text-amber-400 text-xs">⭐</span>
                        <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">Player of The Match</span>
                      </div>
                      <p className="text-base font-black text-white truncate">{potm.fullName}</p>
                      <p className="text-xs text-slate-400 truncate">{potm.team?.shortName || potm.team?.name}</p>
                    </div>
                    {/* Stats */}
                    <div className="flex-shrink-0 flex gap-2">
                      <div className="text-center px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                        <div className="text-lg font-black text-emerald-400 leading-none">{potmGoals}</div>
                        <div className="text-[9px] text-slate-500 font-semibold uppercase tracking-wider mt-0.5">Gol</div>
                      </div>
                      <div className="text-center px-2.5 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20">
                        <div className="text-lg font-black text-blue-400 leading-none">{potmAssists}</div>
                        <div className="text-[9px] text-slate-500 font-semibold uppercase tracking-wider mt-0.5">Assist</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Lineups ── */}
              {(homeLineup || awayLineup) && (
                <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Lineup
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {(
                      [
                        { lineup: homeLineup, team: detail.homeTeam, accent: 'blue' as const },
                        { lineup: awayLineup, team: detail.awayTeam, accent: 'green' as const },
                      ] as Array<{
                        lineup: ModalLineup | null;
                        team: PublicTeam | null | undefined;
                        accent: 'blue' | 'green';
                      }>
                    ).map(({ lineup, team, accent }) => {
                      const accentText = accent === 'blue' ? 'text-blue-400' : 'text-emerald-400';
                      const accentBorder = accent === 'blue' ? 'border-blue-500/20' : 'border-emerald-500/20';
                      const accentBg = accent === 'blue' ? 'bg-blue-950/30 border-blue-500/15' : 'bg-emerald-950/30 border-emerald-500/15';
                      const accentDot = accent === 'blue' ? 'bg-blue-500' : 'bg-emerald-500';
                      const starters = lineup?.players.filter((p) => p.isStarter) ?? [];
                      const bench = lineup?.players.filter((p) => !p.isStarter) ?? [];

                      return (
                        <div key={team?.id ?? accent} className={`glass-card p-4 border ${accentBorder}`}>
                          {/* Team label */}
                          <div className="flex items-center gap-2 mb-3">
                            <div className="w-6 h-6 rounded-full bg-white/[0.06] border border-white/[0.08] flex items-center justify-center overflow-hidden flex-shrink-0">
                              {team?.logoUrl ? (
                                <img src={team.logoUrl} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-[7px] font-bold text-slate-400">
                                  {(team?.shortName || team?.name || '?').substring(0, 2).toUpperCase()}
                                </span>
                              )}
                            </div>
                            <p className={`text-xs font-bold ${accentText} truncate`}>{team?.name ?? '—'}</p>
                          </div>

                          {!lineup ? (
                            <p className="text-xs text-slate-600 py-2 text-center">Lineup belum tersedia</p>
                          ) : (
                            <div className="space-y-3">
                              {starters.length > 0 && (
                                <div>
                                  <div className="flex items-center gap-1.5 mb-2">
                                    <div className={`w-1 h-1 rounded-full ${accentDot}`} />
                                    <span className={`text-[10px] font-bold uppercase tracking-wider ${accentText}`}>
                                      Starter ({starters.length})
                                    </span>
                                  </div>
                                  <div className="space-y-0.5">
                                    {starters.map((p) => (
                                      <div
                                        key={p.player.id}
                                        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border ${accentBg}`}
                                      >
                                        <span className={`w-6 text-center text-[11px] font-bold tabular-nums flex-shrink-0 ${accentText}`}>
                                          {p.jerseyNumber}
                                        </span>
                                        <span className="text-xs text-slate-200 flex-1 truncate">{p.player.fullName}</span>
                                        {p.isCaptain && (
                                          <span className="px-1 py-0.5 text-[8px] font-black bg-amber-500/20 text-amber-400 rounded border border-amber-500/30 leading-none">
                                            C
                                          </span>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {bench.length > 0 && (
                                <div>
                                  <div className="flex items-center gap-1.5 mb-2">
                                    <div className="w-1 h-1 rounded-full bg-slate-600" />
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                      Bench ({bench.length})
                                    </span>
                                  </div>
                                  <div className="space-y-0.5">
                                    {bench.map((p) => (
                                      <div
                                        key={p.player.id}
                                        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-800/30 border border-white/[0.04]"
                                      >
                                        <span className="w-6 text-center text-[11px] font-medium text-slate-500 tabular-nums flex-shrink-0">
                                          {p.jerseyNumber}
                                        </span>
                                        <span className="text-xs text-slate-400 flex-1 truncate">{p.player.fullName}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── Event Timeline ── */}
              {sortedEvents.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Timeline ({sortedEvents.length})
                  </h3>
                  <div className="glass-card p-4 space-y-1.5">
                    {sortedEvents.map((ev) => {
                      const emoji = getModalEventEmoji(ev.type);
                      const accent = getModalEventAccent(ev.type);
                      const isPeriod = ev.type === 'PERIOD_START' || ev.type === 'PERIOD_END';
                      const isHome = ev.teamId === homeTeamId;
                      const isAway = ev.teamId === awayTeamId;

                      if (isPeriod) {
                        return (
                          <div key={ev.id} className="flex justify-center py-1.5">
                            <div className="flex items-center gap-2 px-3 py-1 bg-slate-800/60 rounded-full border border-white/[0.05]">
                              <span className="text-xs">{emoji}</span>
                              <span className="text-[11px] text-slate-500">
                                {ev.description || (ev.type === 'PERIOD_START' ? 'Mulai' : 'Selesai')}
                              </span>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={ev.id}
                          className={`flex items-center gap-2 ${isAway && !isHome ? 'flex-row-reverse' : ''}`}
                        >
                          <div
                            className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900/60 border border-white/[0.05] ${
                              isAway && !isHome ? 'flex-row-reverse' : ''
                            }`}
                          >
                            {ev.minute != null && (
                              <span className="text-[11px] font-bold text-slate-400 tabular-nums w-7 flex-shrink-0 text-center">
                                {ev.minute}&apos;
                              </span>
                            )}
                            <span className="text-sm flex-shrink-0">{emoji}</span>
                            <div className={`flex-1 min-w-0 ${isAway && !isHome ? 'text-right' : ''}`}>
                              {ev.player?.fullName && (
                                <p className="text-xs font-semibold text-slate-200 truncate">
                                  {ev.player.fullName}
                                  {ev.player.jerseyNumber != null && (
                                    <span className="text-slate-500 font-normal ml-1">(#{ev.player.jerseyNumber})</span>
                                  )}
                                </p>
                              )}
                              <p className={`text-[10px] font-medium ${accent}`}>
                                {ev.type === 'OWN_GOAL'
                                  ? 'Gol Bunuh Diri'
                                  : ev.type?.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}
                              </p>
                              {ev.description && (
                                <p className="text-[10px] text-slate-600 truncate mt-0.5">{ev.description}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {sortedEvents.length === 0 && showScore && (
                <div className="text-center py-6 text-slate-600">
                  <p className="text-sm">Belum ada event tercatat.</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}

// ─── Main page component ──────────────────────────────────────────────────────

type TabKey = 'turnamen' | 'tim' | 'pertandingan' | 'topskor';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'turnamen',     label: 'Turnamen' },
  { key: 'tim',          label: 'Tim' },
  { key: 'pertandingan', label: 'Pertandingan' },
  { key: 'topskor',      label: 'Top Skor' },
];

export default function PublicEventPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [data, setData] = useState<TournamentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('turnamen');
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    apiGet<TournamentData>(`/events/by-slug/${slug}/tournament-data`)
      .then(setData)
      .catch((e: any) => setError(e?.message || 'Gagal memuat data turnamen'))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) return <LoadingSkeleton />;

  if (error || !data) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">⚠️</span>
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Turnamen Tidak Ditemukan</h2>
        <p className="text-slate-400 mb-6 text-sm">{error || 'Turnamen tidak ditemukan atau belum dipublikasikan.'}</p>
        <Link
          href="/events"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 text-white font-semibold hover:bg-emerald-400 transition-colors text-sm"
        >
          Kembali ke Acara
        </Link>
      </div>
    );
  }

  const { event, categories } = data;
  const statusStyle = EVENT_STATUS_STYLES[event.status] ?? 'bg-slate-500/15 text-slate-400 border-slate-500/20';
  const totalTeams = new Set(categories.flatMap((c) => c.teams.map((t) => t.teamId))).size;
  const totalMatches = categories.reduce((sum, c) => sum + c.allMatches.length, 0);

  return (
    <div className="min-h-screen">
      {/* ── Hero / Header ── */}
      <section className="relative overflow-hidden hero-mesh border-b border-white/[0.06]">
        <div className="pattern-dots absolute inset-0" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <Link
            href="/events"
            className="inline-flex items-center gap-1.5 text-slate-400 hover:text-white text-sm mb-5 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Kembali ke Acara
          </Link>

          <div className="flex flex-col md:flex-row md:items-start gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                {event.sport && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    {event.sport.name}
                  </span>
                )}
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold border ${statusStyle}`}>
                  {event.status}
                </span>
              </div>
              <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white leading-tight">
                {event.name}
              </h1>
            </div>

            {/* Quick stats */}
            <div className="flex gap-4 md:flex-col md:items-end md:gap-2">
              {totalTeams > 0 && (
                <div className="flex items-center gap-1.5 text-slate-400 text-sm">
                  <Users className="w-4 h-4 text-slate-500" />
                  <span>{totalTeams} tim</span>
                </div>
              )}
              {totalMatches > 0 && (
                <div className="flex items-center gap-1.5 text-slate-400 text-sm">
                  <Trophy className="w-4 h-4 text-slate-500" />
                  <span>{totalMatches} pertandingan</span>
                </div>
              )}
            </div>
          </div>

          {/* Meta info */}
          <div className="flex flex-wrap gap-x-6 gap-y-2 mt-5 text-sm text-slate-400">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-slate-500" />
              <span>{formatDate(event.startDate)} — {formatDate(event.endDate)}</span>
            </div>
            {event.location && (
              <div className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-slate-500" />
                <span>{event.location}</span>
              </div>
            )}
            {event.venue && (
              <div className="flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-slate-500" />
                <span>{event.venue}</span>
              </div>
            )}
            {event.organizer && (
              <div className="flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-slate-500" />
                <span>{event.organizer.firstName} {event.organizer.lastName}</span>
              </div>
            )}
          </div>

          {/* Description */}
          {event.description && (
            <p className="mt-4 text-slate-400 text-sm leading-relaxed max-w-3xl">
              {event.description}
            </p>
          )}
        </div>
      </section>

      {/* ── Tab bar ── */}
      <div className="border-b border-white/[0.06] bg-[#0a0f1c]/90 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex gap-8 -mb-px overflow-x-auto" aria-label="Tabs">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`
                  whitespace-nowrap py-4 px-1 border-b-2 text-sm font-semibold transition-colors
                  ${activeTab === tab.key
                    ? 'border-emerald-400 text-emerald-400'
                    : 'border-transparent text-slate-500 hover:text-slate-300 hover:border-slate-600'
                  }
                `}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* ── Tab content ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'turnamen'     && <TurnamanTab     categories={categories} />}
        {activeTab === 'tim'          && <TimTab           categories={categories} />}
        {activeTab === 'pertandingan' && (
          <PertandinganTab categories={categories} onSelectMatch={setSelectedMatchId} />
        )}
        {activeTab === 'topskor'      && <TopSkorTab       categories={categories} />}
      </div>

      {/* ── Match Detail Modal ── */}
      {selectedMatchId && (
        <MatchDetailModal
          matchId={selectedMatchId}
          onClose={() => setSelectedMatchId(null)}
        />
      )}
    </div>
  );
}

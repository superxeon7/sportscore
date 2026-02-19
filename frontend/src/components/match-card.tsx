'use client';

import Link from 'next/link';
import { Match, MatchStatus } from '@/lib/types';
import InitialsAvatar from '@/components/ui/initials-avatar';

interface MatchCardProps {
  match: Match;
}

function getStatusDisplay(status: MatchStatus) {
  switch (status) {
    case MatchStatus.LIVE:
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-red-400 uppercase tracking-wider">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500 glow-red" />
          </span>
          LIVE
        </span>
      );
    case MatchStatus.COMPLETED:
      return (
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">FT</span>
      );
    case MatchStatus.SCHEDULED:
      return (
        <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">
          TERJADWAL
        </span>
      );
    case MatchStatus.POSTPONED:
      return (
        <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">DITUNDA</span>
      );
    case MatchStatus.CANCELLED:
      return (
        <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">DIBATALKAN</span>
      );
    default:
      return (
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{status}</span>
      );
  }
}

function formatMatchTime(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatMatchDate(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function MatchCard({ match }: MatchCardProps) {
  const isLive = match.status === MatchStatus.LIVE;
  const isCompleted = match.status === MatchStatus.COMPLETED;
  const showScore = isLive || isCompleted;

  return (
    <Link href={`/matches/${match.id}`}>
      <div
        className={`
          glass-card p-4 cursor-pointer transition-all duration-200 hover:scale-[1.02]
          ${isLive ? 'border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.1)]' : ''}
        `}
      >
        {/* Status */}
        <div className="flex items-center justify-between mb-3">
          {getStatusDisplay(match.status)}
          {match.scheduledAt && !isLive && !isCompleted && (
            <span className="text-xs text-slate-500 font-medium">
              {formatMatchDate(match.scheduledAt)} {formatMatchTime(match.scheduledAt)}
            </span>
          )}
          {match.currentPeriod != null && isLive && (
            <span className="text-xs font-semibold text-red-400">
              Babak {match.currentPeriod}
            </span>
          )}
        </div>

        {/* Teams and Score */}
        <div className="space-y-2.5">
          {/* Home Team */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <InitialsAvatar
                name={match.homeTeam?.shortName || match.homeTeam?.name || 'H'}
                imageUrl={match.homeTeam?.logoUrl}
                size="xs"
                shape="square"
              />
              <span className="text-sm font-semibold text-white truncate">
                {match.homeTeam?.name || 'Tim Kandang'}
              </span>
            </div>
            {showScore && (
              <span className={`text-xl font-extrabold tabular-nums ${isLive ? 'text-red-400' : 'text-white'}`}>
                {match.matchScore?.homeScore ?? 0}
              </span>
            )}
          </div>

          {/* Away Team */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <InitialsAvatar
                name={match.awayTeam?.shortName || match.awayTeam?.name || 'A'}
                imageUrl={match.awayTeam?.logoUrl}
                size="xs"
                shape="square"
              />
              <span className="text-sm font-semibold text-white truncate">
                {match.awayTeam?.name || 'Tim Tandang'}
              </span>
            </div>
            {showScore && (
              <span className={`text-xl font-extrabold tabular-nums ${isLive ? 'text-red-400' : 'text-white'}`}>
                {match.matchScore?.awayScore ?? 0}
              </span>
            )}
          </div>
        </div>

        {/* Venue */}
        {match.venue && (
          <div className="mt-3 pt-2.5 border-t border-white/[0.06]">
            <span className="text-xs text-slate-500">{match.venue}</span>
          </div>
        )}
      </div>
    </Link>
  );
}

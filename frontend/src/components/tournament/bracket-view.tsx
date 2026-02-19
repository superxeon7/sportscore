'use client';

import { Match, MatchStatus } from '@/lib/types';
import InitialsAvatar from '@/components/ui/initials-avatar';

interface BracketViewProps {
  matches: Match[];
}

function getRoundLabel(round: number, totalRounds: number): string {
  const fromFinal = totalRounds - round;
  switch (fromFinal) {
    case 0:
      return 'Final';
    case 1:
      return 'Semifinal';
    case 2:
      return 'Perempat Final';
    default:
      return `Babak ${round}`;
  }
}

function getStatusBadge(status: MatchStatus) {
  const map: Record<string, { label: string; className: string }> = {
    [MatchStatus.SCHEDULED]: { label: 'Terjadwal', className: 'bg-slate-500/15 text-slate-400' },
    [MatchStatus.WARMUP]: { label: 'Pemanasan', className: 'bg-amber-500/15 text-amber-400' },
    [MatchStatus.LIVE]: { label: 'LIVE', className: 'bg-red-500/15 text-red-400 animate-pulse' },
    [MatchStatus.HALF_TIME]: { label: 'Jeda', className: 'bg-amber-500/15 text-amber-400' },
    [MatchStatus.PAUSED]: { label: 'Ditunda', className: 'bg-amber-500/15 text-amber-400' },
    [MatchStatus.COMPLETED]: { label: 'Selesai', className: 'bg-emerald-500/15 text-emerald-400' },
    [MatchStatus.CANCELLED]: { label: 'Dibatalkan', className: 'bg-red-500/15 text-red-400' },
    [MatchStatus.POSTPONED]: { label: 'Ditunda', className: 'bg-orange-500/15 text-orange-400' },
  };
  const info = map[status] || { label: status, className: 'bg-slate-500/15 text-slate-400' };
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${info.className}`}>
      {info.label}
    </span>
  );
}

function MatchBox({ match }: { match: Match }) {
  const homeScore = match.matchScore?.homeScore ?? null;
  const awayScore = match.matchScore?.awayScore ?? null;
  const isCompleted = match.status === MatchStatus.COMPLETED;
  const homeWon = isCompleted && homeScore !== null && awayScore !== null && homeScore > awayScore;
  const awayWon = isCompleted && homeScore !== null && awayScore !== null && awayScore > homeScore;

  return (
    <div className="w-56 rounded-lg border border-white/[0.08] bg-white/[0.03] overflow-hidden">
      {/* Home Team */}
      <div className={`flex items-center justify-between px-3 py-2 ${homeWon ? 'bg-emerald-500/10' : ''}`}>
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <InitialsAvatar
            name={match.homeTeam?.name || 'TBD'}
            imageUrl={match.homeTeam?.logoUrl}
            size="xs"
          />
          <span className={`text-xs truncate ${homeWon ? 'font-bold text-white' : 'text-slate-300'}`}>
            {match.homeTeam?.shortName || match.homeTeam?.name || 'TBD'}
          </span>
        </div>
        <span className={`text-sm font-bold ml-2 ${homeWon ? 'text-emerald-400' : 'text-slate-400'}`}>
          {homeScore ?? '-'}
        </span>
      </div>

      {/* Divider */}
      <div className="border-t border-white/[0.06]" />

      {/* Away Team */}
      <div className={`flex items-center justify-between px-3 py-2 ${awayWon ? 'bg-emerald-500/10' : ''}`}>
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <InitialsAvatar
            name={match.awayTeam?.name || 'TBD'}
            imageUrl={match.awayTeam?.logoUrl}
            size="xs"
          />
          <span className={`text-xs truncate ${awayWon ? 'font-bold text-white' : 'text-slate-300'}`}>
            {match.awayTeam?.shortName || match.awayTeam?.name || 'TBD'}
          </span>
        </div>
        <span className={`text-sm font-bold ml-2 ${awayWon ? 'text-emerald-400' : 'text-slate-400'}`}>
          {awayScore ?? '-'}
        </span>
      </div>

      {/* Status */}
      <div className="border-t border-white/[0.06] px-3 py-1.5 flex justify-center">
        {getStatusBadge(match.status)}
      </div>
    </div>
  );
}

export default function BracketView({ matches }: BracketViewProps) {
  if (!matches || matches.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        Bagan turnamen belum tersedia.
      </div>
    );
  }

  // Group matches by round
  const roundsMap = matches.reduce<Record<number, Match[]>>((acc, match) => {
    const round = match.round ?? 1;
    if (!acc[round]) acc[round] = [];
    acc[round].push(match);
    return acc;
  }, {});

  const roundNumbers = Object.keys(roundsMap).map(Number).sort((a, b) => a - b);
  const totalRounds = roundNumbers.length;

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-8 min-w-max items-start">
        {roundNumbers.map((round, roundIndex) => {
          const roundMatches = roundsMap[round];
          // Calculate vertical spacing - later rounds need more spacing to align with connectors
          const spacingMultiplier = Math.pow(2, roundIndex);

          return (
            <div key={round} className="flex flex-col items-center">
              {/* Round Header */}
              <h4 className="text-sm font-bold text-slate-400 mb-4 uppercase tracking-wider">
                {getRoundLabel(round, roundNumbers[roundNumbers.length - 1])}
              </h4>

              {/* Match Boxes */}
              <div
                className="flex flex-col justify-around"
                style={{
                  gap: `${spacingMultiplier * 16}px`,
                  minHeight: roundIndex > 0 ? `${roundsMap[roundNumbers[0]].length * 120}px` : undefined,
                }}
              >
                {roundMatches.map((match) => (
                  <div key={match.id} className="relative flex items-center">
                    {/* Connector lines - left */}
                    {roundIndex > 0 && (
                      <div className="absolute -left-8 top-1/2 w-8 h-px bg-white/[0.1]" />
                    )}

                    <MatchBox match={match} />

                    {/* Connector lines - right */}
                    {roundIndex < totalRounds - 1 && (
                      <div className="absolute -right-8 top-1/2 w-8 h-px bg-white/[0.1]" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

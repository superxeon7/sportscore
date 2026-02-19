'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { MatchTimerDisplay } from './match-timer-display';
import InitialsAvatar from '@/components/ui/initials-avatar';
import type { TimerState } from '@/lib/stores/live-match.store';

interface PeriodScore {
  period: number;
  label: string;
  homeScore: number;
  awayScore: number;
}

export interface ScoreBoardProps {
  homeTeam: string;
  awayTeam: string;
  score: { homeScore: number; awayScore: number };
  status: string;
  currentPeriod: number;
  periodScores?: PeriodScore[];
  timerState?: TimerState | null;
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'LIVE':
      return (
        <Badge variant="danger" size="md" dot>
          LIVE
        </Badge>
      );
    case 'HALF_TIME':
      return (
        <Badge variant="warning" size="md">
          Jeda Babak
        </Badge>
      );
    case 'PAUSED':
      return (
        <Badge variant="warning" size="md">
          Jeda
        </Badge>
      );
    case 'COMPLETED':
      return (
        <Badge variant="default" size="md">
          Selesai
        </Badge>
      );
    case 'SCHEDULED':
      return (
        <Badge variant="info" size="md">
          Terjadwal
        </Badge>
      );
    default:
      return (
        <Badge variant="default" size="md">
          {status?.replace(/_/g, ' ') || 'Tidak Diketahui'}
        </Badge>
      );
  }
}

/**
 * Large real-time scoreboard. Animates score changes with a brief scale-up.
 */
export function ScoreBoard({
  homeTeam,
  awayTeam,
  score,
  status,
  currentPeriod,
  periodScores,
  timerState,
}: ScoreBoardProps) {
  const [homeAnimating, setHomeAnimating] = useState(false);
  const [awayAnimating, setAwayAnimating] = useState(false);
  const prevScoreRef = useRef({ homeScore: score.homeScore, awayScore: score.awayScore });

  useEffect(() => {
    const prev = prevScoreRef.current;
    if (prev.homeScore !== score.homeScore) {
      setHomeAnimating(true);
      const timer = setTimeout(() => setHomeAnimating(false), 600);
      prevScoreRef.current = { ...prev, homeScore: score.homeScore };
      return () => clearTimeout(timer);
    }
  }, [score.homeScore]);

  useEffect(() => {
    const prev = prevScoreRef.current;
    if (prev.awayScore !== score.awayScore) {
      setAwayAnimating(true);
      const timer = setTimeout(() => setAwayAnimating(false), 600);
      prevScoreRef.current = { ...prev, awayScore: score.awayScore };
      return () => clearTimeout(timer);
    }
  }, [score.awayScore]);

  const isLive =
    status === 'LIVE' || status === 'HALF_TIME' || status === 'PAUSED';

  return (
    <div className="relative rounded-2xl overflow-hidden">
      {/* Subtle gradient background */}
      <div
        className={`absolute inset-0 ${isLive
            ? 'bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950'
            : status === 'COMPLETED'
              ? 'bg-gradient-to-br from-slate-800 to-slate-950'
              : 'bg-gradient-to-br from-slate-800 via-indigo-950/30 to-slate-950'
          }`}
      />
      {/* Live accent strip */}
      {isLive && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-500" />
      )}

      <div className="relative p-6 md:p-8">
        {/* Status Row */}
        <div className="flex items-center justify-center gap-3 mb-6">
          <StatusBadge status={status} />
          {isLive && timerState && (
            <MatchTimerDisplay
              timerState={timerState}
              size="lg"
              className="text-slate-100"
            />
          )}
          {isLive && currentPeriod > 0 && (
            <span className="text-sm font-medium text-slate-400">
              Babak {currentPeriod}
            </span>
          )}
        </div>

        {/* Score Row */}
        <div className="flex items-center justify-center gap-6 md:gap-10">
          {/* Home Team */}
          <div className="flex-1 text-right">
            <p className="text-lg md:text-2xl font-semibold text-slate-100 truncate">
              {homeTeam}
            </p>
          </div>

          {/* Scores */}
          <div className="flex items-center gap-4 md:gap-8 flex-shrink-0">
            <span
              className={`text-5xl md:text-7xl font-extrabold tabular-nums text-white transition-all duration-300 ${homeAnimating ? 'scale-125 text-emerald-400' : 'scale-100'
                }`}
            >
              {score.homeScore}
            </span>
            <span className="text-2xl md:text-3xl text-slate-600 font-light select-none">
              :
            </span>
            <span
              className={`text-5xl md:text-7xl font-extrabold tabular-nums text-white transition-all duration-300 ${awayAnimating ? 'scale-125 text-emerald-400' : 'scale-100'
                }`}
            >
              {score.awayScore}
            </span>
          </div>

          {/* Away Team */}
          <div className="flex-1 text-left">
            <p className="text-lg md:text-2xl font-semibold text-slate-100 truncate">
              {awayTeam}
            </p>
          </div>
        </div>

        {/* Period Scores Row */}
        {periodScores && periodScores.length > 0 && (
          <div className="mt-6 flex justify-center">
            <div className="flex gap-2">
              {periodScores.map((ps) => (
                <div
                  key={ps.period}
                  className="text-center bg-white/5 rounded-lg px-3 py-1.5 border border-white/5"
                >
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider">{ps.label}</p>
                  <p className="text-sm font-bold tabular-nums text-slate-300">
                    {ps.homeScore} - {ps.awayScore}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

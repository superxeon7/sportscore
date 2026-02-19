'use client';

import React from 'react';
import { useMatchTimer } from '@/hooks/use-match-timer';
import type { TimerState } from '@/lib/stores/live-match.store';

interface MatchTimerDisplayProps {
  timerState: TimerState | null | undefined;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
} as const;

export function MatchTimerDisplay({
  timerState,
  size = 'md',
  className = '',
}: MatchTimerDisplayProps) {
  const { mainTime, addedTimeDisplay, isRunning } = useMatchTimer(timerState);

  if (!timerState) return null;

  return (
    <span
      className={`font-mono font-bold tabular-nums ${sizeClasses[size]} ${className}`}
    >
      <span>{mainTime}</span>
      {addedTimeDisplay && (
        <span className="text-yellow-300 ml-1">{addedTimeDisplay}</span>
      )}
      {isRunning && (
        <span className="inline-block w-1 h-1 rounded-full bg-current ml-1 animate-pulse" />
      )}
    </span>
  );
}

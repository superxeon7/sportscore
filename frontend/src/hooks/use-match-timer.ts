'use client';

import { useEffect, useState, useRef } from 'react';
import type { TimerState } from '@/lib/stores/live-match.store';

interface MatchTimerResult {
  /** Formatted main time, e.g. "32:15" or "45:00" */
  mainTime: string;
  /** Formatted added-time display, e.g. "+3:12" — empty when not in added time */
  addedTimeDisplay: string;
  /** Raw total elapsed seconds */
  totalElapsed: number;
  /** Whether we are past periodDuration (in added / injury time zone) */
  isAddedTime: boolean;
  /** Whether the timer is currently running */
  isRunning: boolean;
}

function formatTime(totalSeconds: number): string {
  const absSeconds = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(absSeconds / 60);
  const secs = absSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function computeElapsed(timer: TimerState): number {
  let elapsed = timer.elapsedAtPause;
  if (timer.running && timer.startedTimestamp) {
    const now = Date.now();
    const started = new Date(timer.startedTimestamp).getTime();
    elapsed += (now - started) / 1000;
  }
  return elapsed;
}

/**
 * Hook that takes a TimerState and returns ticking display values.
 * Runs a 1-second interval when the timer is running.
 */
export function useMatchTimer(timerState: TimerState | null | undefined): MatchTimerResult {
  const [tick, setTick] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isRunning = timerState?.running ?? false;

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setTick((t) => t + 1);
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isRunning]);

  // Reset tick when timer state identity changes.
  useEffect(() => {
    setTick(0);
  }, [timerState?.startedTimestamp, timerState?.elapsedAtPause]);

  if (!timerState) {
    return {
      mainTime: '--:--',
      addedTimeDisplay: '',
      totalElapsed: 0,
      isAddedTime: false,
      isRunning: false,
    };
  }

  const totalElapsed = computeElapsed(timerState);
  const periodDuration = timerState.periodDuration;
  const pastPeriod = totalElapsed > periodDuration;

  let mainTime: string;
  let addedTimeDisplay = '';
  let isAddedTime = false;

  if (timerState.direction === 'up') {
    if (pastPeriod) {
      // Show period duration as main, overflow as +X:XX
      mainTime = formatTime(periodDuration);
      const overtime = totalElapsed - periodDuration;
      addedTimeDisplay = `+${formatTime(overtime)}`;
      isAddedTime = true;
    } else {
      mainTime = formatTime(totalElapsed);
    }
  } else {
    // Countdown
    const remaining = periodDuration - totalElapsed;
    if (remaining <= 0) {
      mainTime = '00:00';
      const overtime = totalElapsed - periodDuration;
      addedTimeDisplay = `+${formatTime(overtime)}`;
      isAddedTime = true;
    } else {
      mainTime = formatTime(remaining);
    }
  }

  return {
    mainTime,
    addedTimeDisplay,
    totalElapsed,
    isAddedTime,
    isRunning,
  };
}

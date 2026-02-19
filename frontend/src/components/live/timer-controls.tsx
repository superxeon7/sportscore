'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useMatchTimer } from '@/hooks/use-match-timer';
import type { TimerState } from '@/lib/stores/live-match.store';

interface TimerControlsProps {
  timerState: TimerState | null | undefined;
  onStartTimer: () => void;
  onPauseTimer: () => void;
  onSetAddedTime: (seconds: number) => void;
  onSetDirection: (direction: 'up' | 'down') => void;
  onAdjustTimer: (elapsedSeconds: number) => void;
}

export function TimerControls({
  timerState,
  onStartTimer,
  onPauseTimer,
  onSetAddedTime,
  onSetDirection,
  onAdjustTimer,
}: TimerControlsProps) {
  const { mainTime, addedTimeDisplay, isRunning } = useMatchTimer(timerState);
  const [customMinutes, setCustomMinutes] = useState('');

  if (!timerState) return null;

  const direction = timerState.direction;
  const addedTimeMinutes = Math.round(timerState.addedTime / 60);

  const handleQuickAddedTime = (minutes: number) => {
    onSetAddedTime(minutes * 60);
  };

  const handleAdjustMinutes = () => {
    const mins = parseInt(customMinutes, 10);
    if (!isNaN(mins) && mins >= 0) {
      onAdjustTimer(mins * 60);
      setCustomMinutes('');
    }
  };

  return (
    <div className="space-y-4">
      {/* Timer Display */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
          Waktu
        </h4>
        <span className="font-mono text-xl font-bold tabular-nums text-slate-100">
          {mainTime}
          {addedTimeDisplay && (
            <span className="text-orange-400 ml-1">{addedTimeDisplay}</span>
          )}
        </span>
      </div>

      {/* Start / Pause */}
      <div className="flex gap-2">
        {isRunning ? (
          <Button
            variant="secondary"
            className="flex-1 h-11"
            onClick={onPauseTimer}
          >
            ⏸ Jeda Waktu
          </Button>
        ) : (
          <Button
            className="flex-1 h-11 bg-emerald-600 hover:bg-emerald-500 text-white"
            onClick={onStartTimer}
          >
            ▶ Mulai Waktu
          </Button>
        )}
      </div>

      {/* Direction Toggle */}
      <div className="flex gap-2">
        <Button
          variant={direction === 'up' ? 'primary' : 'secondary'}
          size="sm"
          className="flex-1"
          onClick={() => onSetDirection('up')}
        >
          ↑ Hitung Maju
        </Button>
        <Button
          variant={direction === 'down' ? 'primary' : 'secondary'}
          size="sm"
          className="flex-1"
          onClick={() => onSetDirection('down')}
        >
          ↓ Hitung Mundur
        </Button>
      </div>

      {/* Added Time */}
      <div>
        <p className="text-xs font-medium text-slate-400 mb-2">
          Tambahan Waktu{addedTimeMinutes > 0 ? `: ${addedTimeMinutes} menit` : ''}
        </p>
        <div className="flex gap-1.5">
          {[1, 2, 3, 4, 5].map((m) => (
            <Button
              key={m}
              variant={addedTimeMinutes === m ? 'primary' : 'secondary'}
              size="sm"
              className="flex-1 px-0"
              onClick={() => handleQuickAddedTime(m)}
            >
              +{m}
            </Button>
          ))}
          <Button
            variant={addedTimeMinutes === 0 ? 'primary' : 'secondary'}
            size="sm"
            className="px-3"
            onClick={() => handleQuickAddedTime(0)}
          >
            Hapus
          </Button>
        </div>
      </div>

      {/* Manual Adjust */}
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <label className="text-xs font-medium text-slate-400 block mb-1">
            Atur waktu berjalan (menit)
          </label>
          <input
            type="number"
            min="0"
            value={customMinutes}
            onChange={(e) => setCustomMinutes(e.target.value)}
            placeholder="contoh: 30"
            className="block w-full rounded-lg border border-slate-600/60 bg-slate-800/80 px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 placeholder:text-slate-500"
          />
        </div>
        <Button variant="secondary" size="sm" onClick={handleAdjustMinutes}>
          Atur
        </Button>
      </div>
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { TimerControls } from './timer-controls';
import type { TimerState } from '@/lib/stores/live-match.store';

export interface MatchControlsProps {
  matchId: string;
  status: string;
  isPenaltyShootout?: boolean;
  onStartMatch: () => void;
  onEndMatch: () => void;
  onStartPeriod: () => void;
  onEndPeriod: () => void;
  onPause?: () => void;
  onResume?: () => void;
  timerState?: TimerState | null;
  onStartTimer?: () => void;
  onPauseTimer?: () => void;
  onSetAddedTime?: (seconds: number) => void;
  onSetDirection?: (direction: 'up' | 'down') => void;
  onAdjustTimer?: (elapsedSeconds: number) => void;
}

/**
 * Match lifecycle controls for organizers.
 * Renders buttons conditionally based on match status.
 * Includes a confirmation dialog before ending the match.
 */
export function MatchControls({
  matchId,
  status,
  isPenaltyShootout,
  onStartMatch,
  onEndMatch,
  onStartPeriod,
  onEndPeriod,
  onPause,
  onResume,
  timerState,
  onStartTimer,
  onPauseTimer,
  onSetAddedTime,
  onSetDirection,
  onAdjustTimer,
}: MatchControlsProps) {
  const [showEndConfirm, setShowEndConfirm] = useState(false);

  const handleEndMatch = () => {
    setShowEndConfirm(false);
    onEndMatch();
  };

  const hasTimerControls =
    status === 'LIVE' &&
    timerState &&
    onStartTimer &&
    onPauseTimer &&
    onSetAddedTime &&
    onSetDirection &&
    onAdjustTimer;

  return (
    <>
      <div className="space-y-5">
        {/* Section Header */}
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
          Kontrol Pertandingan
        </h3>

        {/* Match Status Controls */}
        <div className="flex flex-wrap gap-3">
          {/* SCHEDULED: Start Match */}
          {(status === 'PUBLISHED' || status === 'SCHEDULED' || status === 'WARMUP') && (
            <Button
              size="lg"
              className="h-14 px-8 text-lg bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl flex-1 min-w-[200px]"
              onClick={onStartMatch}
            >
              ▶ Mulai Pertandingan
            </Button>
          )}

          {/* LIVE: End Period, Pause, End Match */}
          {status === 'LIVE' && (
            <>
              <Button
                variant="secondary"
                size="lg"
                className="h-12 px-6 rounded-xl"
                onClick={onEndPeriod}
              >
                Akhiri Babak
              </Button>
              {onPause && (
                <Button
                  variant="secondary"
                  size="lg"
                  className="h-12 px-6 rounded-xl"
                  onClick={onPause}
                >
                  Jeda
                </Button>
              )}
              <Button
                variant="danger"
                size="lg"
                className="h-12 px-6 rounded-xl"
                onClick={() => setShowEndConfirm(true)}
              >
                Akhiri Pertandingan
              </Button>
            </>
          )}

          {/* PENALTY_SHOOTOUT: informational only — controls are in PenaltyShootoutPanel */}
          {(status === 'PENALTY_SHOOTOUT' || isPenaltyShootout) && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/25 w-full">
              <span className="text-amber-400 text-base">&#9917;</span>
              <p className="text-sm text-amber-300 font-medium">
                Adu penalti sedang berlangsung — gunakan panel penalti untuk mencatat tendangan
              </p>
            </div>
          )}

          {/* HALF_TIME / PAUSED (non-penalty): Start Period, Resume */}
          {(status === 'HALF_TIME' || (status === 'PAUSED' && !isPenaltyShootout)) && (
            <>
              <Button
                size="lg"
                className="h-12 px-6 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl"
                onClick={onStartPeriod}
              >
                ▶ Mulai Babak
              </Button>
              {onResume && (
                <Button
                  variant="secondary"
                  size="lg"
                  className="h-12 px-6 rounded-xl"
                  onClick={onResume}
                >
                  Lanjutkan
                </Button>
              )}
              <Button
                variant="danger"
                size="lg"
                className="h-12 px-6 rounded-xl"
                onClick={() => setShowEndConfirm(true)}
              >
                Akhiri Pertandingan
              </Button>
            </>
          )}

          {/* COMPLETED: Disabled indicator */}
          {status === 'COMPLETED' && (
            <Button
              variant="secondary"
              size="lg"
              className="h-12 px-6 opacity-60 rounded-xl"
              disabled
            >
              ✓ Pertandingan Selesai
            </Button>
          )}
        </div>

        {/* Timer Controls — visually grouped */}
        {hasTimerControls && (
          <div className="border-t border-slate-700/50 pt-5">
            <TimerControls
              timerState={timerState}
              onStartTimer={onStartTimer}
              onPauseTimer={onPauseTimer}
              onSetAddedTime={onSetAddedTime}
              onSetDirection={onSetDirection}
              onAdjustTimer={onAdjustTimer}
            />
          </div>
        )}
      </div>

      {/* End Match Confirmation Modal */}
      <Modal
        open={showEndConfirm}
        onClose={() => setShowEndConfirm(false)}
        title="Akhiri Pertandingan?"
        size="sm"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setShowEndConfirm(false)}
            >
              Batal
            </Button>
            <Button variant="danger" onClick={handleEndMatch}>
              Akhiri Pertandingan
            </Button>
          </>
        }
      >
        <p className="text-slate-300">
          Apakah Anda yakin ingin mengakhiri pertandingan ini? Tindakan ini akan menandai pertandingan sebagai selesai dan mengunci skor akhir.
        </p>
      </Modal>
    </>
  );
}

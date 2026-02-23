'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import type { PenaltyShot } from '@/lib/types';

export interface PenaltyShootoutPanelProps {
  homeTeamName: string;
  awayTeamName: string;
  homeScore: number;
  awayScore: number;
  penaltyShots: PenaltyShot[];
  homePenaltyScore: number;
  awayPenaltyScore: number;
  onAddKick: (team: 'home' | 'away', result: 'GOAL' | 'MISS') => void;
  onUndoKick: () => void;
  onReset: () => void;
  onFinish: () => void;
}

/**
 * Full penalty shootout UI for organizers.
 * Shows per-kick input, visual scoreboard with dots, and control buttons.
 */
export function PenaltyShootoutPanel({
  homeTeamName,
  awayTeamName,
  homeScore,
  awayScore,
  penaltyShots,
  homePenaltyScore,
  awayPenaltyScore,
  onAddKick,
  onUndoKick,
  onReset,
  onFinish,
}: PenaltyShootoutPanelProps) {
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);

  const homeShots = penaltyShots.filter((s) => s.team === 'home');
  const awayShots = penaltyShots.filter((s) => s.team === 'away');

  const hasWinner = homePenaltyScore !== awayPenaltyScore;
  const canFinish = hasWinner && penaltyShots.length >= 2;

  // Determine which team should kick next
  const getNextKicker = (): 'home' | 'away' | null => {
    if (homeShots.length <= awayShots.length) return 'home';
    return 'away';
  };

  const nextKicker = getNextKicker();

  // Determine max rounds for display (at least 5, or current max + 1)
  const maxRound = Math.max(
    5,
    ...homeShots.map((s) => s.round),
    ...awayShots.map((s) => s.round),
  );

  // Build round-by-round display
  const rounds: Array<{
    round: number;
    home: PenaltyShot | null;
    away: PenaltyShot | null;
    isSuddenDeath: boolean;
  }> = [];

  for (let r = 1; r <= maxRound; r++) {
    rounds.push({
      round: r,
      home: homeShots.find((s) => s.round === r) ?? null,
      away: awayShots.find((s) => s.round === r) ?? null,
      isSuddenDeath: r > 5,
    });
  }

  const renderDot = (shot: PenaltyShot | null) => {
    if (!shot) {
      return (
        <div className="w-7 h-7 rounded-full border-2 border-slate-700/50 bg-slate-800/40" />
      );
    }
    if (shot.result === 'GOAL') {
      return (
        <div className="w-7 h-7 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center">
          <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      );
    }
    return (
      <div className="w-7 h-7 rounded-full bg-red-500/20 border-2 border-red-500 flex items-center justify-center">
        <svg className="w-3.5 h-3.5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>
    );
  };

  return (
    <>
      <div className="space-y-5">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/15 border border-amber-500/30">
            <span className="text-amber-400 text-sm">&#9917;</span>
            <span className="text-sm font-bold text-amber-300 uppercase tracking-wider">
              Adu Penalti
            </span>
          </div>
        </div>

        {/* FT Score */}
        <div className="text-center">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Skor Waktu Normal</p>
          <p className="text-lg font-bold text-slate-300 tabular-nums">
            {homeScore} - {awayScore}
          </p>
        </div>

        {/* Penalty Score */}
        <div className="flex items-center justify-center gap-6">
          <div className="text-center">
            <p className="text-xs text-slate-400 truncate max-w-[100px]">{homeTeamName}</p>
            <p className="text-3xl font-black text-white tabular-nums mt-1">{homePenaltyScore}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-slate-500 uppercase tracking-wider">Penalti</p>
            <p className="text-lg text-slate-600 font-light mt-1">:</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-slate-400 truncate max-w-[100px]">{awayTeamName}</p>
            <p className="text-3xl font-black text-white tabular-nums mt-1">{awayPenaltyScore}</p>
          </div>
        </div>

        {/* Visual Scoreboard — Dots per round */}
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-4">
          <div className="space-y-2">
            {/* Header row */}
            <div className="grid grid-cols-[1fr_40px_1fr] gap-2 items-center mb-3">
              <p className="text-xs font-semibold text-slate-400 text-center truncate">{homeTeamName}</p>
              <p className="text-[10px] text-slate-600 text-center">#</p>
              <p className="text-xs font-semibold text-slate-400 text-center truncate">{awayTeamName}</p>
            </div>

            {/* Rounds */}
            {rounds.map((r) => (
              <div
                key={r.round}
                className={`grid grid-cols-[1fr_40px_1fr] gap-2 items-center ${
                  r.isSuddenDeath ? 'pt-2 border-t border-dashed border-amber-500/30' : ''
                }`}
              >
                <div className="flex justify-center">{renderDot(r.home)}</div>
                <div className="text-center">
                  <span className={`text-[10px] font-bold ${r.isSuddenDeath ? 'text-amber-400' : 'text-slate-600'}`}>
                    {r.round}
                  </span>
                  {r.isSuddenDeath && r.round === Math.min(...rounds.filter(rd => rd.isSuddenDeath).map(rd => rd.round)) && (
                    <p className="text-[8px] text-amber-500 uppercase tracking-wider leading-none mt-0.5">SD</p>
                  )}
                </div>
                <div className="flex justify-center">{renderDot(r.away)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Kick Input Buttons */}
        <div className="space-y-3">
          <p className="text-xs text-slate-400 text-center">
            {nextKicker === 'home'
              ? `Giliran: ${homeTeamName}`
              : nextKicker === 'away'
                ? `Giliran: ${awayTeamName}`
                : 'Tentukan tendangan berikutnya'}
          </p>

          <div className="grid grid-cols-2 gap-3">
            {/* Home buttons */}
            <div className="space-y-2">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider text-center truncate">
                {homeTeamName}
              </p>
              <Button
                onClick={() => onAddKick('home', 'GOAL')}
                className="w-full h-11 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-bold"
              >
                + GOL
              </Button>
              <Button
                variant="secondary"
                onClick={() => onAddKick('home', 'MISS')}
                className="w-full h-11 rounded-xl border-red-700/40 text-red-400 hover:bg-red-950/30 text-sm font-bold"
              >
                + MISS
              </Button>
            </div>

            {/* Away buttons */}
            <div className="space-y-2">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider text-center truncate">
                {awayTeamName}
              </p>
              <Button
                onClick={() => onAddKick('away', 'GOAL')}
                className="w-full h-11 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-bold"
              >
                + GOL
              </Button>
              <Button
                variant="secondary"
                onClick={() => onAddKick('away', 'MISS')}
                className="w-full h-11 rounded-xl border-red-700/40 text-red-400 hover:bg-red-950/30 text-sm font-bold"
              >
                + MISS
              </Button>
            </div>
          </div>
        </div>

        {/* Control Buttons */}
        <div className="space-y-2 pt-3 border-t border-slate-700/40">
          {/* Finish Match */}
          <Button
            onClick={() => setShowFinishConfirm(true)}
            disabled={!canFinish}
            className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold disabled:opacity-40"
          >
            Selesaikan Pertandingan
          </Button>

          {/* Undo + Reset row */}
          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={onUndoKick}
              disabled={penaltyShots.length === 0}
              className="flex-1 h-10 rounded-xl border border-slate-600/40 text-slate-400 hover:text-white text-xs disabled:opacity-40"
            >
              ↩ Batalkan Tendangan
            </Button>
            <Button
              variant="ghost"
              onClick={() => setShowResetConfirm(true)}
              disabled={penaltyShots.length === 0}
              className="flex-1 h-10 rounded-xl border border-red-700/30 text-red-400 hover:bg-red-950/20 text-xs disabled:opacity-40"
            >
              Reset Penalti
            </Button>
          </div>
        </div>
      </div>

      {/* Reset Confirmation Modal */}
      <Modal
        open={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        title="Reset Adu Penalti?"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowResetConfirm(false)}>
              Batal
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setShowResetConfirm(false);
                onReset();
              }}
            >
              Reset
            </Button>
          </>
        }
      >
        <p className="text-slate-300">
          Semua data tendangan penalti akan dihapus. Anda harus memulai ulang adu penalti dari awal.
        </p>
      </Modal>

      {/* Finish Confirmation Modal */}
      <Modal
        open={showFinishConfirm}
        onClose={() => setShowFinishConfirm(false)}
        title="Selesaikan Pertandingan?"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowFinishConfirm(false)}>
              Batal
            </Button>
            <Button
              className="bg-blue-600 hover:bg-blue-500 text-white"
              onClick={() => {
                setShowFinishConfirm(false);
                onFinish();
              }}
            >
              Selesaikan
            </Button>
          </>
        }
      >
        <p className="text-slate-300">
          Pertandingan akan ditandai selesai dengan pemenang melalui adu penalti ({homePenaltyScore} - {awayPenaltyScore}).
          Klasemen dan bracket akan otomatis diperbarui.
        </p>
      </Modal>
    </>
  );
}

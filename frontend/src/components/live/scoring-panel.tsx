'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { Player } from '@/lib/types';

interface TeamInfo {
  id: string;
  name: string;
  players?: Player[];
}

export interface ScoringPanelProps {
  sportSlug: string;
  matchId: string;
  homeTeam: TeamInfo;
  awayTeam: TeamInfo;
  onEvent: (eventData: {
    type: string;
    teamId?: string;
    playerId?: string;
    description?: string;
    data?: Record<string, unknown>;
  }) => void;
}

const PLAYER_REQUIRED_EVENTS = ['GOAL', 'YELLOW_CARD', 'RED_CARD', 'GREEN_CARD', 'FOUL'];

function PlayerDropdown({
  players,
  value,
  onChange,
  label,
  required,
}: {
  players: Player[];
  value: string | undefined;
  onChange: (playerId: string | undefined) => void;
  label: string;
  required?: boolean;
}) {
  if (!players || players.length === 0) return null;

  return (
    <div>
      <label className="text-xs font-medium text-slate-400 block mb-1">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value || undefined)}
        className={`block w-full rounded-lg border px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 ${required && !value
            ? 'border-red-500/50 bg-red-950/20 text-slate-200'
            : 'border-slate-600/60 bg-slate-800 text-slate-200'
          }`}
      >
        <option value="" className="bg-slate-900 text-slate-100">-- Pilih pemain --</option>
        {players.map((p) => (
          <option key={p.id} value={p.id} className="bg-slate-900 text-slate-100">
            {p.jerseyNumber != null ? `#${p.jerseyNumber} ` : ''}
            {p.fullName}
          </option>
        ))}
      </select>
    </div>
  );
}

function TeamScoringColumn({
  team,
  sportSlug,
  onEvent,
  colorScheme,
}: {
  team: TeamInfo;
  sportSlug: string;
  onEvent: ScoringPanelProps['onEvent'];
  colorScheme: 'blue' | 'red';
}) {
  const [selectedPlayer, setSelectedPlayer] = useState<string | undefined>();
  const [playerWarning, setPlayerWarning] = useState(false);

  // Dark-themed color tokens per team side
  const colors = colorScheme === 'blue'
    ? {
      bg: 'bg-blue-950/25',
      border: 'border-blue-700/30',
      header: 'text-blue-400',
      goalBg: 'bg-blue-600 hover:bg-blue-500 active:bg-blue-700',
      hoverBg: 'hover:bg-blue-950/40',
      accentRing: 'focus-visible:ring-blue-500',
    }
    : {
      bg: 'bg-red-950/25',
      border: 'border-red-700/30',
      header: 'text-red-400',
      goalBg: 'bg-red-600 hover:bg-red-500 active:bg-red-700',
      hoverBg: 'hover:bg-red-950/40',
      accentRing: 'focus-visible:ring-red-500',
    };

  const emit = (type: string, data?: Record<string, unknown>) => {
    if (PLAYER_REQUIRED_EVENTS.includes(type) && !selectedPlayer) {
      setPlayerWarning(true);
      return;
    }
    setPlayerWarning(false);
    onEvent({
      type,
      teamId: team.id,
      playerId: selectedPlayer,
      data,
    });
    setSelectedPlayer(undefined);
  };

  // Football / Futsal controls
  if (sportSlug === 'football' || sportSlug === 'soccer' || sportSlug === 'futsal') {
    const isFutsal = sportSlug === 'futsal';
    return (
      <div className={`space-y-3 p-4 rounded-xl border ${colors.bg} ${colors.border}`}>
        <h4 className={`font-semibold text-sm tracking-wide ${colors.header}`}>
          {team.name}
        </h4>

        {/* Player Selector — placed at top for better flow */}
        {team.players && team.players.length > 0 && (
          <PlayerDropdown
            players={team.players}
            value={selectedPlayer}
            onChange={setSelectedPlayer}
            label="Pilih Pemain"
            required
          />
        )}
        {playerWarning && (
          <p className="text-xs text-red-400 font-medium">
            ⚠ Pilih pemain terlebih dahulu untuk aksi ini
          </p>
        )}

        {/* Main action — Goal */}
        <Button
          className={`w-full h-16 text-lg font-bold text-white rounded-xl transition-all ${colors.goalBg}`}
          onClick={() => emit('GOAL')}
        >
          ⚽ Gol
        </Button>

        {/* Secondary actions */}
        <Button
          variant="ghost"
          className={`w-full h-11 text-slate-300 ${colors.hoverBg}`}
          onClick={() => emit('OWN_GOAL')}
        >
          Gol Bunuh Diri
        </Button>

        {/* Cards row */}
        <div className={`grid gap-2 ${isFutsal ? 'grid-cols-3' : 'grid-cols-2'}`}>
          <Button
            variant="ghost"
            className="h-12 bg-yellow-900/30 hover:bg-yellow-900/50 text-yellow-400 border border-yellow-700/30 rounded-xl"
            onClick={() => emit('YELLOW_CARD')}
          >
            🟡 Kuning
          </Button>
          <Button
            variant="ghost"
            className="h-12 bg-red-900/30 hover:bg-red-900/50 text-red-400 border border-red-700/30 rounded-xl"
            onClick={() => emit('RED_CARD')}
          >
            🔴 Merah
          </Button>
          {isFutsal && (
            <Button
              variant="ghost"
              className="h-12 bg-green-900/30 hover:bg-green-900/50 text-green-400 border border-green-700/30 rounded-xl"
              onClick={() => emit('GREEN_CARD')}
            >
              🟢 Hijau
            </Button>
          )}
        </div>

        {/* Substitution */}
        <Button
          variant="ghost"
          className={`w-full h-11 text-slate-300 ${colors.hoverBg}`}
          onClick={() => emit('SUBSTITUTION')}
        >
          🔄 Pergantian Pemain
        </Button>
      </div>
    );
  }

  // Basketball controls
  if (sportSlug === 'basketball') {
    return (
      <div className={`space-y-3 p-4 rounded-xl border ${colors.bg} ${colors.border}`}>
        <h4 className={`font-semibold text-sm tracking-wide ${colors.header}`}>
          {team.name}
        </h4>

        {/* Player Selector */}
        {team.players && team.players.length > 0 && (
          <PlayerDropdown
            players={team.players}
            value={selectedPlayer}
            onChange={setSelectedPlayer}
            label="Pilih Pemain"
            required
          />
        )}
        {playerWarning && (
          <p className="text-xs text-red-400 font-medium">
            ⚠ Pilih pemain terlebih dahulu untuk aksi ini
          </p>
        )}

        {/* Scoring buttons */}
        <div className="grid grid-cols-3 gap-2">
          <Button
            className={`h-16 text-lg font-bold text-white rounded-xl ${colors.goalBg}`}
            onClick={() => emit('POINT', { points: 2, variant: '2PT' })}
          >
            2PT
          </Button>
          <Button
            className={`h-16 text-lg font-bold text-white rounded-xl ${colors.goalBg}`}
            onClick={() => emit('POINT', { points: 3, variant: '3PT' })}
          >
            3PT
          </Button>
          <Button
            variant="ghost"
            className="h-16 text-lg font-bold text-slate-200 border border-slate-600/50 rounded-xl hover:bg-slate-700/50"
            onClick={() => emit('POINT', { points: 1, variant: 'FT' })}
          >
            FT
          </Button>
        </div>

        {/* Foul */}
        <Button
          variant="ghost"
          className={`w-full h-11 text-slate-300 border border-slate-600/40 ${colors.hoverBg}`}
          onClick={() => emit('FOUL')}
        >
          Pelanggaran
        </Button>
      </div>
    );
  }

  // Volleyball controls
  if (sportSlug === 'volleyball') {
    return (
      <Button
        className={`h-20 text-xl font-bold text-white rounded-xl w-full transition-all ${colors.goalBg}`}
        onClick={() => emit('POINT')}
      >
        {team.name} Poin
      </Button>
    );
  }

  // Default / generic controls
  return (
    <Button
      className={`h-20 text-xl font-bold text-white rounded-xl w-full transition-all ${colors.goalBg}`}
      onClick={() => emit('POINT')}
    >
      {team.name}
      {'\n'}
      Tambah Poin
    </Button>
  );
}

/**
 * Dynamic scoring control panel for organizers.
 * Renders sport-specific controls based on the sportSlug.
 */
export function ScoringPanel({
  sportSlug,
  matchId,
  homeTeam,
  awayTeam,
  onEvent,
}: ScoringPanelProps) {
  const slug = sportSlug?.toLowerCase() || '';
  const isCompactLayout = slug === 'volleyball' || slug === '';

  const title =
    {
      football: 'Aksi Sepak Bola',
      soccer: 'Aksi Sepak Bola',
      futsal: 'Aksi Futsal',
      basketball: 'Aksi Bola Basket',
      volleyball: 'Aksi Bola Voli',
    }[slug] || 'Pencatatan Skor';

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-lg text-slate-100">{title}</h3>
      <div
        className={`grid gap-4 ${isCompactLayout ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-2'
          }`}
      >
        <TeamScoringColumn
          team={homeTeam}
          sportSlug={slug}
          onEvent={onEvent}
          colorScheme="blue"
        />
        <TeamScoringColumn
          team={awayTeam}
          sportSlug={slug}
          onEvent={onEvent}
          colorScheme="red"
        />
      </div>
    </div>
  );
}

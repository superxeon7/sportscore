'use client';

import { create } from 'zustand';
import type { MatchStatus } from '@/lib/types';

/**
 * Score state matching the backend ScoreState interface.
 */
export interface ScoreState {
  homeScore: number;
  awayScore: number;
  periodScores: Array<{
    period: number;
    label: string;
    homeScore: number;
    awayScore: number;
  }>;
  extraScores: Array<{
    period: number;
    label: string;
    homeScore: number;
    awayScore: number;
  }>;
  penaltyScores: { home: number; away: number };
}

/**
 * Match event record as received from the WebSocket gateway.
 */
export interface MatchEventRecord {
  id: string;
  type: string;
  minute: number | null;
  period: number | null;
  playerId: string | null;
  playerName: string | null;
  jerseyNumber: number | null;
  teamId: string | null;
  description: string | null;
  data: Record<string, unknown>;
  timestamp: string | Date;
  homeScoreSnapshot: number | null;
  awayScoreSnapshot: number | null;
}

/**
 * Timer state as managed by the server and synced via WebSocket.
 */
export interface TimerState {
  running: boolean;
  direction: 'up' | 'down';
  periodDuration: number;
  elapsedAtPause: number;
  startedTimestamp: string | null;
  addedTime: number;
}

/**
 * Full match state as returned by the `match:state` socket event.
 */
export interface MatchState {
  matchId: string;
  status: MatchStatus | string;
  currentPeriod: number;
  score: ScoreState;
  events: MatchEventRecord[];
  homeTeamId: string;
  awayTeamId: string;
  startedAt: string | Date | null;
  timerState: TimerState | null;
  sportSlug?: string;
}

interface LiveMatchState {
  matchId: string | null;
  matchState: MatchState | null;
  isConnected: boolean;
  error: string | null;
}

interface LiveMatchActions {
  joinMatch: (matchId: string) => void;
  leaveMatch: () => void;
  setMatchState: (state: MatchState) => void;
  handleScoreUpdate: (payload: { score: ScoreState; matchId: string }) => void;
  handleNewEvent: (event: MatchEventRecord) => void;
  handleEventRemoved: (payload: {
    removedEvent: MatchEventRecord;
    score: ScoreState;
    matchId: string;
  }) => void;
  handleStatusChange: (status: MatchStatus | string) => void;
  handleTimerUpdate: (timerState: TimerState) => void;
  setConnected: (connected: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

type LiveMatchStore = LiveMatchState & LiveMatchActions;

const initialState: LiveMatchState = {
  matchId: null,
  matchState: null,
  isConnected: false,
  error: null,
};

export const useLiveMatchStore = create<LiveMatchStore>((set, get) => ({
  ...initialState,

  joinMatch: (matchId: string) => {
    set({ matchId, error: null });
  },

  leaveMatch: () => {
    set({ ...initialState });
  },

  setMatchState: (state: MatchState) => {
    set({ matchState: state, error: null });
  },

  handleScoreUpdate: (payload) => {
    const current = get().matchState;
    if (!current) return;
    set({
      matchState: {
        ...current,
        score: payload.score,
      },
    });
  },

  handleNewEvent: (event: MatchEventRecord) => {
    const current = get().matchState;
    if (!current) return;
    set({
      matchState: {
        ...current,
        events: [...current.events, event],
      },
    });
  },

  handleEventRemoved: (payload) => {
    const current = get().matchState;
    if (!current) return;
    set({
      matchState: {
        ...current,
        events: current.events.filter(
          (e) => e.id !== payload.removedEvent.id,
        ),
        score: payload.score,
      },
    });
  },

  handleStatusChange: (status) => {
    const current = get().matchState;
    if (!current) return;
    set({
      matchState: {
        ...current,
        status,
      },
    });
  },

  handleTimerUpdate: (timerState: TimerState) => {
    const current = get().matchState;
    if (!current) return;
    set({
      matchState: {
        ...current,
        timerState,
      },
    });
  },

  setConnected: (connected: boolean) => {
    set({ isConnected: connected });
  },

  setError: (error: string | null) => {
    set({ error });
  },

  reset: () => {
    set({ ...initialState });
  },
}));

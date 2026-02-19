'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useSocket } from './use-socket';
import {
  useLiveMatchStore,
  type MatchState,
  type MatchEventRecord,
  type ScoreState,
  type TimerState,
} from '@/lib/stores/live-match.store';

/**
 * Hook that manages a real-time connection to a specific match.
 *
 * - Joins the match room on mount, leaves on unmount.
 * - Listens for all server-pushed events and updates the store.
 * - Exposes action emitters for organizer controls.
 */
export function useLiveMatch(matchId: string | null) {
  const { socket, isConnected: socketConnected } = useSocket();
  const {
    matchState,
    isConnected,
    error,
    setMatchState,
    handleScoreUpdate,
    handleNewEvent,
    handleEventRemoved,
    handleStatusChange,
    handleTimerUpdate,
    setConnected,
    setError,
    joinMatch,
    leaveMatch,
    reset,
  } = useLiveMatchStore();

  const currentMatchIdRef = useRef<string | null>(null);

  // Join / leave match room
  useEffect(() => {
    if (!socket || !matchId) return;

    // Already joined this match
    if (currentMatchIdRef.current === matchId) return;

    // Leave previous match if any
    if (currentMatchIdRef.current) {
      socket.emit('match:leave', { matchId: currentMatchIdRef.current });
    }

    currentMatchIdRef.current = matchId;
    joinMatch(matchId);
    setConnected(socketConnected);

    // Join the new match room
    socket.emit('match:join', { matchId });

    // ---- Listeners ----

    function onMatchState(state: MatchState) {
      setMatchState(state);
    }

    function onScoreUpdate(payload: { score: ScoreState; matchId: string }) {
      handleScoreUpdate(payload);
    }

    function onNewEvent(rawEvent: any) {
      const player = rawEvent?.player;
      const event: MatchEventRecord = {
        id: rawEvent.id,
        type: rawEvent.type,
        minute: rawEvent.minute ?? null,
        period: rawEvent.period ?? null,
        playerId: rawEvent.playerId ?? null,
        playerName: rawEvent.playerName ?? player?.fullName ?? null,
        jerseyNumber: rawEvent.jerseyNumber ?? player?.jerseyNumber ?? null,
        teamId: rawEvent.teamId ?? null,
        description: rawEvent.description ?? null,
        data: rawEvent.data ?? {},
        timestamp: rawEvent.timestamp,
        homeScoreSnapshot: rawEvent.homeScoreSnapshot ?? null,
        awayScoreSnapshot: rawEvent.awayScoreSnapshot ?? null,
      };
      handleNewEvent(event);
    }

    function onEventRemoved(payload: {
      removedEvent: MatchEventRecord;
      score: ScoreState;
      matchId: string;
    }) {
      handleEventRemoved(payload);
    }

    function onStatusChange(payload: { status: string; matchId: string }) {
      handleStatusChange(payload.status);
    }

    function onTimerUpdate(timerState: TimerState) {
      handleTimerUpdate(timerState);
    }

    function onMatchError(payload: { message: string }) {
      setError(payload.message || 'An error occurred');
    }

    function onConnect() {
      setConnected(true);
      // Re-join room on reconnect
      if (currentMatchIdRef.current) {
        socket!.emit('match:join', { matchId: currentMatchIdRef.current });
      }
    }

    function onDisconnect() {
      setConnected(false);
    }

    socket.on('match:state', onMatchState);
    socket.on('match:score-update', onScoreUpdate);
    socket.on('match:new-event', onNewEvent);
    socket.on('match:event-undone', onEventRemoved);
    socket.on('match:status-change', onStatusChange);
    socket.on('match:timer', onTimerUpdate);
    socket.on('match:error', onMatchError);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    // Sync connection state
    setConnected(socket.connected);

    return () => {
      socket.off('match:state', onMatchState);
      socket.off('match:score-update', onScoreUpdate);
      socket.off('match:new-event', onNewEvent);
      socket.off('match:event-undone', onEventRemoved);
      socket.off('match:status-change', onStatusChange);
      socket.off('match:timer', onTimerUpdate);
      socket.off('match:error', onMatchError);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);

      if (currentMatchIdRef.current) {
        socket.emit('match:leave', { matchId: currentMatchIdRef.current });
      }
      currentMatchIdRef.current = null;
      reset();
    };
  }, [socket, matchId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep connection state in sync
  useEffect(() => {
    setConnected(socketConnected);
  }, [socketConnected, setConnected]);

  // ---- Emitters ----

  const sendEvent = useCallback(
    (eventData: {
      type: string;
      teamId?: string;
      playerId?: string;
      minute?: number;
      period?: number;
      description?: string;
      data?: Record<string, unknown>;
    }) => {
      if (!socket || !matchId) return;
      socket.emit('match:event', { matchId, ...eventData });
    },
    [socket, matchId],
  );

  const undoEvent = useCallback(() => {
    if (!socket || !matchId) return;
    socket.emit('match:undo-event', { matchId });
  }, [socket, matchId]);

  const startMatch = useCallback(() => {
    if (!socket || !matchId) return;
    socket.emit('match:start', { matchId });
  }, [socket, matchId]);

  const endMatch = useCallback(() => {
    if (!socket || !matchId) return;
    socket.emit('match:end', { matchId });
  }, [socket, matchId]);

  const startPeriod = useCallback(
    (period?: number) => {
      if (!socket || !matchId) return;
      const p = period ?? (matchState?.currentPeriod ?? 0) + 1;
      socket.emit('match:period-start', { matchId, period: p });
    },
    [socket, matchId, matchState?.currentPeriod],
  );

  const endPeriod = useCallback(
    (period?: number) => {
      if (!socket || !matchId) return;
      const p = period ?? matchState?.currentPeriod ?? 1;
      socket.emit('match:period-end', { matchId, period: p });
    },
    [socket, matchId, matchState?.currentPeriod],
  );

  // ---- Timer emitters ----

  const startTimer = useCallback(() => {
    if (!socket || !matchId) return;
    socket.emit('match:timer-start', { matchId });
  }, [socket, matchId]);

  const pauseTimer = useCallback(() => {
    if (!socket || !matchId) return;
    socket.emit('match:timer-pause', { matchId });
  }, [socket, matchId]);

  const setAddedTime = useCallback(
    (seconds: number) => {
      if (!socket || !matchId) return;
      socket.emit('match:timer-set-added-time', { matchId, seconds });
    },
    [socket, matchId],
  );

  const setTimerDirection = useCallback(
    (direction: 'up' | 'down') => {
      if (!socket || !matchId) return;
      socket.emit('match:timer-set-direction', { matchId, direction });
    },
    [socket, matchId],
  );

  const adjustTimer = useCallback(
    (elapsedSeconds: number) => {
      if (!socket || !matchId) return;
      socket.emit('match:timer-adjust', { matchId, elapsedSeconds });
    },
    [socket, matchId],
  );

  return {
    matchState,
    isConnected,
    error,
    sendEvent,
    undoEvent,
    startMatch,
    endMatch,
    startPeriod,
    endPeriod,
    startTimer,
    pauseTimer,
    setAddedTime,
    setTimerDirection,
    adjustTimer,
  };
}

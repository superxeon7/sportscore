import { MatchEventType, MatchStatus } from '@prisma/client';

// ---------------------------------------------------------------------------
// Sport Configuration – stored in Sport.scoringSystem JSON column
// ---------------------------------------------------------------------------

/**
 * Describes how a single event type affects the score.
 *
 * Example for football:
 * ```json
 * { "eventType": "GOAL", "points": 1, "forOpponent": false }
 * ```
 *
 * Example for basketball:
 * ```json
 * { "eventType": "POINT", "points": 2, "variant": "2PT", "forOpponent": false }
 * ```
 */
export interface ScoringEventConfig {
  /** The MatchEventType that triggers a score change. */
  eventType: MatchEventType | string;

  /** How many points this event awards. */
  points: number;

  /**
   * Optional variant label (e.g. "2PT", "3PT", "FT" in basketball).
   * When present the engine checks `event.data.variant` to match.
   */
  variant?: string;

  /**
   * If true the points are credited to the *opposing* team.
   * Used for own-goals in football, etc.
   */
  forOpponent?: boolean;
}

/**
 * Configuration for a single period / half / quarter / set.
 */
export interface PeriodConfig {
  /** Human-readable label, e.g. "1st Half", "Q1", "Set 1". */
  label: string;

  /** Duration in minutes (0 if untimed, e.g. volleyball). */
  duration: number;
}

/**
 * Full scoring-system JSON shape persisted in Sport.scoringSystem.
 */
export interface SportConfig {
  /** Sport slug for quick identification, e.g. "football", "basketball". */
  slug?: string;

  /** All events that can change the score. */
  scoringEvents: ScoringEventConfig[];

  /** Period definitions.  Index 0 is period 1 in the UI. */
  periods: PeriodConfig[];

  /**
   * Whether the sport supports extra time / overtime.
   * If true the engine will allow periods beyond the regular count.
   */
  hasExtraTime?: boolean;

  /**
   * Whether the sport supports penalty shoot-outs (football).
   */
  hasPenaltyShootout?: boolean;

  /**
   * Set-based scoring configuration (volleyball).
   * When present the engine uses set logic instead of cumulative scoring.
   */
  setBased?: {
    /** Points needed to win a regular set. */
    pointsToWin: number;

    /** Points needed to win the final / deciding set. */
    finalSetPointsToWin: number;

    /** Minimum point advantage required to win a set. */
    minAdvantage: number;

    /** Number of sets to win the match. */
    setsToWin: number;
  };

  /**
   * Arbitrary extra properties a sport may define.
   * The generic engine ignores unknown keys; sport-specific engines may use them.
   */
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Timer State – real-time clock managed in Redis
// ---------------------------------------------------------------------------

export interface TimerState {
  /** Whether the timer is currently ticking. */
  running: boolean;

  /** Count direction: 'up' counts from 0, 'down' counts from periodDuration. */
  direction: 'up' | 'down';

  /** Duration of the current period in seconds (e.g. 2700 for 45 min). */
  periodDuration: number;

  /** Seconds elapsed when the timer was last paused. */
  elapsedAtPause: number;

  /** ISO-8601 timestamp when the timer was started; null when paused. */
  startedTimestamp: string | null;

  /** Injury / added time in seconds. */
  addedTime: number;
}

// ---------------------------------------------------------------------------
// Match State – the real-time snapshot of a match
// ---------------------------------------------------------------------------

export interface PeriodScore {
  period: number;
  label: string;
  homeScore: number;
  awayScore: number;
}

export interface ScoreState {
  homeScore: number;
  awayScore: number;
  periodScores: PeriodScore[];
  /** Extra-time / overtime scores, kept separate from regular periods. */
  extraScores: PeriodScore[];
  /** Penalty shoot-out tally (football). */
  penaltyScores: { home: number; away: number };
}

export interface MatchEventRecord {
  id: string;
  type: MatchEventType | string;
  minute: number | null;
  period: number | null;
  playerId: string | null;
  playerName?: string | null;
  jerseyNumber?: number | null;
  teamId: string | null;
  description: string | null;
  data: Record<string, unknown>;
  timestamp: Date | string;
  homeScoreSnapshot: number | null;
  awayScoreSnapshot: number | null;
}

export interface PenaltyShot {
  round: number;
  team: 'home' | 'away';
  result: 'GOAL' | 'MISS';
}

export interface MatchState {
  matchId: string;
  status: MatchStatus | string;
  currentPeriod: number;
  score: ScoreState;
  events: MatchEventRecord[];
  homeTeamId: string;
  awayTeamId: string;
  startedAt: Date | string | null;
  /** Real-time timer state (lives in Redis only; null when loaded from DB). */
  timerState: TimerState | null;
  /** Sport slug for the match (e.g. "football", "futsal"). */
  sportSlug: string;
  /** Whether the match is currently in penalty shootout mode. */
  isPenaltyShootout?: boolean;
  /** Individual penalty kicks recorded during shootout. */
  penaltyShots?: PenaltyShot[];
}

// ---------------------------------------------------------------------------
// Scoring Result – returned by processEvent
// ---------------------------------------------------------------------------

export interface ScoringResult {
  /** Whether the score changed as a result of this event. */
  scoreChanged: boolean;

  /** The updated score state. */
  newScore: ScoreState;

  /** The persisted match event record. */
  matchEvent: MatchEventRecord;
}

// ---------------------------------------------------------------------------
// Scoring Engine Interface
// ---------------------------------------------------------------------------

export interface IScoringEngine {
  /**
   * Process a new match event and return the updated score.
   */
  processEvent(
    matchState: MatchState,
    event: {
      type: MatchEventType | string;
      minute?: number;
      period?: number;
      playerId?: string;
      teamId?: string;
      description?: string;
      data?: Record<string, unknown>;
    },
    sportConfig: SportConfig,
  ): ScoringResult;

  /**
   * Recalculate the full score from a list of events (used after undo).
   */
  recalculateScore(
    events: MatchEventRecord[],
    sportConfig: SportConfig,
    homeTeamId: string,
    awayTeamId: string,
  ): ScoreState;
}

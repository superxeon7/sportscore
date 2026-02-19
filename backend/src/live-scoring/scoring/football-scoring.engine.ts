import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { MatchEventType } from '@prisma/client';
import {
  IScoringEngine,
  MatchEventRecord,
  MatchState,
  ScoreState,
  ScoringResult,
  SportConfig,
} from './scoring-engine.interface';
import { GenericScoringEngine } from './generic-scoring.engine';

/**
 * Football-specific scoring engine.
 *
 * Extends the generic engine with:
 *   - Extra-time handling (periods beyond the regular 2 halves)
 *   - Penalty shoot-out tracking
 *   - OWN_GOAL → points credited to the opposing team (already handled
 *     by the generic engine via `forOpponent`, but this engine ensures
 *     a sensible default config exists even if the sport JSON is sparse)
 */
@Injectable()
export class FootballScoringEngine
  extends GenericScoringEngine
  implements IScoringEngine
{
  // -------------------------------------------------------------------
  // Default football scoring config used as a fallback
  // -------------------------------------------------------------------

  private static readonly DEFAULT_CONFIG: Partial<SportConfig> = {
    scoringEvents: [
      { eventType: MatchEventType.GOAL, points: 1, forOpponent: false },
      { eventType: MatchEventType.OWN_GOAL, points: 1, forOpponent: true },
      { eventType: MatchEventType.PENALTY, points: 1, forOpponent: false },
    ],
    periods: [
      { label: '1st Half', duration: 45 },
      { label: '2nd Half', duration: 45 },
    ],
    hasExtraTime: true,
    hasPenaltyShootout: true,
  };

  // -------------------------------------------------------------------
  // Override processEvent to handle penalty shoot-out events
  // -------------------------------------------------------------------

  override processEvent(
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
  ): ScoringResult {
    const merged = this.mergeConfig(sportConfig);
    const eventData = event.data ?? {};

    // Handle penalty shoot-out goals separately – they do not affect the
    // main score, only the penaltyScores tally.
    if (this.isPenaltyShootoutEvent(event.type, eventData)) {
      return this.processPenaltyShootout(matchState, event, merged);
    }

    return super.processEvent(matchState, event, merged);
  }

  override recalculateScore(
    events: MatchEventRecord[],
    sportConfig: SportConfig,
    homeTeamId: string,
    awayTeamId: string,
  ): ScoreState {
    const merged = this.mergeConfig(sportConfig);

    // First run the generic recalculation for all non-shootout events.
    const nonShootout = events.filter(
      (e) => !this.isPenaltyShootoutEvent(e.type, e.data),
    );
    const score = super.recalculateScore(
      nonShootout,
      merged,
      homeTeamId,
      awayTeamId,
    );

    // Then replay penalty shoot-out events.
    const shootoutEvents = events.filter((e) =>
      this.isPenaltyShootoutEvent(e.type, e.data),
    );
    score.penaltyScores = { home: 0, away: 0 };

    for (const evt of shootoutEvents) {
      if (!evt.teamId) continue;
      const scored = (evt.data as Record<string, unknown>)?.scored !== false;
      if (!scored) continue;

      if (evt.teamId === homeTeamId) {
        score.penaltyScores.home += 1;
      } else if (evt.teamId === awayTeamId) {
        score.penaltyScores.away += 1;
      }
    }

    return score;
  }

  // -------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------

  /**
   * Check if the event is a penalty during a shoot-out.
   * A penalty shoot-out event has type PENALTY with data.shootout === true.
   */
  private isPenaltyShootoutEvent(
    type: MatchEventType | string,
    data: Record<string, unknown>,
  ): boolean {
    return type === MatchEventType.PENALTY && data?.shootout === true;
  }

  /**
   * Process a single penalty in a shoot-out.
   */
  private processPenaltyShootout(
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
  ): ScoringResult {
    const newScore = this.cloneScore(matchState.score);
    const eventData = event.data ?? {};
    const scored = eventData.scored !== false;

    const matchEvent: MatchEventRecord = {
      id: uuidv4(),
      type: event.type,
      minute: event.minute ?? null,
      period: event.period ?? matchState.currentPeriod,
      playerId: event.playerId ?? null,
      teamId: event.teamId ?? null,
      description:
        event.description ?? (scored ? 'Penalty scored' : 'Penalty missed'),
      data: eventData,
      timestamp: new Date(),
      homeScoreSnapshot: null,
      awayScoreSnapshot: null,
    };

    if (event.teamId && scored) {
      if (event.teamId === matchState.homeTeamId) {
        newScore.penaltyScores.home += 1;
      } else {
        newScore.penaltyScores.away += 1;
      }
    }

    matchEvent.homeScoreSnapshot = newScore.homeScore;
    matchEvent.awayScoreSnapshot = newScore.awayScore;

    return { scoreChanged: scored, newScore, matchEvent };
  }

  /**
   * Merge the persisted sport config with sensible football defaults
   * so the engine works even if the JSON is incomplete.
   */
  private mergeConfig(sportConfig: SportConfig): SportConfig {
    return {
      ...FootballScoringEngine.DEFAULT_CONFIG,
      ...sportConfig,
      scoringEvents:
        sportConfig.scoringEvents?.length > 0
          ? sportConfig.scoringEvents
          : FootballScoringEngine.DEFAULT_CONFIG.scoringEvents!,
      periods:
        sportConfig.periods?.length > 0
          ? sportConfig.periods
          : FootballScoringEngine.DEFAULT_CONFIG.periods!,
    };
  }
}

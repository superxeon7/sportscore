import { Injectable } from '@nestjs/common';
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
 * Basketball-specific scoring engine.
 *
 * Extends the generic engine with:
 *   - Point variants: 2PT (field goal), 3PT (three-pointer), FT (free throw)
 *   - Overtime detection: any period beyond period 4 is automatically
 *     treated as overtime.
 *   - Sensible defaults for NBA-style 4-quarter basketball.
 */
@Injectable()
export class BasketballScoringEngine
  extends GenericScoringEngine
  implements IScoringEngine
{
  // -------------------------------------------------------------------
  // Default basketball config
  // -------------------------------------------------------------------

  private static readonly DEFAULT_CONFIG: Partial<SportConfig> = {
    scoringEvents: [
      { eventType: MatchEventType.POINT, points: 2, variant: '2PT' },
      { eventType: MatchEventType.POINT, points: 3, variant: '3PT' },
      { eventType: MatchEventType.POINT, points: 1, variant: 'FT' },
      // Fallback – if no variant is specified, assume a 2-pointer.
      { eventType: MatchEventType.POINT, points: 2 },
    ],
    periods: [
      { label: 'Q1', duration: 12 },
      { label: 'Q2', duration: 12 },
      { label: 'Q3', duration: 12 },
      { label: 'Q4', duration: 12 },
    ],
    hasExtraTime: true,
  };

  // -------------------------------------------------------------------
  // Override processEvent to label overtime periods
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
    const result = super.processEvent(matchState, event, merged);

    // Ensure overtime periods have the right label.
    this.labelOvertimePeriods(result.newScore, merged);

    return result;
  }

  override recalculateScore(
    events: MatchEventRecord[],
    sportConfig: SportConfig,
    homeTeamId: string,
    awayTeamId: string,
  ): ScoreState {
    const merged = this.mergeConfig(sportConfig);
    const score = super.recalculateScore(
      events,
      merged,
      homeTeamId,
      awayTeamId,
    );

    this.labelOvertimePeriods(score, merged);

    return score;
  }

  // -------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------

  /**
   * Ensure extra-time periods are labelled OT1, OT2, etc.
   */
  private labelOvertimePeriods(
    score: ScoreState,
    config: SportConfig,
  ): void {
    const regularCount = config.periods?.length ?? 4;

    for (const extra of score.extraScores) {
      const otNumber = extra.period - regularCount;
      extra.label = `OT${otNumber}`;
    }
  }

  /**
   * Merge with sensible basketball defaults.
   */
  private mergeConfig(sportConfig: SportConfig): SportConfig {
    return {
      ...BasketballScoringEngine.DEFAULT_CONFIG,
      ...sportConfig,
      scoringEvents:
        sportConfig.scoringEvents?.length > 0
          ? sportConfig.scoringEvents
          : BasketballScoringEngine.DEFAULT_CONFIG.scoringEvents!,
      periods:
        sportConfig.periods?.length > 0
          ? sportConfig.periods
          : BasketballScoringEngine.DEFAULT_CONFIG.periods!,
    };
  }
}

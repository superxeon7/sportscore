import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { MatchEventType } from '@prisma/client';
import {
  IScoringEngine,
  MatchEventRecord,
  MatchState,
  PeriodScore,
  ScoreState,
  ScoringEventConfig,
  ScoringResult,
  SportConfig,
} from './scoring-engine.interface';

/**
 * Configuration-driven scoring engine.
 *
 * All scoring logic is derived from the sport's `scoringSystem` JSON
 * (persisted in Sport.scoringSystem) so that no sport-specific behaviour
 * is hard-coded.  The sport-specific engines extend this class only to
 * add specialised concepts (extra-time, set-based scoring, etc.).
 *
 * ---- How it works ----
 *
 * 1. When `processEvent` is called the engine looks up the event type
 *    (and optional variant) in `sportConfig.scoringEvents`.
 *
 * 2. If a matching config is found, `points` are added to the correct
 *    team for the current period.  The `forOpponent` flag flips the
 *    scoring team.
 *
 * 3. Period-by-period totals are kept, and the aggregate home/away score
 *    is the sum of all period scores.
 *
 * 4. `recalculateScore` replays every event to rebuild the score from
 *    scratch -- used after undo operations.
 */
@Injectable()
export class GenericScoringEngine implements IScoringEngine {
  // -------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------

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
  ): ScoringResult {
    const period = event.period ?? matchState.currentPeriod;
    const eventData = event.data ?? {};

    // Build the persisted event record (snapshot will be filled in below).
    const matchEvent: MatchEventRecord = {
      id: uuidv4(),
      type: event.type,
      minute: event.minute ?? null,
      period,
      playerId: event.playerId ?? null,
      teamId: event.teamId ?? null,
      description: event.description ?? null,
      data: eventData,
      timestamp: new Date(),
      homeScoreSnapshot: null,
      awayScoreSnapshot: null,
    };

    // Deep-clone the current score so mutations are safe.
    const newScore = this.cloneScore(matchState.score);

    // Look up the scoring config for this event.
    const scoringConfig = this.findScoringConfig(
      event.type,
      eventData,
      sportConfig,
    );

    let scoreChanged = false;

    if (scoringConfig && event.teamId) {
      scoreChanged = true;
      this.applyPoints(
        newScore,
        scoringConfig,
        event.teamId,
        matchState.homeTeamId,
        matchState.awayTeamId,
        period,
        sportConfig,
      );
    }

    // Fill snapshots.
    matchEvent.homeScoreSnapshot = newScore.homeScore;
    matchEvent.awayScoreSnapshot = newScore.awayScore;

    return { scoreChanged, newScore, matchEvent };
  }

  recalculateScore(
    events: MatchEventRecord[],
    sportConfig: SportConfig,
    homeTeamId: string,
    awayTeamId: string,
  ): ScoreState {
    const score = this.createEmptyScore(sportConfig);

    for (const evt of events) {
      const scoringConfig = this.findScoringConfig(
        evt.type,
        evt.data,
        sportConfig,
      );

      if (scoringConfig && evt.teamId) {
        const period = evt.period ?? 1;
        this.applyPoints(
          score,
          scoringConfig,
          evt.teamId,
          homeTeamId,
          awayTeamId,
          period,
          sportConfig,
        );
      }
    }

    return score;
  }

  // -------------------------------------------------------------------
  // Helpers – protected so sport-specific engines can override / reuse
  // -------------------------------------------------------------------

  /**
   * Find the ScoringEventConfig that matches the event type and optional
   * variant stored in event.data.variant.
   */
  protected findScoringConfig(
    eventType: MatchEventType | string,
    eventData: Record<string, unknown>,
    sportConfig: SportConfig,
  ): ScoringEventConfig | null {
    const configs = sportConfig.scoringEvents ?? [];
    const variant = (eventData?.variant as string) ?? undefined;

    // First try an exact match on type + variant.
    if (variant) {
      const exact = configs.find(
        (c) => c.eventType === eventType && c.variant === variant,
      );
      if (exact) return exact;
    }

    // Fall back to a match on type alone (no variant or variant-less config).
    const fallback = configs.find(
      (c) => c.eventType === eventType && !c.variant,
    );

    return fallback ?? null;
  }

  /**
   * Apply points from a ScoringEventConfig to the correct team and period.
   */
  protected applyPoints(
    score: ScoreState,
    config: ScoringEventConfig,
    eventTeamId: string,
    homeTeamId: string,
    awayTeamId: string,
    period: number,
    sportConfig: SportConfig,
  ): void {
    const isHome = eventTeamId === homeTeamId;
    const forOpponent = config.forOpponent === true;
    const points = config.points;

    // Determine which side to credit.
    const creditHome = forOpponent ? !isHome : isHome;

    // Determine if this period falls within regular time or extra time.
    const regularPeriodCount = sportConfig.periods?.length ?? 1;
    const isExtraTime = period > regularPeriodCount;

    if (isExtraTime) {
      // Extra-time periods.
      let extraPeriod = score.extraScores.find((p) => p.period === period);
      if (!extraPeriod) {
        extraPeriod = {
          period,
          label: `ET ${period - regularPeriodCount}`,
          homeScore: 0,
          awayScore: 0,
        };
        score.extraScores.push(extraPeriod);
      }
      if (creditHome) {
        extraPeriod.homeScore += points;
      } else {
        extraPeriod.awayScore += points;
      }
    } else {
      // Regular period – ensure the entry exists.
      let periodEntry = score.periodScores.find((p) => p.period === period);
      if (!periodEntry) {
        const periodConfig = sportConfig.periods?.[period - 1];
        periodEntry = {
          period,
          label: periodConfig?.label ?? `Period ${period}`,
          homeScore: 0,
          awayScore: 0,
        };
        score.periodScores.push(periodEntry);
        // Keep ordered.
        score.periodScores.sort((a, b) => a.period - b.period);
      }
      if (creditHome) {
        periodEntry.homeScore += points;
      } else {
        periodEntry.awayScore += points;
      }
    }

    // Recompute totals from all periods.
    this.recomputeTotals(score);
  }

  /**
   * Sum all period + extra scores into the top-level homeScore / awayScore.
   */
  protected recomputeTotals(score: ScoreState): void {
    let home = 0;
    let away = 0;

    for (const p of score.periodScores) {
      home += p.homeScore;
      away += p.awayScore;
    }
    for (const p of score.extraScores) {
      home += p.homeScore;
      away += p.awayScore;
    }

    score.homeScore = home;
    score.awayScore = away;
  }

  /**
   * Build an empty ScoreState pre-populated with period entries from config.
   */
  protected createEmptyScore(sportConfig: SportConfig): ScoreState {
    const periodScores: PeriodScore[] = (sportConfig.periods ?? []).map(
      (p, i) => ({
        period: i + 1,
        label: p.label,
        homeScore: 0,
        awayScore: 0,
      }),
    );

    return {
      homeScore: 0,
      awayScore: 0,
      periodScores,
      extraScores: [],
      penaltyScores: { home: 0, away: 0 },
    };
  }

  /**
   * Deep-clone a ScoreState to avoid mutating the original.
   */
  protected cloneScore(score: ScoreState): ScoreState {
    return {
      homeScore: score.homeScore,
      awayScore: score.awayScore,
      periodScores: score.periodScores.map((p) => ({ ...p })),
      extraScores: score.extraScores.map((p) => ({ ...p })),
      penaltyScores: { ...score.penaltyScores },
    };
  }
}

import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { MatchEventType } from '@prisma/client';
import {
  IScoringEngine,
  MatchEventRecord,
  MatchState,
  PeriodScore,
  ScoreState,
  ScoringResult,
  SportConfig,
} from './scoring-engine.interface';
import { GenericScoringEngine } from './generic-scoring.engine';

/**
 * Volleyball-specific scoring engine.
 *
 * Key differences from the generic engine:
 *
 * 1. **Set-based scoring** – A match is won by winning a configured number
 *    of sets (default: 3 out of 5).  Each regular set is won at 25 points;
 *    the deciding (5th) set is won at 15 points.  A 2-point advantage is
 *    required in all cases.
 *
 * 2. **Top-level score = sets won**, not total points.
 *    `homeScore` / `awayScore` track sets won.
 *    Period scores track points per set.
 *
 * 3. **Auto-set-end detection** – after each POINT the engine checks if
 *    the current set has been won and, if so, automatically advances to
 *    the next set.
 */
@Injectable()
export class VolleyballScoringEngine
  extends GenericScoringEngine
  implements IScoringEngine
{
  // -------------------------------------------------------------------
  // Default volleyball config
  // -------------------------------------------------------------------

  private static readonly DEFAULT_CONFIG: Partial<SportConfig> = {
    scoringEvents: [
      { eventType: MatchEventType.POINT, points: 1, forOpponent: false },
    ],
    periods: [
      { label: 'Set 1', duration: 0 },
      { label: 'Set 2', duration: 0 },
      { label: 'Set 3', duration: 0 },
      { label: 'Set 4', duration: 0 },
      { label: 'Set 5', duration: 0 },
    ],
    setBased: {
      pointsToWin: 25,
      finalSetPointsToWin: 15,
      minAdvantage: 2,
      setsToWin: 3,
    },
  };

  // -------------------------------------------------------------------
  // Override processEvent for set-based logic
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
    const setBased = merged.setBased;

    // If there is no set-based config, fall back to the generic engine.
    if (!setBased) {
      return super.processEvent(matchState, event, merged);
    }

    const period = event.period ?? matchState.currentPeriod;
    const eventData = event.data ?? {};

    // Build the event record.
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

    const newScore = this.cloneScore(matchState.score);

    // Look up whether this event type changes the score.
    const scoringConfig = this.findScoringConfig(
      event.type,
      eventData,
      merged,
    );

    let scoreChanged = false;

    if (scoringConfig && event.teamId) {
      scoreChanged = true;

      // Apply points to the current set.
      this.applySetPoints(
        newScore,
        scoringConfig.points,
        scoringConfig.forOpponent === true,
        event.teamId,
        matchState.homeTeamId,
        matchState.awayTeamId,
        period,
        merged,
      );

      // Check if the current set has been won.
      this.checkSetWon(newScore, period, merged);
    }

    matchEvent.homeScoreSnapshot = newScore.homeScore;
    matchEvent.awayScoreSnapshot = newScore.awayScore;

    return { scoreChanged, newScore, matchEvent };
  }

  override recalculateScore(
    events: MatchEventRecord[],
    sportConfig: SportConfig,
    homeTeamId: string,
    awayTeamId: string,
  ): ScoreState {
    const merged = this.mergeConfig(sportConfig);
    const setBased = merged.setBased;

    if (!setBased) {
      return super.recalculateScore(events, merged, homeTeamId, awayTeamId);
    }

    const score = this.createEmptyVolleyballScore(merged);

    for (const evt of events) {
      const scoringConfig = this.findScoringConfig(evt.type, evt.data, merged);
      if (!scoringConfig || !evt.teamId) continue;

      const period = evt.period ?? 1;

      this.applySetPoints(
        score,
        scoringConfig.points,
        scoringConfig.forOpponent === true,
        evt.teamId,
        homeTeamId,
        awayTeamId,
        period,
        merged,
      );

      this.checkSetWon(score, period, merged);
    }

    return score;
  }

  // -------------------------------------------------------------------
  // Volleyball-specific helpers
  // -------------------------------------------------------------------

  /**
   * Apply points within a set.
   */
  private applySetPoints(
    score: ScoreState,
    points: number,
    forOpponent: boolean,
    eventTeamId: string,
    homeTeamId: string,
    awayTeamId: string,
    period: number,
    config: SportConfig,
  ): void {
    const isHome = eventTeamId === homeTeamId;
    const creditHome = forOpponent ? !isHome : isHome;

    // Ensure the set entry exists.
    let setEntry = score.periodScores.find((p) => p.period === period);
    if (!setEntry) {
      const periodConfig = config.periods?.[period - 1];
      setEntry = {
        period,
        label: periodConfig?.label ?? `Set ${period}`,
        homeScore: 0,
        awayScore: 0,
      };
      score.periodScores.push(setEntry);
      score.periodScores.sort((a, b) => a.period - b.period);
    }

    if (creditHome) {
      setEntry.homeScore += points;
    } else {
      setEntry.awayScore += points;
    }
  }

  /**
   * After points are added, check whether the set has been won.
   * If so, update the top-level homeScore / awayScore (sets won).
   */
  private checkSetWon(
    score: ScoreState,
    period: number,
    config: SportConfig,
  ): void {
    const setBased = config.setBased!;
    const totalSets = config.periods?.length ?? 5;
    const isFinalSet = period >= totalSets;
    const targetPoints = isFinalSet
      ? setBased.finalSetPointsToWin
      : setBased.pointsToWin;
    const minAdvantage = setBased.minAdvantage;

    const setEntry = score.periodScores.find((p) => p.period === period);
    if (!setEntry) return;

    const { homeScore: hPts, awayScore: aPts } = setEntry;

    const homeWins =
      hPts >= targetPoints &&
      hPts - aPts >= minAdvantage;

    const awayWins =
      aPts >= targetPoints &&
      aPts - hPts >= minAdvantage;

    // Recount sets won from all period scores to stay idempotent.
    let homeSets = 0;
    let awaySets = 0;

    for (const ps of score.periodScores) {
      const isFinal = ps.period >= totalSets;
      const target = isFinal
        ? setBased.finalSetPointsToWin
        : setBased.pointsToWin;

      if (
        ps.homeScore >= target &&
        ps.homeScore - ps.awayScore >= minAdvantage
      ) {
        homeSets++;
      } else if (
        ps.awayScore >= target &&
        ps.awayScore - ps.homeScore >= minAdvantage
      ) {
        awaySets++;
      }
    }

    score.homeScore = homeSets;
    score.awayScore = awaySets;
  }

  /**
   * Build an empty volleyball score with set entries for each configured period.
   */
  private createEmptyVolleyballScore(config: SportConfig): ScoreState {
    const periodScores: PeriodScore[] = (config.periods ?? []).map((p, i) => ({
      period: i + 1,
      label: p.label,
      homeScore: 0,
      awayScore: 0,
    }));

    return {
      homeScore: 0,
      awayScore: 0,
      periodScores,
      extraScores: [],
      penaltyScores: { home: 0, away: 0 },
    };
  }

  /**
   * Merge with volleyball defaults.
   */
  private mergeConfig(sportConfig: SportConfig): SportConfig {
    return {
      ...VolleyballScoringEngine.DEFAULT_CONFIG,
      ...sportConfig,
      scoringEvents:
        sportConfig.scoringEvents?.length > 0
          ? sportConfig.scoringEvents
          : VolleyballScoringEngine.DEFAULT_CONFIG.scoringEvents!,
      periods:
        sportConfig.periods?.length > 0
          ? sportConfig.periods
          : VolleyballScoringEngine.DEFAULT_CONFIG.periods!,
      setBased: sportConfig.setBased ?? VolleyballScoringEngine.DEFAULT_CONFIG.setBased,
    };
  }
}

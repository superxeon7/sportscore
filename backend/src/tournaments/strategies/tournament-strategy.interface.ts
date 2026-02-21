export interface FixtureMatch {
  homeTeamId: string;
  awayTeamId: string;
  round: number;
  matchDay: number;
  scheduledAt?: Date;
  // Double Elimination fields
  bracket?: string;
  matchIndex?: number;
  isGrandFinal?: boolean;
  isResetFinal?: boolean;
  stageType?: string;
  /** Internal temp ID used during generation to wire linkages */
  _tempId?: string;
  _winnerTo?: string;
  _loserTo?: string;
  _sourceA?: string;
  _sourceB?: string;
}

export interface TournamentStrategy {
  /**
   * Generate match fixtures for a tournament given a list of team IDs.
   * Returns an array of fixture data to be used for creating matches.
   */
  generateFixtures(
    teamIds: string[],
    config?: Record<string, unknown>,
  ): FixtureMatch[];

  /**
   * Validate the tournament configuration for this strategy type.
   * Throws an error if the configuration is invalid.
   */
  validateConfig(config: Record<string, unknown>): void;
}

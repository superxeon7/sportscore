export interface FixtureMatch {
  homeTeamId: string;
  awayTeamId: string;
  round: number;
  matchDay: number;
  scheduledAt?: Date;
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

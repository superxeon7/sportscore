import { BadRequestException, Injectable } from '@nestjs/common';
import {
  FixtureMatch,
  TournamentStrategy,
} from './tournament-strategy.interface';

/**
 * Knockout (single-elimination) fixture generation strategy.
 *
 * Seeds teams and pairs them for the first round.
 * Team 1 vs last seed, Team 2 vs second-to-last, etc.
 * If the number of teams is not a power of 2, byes are awarded
 * to the top-seeded teams.
 */
@Injectable()
export class KnockoutStrategy implements TournamentStrategy {
  generateFixtures(
    teamIds: string[],
    _config?: Record<string, unknown>,
  ): FixtureMatch[] {
    if (teamIds.length < 2) {
      throw new BadRequestException(
        'At least 2 teams are required to generate knockout fixtures',
      );
    }

    const fixtures: FixtureMatch[] = [];

    // Find the next power of 2 >= team count for a proper bracket
    const bracketSize = this.nextPowerOf2(teamIds.length);
    const byeCount = bracketSize - teamIds.length;

    // Seeds are the team IDs in order (index 0 = seed 1, etc.)
    const seeds = [...teamIds];

    // Build seeded bracket:
    // Pair seed 1 vs seed N, seed 2 vs seed N-1, etc.
    // Teams that receive a bye (top seeds) will not have a first-round match;
    // they advance directly. We only generate matches for teams that play.
    const firstRoundMatchCount = bracketSize / 2;
    let matchDay = 1;

    for (let i = 0; i < firstRoundMatchCount; i++) {
      const homeIndex = i;
      const awayIndex = bracketSize - 1 - i;

      // If away index points beyond actual teams, it's a bye for the home team
      if (awayIndex >= teamIds.length) {
        continue;
      }

      // If home index >= away index, we've paired all teams
      if (homeIndex >= awayIndex) {
        break;
      }

      fixtures.push({
        homeTeamId: seeds[homeIndex],
        awayTeamId: seeds[awayIndex],
        round: 1,
        matchDay,
      });
    }

    // Note: Only first-round fixtures are auto-generated.
    // Subsequent rounds should be generated as results come in,
    // since we don't know the winners yet.

    return fixtures;
  }

  validateConfig(config: Record<string, unknown>): void {
    // Knockout tournaments have minimal configuration requirements.
    // Validate any known optional fields if present.
    if (config.thirdPlaceMatch !== undefined && typeof config.thirdPlaceMatch !== 'boolean') {
      throw new BadRequestException(
        'Knockout config: "thirdPlaceMatch" must be a boolean',
      );
    }
  }

  private nextPowerOf2(n: number): number {
    let power = 1;
    while (power < n) {
      power *= 2;
    }
    return power;
  }
}

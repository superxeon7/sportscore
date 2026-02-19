import { BadRequestException, Injectable } from '@nestjs/common';
import {
  FixtureMatch,
  TournamentStrategy,
} from './tournament-strategy.interface';

/**
 * League (round-robin) fixture generation strategy.
 *
 * Each team plays every other team. If the number of teams is odd,
 * a "bye" round is introduced by adding a dummy placeholder.
 * Uses the standard round-robin scheduling algorithm (circle method).
 */
@Injectable()
export class LeagueStrategy implements TournamentStrategy {
  generateFixtures(
    teamIds: string[],
    config?: Record<string, unknown>,
  ): FixtureMatch[] {
    if (teamIds.length < 2) {
      throw new BadRequestException(
        'At least 2 teams are required to generate league fixtures',
      );
    }

    const doubleRound = config?.doubleRound === true;
    const fixtures: FixtureMatch[] = [];

    // If odd number of teams, add a placeholder "BYE" team
    const teams = [...teamIds];
    const hasBye = teams.length % 2 !== 0;
    if (hasBye) {
      teams.push('BYE');
    }

    const teamCount = teams.length;
    const totalRounds = teamCount - 1;
    const matchesPerRound = teamCount / 2;

    // Circle method for round-robin scheduling:
    // Fix the last team, rotate the rest.
    const fixed = teams[teamCount - 1];
    const rotating = teams.slice(0, teamCount - 1);

    let matchDay = 1;

    for (let round = 0; round < totalRounds; round++) {
      const roundNumber = round + 1;

      // Build the current round's pairing
      const current = [...rotating];
      // First pairing: fixed vs rotating[0]
      const pairings: [string, string][] = [];

      // Alternate home/away for the fixed team each round
      if (round % 2 === 0) {
        pairings.push([fixed, current[0]]);
      } else {
        pairings.push([current[0], fixed]);
      }

      // Remaining pairings: pair from outer edges inward
      for (let i = 1; i < matchesPerRound; i++) {
        const home = current[i];
        const away = current[current.length - i];
        pairings.push([home, away]);
      }

      for (const [home, away] of pairings) {
        // Skip matches involving the BYE placeholder
        if (home === 'BYE' || away === 'BYE') {
          continue;
        }

        fixtures.push({
          homeTeamId: home,
          awayTeamId: away,
          round: roundNumber,
          matchDay,
        });
      }

      matchDay++;

      // Rotate: move the last element of the rotating array to the front
      const last = rotating.pop()!;
      rotating.unshift(last);
    }

    // If double round-robin, add reverse fixtures
    if (doubleRound) {
      const firstLegCount = fixtures.length;
      for (let i = 0; i < firstLegCount; i++) {
        const original = fixtures[i];
        fixtures.push({
          homeTeamId: original.awayTeamId,
          awayTeamId: original.homeTeamId,
          round: original.round + totalRounds,
          matchDay: original.matchDay + totalRounds,
        });
      }
    }

    return fixtures;
  }

  validateConfig(config: Record<string, unknown>): void {
    if (config.doubleRound !== undefined && typeof config.doubleRound !== 'boolean') {
      throw new BadRequestException(
        'League config: "doubleRound" must be a boolean',
      );
    }
  }
}

import { BadRequestException, Injectable } from '@nestjs/common';
import {
    FixtureMatch,
    TournamentStrategy,
} from './tournament-strategy.interface';

/**
 * Special Group fixture generation strategy.
 *
 * Unlike League (full round-robin), each team plays a limited number
 * of matches defined by `matchPerTeam`. Uses the circle-method
 * round-robin but caps appearances so no team exceeds the limit.
 *
 * Example: 6 teams, matchPerTeam=2 → 6 total matches (not 15).
 */
@Injectable()
export class SpecialGroupStrategy implements TournamentStrategy {
    generateFixtures(
        teamIds: string[],
        config?: Record<string, unknown>,
    ): FixtureMatch[] {
        const n = teamIds.length;
        if (n < 2) {
            throw new BadRequestException(
                'At least 2 teams are required to generate special group fixtures',
            );
        }

        const matchPerTeam = (config?.matchPerTeam as number) ?? n - 1;

        // Clamp: each team can play at most n-1 matches (full round-robin)
        const maxMatches = Math.min(matchPerTeam, n - 1);

        if (maxMatches < 1) {
            throw new BadRequestException(
                'matchPerTeam must be at least 1',
            );
        }

        // If matchPerTeam >= n-1, fall back to full round-robin
        if (maxMatches >= n - 1) {
            return this.generateFullRoundRobin(teamIds);
        }

        // Track how many matches each team has been assigned
        const matchCount = new Map<string, number>();
        for (const id of teamIds) {
            matchCount.set(id, 0);
        }

        const fixtures: FixtureMatch[] = [];
        const usedPairs = new Set<string>();

        // Generate round-robin pairings using the circle method, then
        // greedily pick matches where both teams are under the limit.
        const teams = [...teamIds];
        const hasBye = teams.length % 2 !== 0;
        if (hasBye) {
            teams.push('BYE');
        }

        const teamCount = teams.length;
        const totalRounds = teamCount - 1;
        const matchesPerRound = teamCount / 2;

        const fixed = teams[teamCount - 1];
        const rotating = teams.slice(0, teamCount - 1);

        let matchDay = 1;

        for (let round = 0; round < totalRounds; round++) {
            const current = [...rotating];
            const pairings: [string, string][] = [];

            if (round % 2 === 0) {
                pairings.push([fixed, current[0]]);
            } else {
                pairings.push([current[0], fixed]);
            }

            for (let i = 1; i < matchesPerRound; i++) {
                const home = current[i];
                const away = current[current.length - i];
                pairings.push([home, away]);
            }

            for (const [home, away] of pairings) {
                if (home === 'BYE' || away === 'BYE') continue;

                const homeCount = matchCount.get(home)!;
                const awayCount = matchCount.get(away)!;

                if (homeCount >= maxMatches || awayCount >= maxMatches) continue;

                const pairKey = [home, away].sort().join(':');
                if (usedPairs.has(pairKey)) continue;

                usedPairs.add(pairKey);
                matchCount.set(home, homeCount + 1);
                matchCount.set(away, awayCount + 1);

                fixtures.push({
                    homeTeamId: home,
                    awayTeamId: away,
                    round: round + 1,
                    matchDay,
                });
            }

            matchDay++;

            const last = rotating.pop()!;
            rotating.unshift(last);
        }

        return fixtures;
    }

    /**
     * Standard full round-robin (same as LeagueStrategy single round).
     */
    private generateFullRoundRobin(teamIds: string[]): FixtureMatch[] {
        const teams = [...teamIds];
        const hasBye = teams.length % 2 !== 0;
        if (hasBye) {
            teams.push('BYE');
        }

        const teamCount = teams.length;
        const totalRounds = teamCount - 1;
        const matchesPerRound = teamCount / 2;
        const fixtures: FixtureMatch[] = [];

        const fixed = teams[teamCount - 1];
        const rotating = teams.slice(0, teamCount - 1);

        let matchDay = 1;

        for (let round = 0; round < totalRounds; round++) {
            const current = [...rotating];
            const pairings: [string, string][] = [];

            if (round % 2 === 0) {
                pairings.push([fixed, current[0]]);
            } else {
                pairings.push([current[0], fixed]);
            }

            for (let i = 1; i < matchesPerRound; i++) {
                const home = current[i];
                const away = current[current.length - i];
                pairings.push([home, away]);
            }

            for (const [home, away] of pairings) {
                if (home === 'BYE' || away === 'BYE') continue;
                fixtures.push({
                    homeTeamId: home,
                    awayTeamId: away,
                    round: round + 1,
                    matchDay,
                });
            }

            matchDay++;
            const last = rotating.pop()!;
            rotating.unshift(last);
        }

        return fixtures;
    }

    validateConfig(config: Record<string, unknown>): void {
        if (config.matchPerTeam !== undefined) {
            const v = config.matchPerTeam;
            if (typeof v !== 'number' || !Number.isInteger(v) || v < 1) {
                throw new BadRequestException(
                    'Special Group config: "matchPerTeam" must be a positive integer',
                );
            }
        }
    }
}

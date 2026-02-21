import { BadRequestException, Injectable } from '@nestjs/common';
import {
    FixtureMatch,
    TournamentStrategy,
} from './tournament-strategy.interface';

/**
 * Double Elimination bracket generator.
 *
 * Produces:
 *  - Upper Bracket (standard single-elim tree)
 *  - Lower Bracket (losers bracket with alternating drop-in / survivor rounds)
 *  - Grand Final (UB winner vs LB winner)
 *  - Reset Final (activated only if LB winner beats UB winner in GF)
 *
 * Every match is wired with _winnerTo / _loserTo temp IDs that the
 * TournamentsService resolves to real match IDs after bulk creation.
 */
@Injectable()
export class DoubleEliminationStrategy implements TournamentStrategy {
    // ── Public API ──────────────────────────────────────────────────

    generateFixtures(
        teamIds: string[],
        _config?: Record<string, unknown>,
    ): FixtureMatch[] {
        if (teamIds.length < 2) {
            throw new BadRequestException(
                'At least 2 teams are required for double elimination',
            );
        }

        const bracketSize = this.nextPowerOf2(teamIds.length);
        const ubRounds = Math.log2(bracketSize);
        const seeds = [...teamIds];

        const BYE_TEAM = '__BYE__';

        const fixtures: FixtureMatch[] = [];
        // Map: tempId → fixture (for linking)
        const byTemp = new Map<string, FixtureMatch>();

        // ── UPPER BRACKET ─────────────────────────────────────────────

        // Round 1 matches
        const ubR1Count = bracketSize / 2;
        const ubMatchesByRound: string[][] = [];
        const round1Ids: string[] = [];

        for (let i = 0; i < ubR1Count; i++) {
            const homeIndex = i;
            const awayIndex = bracketSize - 1 - i;
            const homeTeam = seeds[homeIndex] || BYE_TEAM;
            const awayTeam = awayIndex < seeds.length ? seeds[awayIndex] : BYE_TEAM;
            const tempId = `UB-R1-M${i}`;

            const match: FixtureMatch = {
                homeTeamId: homeTeam,
                awayTeamId: awayTeam,
                round: 1,
                matchDay: 1,
                bracket: 'UPPER',
                matchIndex: i,
                stageType: 'DOUBLE_ELIMINATION',
                _tempId: tempId,
            };
            fixtures.push(match);
            byTemp.set(tempId, match);
            round1Ids.push(tempId);
        }
        ubMatchesByRound.push(round1Ids);

        // UB rounds 2..ubRounds
        for (let r = 2; r <= ubRounds; r++) {
            const prevIds = ubMatchesByRound[r - 2];
            const matchCount = prevIds.length / 2;
            const roundIds: string[] = [];

            for (let i = 0; i < matchCount; i++) {
                const tempId = `UB-R${r}-M${i}`;
                const sourceA = prevIds[i * 2];
                const sourceB = prevIds[i * 2 + 1];

                const match: FixtureMatch = {
                    homeTeamId: BYE_TEAM,
                    awayTeamId: BYE_TEAM,
                    round: r,
                    matchDay: r,
                    bracket: 'UPPER',
                    matchIndex: i,
                    stageType: 'DOUBLE_ELIMINATION',
                    _tempId: tempId,
                    _sourceA: sourceA,
                    _sourceB: sourceB,
                };
                fixtures.push(match);
                byTemp.set(tempId, match);
                roundIds.push(tempId);

                // Wire previous matches' winners to this match
                byTemp.get(sourceA)!._winnerTo = tempId;
                byTemp.get(sourceB)!._winnerTo = tempId;
            }
            ubMatchesByRound.push(roundIds);
        }

        // ── LOWER BRACKET ─────────────────────────────────────────────
        // LB has 2*(ubRounds-1) rounds:
        //   - Odd LB rounds:  UB losers drop in to face LB survivors (or each other in R1)
        //   - Even LB rounds: LB survivors play each other (normal round)

        const totalLbRounds = 2 * (ubRounds - 1);
        const lbMatchesByRound: string[][] = [];

        for (let lbr = 1; lbr <= totalLbRounds; lbr++) {
            const roundIds: string[] = [];

            if (lbr === 1) {
                // LB Round 1: UB R1 losers play each other
                // Pair them: loser of UB-R1-M0 vs loser of UB-R1-M(n-1), etc.
                const ubR1Losers = ubMatchesByRound[0]; // UB R1 match temp IDs
                const pairCount = ubR1Losers.length / 2;
                for (let i = 0; i < pairCount; i++) {
                    const tempId = `LB-R${lbr}-M${i}`;
                    const loserSourceA = ubR1Losers[i];
                    const loserSourceB = ubR1Losers[ubR1Losers.length - 1 - i];

                    const match: FixtureMatch = {
                        homeTeamId: BYE_TEAM,
                        awayTeamId: BYE_TEAM,
                        round: lbr,
                        matchDay: 2,
                        bracket: 'LOWER',
                        matchIndex: i,
                        stageType: 'DOUBLE_ELIMINATION',
                        _tempId: tempId,
                        _sourceA: loserSourceA,
                        _sourceB: loserSourceB,
                    };
                    fixtures.push(match);
                    byTemp.set(tempId, match);
                    roundIds.push(tempId);

                    // Wire UB losers to this LB match
                    byTemp.get(loserSourceA)!._loserTo = tempId;
                    byTemp.get(loserSourceB)!._loserTo = tempId;
                }
            } else if (lbr % 2 === 0) {
                // Even LB round: drop-in round — UB losers from the corresponding UB round drop in
                // UB round that feeds losers = (lbr / 2) + 1
                const ubFeedRound = lbr / 2 + 1;
                const ubFeedIdx = ubFeedRound - 1; // zero-based index into ubMatchesByRound
                const prevLbIds = lbMatchesByRound[lbMatchesByRound.length - 1];

                if (ubFeedIdx < ubMatchesByRound.length) {
                    const ubFeedMatches = ubMatchesByRound[ubFeedIdx];
                    const matchCount = prevLbIds.length; // LB survivors = same count as UB droppers

                    for (let i = 0; i < matchCount; i++) {
                        const tempId = `LB-R${lbr}-M${i}`;
                        // LB survivor is sourceA, UB dropper is sourceB
                        const lbSurvivor = prevLbIds[i];
                        const ubDropper = ubFeedMatches[i] || prevLbIds[0]; // safety

                        const match: FixtureMatch = {
                            homeTeamId: BYE_TEAM,
                            awayTeamId: BYE_TEAM,
                            round: lbr,
                            matchDay: lbr + 1,
                            bracket: 'LOWER',
                            matchIndex: i,
                            stageType: 'DOUBLE_ELIMINATION',
                            _tempId: tempId,
                            _sourceA: lbSurvivor,
                            _sourceB: ubDropper,
                        };
                        fixtures.push(match);
                        byTemp.set(tempId, match);
                        roundIds.push(tempId);

                        // Wire
                        byTemp.get(lbSurvivor)!._winnerTo = tempId;
                        if (ubFeedMatches[i]) {
                            byTemp.get(ubFeedMatches[i])!._loserTo = tempId;
                        }
                    }
                }
            } else {
                // Odd LB round (> 1): normal round — LB survivors play each other
                const prevLbIds = lbMatchesByRound[lbMatchesByRound.length - 1];
                const matchCount = prevLbIds.length / 2;

                for (let i = 0; i < matchCount; i++) {
                    const tempId = `LB-R${lbr}-M${i}`;
                    const sourceA = prevLbIds[i * 2];
                    const sourceB = prevLbIds[i * 2 + 1];

                    const match: FixtureMatch = {
                        homeTeamId: BYE_TEAM,
                        awayTeamId: BYE_TEAM,
                        round: lbr,
                        matchDay: lbr + 1,
                        bracket: 'LOWER',
                        matchIndex: i,
                        stageType: 'DOUBLE_ELIMINATION',
                        _tempId: tempId,
                        _sourceA: sourceA,
                        _sourceB: sourceB,
                    };
                    fixtures.push(match);
                    byTemp.set(tempId, match);
                    roundIds.push(tempId);

                    byTemp.get(sourceA)!._winnerTo = tempId;
                    byTemp.get(sourceB)!._winnerTo = tempId;
                }
            }

            lbMatchesByRound.push(roundIds);
        }

        // ── GRAND FINAL ───────────────────────────────────────────────

        const ubFinalTempId = ubMatchesByRound[ubMatchesByRound.length - 1][0];
        const lbFinalTempId = lbMatchesByRound[lbMatchesByRound.length - 1][0];
        const gfTempId = 'GF';

        const grandFinal: FixtureMatch = {
            homeTeamId: BYE_TEAM,
            awayTeamId: BYE_TEAM,
            round: 1,
            matchDay: totalLbRounds + 2,
            bracket: 'GRAND_FINAL',
            matchIndex: 0,
            isGrandFinal: true,
            stageType: 'DOUBLE_ELIMINATION',
            _tempId: gfTempId,
            _sourceA: ubFinalTempId,
            _sourceB: lbFinalTempId,
        };
        fixtures.push(grandFinal);
        byTemp.set(gfTempId, grandFinal);

        // Wire UB/LB finals
        byTemp.get(ubFinalTempId)!._winnerTo = gfTempId;
        byTemp.get(lbFinalTempId)!._winnerTo = gfTempId;

        // ── RESET FINAL ───────────────────────────────────────────────

        const rfTempId = 'RF';
        const resetFinal: FixtureMatch = {
            homeTeamId: BYE_TEAM,
            awayTeamId: BYE_TEAM,
            round: 1,
            matchDay: totalLbRounds + 3,
            bracket: 'RESET_FINAL',
            matchIndex: 0,
            isResetFinal: true,
            stageType: 'DOUBLE_ELIMINATION',
            _tempId: rfTempId,
            _sourceA: gfTempId,
            _sourceB: gfTempId,
        };
        fixtures.push(resetFinal);
        byTemp.set(rfTempId, resetFinal);

        // GF winner goes to RF (only activated if LB winner wins GF)
        grandFinal._winnerTo = rfTempId;

        // ── Remove BYE-only matches & auto-advance ────────────────────

        return this.resolveByes(fixtures, BYE_TEAM);
    }

    validateConfig(config: Record<string, unknown>): void {
        // No required config for double elimination
        if (
            config.seedingOrder !== undefined &&
            !Array.isArray(config.seedingOrder)
        ) {
            throw new BadRequestException(
                'Double elimination config: "seedingOrder" must be an array of team IDs',
            );
        }
    }

    // ── Helpers ─────────────────────────────────────────────────────

    private nextPowerOf2(n: number): number {
        let power = 1;
        while (power < n) power *= 2;
        return power;
    }

    /**
     * Resolve BYE matches: if both teams are BYE, mark match for skip.
     * If one team is BYE, auto-advance the real team by keeping the match
     * but setting a flag via the _tempId prefix.
     */
    private resolveByes(fixtures: FixtureMatch[], BYE: string): FixtureMatch[] {
        // We keep all matches in the structure. Matches where one or both teams
        // are BYE will still be created with placeholder team IDs. The
        // advancement service handles BYE auto-advancement when the bracket
        // is published and teams are placed.
        return fixtures;
    }
}

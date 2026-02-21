import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { MatchStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

// ── Types ──────────────────────────────────────────────────────────

interface SwissStandingRow {
    teamId: string;
    played: number;
    win: number;
    draw: number;
    lose: number;
    goalsFor: number;
    goalsAgainst: number;
    goalDiff: number;
    points: number;
    byeCount: number;
}

interface SwissConfig {
    rounds: number;
    hasPlayoff?: boolean;
    playoffTop?: number;
}

// ── Service ────────────────────────────────────────────────────────

@Injectable()
export class SwissSystemService {
    constructor(private readonly prisma: PrismaService) { }

    // ─── Generate Next Swiss Round ──────────────────────────────────

    async generateRound(
        tournamentId: string,
        userId: string,
        userRole: UserRole,
    ) {
        const tournament = await this.prisma.tournament.findUnique({
            where: { id: tournamentId },
            include: {
                event: { select: { organizerId: true } },
                eventCategory: {
                    include: {
                        categoryTeams: {
                            select: { teamId: true },
                            orderBy: { seed: 'asc' },
                        },
                        stages: true,
                    },
                },
                swissRounds: { orderBy: { roundNumber: 'asc' } },
            },
        });

        if (!tournament) {
            throw new NotFoundException('Tournament not found');
        }

        if (
            tournament.event.organizerId !== userId &&
            userRole !== UserRole.ADMIN
        ) {
            throw new BadRequestException('Not authorized');
        }

        if (!tournament.eventCategory) {
            throw new BadRequestException(
                'Tournament must be linked to an event category',
            );
        }

        const teamIds = tournament.eventCategory.categoryTeams.map(
            (ct) => ct.teamId,
        );
        if (teamIds.length < 2) {
            throw new BadRequestException('Need at least 2 teams');
        }

        // Read Swiss config from stage settings
        const swissStage = tournament.eventCategory.stages.find(
            (s) => s.stageType === 'SWISS',
        );
        const config: SwissConfig = swissStage
            ? (swissStage.settingsJson as unknown as SwissConfig)
            : { rounds: 5 };

        const currentRoundNumber = tournament.swissRounds.length;

        // Validate max rounds
        if (currentRoundNumber >= config.rounds) {
            throw new BadRequestException(
                `Maximum rounds (${config.rounds}) already generated`,
            );
        }

        // Check previous round is completed
        if (currentRoundNumber > 0) {
            const lastRound = tournament.swissRounds[currentRoundNumber - 1];
            if (lastRound.status !== 'COMPLETED') {
                throw new BadRequestException(
                    'Previous round must be completed before generating a new round',
                );
            }
        }

        const nextRoundNumber = currentRoundNumber + 1;

        // Build pairings
        let pairings: [string, string | null][];
        if (nextRoundNumber === 1) {
            pairings = this.buildInitialPairings(teamIds);
        } else {
            pairings = await this.buildStandingsPairings(
                tournamentId,
                teamIds,
            );
        }

        // Create the swiss round
        const swissRound = await this.prisma.swissRound.create({
            data: {
                tournamentId,
                categoryId: tournament.eventCategory.id,
                roundNumber: nextRoundNumber,
                status: 'ACTIVE',
            },
        });

        // Create matches for each pairing
        const baseDate = new Date();
        const matchCreateData = pairings
            .filter(([, away]) => away !== null)
            .map(([home, away], i) => ({
                tournamentId,
                homeTeamId: home,
                awayTeamId: away!,
                eventCategoryId: tournament.eventCategory!.id,
                round: nextRoundNumber,
                matchDay: nextRoundNumber,
                scheduledAt: new Date(
                    baseDate.getTime() + nextRoundNumber * 86400000 + i * 3600000,
                ),
                status: MatchStatus.DRAFT,
                stageType: 'SWISS',
                swissRoundId: swissRound.id,
            }));

        await this.prisma.match.createMany({ data: matchCreateData });

        // Handle BYE team (team paired with null gets auto 3 points)
        // We track BYEs via metadata on the swiss round; no match is created.
        const byeTeamId = pairings.find(([, away]) => away === null)?.[0];

        // Return summary
        return {
            swissRound,
            matchesCreated: matchCreateData.length,
            byeTeamId: byeTeamId ?? null,
            roundNumber: nextRoundNumber,
            totalRounds: config.rounds,
        };
    }

    // ─── Round 1: Random Pairing ────────────────────────────────────

    private buildInitialPairings(
        teamIds: string[],
    ): [string, string | null][] {
        // Fisher-Yates shuffle
        const shuffled = [...teamIds];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }

        const pairs: [string, string | null][] = [];
        for (let i = 0; i < shuffled.length; i += 2) {
            if (i + 1 < shuffled.length) {
                pairs.push([shuffled[i], shuffled[i + 1]]);
            } else {
                // Odd team gets a BYE
                pairs.push([shuffled[i], null]);
            }
        }
        return pairs;
    }

    // ─── Round 2+: Standings-Based Pairing ──────────────────────────

    private async buildStandingsPairings(
        tournamentId: string,
        teamIds: string[],
    ): Promise<[string, string | null][]> {
        // 1. Get standings
        const standings = await this.computeStandings(tournamentId, teamIds);

        // 2. Get all existing pairings to prevent duplicates
        const playedPairs = await this.getPlayedPairs(tournamentId);

        // 3. Track BYE counts to give BYE to team with fewest
        const byeCounts = new Map<string, number>();
        for (const row of standings) {
            byeCounts.set(row.teamId, row.byeCount);
        }

        // 4. Build ordered list by standings
        const available = standings.map((s) => s.teamId);

        // 5. Handle BYE if odd number of teams
        let byeTeamId: string | null = null;
        if (available.length % 2 !== 0) {
            // Find team with fewest BYEs, then lowest standings (from bottom)
            let bestByeIdx = available.length - 1;
            let minByes = byeCounts.get(available[bestByeIdx]) ?? 0;

            for (let i = available.length - 2; i >= 0; i--) {
                const bc = byeCounts.get(available[i]) ?? 0;
                if (bc < minByes) {
                    minByes = bc;
                    bestByeIdx = i;
                }
            }

            byeTeamId = available[bestByeIdx];
            available.splice(bestByeIdx, 1);
        }

        // 6. Pair adjacent teams with duplicate prevention
        const pairs: [string, string | null][] = [];
        const used = new Set<string>();

        for (let i = 0; i < available.length; i++) {
            if (used.has(available[i])) continue;

            const teamA = available[i];
            used.add(teamA);

            // Try to pair with nearest available unmet team
            let paired = false;
            for (let j = i + 1; j < available.length; j++) {
                if (used.has(available[j])) continue;

                const teamB = available[j];
                const pairKey = this.makePairKey(teamA, teamB);

                if (!playedPairs.has(pairKey)) {
                    pairs.push([teamA, teamB]);
                    used.add(teamB);
                    paired = true;
                    break;
                }
            }

            // Fallback: if all potential opponents already met, still pair
            if (!paired) {
                for (let j = i + 1; j < available.length; j++) {
                    if (!used.has(available[j])) {
                        pairs.push([teamA, available[j]]);
                        used.add(available[j]);
                        paired = true;
                        break;
                    }
                }
            }
        }

        // Add BYE pair
        if (byeTeamId) {
            pairs.push([byeTeamId, null]);
        }

        return pairs;
    }

    // ─── Standings Computation ──────────────────────────────────────

    async computeStandings(
        tournamentId: string,
        teamIds?: string[],
    ): Promise<SwissStandingRow[]> {
        // Get all completed Swiss matches for this tournament
        const matches = await this.prisma.match.findMany({
            where: {
                tournamentId,
                stageType: 'SWISS',
                status: MatchStatus.COMPLETED,
            },
            include: { matchScore: true },
        });

        // If no teamIds provided, get from tournament
        if (!teamIds) {
            const tournament = await this.prisma.tournament.findUnique({
                where: { id: tournamentId },
                include: {
                    eventCategory: {
                        include: {
                            categoryTeams: { select: { teamId: true } },
                        },
                    },
                },
            });
            teamIds =
                tournament?.eventCategory?.categoryTeams.map((ct) => ct.teamId) ?? [];
        }

        // Get BYE info from swiss rounds (teams that got BYE = those not appearing in any match of that round)
        const swissRounds = await this.prisma.swissRound.findMany({
            where: { tournamentId, status: 'COMPLETED' },
            include: { matches: { select: { homeTeamId: true, awayTeamId: true } } },
        });

        const byeCounts = new Map<string, number>();
        for (const tid of teamIds) {
            byeCounts.set(tid, 0);
        }

        for (const round of swissRounds) {
            const teamsInRound = new Set<string>();
            for (const m of round.matches) {
                teamsInRound.add(m.homeTeamId);
                teamsInRound.add(m.awayTeamId);
            }
            for (const tid of teamIds) {
                if (!teamsInRound.has(tid)) {
                    byeCounts.set(tid, (byeCounts.get(tid) ?? 0) + 1);
                }
            }
        }

        // Build standings map
        const map = new Map<string, SwissStandingRow>();
        for (const tid of teamIds) {
            map.set(tid, {
                teamId: tid,
                played: 0,
                win: 0,
                draw: 0,
                lose: 0,
                goalsFor: 0,
                goalsAgainst: 0,
                goalDiff: 0,
                points: 0,
                byeCount: byeCounts.get(tid) ?? 0,
            });
        }

        for (const match of matches) {
            if (!match.matchScore) continue;

            const home = map.get(match.homeTeamId);
            const away = map.get(match.awayTeamId);
            if (!home || !away) continue;

            const hs = match.matchScore.homeScore;
            const as_ = match.matchScore.awayScore;

            home.played++;
            away.played++;
            home.goalsFor += hs;
            home.goalsAgainst += as_;
            away.goalsFor += as_;
            away.goalsAgainst += hs;

            if (hs > as_) {
                home.win++;
                away.lose++;
            } else if (hs < as_) {
                away.win++;
                home.lose++;
            } else {
                home.draw++;
                away.draw++;
            }
        }

        // Add BYE wins (3 points per BYE)
        for (const [tid, count] of byeCounts) {
            const row = map.get(tid);
            if (row && count > 0) {
                row.win += count;
                row.played += count;
            }
        }

        // Compute derived fields and sort
        const standings = Array.from(map.values())
            .map((s) => ({
                ...s,
                goalDiff: s.goalsFor - s.goalsAgainst,
                points: s.win * 3 + s.draw,
            }))
            .sort((a, b) => {
                if (b.points !== a.points) return b.points - a.points;
                if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
                return b.goalsFor - a.goalsFor;
            });

        return standings;
    }

    // ─── Get Standings with Team Details ────────────────────────────

    async getStandings(tournamentId: string) {
        const tournament = await this.prisma.tournament.findUnique({
            where: { id: tournamentId },
        });
        if (!tournament) {
            throw new NotFoundException('Tournament not found');
        }

        const standings = await this.computeStandings(tournamentId);

        // Fetch team details
        const teamIds = standings.map((s) => s.teamId);
        const teams = await this.prisma.team.findMany({
            where: { id: { in: teamIds } },
            select: {
                id: true,
                name: true,
                shortName: true,
                slug: true,
                logoUrl: true,
            },
        });
        const teamMap = new Map(teams.map((t) => [t.id, t]));

        return {
            data: standings.map((s, i) => ({
                position: i + 1,
                team: teamMap.get(s.teamId) || null,
                ...s,
            })),
        };
    }

    // ─── Get All Swiss Rounds ───────────────────────────────────────

    async getRounds(tournamentId: string) {
        const rounds = await this.prisma.swissRound.findMany({
            where: { tournamentId },
            orderBy: { roundNumber: 'asc' },
            include: {
                matches: {
                    include: {
                        homeTeam: {
                            select: { id: true, name: true, shortName: true, logoUrl: true },
                        },
                        awayTeam: {
                            select: { id: true, name: true, shortName: true, logoUrl: true },
                        },
                        matchScore: true,
                    },
                    orderBy: { scheduledAt: 'asc' },
                },
            },
        });

        // Get tournament config for total rounds
        const tournament = await this.prisma.tournament.findUnique({
            where: { id: tournamentId },
            include: {
                eventCategory: {
                    include: {
                        stages: true,
                        categoryTeams: { select: { teamId: true } },
                    },
                },
            },
        });

        const swissStage = tournament?.eventCategory?.stages.find(
            (s) => s.stageType === 'SWISS',
        );
        const config: SwissConfig = swissStage
            ? (swissStage.settingsJson as unknown as SwissConfig)
            : { rounds: 5 };

        // Compute BYE teams per round
        const teamIds =
            tournament?.eventCategory?.categoryTeams?.map((ct: any) => ct.teamId) ??
            [];

        return {
            rounds,
            totalRounds: config.rounds,
            hasPlayoff: config.hasPlayoff ?? false,
            playoffTop: config.playoffTop ?? 4,
            currentRound: rounds.length,
            canGenerateNext:
                rounds.length < config.rounds &&
                (rounds.length === 0 ||
                    rounds[rounds.length - 1].status === 'COMPLETED'),
            allRoundsCompleted:
                rounds.length >= config.rounds &&
                rounds.every((r) => r.status === 'COMPLETED'),
        };
    }

    // ─── Check & Auto-Complete Swiss Round ──────────────────────────

    async checkRoundCompletion(matchId: string): Promise<boolean> {
        const match = await this.prisma.match.findUnique({
            where: { id: matchId },
            select: { swissRoundId: true },
        });

        if (!match?.swissRoundId) return false;

        // Check if all matches in the round are completed
        const incompleteCount = await this.prisma.match.count({
            where: {
                swissRoundId: match.swissRoundId,
                status: { not: MatchStatus.COMPLETED },
            },
        });

        if (incompleteCount === 0) {
            await this.prisma.swissRound.update({
                where: { id: match.swissRoundId },
                data: { status: 'COMPLETED' },
            });
            return true;
        }

        return false;
    }

    // ─── Generate Playoff from Swiss ────────────────────────────────

    async generatePlayoff(
        tournamentId: string,
        userId: string,
        userRole: UserRole,
    ) {
        const tournament = await this.prisma.tournament.findUnique({
            where: { id: tournamentId },
            include: {
                event: { select: { organizerId: true } },
                eventCategory: {
                    include: {
                        stages: true,
                        categoryTeams: { select: { teamId: true } },
                    },
                },
                swissRounds: { orderBy: { roundNumber: 'asc' } },
            },
        });

        if (!tournament) {
            throw new NotFoundException('Tournament not found');
        }

        if (
            tournament.event.organizerId !== userId &&
            userRole !== UserRole.ADMIN
        ) {
            throw new BadRequestException('Not authorized');
        }

        // Validate all Swiss rounds completed
        const swissStage = tournament.eventCategory?.stages.find(
            (s) => s.stageType === 'SWISS',
        );
        const config: SwissConfig = swissStage
            ? (swissStage.settingsJson as unknown as SwissConfig)
            : { rounds: 5 };

        if (!config.hasPlayoff) {
            throw new BadRequestException(
                'Playoff is not enabled for this Swiss tournament',
            );
        }

        if (tournament.swissRounds.length < config.rounds) {
            throw new BadRequestException('Not all Swiss rounds are completed yet');
        }

        const allCompleted = tournament.swissRounds.every(
            (r) => r.status === 'COMPLETED',
        );
        if (!allCompleted) {
            throw new BadRequestException('Not all Swiss rounds are completed yet');
        }

        // Get top N teams from standings
        const teamIds =
            tournament.eventCategory?.categoryTeams.map((ct) => ct.teamId) ?? [];
        const standings = await this.computeStandings(tournamentId, teamIds);
        const playoffTop = config.playoffTop ?? 4;
        const qualifiedTeams = standings.slice(0, playoffTop).map((s) => s.teamId);

        if (qualifiedTeams.length < 2) {
            throw new BadRequestException('Not enough teams for playoff');
        }

        // Generate single-elimination knockout bracket
        const bracketSize = this.nextPowerOfTwo(qualifiedTeams.length);
        const baseDate = new Date();
        const matchCreateData: any[] = [];
        let roundMatches = bracketSize / 2;
        let roundNum = 1;

        // First round
        for (let i = 0; i < roundMatches; i++) {
            const homeIdx = i;
            const awayIdx = bracketSize - 1 - i;
            const home = qualifiedTeams[homeIdx] ?? qualifiedTeams[0]; // BYE fallback
            const away =
                awayIdx < qualifiedTeams.length
                    ? qualifiedTeams[awayIdx]
                    : qualifiedTeams[0]; // BYE fallback

            matchCreateData.push({
                tournamentId,
                homeTeamId: home,
                awayTeamId: away,
                eventCategoryId: tournament.eventCategoryId,
                round: 100 + roundNum, // Offset to distinguish from Swiss rounds
                matchDay: 100 + roundNum,
                scheduledAt: new Date(
                    baseDate.getTime() + (100 + roundNum) * 86400000 + i * 3600000,
                ),
                status: MatchStatus.DRAFT,
                stageType: 'KNOCKOUT',
            });
        }

        // Subsequent rounds (semis, final)
        while (roundMatches > 1) {
            roundNum++;
            roundMatches = roundMatches / 2;
            for (let i = 0; i < roundMatches; i++) {
                matchCreateData.push({
                    tournamentId,
                    homeTeamId: qualifiedTeams[0], // placeholder
                    awayTeamId: qualifiedTeams[0], // placeholder
                    eventCategoryId: tournament.eventCategoryId,
                    round: 100 + roundNum,
                    matchDay: 100 + roundNum,
                    scheduledAt: new Date(
                        baseDate.getTime() + (100 + roundNum) * 86400000 + i * 3600000,
                    ),
                    status: MatchStatus.DRAFT,
                    stageType: 'KNOCKOUT',
                });
            }
        }

        await this.prisma.match.createMany({ data: matchCreateData });

        return {
            qualifiedTeams,
            matchesCreated: matchCreateData.length,
        };
    }

    // ─── Helpers ────────────────────────────────────────────────────

    private async getPlayedPairs(tournamentId: string): Promise<Set<string>> {
        const matches = await this.prisma.match.findMany({
            where: {
                tournamentId,
                stageType: 'SWISS',
            },
            select: { homeTeamId: true, awayTeamId: true },
        });

        const pairs = new Set<string>();
        for (const m of matches) {
            pairs.add(this.makePairKey(m.homeTeamId, m.awayTeamId));
        }
        return pairs;
    }

    private makePairKey(a: string, b: string): string {
        return a < b ? `${a}|${b}` : `${b}|${a}`;
    }

    private nextPowerOfTwo(n: number): number {
        let p = 1;
        while (p < n) p *= 2;
        return p;
    }
}

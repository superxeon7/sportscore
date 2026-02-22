import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MatchStatus, TournamentStatus } from '@prisma/client';

/**
 * Handles automatic advancement of winners and losers through a
 * double elimination bracket when a match completes.
 *
 * Called from the match completion flow (live-scoring or manual status update).
 */
@Injectable()
export class BracketAdvancementService {
    private readonly logger = new Logger(BracketAdvancementService.name);

    constructor(private readonly prisma: PrismaService) { }

    /**
     * Process advancement for a completed match.
     * - Advances winner to winnerToMatch
     * - Drops loser to loserToMatch (upper bracket)
     * - Handles Grand Final → Reset Final activation
     * - Handles tournament completion
     */
    async advanceFromMatch(matchId: string): Promise<void> {
        const match = await this.prisma.match.findUnique({
            where: { id: matchId },
            include: {
                matchScore: true,
                homeTeam: { select: { id: true, name: true } },
                awayTeam: { select: { id: true, name: true } },
            },
        });

        if (!match) {
            throw new NotFoundException(`Match ${matchId} not found`);
        }

        if (match.status !== MatchStatus.COMPLETED) {
            return; // Only process completed matches
        }

        if (!match.matchScore) {
            this.logger.warn(`Match ${matchId} completed but has no score — skipping advancement`);
            return;
        }

        // ── Determine winner / loser ──
        const homeScore = match.matchScore.homeScore;
        const awayScore = match.matchScore.awayScore;

        if (homeScore === awayScore) {
            // Draws are not valid in elimination brackets. 
            // The scoring system should force a winner (penalties, etc.)
            // Check penalty scores
            const penaltyScores = match.matchScore.penaltyScores as any;
            if (penaltyScores?.home !== undefined && penaltyScores?.away !== undefined) {
                if (penaltyScores.home === penaltyScores.away) {
                    this.logger.warn(`Match ${matchId} ended in a draw even after penalties — skipping`);
                    return;
                }
                if (!match.homeTeamId || !match.awayTeamId) {
                    this.logger.warn(`Match ${matchId} has null team — skipping advancement`);
                    return;
                }
                // Penalty winner
                const winnerId = penaltyScores.home > penaltyScores.away
                    ? match.homeTeamId
                    : match.awayTeamId;
                const loserId = winnerId === match.homeTeamId
                    ? match.awayTeamId
                    : match.homeTeamId;
                await this.processAdvancement(match, winnerId, loserId);
            } else {
                this.logger.warn(`Match ${matchId} is a draw with no penalties — cannot advance`);
                return;
            }
        } else {
            if (!match.homeTeamId || !match.awayTeamId) {
                this.logger.warn(`Match ${matchId} has null team — skipping advancement`);
                return;
            }
            const winnerId = homeScore > awayScore ? match.homeTeamId : match.awayTeamId;
            const loserId = winnerId === match.homeTeamId ? match.awayTeamId : match.homeTeamId;
            await this.processAdvancement(match, winnerId, loserId);
        }
    }

    private async processAdvancement(
        match: any,
        winnerId: string,
        loserId: string,
    ): Promise<void> {
        const updates: Promise<unknown>[] = [];

        // ── Grand Final logic ──
        if (match.isGrandFinal) {
            // Check if the LB winner (away) beat the UB winner (home)
            // In GF: home = UB winner, away = LB winner
            if (winnerId === match.awayTeamId) {
                // LB winner beat UB winner → activate Reset Final
                this.logger.log(`Grand Final: LB winner won — activating Reset Final`);

                const resetFinal = await this.prisma.match.findFirst({
                    where: {
                        tournamentId: match.tournamentId,
                        isResetFinal: true,
                    },
                });

                if (resetFinal) {
                    updates.push(
                        this.prisma.match.update({
                            where: { id: resetFinal.id },
                            data: {
                                status: MatchStatus.SCHEDULED,
                                homeTeamId: match.homeTeamId, // UB winner
                                awayTeamId: match.awayTeamId, // LB winner (GF winner)
                            },
                        }),
                    );
                }
            } else {
                // UB winner won → tournament complete
                this.logger.log(`Grand Final: UB winner won — tournament complete`);
                updates.push(
                    this.prisma.tournament.update({
                        where: { id: match.tournamentId },
                        data: { status: TournamentStatus.COMPLETED },
                    }),
                );
            }
            await Promise.all(updates);
            return;
        }

        // ── Reset Final logic ──
        if (match.isResetFinal) {
            // Winner of reset final is the champion
            this.logger.log(`Reset Final complete — tournament champion determined`);
            updates.push(
                this.prisma.tournament.update({
                    where: { id: match.tournamentId },
                    data: { status: TournamentStatus.COMPLETED },
                }),
            );
            await Promise.all(updates);
            return;
        }

        // ── Standard bracket advancement ──

        // Advance winner
        if (match.winnerToMatchId) {
            const targetMatch = await this.prisma.match.findUnique({
                where: { id: match.winnerToMatchId },
            });

            if (targetMatch) {
                // Place winner as the slot fed by this match
                // If sourceMatchAId matches this match → home slot
                // If sourceMatchBId matches this match → away slot
                const updateData: Record<string, string> = {};
                if (targetMatch.sourceMatchAId === match.id) {
                    updateData.homeTeamId = winnerId;
                } else if (targetMatch.sourceMatchBId === match.id) {
                    updateData.awayTeamId = winnerId;
                } else {
                    // Fallback for simple single-elimination brackets:
                    // even matchIndex → home slot, odd matchIndex → away slot
                    const isHomeSlot = (match.matchIndex ?? 0) % 2 === 0;
                    if (isHomeSlot) {
                        updateData.homeTeamId = winnerId;
                    } else {
                        updateData.awayTeamId = winnerId;
                    }
                }

                updates.push(
                    this.prisma.match.update({
                        where: { id: match.winnerToMatchId },
                        data: updateData,
                    }).then(async (updated: any) => {
                        // Promote to SCHEDULED once both teams are set
                        if (updated.homeTeamId && updated.awayTeamId && updated.status === 'DRAFT') {
                            await this.prisma.match.update({
                                where: { id: match.winnerToMatchId },
                                data: { status: MatchStatus.SCHEDULED },
                            });
                        }
                    }),
                );
            }
        }

        // Drop loser to lower bracket
        if (match.loserToMatchId) {
            const targetMatch = await this.prisma.match.findUnique({
                where: { id: match.loserToMatchId },
            });

            if (targetMatch) {
                const updateData: Record<string, string> = {};
                if (targetMatch.sourceMatchAId === match.id) {
                    updateData.homeTeamId = loserId;
                } else if (targetMatch.sourceMatchBId === match.id) {
                    updateData.awayTeamId = loserId;
                } else {
                    // Fallback
                    updateData.awayTeamId = loserId;
                }

                updates.push(
                    this.prisma.match.update({
                        where: { id: match.loserToMatchId },
                        data: updateData,
                    }),
                );
            }
        }

        await Promise.all(updates);
    }
}

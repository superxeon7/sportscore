'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';

// ── Types ──

interface BracketTeam {
    id: string;
    name: string;
    shortName?: string;
    logoUrl?: string;
}

interface BracketMatch {
    id: string;
    homeTeamId: string;
    awayTeamId: string;
    homeTeam?: BracketTeam;
    awayTeam?: BracketTeam;
    matchScore?: { homeScore: number; awayScore: number };
    status: string;
    bracket?: string;
    round?: number;
    matchIndex?: number;
    isGrandFinal?: boolean;
    isResetFinal?: boolean;
}

interface SeedEntry {
    seed: number;
    team: BracketTeam;
}

interface DoubleEliminationBracketProps {
    upper: Record<number, BracketMatch[]>;
    lower: Record<number, BracketMatch[]>;
    grandFinal: BracketMatch | null;
    resetFinal: BracketMatch | null;
    seeding?: SeedEntry[];
}

// ── Constants ──

const MATCH_W = 220;
const MATCH_H = 72;
const ROUND_GAP = 60;
const MATCH_GAP_Y = 16;
const ROUND_LABEL_H = 32;

// ── Component ──

export default function DoubleEliminationBracket({
    upper,
    lower,
    grandFinal,
    resetFinal,
}: DoubleEliminationBracketProps) {
    const [selectedMatch, setSelectedMatch] = useState<BracketMatch | null>(null);

    const ubRounds = Object.keys(upper)
        .map(Number)
        .sort((a, b) => a - b);
    const lbRounds = Object.keys(lower)
        .map(Number)
        .sort((a, b) => a - b);

    // Calculate upper bracket dimensions
    const maxUbMatchesInRound = Math.max(...ubRounds.map((r) => upper[r].length), 1);
    const ubTotalHeight = maxUbMatchesInRound * (MATCH_H + MATCH_GAP_Y) + ROUND_LABEL_H;

    // Calculate lower bracket dimensions  
    const maxLbMatchesInRound = lbRounds.length > 0
        ? Math.max(...lbRounds.map((r) => lower[r].length), 1)
        : 0;
    const lbTotalHeight = maxLbMatchesInRound > 0
        ? maxLbMatchesInRound * (MATCH_H + MATCH_GAP_Y) + ROUND_LABEL_H
        : 0;

    const gfSectionHeight = 160;
    const totalRounds = Math.max(ubRounds.length, lbRounds.length) + 2; // +2 for GF and RF
    const svgWidth = totalRounds * (MATCH_W + ROUND_GAP) + ROUND_GAP;
    const svgHeight = ubTotalHeight + lbTotalHeight + gfSectionHeight + 60;

    // Render function for a single bracket match card
    const renderMatch = (
        match: BracketMatch,
        x: number,
        y: number,
        isGF = false,
        isRF = false
    ) => {
        const isCompleted = match.status === 'COMPLETED';
        const isLive = match.status === 'LIVE';
        const isDraft = match.status === 'DRAFT';

        const homeWon =
            isCompleted &&
            match.matchScore &&
            match.matchScore.homeScore > match.matchScore.awayScore;
        const awayWon =
            isCompleted &&
            match.matchScore &&
            match.matchScore.awayScore > match.matchScore.homeScore;

        const borderColor = isGF
            ? '#EAB308'
            : isRF
                ? '#F97316'
                : isLive
                    ? '#EF4444'
                    : isCompleted
                        ? '#8B5CF6'
                        : '#334155';

        return (
            <g
                key={match.id}
                onClick={() => setSelectedMatch(match)}
                style={{ cursor: 'pointer' }}
            >
                {/* Match card background */}
                <rect
                    x={x}
                    y={y}
                    width={MATCH_W}
                    height={MATCH_H}
                    rx={8}
                    fill={isDraft ? '#0F172A' : '#1E293B'}
                    stroke={borderColor}
                    strokeWidth={isGF || isRF ? 2 : 1}
                    opacity={isDraft ? 0.5 : 1}
                />

                {/* Status indicator */}
                {isLive && (
                    <circle cx={x + MATCH_W - 12} cy={y + 8} r={4} fill="#EF4444">
                        <animate attributeName="opacity" values="1;0.3;1" dur="1.5s" repeatCount="indefinite" />
                    </circle>
                )}

                {/* Home team */}
                <rect
                    x={x}
                    y={y}
                    width={MATCH_W}
                    height={MATCH_H / 2}
                    rx={8}
                    fill={homeWon ? 'rgba(34, 197, 94, 0.1)' : 'transparent'}
                />
                {match.homeTeam?.logoUrl && (
                    <image
                        href={match.homeTeam.logoUrl}
                        x={x + 8}
                        y={y + 6}
                        width={20}
                        height={20}
                        clipPath="circle(10px)"
                    />
                )}
                <text
                    x={x + 34}
                    y={y + 22}
                    fill={homeWon ? '#22C55E' : '#CBD5E1'}
                    fontSize={12}
                    fontFamily="system-ui, sans-serif"
                    fontWeight={homeWon ? 700 : 400}
                >
                    {truncate(match.homeTeam?.shortName || match.homeTeam?.name || 'TBD', 16)}
                </text>
                <text
                    x={x + MATCH_W - 12}
                    y={y + 22}
                    fill={homeWon ? '#22C55E' : '#94A3B8'}
                    fontSize={13}
                    fontWeight={700}
                    textAnchor="end"
                    fontFamily="system-ui, sans-serif"
                >
                    {match.matchScore?.homeScore ?? '-'}
                </text>

                {/* Divider */}
                <line
                    x1={x + 4}
                    y1={y + MATCH_H / 2}
                    x2={x + MATCH_W - 4}
                    y2={y + MATCH_H / 2}
                    stroke="#334155"
                    strokeWidth={0.5}
                />

                {/* Away team */}
                <rect
                    x={x}
                    y={y + MATCH_H / 2}
                    width={MATCH_W}
                    height={MATCH_H / 2}
                    rx={8}
                    fill={awayWon ? 'rgba(34, 197, 94, 0.1)' : 'transparent'}
                />
                {match.awayTeam?.logoUrl && (
                    <image
                        href={match.awayTeam.logoUrl}
                        x={x + 8}
                        y={y + MATCH_H / 2 + 6}
                        width={20}
                        height={20}
                        clipPath="circle(10px)"
                    />
                )}
                <text
                    x={x + 34}
                    y={y + MATCH_H / 2 + 22}
                    fill={awayWon ? '#22C55E' : '#CBD5E1'}
                    fontSize={12}
                    fontFamily="system-ui, sans-serif"
                    fontWeight={awayWon ? 700 : 400}
                >
                    {truncate(match.awayTeam?.shortName || match.awayTeam?.name || 'TBD', 16)}
                </text>
                <text
                    x={x + MATCH_W - 12}
                    y={y + MATCH_H / 2 + 22}
                    fill={awayWon ? '#22C55E' : '#94A3B8'}
                    fontSize={13}
                    fontWeight={700}
                    textAnchor="end"
                    fontFamily="system-ui, sans-serif"
                >
                    {match.matchScore?.awayScore ?? '-'}
                </text>
            </g>
        );
    };

    // Calculate match positions for connector lines
    const matchPositions = new Map<string, { x: number; y: number }>();

    return (
        <div className="w-full">
            <div className="overflow-x-auto overflow-y-auto pb-4" style={{ WebkitOverflowScrolling: 'touch' }}>
                <svg
                    width={svgWidth}
                    height={svgHeight}
                    viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                    className="select-none"
                >
                    {/* ─── Upper Bracket ─── */}
                    <text
                        x={ROUND_GAP / 2}
                        y={16}
                        fill="#10B981"
                        fontSize={14}
                        fontWeight={700}
                        fontFamily="system-ui, sans-serif"
                    >
                        ▲ UPPER BRACKET
                    </text>

                    {ubRounds.map((round, ri) => {
                        const matchList = upper[round];
                        const x = ri * (MATCH_W + ROUND_GAP) + ROUND_GAP / 2;

                        // Distribute matches vertically for this round
                        const totalMatchSpace = maxUbMatchesInRound * (MATCH_H + MATCH_GAP_Y);
                        const roundMatchSpace = matchList.length * (MATCH_H + MATCH_GAP_Y);
                        const yOffset = (totalMatchSpace - roundMatchSpace) / 2;

                        return (
                            <g key={`ub-r${round}`}>
                                {/* Round label */}
                                <text
                                    x={x + MATCH_W / 2}
                                    y={ROUND_LABEL_H}
                                    fill="#64748B"
                                    fontSize={10}
                                    fontWeight={600}
                                    textAnchor="middle"
                                    fontFamily="system-ui, sans-serif"
                                    letterSpacing={1}
                                >
                                    {ri === ubRounds.length - 1
                                        ? 'UB FINAL'
                                        : `ROUND ${round}`}
                                </text>

                                {matchList.map((match, mi) => {
                                    const y =
                                        ROUND_LABEL_H +
                                        8 +
                                        yOffset +
                                        mi * (MATCH_H + MATCH_GAP_Y);
                                    matchPositions.set(match.id, { x, y });
                                    return renderMatch(match, x, y);
                                })}
                            </g>
                        );
                    })}

                    {/* ─── SVG Connector Lines (Upper) ─── */}
                    {ubRounds.slice(0, -1).map((round, ri) => {
                        const nextRound = ubRounds[ri + 1];
                        const currentMatches = upper[round];
                        const nextMatches = upper[nextRound];

                        return currentMatches.map((match, mi) => {
                            const nextIdx = Math.floor(mi / 2);
                            const nextMatch = nextMatches[nextIdx];
                            if (!nextMatch) return null;

                            const from = matchPositions.get(match.id);
                            const to = matchPositions.get(nextMatch.id);
                            if (!from || !to) return null;

                            const fromX = from.x + MATCH_W;
                            const fromY = from.y + MATCH_H / 2;
                            const toX = to.x;
                            const toY = to.y + MATCH_H / 2;
                            const midX = fromX + (toX - fromX) / 2;

                            return (
                                <path
                                    key={`ub-conn-${match.id}`}
                                    d={`M ${fromX} ${fromY} H ${midX} V ${toY} H ${toX}`}
                                    fill="none"
                                    stroke="#334155"
                                    strokeWidth={1.5}
                                />
                            );
                        });
                    })}

                    {/* ─── Lower Bracket ─── */}
                    {lbRounds.length > 0 && (
                        <>
                            <text
                                x={ROUND_GAP / 2}
                                y={ubTotalHeight + 36}
                                fill="#F97316"
                                fontSize={14}
                                fontWeight={700}
                                fontFamily="system-ui, sans-serif"
                            >
                                ▼ LOWER BRACKET
                            </text>

                            {lbRounds.map((round, ri) => {
                                const matchList = lower[round];
                                const x = ri * (MATCH_W + ROUND_GAP) + ROUND_GAP / 2;
                                const lbBaseY = ubTotalHeight + ROUND_LABEL_H + 20;

                                return (
                                    <g key={`lb-r${round}`}>
                                        <text
                                            x={x + MATCH_W / 2}
                                            y={ubTotalHeight + ROUND_LABEL_H + 12}
                                            fill="#64748B"
                                            fontSize={10}
                                            fontWeight={600}
                                            textAnchor="middle"
                                            fontFamily="system-ui, sans-serif"
                                            letterSpacing={1}
                                        >
                                            {ri === lbRounds.length - 1
                                                ? 'LB FINAL'
                                                : `LB R${round}`}
                                        </text>

                                        {matchList.map((match, mi) => {
                                            const y = lbBaseY + mi * (MATCH_H + MATCH_GAP_Y);
                                            matchPositions.set(match.id, { x, y });
                                            return renderMatch(match, x, y);
                                        })}
                                    </g>
                                );
                            })}

                            {/* Connector lines (Lower) */}
                            {lbRounds.slice(0, -1).map((round, ri) => {
                                const nextRound = lbRounds[ri + 1];
                                const currentMatches = lower[round];
                                const nextMatches = lower[nextRound];

                                return currentMatches.map((match, mi) => {
                                    // In lower bracket, pairing depends on round type
                                    const nextIdx = ri % 2 === 0 ? mi : Math.floor(mi / 2);
                                    const nextMatch = nextMatches[nextIdx];
                                    if (!nextMatch) return null;

                                    const from = matchPositions.get(match.id);
                                    const to = matchPositions.get(nextMatch.id);
                                    if (!from || !to) return null;

                                    const fromX = from.x + MATCH_W;
                                    const fromY = from.y + MATCH_H / 2;
                                    const toX = to.x;
                                    const toY = to.y + MATCH_H / 2;
                                    const midX = fromX + (toX - fromX) / 2;

                                    return (
                                        <path
                                            key={`lb-conn-${match.id}`}
                                            d={`M ${fromX} ${fromY} H ${midX} V ${toY} H ${toX}`}
                                            fill="none"
                                            stroke="#334155"
                                            strokeWidth={1.5}
                                        />
                                    );
                                });
                            })}
                        </>
                    )}

                    {/* ─── Grand Final ─── */}
                    {grandFinal && (() => {
                        const gfX =
                            Math.max(ubRounds.length, lbRounds.length) *
                            (MATCH_W + ROUND_GAP) +
                            ROUND_GAP / 2;
                        const gfY = svgHeight / 2 - MATCH_H;
                        matchPositions.set(grandFinal.id, { x: gfX, y: gfY });

                        // Connector from UB Final to GF
                        const ubFinalMatch = upper[ubRounds[ubRounds.length - 1]]?.[0];
                        const lbFinalMatch = lbRounds.length > 0
                            ? lower[lbRounds[lbRounds.length - 1]]?.[0]
                            : null;

                        return (
                            <g>
                                <text
                                    x={gfX + MATCH_W / 2}
                                    y={gfY - 12}
                                    fill="#EAB308"
                                    fontSize={12}
                                    fontWeight={700}
                                    textAnchor="middle"
                                    fontFamily="system-ui, sans-serif"
                                    letterSpacing={1}
                                >
                                    🏆 GRAND FINAL
                                </text>

                                {renderMatch(grandFinal, gfX, gfY, true)}

                                {/* Connector lines to GF */}
                                {ubFinalMatch && matchPositions.get(ubFinalMatch.id) && (() => {
                                    const from = matchPositions.get(ubFinalMatch.id)!;
                                    const fromX = from.x + MATCH_W;
                                    const fromY = from.y + MATCH_H / 2;
                                    const toX = gfX;
                                    const toY = gfY + MATCH_H / 4;
                                    const midX = fromX + (toX - fromX) / 2;
                                    return (
                                        <path
                                            d={`M ${fromX} ${fromY} H ${midX} V ${toY} H ${toX}`}
                                            fill="none"
                                            stroke="#10B981"
                                            strokeWidth={1.5}
                                            strokeDasharray="4 2"
                                        />
                                    );
                                })()}

                                {lbFinalMatch && matchPositions.get(lbFinalMatch.id) && (() => {
                                    const from = matchPositions.get(lbFinalMatch.id)!;
                                    const fromX = from.x + MATCH_W;
                                    const fromY = from.y + MATCH_H / 2;
                                    const toX = gfX;
                                    const toY = gfY + (MATCH_H * 3) / 4;
                                    const midX = fromX + (toX - fromX) / 2;
                                    return (
                                        <path
                                            d={`M ${fromX} ${fromY} H ${midX} V ${toY} H ${toX}`}
                                            fill="none"
                                            stroke="#F97316"
                                            strokeWidth={1.5}
                                            strokeDasharray="4 2"
                                        />
                                    );
                                })()}
                            </g>
                        );
                    })()}

                    {/* ─── Reset Final ─── */}
                    {resetFinal && (() => {
                        const rfX =
                            (Math.max(ubRounds.length, lbRounds.length) + 1) *
                            (MATCH_W + ROUND_GAP) +
                            ROUND_GAP / 2;
                        const rfY = svgHeight / 2 - MATCH_H;

                        return (
                            <g>
                                <text
                                    x={rfX + MATCH_W / 2}
                                    y={rfY - 12}
                                    fill="#F97316"
                                    fontSize={12}
                                    fontWeight={700}
                                    textAnchor="middle"
                                    fontFamily="system-ui, sans-serif"
                                    letterSpacing={1}
                                >
                                    RESET FINAL
                                </text>

                                {renderMatch(resetFinal, rfX, rfY, false, true)}

                                {/* Connector from GF to RF */}
                                {grandFinal && matchPositions.get(grandFinal.id) && (() => {
                                    const from = matchPositions.get(grandFinal.id)!;
                                    const fromX = from.x + MATCH_W;
                                    const fromY = from.y + MATCH_H / 2;
                                    return (
                                        <path
                                            d={`M ${fromX} ${fromY} H ${rfX}`}
                                            fill="none"
                                            stroke="#F97316"
                                            strokeWidth={1.5}
                                            strokeDasharray="6 3"
                                        />
                                    );
                                })()}
                            </g>
                        );
                    })()}
                </svg>
            </div>

            {/* Match Detail Modal */}
            <Modal
                open={!!selectedMatch}
                onClose={() => setSelectedMatch(null)}
                title="Detail Pertandingan"
            >
                {selectedMatch && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between mb-4">
                            <Badge
                                className={
                                    selectedMatch.status === 'COMPLETED'
                                        ? 'bg-purple-500/20 text-purple-300'
                                        : selectedMatch.status === 'LIVE'
                                            ? 'bg-red-500/20 text-red-300'
                                            : 'bg-slate-600/30 text-slate-300'
                                }
                            >
                                {selectedMatch.status.replace(/_/g, ' ')}
                            </Badge>
                            {selectedMatch.bracket && (
                                <Badge className="bg-slate-700/50 text-slate-300">
                                    {selectedMatch.bracket.replace(/_/g, ' ')}
                                </Badge>
                            )}
                        </div>

                        {/* Teams and Score */}
                        <div className="flex items-center gap-4">
                            <div className="flex-1 text-center">
                                {selectedMatch.homeTeam?.logoUrl && (
                                    <img
                                        src={selectedMatch.homeTeam.logoUrl}
                                        alt=""
                                        className="w-12 h-12 rounded-full object-cover mx-auto mb-2"
                                    />
                                )}
                                <p className="font-semibold text-slate-200">
                                    {selectedMatch.homeTeam?.name || 'TBD'}
                                </p>
                            </div>
                            <div className="text-center px-4">
                                <p className="text-3xl font-bold text-white">
                                    {selectedMatch.matchScore?.homeScore ?? 0}
                                    <span className="text-slate-500 mx-2">-</span>
                                    {selectedMatch.matchScore?.awayScore ?? 0}
                                </p>
                            </div>
                            <div className="flex-1 text-center">
                                {selectedMatch.awayTeam?.logoUrl && (
                                    <img
                                        src={selectedMatch.awayTeam.logoUrl}
                                        alt=""
                                        className="w-12 h-12 rounded-full object-cover mx-auto mb-2"
                                    />
                                )}
                                <p className="font-semibold text-slate-200">
                                    {selectedMatch.awayTeam?.name || 'TBD'}
                                </p>
                            </div>
                        </div>

                        {selectedMatch.isGrandFinal && (
                            <p className="text-center text-yellow-400 text-sm font-medium">
                                🏆 Grand Final
                            </p>
                        )}
                        {selectedMatch.isResetFinal && (
                            <p className="text-center text-orange-400 text-sm font-medium">
                                Reset Final — Terjadi jika pemenang Lower Bracket menang di Grand Final
                            </p>
                        )}
                    </div>
                )}
            </Modal>
        </div>
    );
}

// Helper to truncate text
function truncate(text: string, maxLen: number): string {
    return text.length > maxLen ? text.substring(0, maxLen - 1) + '…' : text;
}

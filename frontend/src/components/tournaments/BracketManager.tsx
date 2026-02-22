'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { apiGet, apiPost, apiPatch } from '@/lib/api/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/components/ui/toast';

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

interface BracketData {
    type: string;
    upper: Record<number, BracketMatch[]>;
    lower: Record<number, BracketMatch[]>;
    grandFinal: BracketMatch | null;
    resetFinal: BracketMatch | null;
    seeding: SeedEntry[];
    rounds?: Record<number, BracketMatch[]>;
}

interface BracketManagerProps {
    tournament: {
        id: string;
        name: string;
        type: string;
        status: string;
        eventCategoryId?: string;
    };
    categoryTeams: Array<{
        teamId: string;
        team?: BracketTeam;
    }>;
    onRefresh: () => void;
}

export default function BracketManager({
    tournament,
    categoryTeams,
    onRefresh,
}: BracketManagerProps) {
    const toast = useToast();
    const [bracketData, setBracketData] = useState<BracketData | null>(null);
    const [loading, setLoading] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [resetting, setResetting] = useState(false);
    const [seedingOrder, setSeedingOrder] = useState<string[]>([]);
    const [updatingSeeding, setUpdatingSeeding] = useState(false);
    const [dragIdx, setDragIdx] = useState<number | null>(null);

    const isDoubleElim = tournament.type === 'DOUBLE_ELIMINATION';
    const isSetup = tournament.status === 'SETUP';

    const fetchBracket = useCallback(async () => {
        if (!tournament.eventCategoryId) return;
        setLoading(true);
        try {
            const res = await apiGet<BracketData>(
                `/event-categories/${tournament.eventCategoryId}/bracket`
            );
            setBracketData(res);

            // Initialize seeding from bracket data or category teams
            if (res?.seeding?.length > 0) {
                setSeedingOrder(res.seeding.map((s: SeedEntry) => s.team.id));
            } else {
                setSeedingOrder(categoryTeams.map((ct) => ct.teamId));
            }
        } catch {
            // No bracket yet
            setSeedingOrder(categoryTeams.map((ct) => ct.teamId));
        } finally {
            setLoading(false);
        }
    }, [tournament.eventCategoryId, categoryTeams]);

    useEffect(() => {
        fetchBracket();
    }, [fetchBracket]);

    const handleGenerate = async () => {
        setGenerating(true);
        try {
            await apiPost(`/tournaments/${tournament.id}/generate-fixtures`, {});
            toast.success('Bracket generated successfully!');
            await fetchBracket();
            onRefresh();
        } catch (err: any) {
            toast.error(err?.message || 'Failed to generate bracket');
        } finally {
            setGenerating(false);
        }
    };

    const handleReset = async () => {
        if (!confirm('Reset bracket? All matches and progress will be lost.')) return;
        setResetting(true);
        try {
            await apiPost(`/tournaments/${tournament.id}/reset-bracket`, {});
            toast.success('Bracket reset');
            setBracketData(null);
            await fetchBracket();
            onRefresh();
        } catch (err: any) {
            toast.error(err?.message || 'Failed to reset bracket');
        } finally {
            setResetting(false);
        }
    };

    const handleUpdateSeeding = async () => {
        setUpdatingSeeding(true);
        try {
            await apiPatch(`/tournaments/${tournament.id}/update-seeding`, {
                seedingOrder,
            });
            toast.success('Seeding updated');
        } catch (err: any) {
            toast.error(err?.message || 'Failed to update seeding');
        } finally {
            setUpdatingSeeding(false);
        }
    };

    const shuffleSeeding = () => {
        const shuffled = [...seedingOrder];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        setSeedingOrder(shuffled);
    };

    // Drag-and-drop for seeding
    const handleDragStart = (idx: number) => setDragIdx(idx);
    const handleDragOver = (e: React.DragEvent, idx: number) => {
        e.preventDefault();
        if (dragIdx === null || dragIdx === idx) return;
        const newOrder = [...seedingOrder];
        const [moved] = newOrder.splice(dragIdx, 1);
        newOrder.splice(idx, 0, moved);
        setSeedingOrder(newOrder);
        setDragIdx(idx);
    };
    const handleDragEnd = () => setDragIdx(null);

    const teamMap = new Map(categoryTeams.map((ct) => [ct.teamId, ct.team]));
    const hasMatches = bracketData?.type === 'DOUBLE_ELIMINATION' &&
        (Object.keys(bracketData.upper || {}).length > 0 ||
            bracketData.grandFinal != null);

    if (!isDoubleElim) {
        return (
            <Card className="p-6">
                <p className="text-slate-400">
                    Bracket management is only available for Double Elimination tournaments.
                </p>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            {/* Seeding Section */}
            <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-slate-100">
                        Seeding ({seedingOrder.length} tim)
                    </h3>
                    <div className="flex gap-2">
                        {isSetup && (
                            <>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={shuffleSeeding}
                                    className="text-xs"
                                >
                                    🔀 Acak
                                </Button>
                                <Button
                                    size="sm"
                                    onClick={handleUpdateSeeding}
                                    disabled={updatingSeeding}
                                    className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs"
                                >
                                    {updatingSeeding ? <Spinner className="w-3 h-3" /> : 'Simpan Seeding'}
                                </Button>
                            </>
                        )}
                    </div>
                </div>

                {isSetup && (
                    <p className="text-xs text-slate-500 mb-3">
                        Drag untuk mengubah urutan seeding. Seeding dikunci setelah bracket digenerate.
                    </p>
                )}

                <div className="grid gap-1">
                    {seedingOrder.map((teamId, idx) => {
                        const team = teamMap.get(teamId);
                        return (
                            <div
                                key={teamId}
                                draggable={isSetup}
                                onDragStart={() => handleDragStart(idx)}
                                onDragOver={(e) => handleDragOver(e, idx)}
                                onDragEnd={handleDragEnd}
                                className={`flex items-center gap-3 px-3 py-2 rounded-lg border transition-all ${dragIdx === idx
                                    ? 'border-emerald-500 bg-emerald-500/10'
                                    : 'border-white/5 bg-white/[0.02] hover:bg-white/[0.04]'
                                    } ${isSetup ? 'cursor-grab active:cursor-grabbing' : ''}`}
                            >
                                <span className="text-xs font-bold text-slate-500 w-6 text-center">
                                    #{idx + 1}
                                </span>
                                {team?.logoUrl && (
                                    <img
                                        src={team.logoUrl}
                                        alt=""
                                        className="w-5 h-5 rounded-full object-cover"
                                    />
                                )}
                                <span className="text-sm text-slate-200 truncate">
                                    {team?.name || teamId}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </Card>

            {/* Generate / Reset Buttons */}
            <Card className="p-6">
                <div className="flex items-center gap-4">
                    <Button
                        onClick={handleGenerate}
                        disabled={generating || categoryTeams.length < 2}
                        className="bg-blue-600 hover:bg-blue-500 text-white"
                    >
                        {generating ? (
                            <><Spinner className="w-4 h-4 mr-2" /> Menggenerate...</>
                        ) : hasMatches ? (
                            '🔄 Regenerate Bracket'
                        ) : (
                            '⚡ Generate Bracket'
                        )}
                    </Button>

                    {hasMatches && (
                        <Button
                            variant="outline"
                            onClick={handleReset}
                            disabled={resetting}
                            className="text-red-400 border-red-400/30 hover:bg-red-400/10"
                        >
                            {resetting ? <Spinner className="w-4 h-4" /> : '🗑️ Reset Bracket'}
                        </Button>
                    )}

                    {categoryTeams.length < 2 && (
                        <p className="text-xs text-yellow-400">
                            Minimal 2 tim terdaftar untuk generate bracket.
                        </p>
                    )}
                </div>
            </Card>

            {/* Bracket Preview */}
            {loading ? (
                <Card className="p-6">
                    <div className="flex items-center justify-center py-12">
                        <Spinner className="w-8 h-8" />
                    </div>
                </Card>
            ) : hasMatches && bracketData ? (
                <div className="space-y-6">
                    {/* Upper Bracket */}
                    <Card className="p-6">
                        <h3 className="text-lg font-semibold text-emerald-400 mb-4">
                            ▲ Upper Bracket
                        </h3>
                        <div className="overflow-x-auto">
                            <div className="flex gap-8 min-w-max">
                                {Object.entries(bracketData.upper)
                                    .sort(([a], [b]) => Number(a) - Number(b))
                                    .map(([round, matchList]) => (
                                        <div key={round} className="flex-shrink-0 w-56">
                                            <h4 className="text-xs font-medium text-slate-500 mb-2 text-center uppercase">
                                                Round {round}
                                            </h4>
                                            <div className="space-y-2">
                                                {matchList.map((match) => (
                                                    <MatchCard key={match.id} match={match} />
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    </Card>

                    {/* Lower Bracket */}
                    {Object.keys(bracketData.lower || {}).length > 0 && (
                        <Card className="p-6">
                            <h3 className="text-lg font-semibold text-orange-400 mb-4">
                                ▼ Lower Bracket
                            </h3>
                            <div className="overflow-x-auto">
                                <div className="flex gap-8 min-w-max">
                                    {Object.entries(bracketData.lower)
                                        .sort(([a], [b]) => Number(a) - Number(b))
                                        .map(([round, matchList]) => (
                                            <div key={round} className="flex-shrink-0 w-56">
                                                <h4 className="text-xs font-medium text-slate-500 mb-2 text-center uppercase">
                                                    LB Round {round}
                                                </h4>
                                                <div className="space-y-2">
                                                    {matchList.map((match) => (
                                                        <MatchCard key={match.id} match={match} />
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            </div>
                        </Card>
                    )}

                    {/* Grand Final + Reset Final */}
                    <Card className="p-6">
                        <h3 className="text-lg font-semibold text-yellow-400 mb-4">
                            🏆 Grand Final
                        </h3>
                        <div className="flex gap-6">
                            {bracketData.grandFinal && (
                                <div className="w-56">
                                    <h4 className="text-xs font-medium text-slate-500 mb-2 text-center uppercase">
                                        Grand Final
                                    </h4>
                                    <MatchCard match={bracketData.grandFinal} isGrandFinal />
                                </div>
                            )}
                            {bracketData.resetFinal && (
                                <div className="w-56">
                                    <h4 className="text-xs font-medium text-slate-500 mb-2 text-center uppercase">
                                        Reset Final
                                    </h4>
                                    <MatchCard match={bracketData.resetFinal} isResetFinal />
                                </div>
                            )}
                        </div>
                    </Card>
                </div>
            ) : !hasMatches ? (
                <Card className="p-6">
                    <div className="text-center py-8">
                        <p className="text-slate-400 text-sm">
                            Belum ada bracket. Klik &quot;Generate Bracket&quot; untuk membuat bracket.
                        </p>
                    </div>
                </Card>
            ) : null}
        </div>
    );
}

// ── Match card for bracket preview ──

function MatchCard({
    match,
    isGrandFinal,
    isResetFinal,
}: {
    match: BracketMatch;
    isGrandFinal?: boolean;
    isResetFinal?: boolean;
}) {
    const statusColor =
        match.status === 'COMPLETED'
            ? 'bg-purple-500/20 text-purple-300'
            : match.status === 'LIVE'
                ? 'bg-red-500/20 text-red-300'
                : match.status === 'DRAFT'
                    ? 'bg-slate-700/50 text-slate-400'
                    : 'bg-slate-600/30 text-slate-300';

    const borderColor = isGrandFinal
        ? 'border-yellow-500/30'
        : isResetFinal
            ? 'border-orange-500/30'
            : 'border-white/5';

    return (
        <div
            className={`rounded-lg border ${borderColor} bg-white/[0.02] p-2 transition-colors hover:bg-white/[0.05]`}
        >
            <div className="flex items-center justify-between mb-1">
                <Badge className={`${statusColor} text-[10px] px-1.5 py-0`}>
                    {match.status.replace(/_/g, ' ')}
                </Badge>
            </div>

            {/* Home Team */}
            <div className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2 min-w-0">
                    {match.homeTeam?.logoUrl && (
                        <img
                            src={match.homeTeam.logoUrl}
                            alt=""
                            className="w-4 h-4 rounded-full object-cover flex-shrink-0"
                        />
                    )}
                    <span className="text-xs text-slate-200 truncate">
                        {match.homeTeam?.shortName || match.homeTeam?.name || 'TBD'}
                    </span>
                </div>
                <span className="text-xs font-bold text-slate-300 ml-2">
                    {match.matchScore?.homeScore ?? '-'}
                </span>
            </div>

            {/* Divider */}
            <div className="border-t border-white/5" />

            {/* Away Team */}
            <div className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2 min-w-0">
                    {match.awayTeam?.logoUrl && (
                        <img
                            src={match.awayTeam.logoUrl}
                            alt=""
                            className="w-4 h-4 rounded-full object-cover flex-shrink-0"
                        />
                    )}
                    <span className="text-xs text-slate-200 truncate">
                        {match.awayTeam?.shortName || match.awayTeam?.name || 'TBD'}
                    </span>
                </div>
                <span className="text-xs font-bold text-slate-300 ml-2">
                    {match.matchScore?.awayScore ?? '-'}
                </span>
            </div>
        </div>
    );
}

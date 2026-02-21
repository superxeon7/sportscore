'use client';

import { useState, useEffect } from 'react';
import { apiGet, apiPost } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Trophy, Users, AlertCircle, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import MatchCard from '@/components/match-card';
import { Match } from '@/lib/types';

interface SwissStanding {
    position: number;
    teamId: string;
    team: {
        id: string;
        name: string;
        shortName?: string;
        logoUrl?: string;
    } | null;
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

interface SwissRound {
    id: string;
    roundNumber: number;
    status: 'DRAFT' | 'ACTIVE' | 'COMPLETED';
    matches: Match[];
}

interface SwissData {
    rounds: SwissRound[];
    totalRounds: number;
    hasPlayoff: boolean;
    playoffTop: number;
    currentRound: number;
    canGenerateNext: boolean;
    allRoundsCompleted: boolean;
}

export default function SwissManager({ tournamentId }: { tournamentId: string }) {
    const [standings, setStandings] = useState<SwissStanding[]>([]);
    const [swissData, setSwissData] = useState<SwissData | null>(null);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [expandedRoundId, setExpandedRoundId] = useState<string | null>(null);
    const toast = useToast();

    const fetchData = async () => {
        try {
            setLoading(true);
            const [standingsRes, roundsRes] = await Promise.all([
                apiGet<{ data: SwissStanding[] }>(`/tournaments/${tournamentId}/swiss/standings`),
                apiGet<SwissData>(`/tournaments/${tournamentId}/swiss/rounds`),
            ]);
            setStandings(standingsRes.data);
            setSwissData(roundsRes);

            // Auto-expand latest round if not set
            if (roundsRes.rounds.length > 0 && !expandedRoundId) {
                setExpandedRoundId(roundsRes.rounds[roundsRes.rounds.length - 1].id);
            }
        } catch (error) {
            console.error(error);
            toast.error('Gagal memuat data Swiss System');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tournamentId]);

    const handleGenerateRound = async () => {
        try {
            setGenerating(true);
            await apiPost(`/tournaments/${tournamentId}/swiss/generate-round`, {});
            toast.success('Ronde baru berhasil dibuat');
            fetchData();
        } catch (error: any) {
            toast.error(error?.message || 'Gagal membuat ronde');
        } finally {
            setGenerating(false);
        }
    };

    const handleGeneratePlayoff = async () => {
        try {
            setGenerating(true);
            await apiPost(`/tournaments/${tournamentId}/swiss/generate-playoff`, {});
            toast.success('Playoff berhasil dibuat');
            fetchData();
        } catch (error: any) {
            toast.error(error?.message || 'Gagal membuat playoff');
        } finally {
            setGenerating(false);
        }
    };

    const toggleRound = (id: string) => {
        setExpandedRoundId(expandedRoundId === id ? null : id);
    };

    if (loading) {
        return (
            <div className="flex justify-center p-12">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Header & Controls */}
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <Trophy className="w-5 h-5 text-yellow-500" />
                        Swiss System Manager
                    </h2>
                    <p className="text-sm text-slate-400">
                        Ronde {swissData?.currentRound} / {swissData?.totalRounds}
                    </p>
                </div>

                <div className="flex gap-3">
                    <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
                        <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>

                    {swissData?.canGenerateNext && (
                        <Button
                            onClick={handleGenerateRound}
                            disabled={generating}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                            {generating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                            Generate Round {swissData.currentRound + 1}
                        </Button>
                    )}

                    {swissData?.allRoundsCompleted && swissData.hasPlayoff && (
                        <Button
                            onClick={handleGeneratePlayoff}
                            disabled={generating}
                            className="bg-purple-600 hover:bg-purple-700 text-white"
                        >
                            {generating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                            Generate Playoff (Top {swissData.playoffTop})
                        </Button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Standings */}
                <div className="lg:col-span-1 space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                        <Users className="w-4 h-4 text-slate-400" />
                        <h3 className="font-semibold text-slate-200">Klasemen Sementara</h3>
                    </div>

                    <Card className="overflow-hidden bg-[#1E293B]/50 border-white/[0.08]">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-white/[0.02] border-b border-white/[0.08]">
                                    <tr>
                                        <th className="px-4 py-3 font-medium text-slate-400 text-center w-12">#</th>
                                        <th className="px-4 py-3 font-medium text-slate-400">Tim</th>
                                        <th className="px-4 py-3 font-medium text-slate-400 text-center">M</th>
                                        <th className="px-4 py-3 font-medium text-slate-400 text-center">P</th>
                                        <th className="px-4 py-3 font-bold text-white text-center">Pts</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/[0.08]">
                                    {standings.map((row) => (
                                        <tr key={row.teamId} className="hover:bg-white/[0.02] transition-colors">
                                            <td className="px-4 py-3 text-center text-slate-400">{row.position}</td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    {row.team?.logoUrl && (
                                                        <img
                                                            src={row.team.logoUrl}
                                                            alt=""
                                                            className="w-5 h-5 rounded-full object-cover"
                                                        />
                                                    )}
                                                    <span className="font-medium text-slate-200 truncate max-w-[120px]">
                                                        {row.team?.shortName || row.team?.name || 'Unknown'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-center text-slate-400">{row.played}</td>
                                            <td className="px-4 py-3 text-center text-slate-400 whitespace-nowrap">
                                                {row.goalsFor}:{row.goalsAgainst}
                                            </td>
                                            <td className="px-4 py-3 text-center font-bold text-emerald-400">
                                                {row.points}
                                            </td>
                                        </tr>
                                    ))}
                                    {standings.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                                                Belum ada data klasemen
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </div>

                {/* Right Column: Rounds & Matches */}
                <div className="lg:col-span-2 space-y-4">
                    <h3 className="font-semibold text-slate-200">Riwayat Ronde</h3>

                    {!swissData?.rounds.length ? (
                        <Card className="p-8 text-center border-dashed border-slate-700 bg-transparent">
                            <div className="flex flex-col items-center gap-3">
                                <div className="p-3 bg-slate-800 rounded-full">
                                    <AlertCircle className="w-6 h-6 text-slate-400" />
                                </div>
                                <h4 className="text-lg font-medium text-slate-300">Belum Ada Ronde</h4>
                                <p className="text-sm text-slate-500 max-w-sm">
                                    Mulai turnamen dengan menekan tombol &quot;Generate Round 1&quot; di atas.
                                </p>
                            </div>
                        </Card>
                    ) : (
                        <div className="space-y-4">
                            {[...swissData.rounds].reverse().map((round) => {
                                const isExpanded = expandedRoundId === round.id;
                                return (
                                    <div
                                        key={round.id}
                                        className="border border-white/[0.08] bg-[#1E293B]/30 rounded-lg overflow-hidden"
                                    >
                                        <button
                                            onClick={() => toggleRound(round.id)}
                                            className="w-full flex items-center justify-between p-4 hover:bg-white/[0.02] transition-colors"
                                        >
                                            <div className="flex items-center gap-4">
                                                <span className="font-semibold text-lg text-slate-200">
                                                    Ronde {round.roundNumber}
                                                </span>
                                                <Badge
                                                    className={
                                                        round.status === 'COMPLETED'
                                                            ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
                                                            : 'text-amber-400 border-amber-500/30 bg-amber-500/10'
                                                    }
                                                >
                                                    {round.status}
                                                </Badge>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="text-sm text-slate-500 font-normal">
                                                    {round.matches.length} Pertandingan
                                                </span>
                                                {isExpanded ? (
                                                    <ChevronUp className="w-5 h-5 text-slate-500" />
                                                ) : (
                                                    <ChevronDown className="w-5 h-5 text-slate-500" />
                                                )}
                                            </div>
                                        </button>

                                        {isExpanded && (
                                            <div className="p-4 pt-2 border-t border-white/[0.05]">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    {round.matches.map((match) => (
                                                        <MatchCard key={match.id} match={match} />
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiGet } from '@/lib/api/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

interface TeamMatch {
    id: string;
    status: string;
    scheduledAt: string;
    venue?: string;
    round?: number;
    matchDay?: number;
    homeTeam: { id: string; name: string; shortName?: string; logoUrl?: string };
    awayTeam: { id: string; name: string; shortName?: string; logoUrl?: string };
    matchScore?: { homeScore: number; awayScore: number };
    tournament?: { id: string; name: string; type: string };
    eventCategory?: { id: string; name: string };
    myTeamId: string;
    lineupOpensAt: string;
    canSubmitLineup: boolean;
    canEditLineup: boolean;
    hasLineup: boolean;
    isLineupLocked: boolean;
}

const statusLabels: Record<string, string> = {
    PUBLISHED: 'Terjadwal',
    SCHEDULED: 'Terjadwal',
    WARMUP: 'Pemanasan',
    LIVE: 'Berlangsung',
    HALF_TIME: 'Istirahat',
    PAUSED: 'Dijeda',
    COMPLETED: 'Selesai',
    CANCELLED: 'Dibatalkan',
    POSTPONED: 'Ditunda',
};

const statusColors: Record<string, string> = {
    PUBLISHED: 'bg-blue-900/50 text-blue-300',
    SCHEDULED: 'bg-blue-900/50 text-blue-300',
    WARMUP: 'bg-yellow-900/50 text-yellow-300',
    LIVE: 'bg-red-900/50 text-red-300',
    HALF_TIME: 'bg-yellow-900/50 text-yellow-300',
    PAUSED: 'bg-orange-900/50 text-orange-300',
    COMPLETED: 'bg-purple-900/50 text-purple-300',
    CANCELLED: 'bg-red-900/50 text-red-300',
    POSTPONED: 'bg-slate-700/50 text-slate-300',
};

export default function TeamManagerMatchesPage() {
    const router = useRouter();
    const [matches, setMatches] = useState<TeamMatch[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchMatches = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await apiGet<{ data: TeamMatch[]; meta: { total: number; teamId?: string } }>('/matches/my-team');
            setMatches(res.data ?? []);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Gagal memuat jadwal pertandingan';
            setError(message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchMatches();
    }, [fetchMatches]);

    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString('id-ID', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        });
    };

    const formatTime = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    };

    const getCountdown = (lineupOpensAt: string) => {
        const now = new Date();
        const opens = new Date(lineupOpensAt);
        const diff = opens.getTime() - now.getTime();
        if (diff <= 0) return null;
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        if (days > 0) return `${days} hari ${hours} jam lagi`;
        return `${hours} jam lagi`;
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-100">Jadwal & Lineup</h1>
                    <p className="text-sm text-slate-400 mt-1">Pertandingan tim Anda</p>
                </div>
                <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-28 rounded-lg" />
                    ))}
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-100">Jadwal & Lineup</h1>
                </div>
                <Card className="p-6">
                    <p className="text-red-400">{error}</p>
                    <Button className="mt-4" onClick={fetchMatches}>Coba Lagi</Button>
                </Card>
            </div>
        );
    }

    // Split matches into upcoming vs past
    const now = new Date();
    const upcoming = matches.filter(
        (m) => new Date(m.scheduledAt) >= now || ['LIVE', 'WARMUP', 'HALF_TIME', 'PAUSED'].includes(m.status),
    );
    const past = matches.filter(
        (m) => new Date(m.scheduledAt) < now && !['LIVE', 'WARMUP', 'HALF_TIME', 'PAUSED'].includes(m.status),
    );

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-slate-100">Jadwal & Lineup</h1>
                <p className="text-sm text-slate-400 mt-1">
                    Kelola lineup tim Anda untuk pertandingan yang akan datang
                </p>
            </div>

            {matches.length === 0 ? (
                <Card className="p-8 text-center">
                    <div className="space-y-2">
                        <p className="text-slate-400 font-medium">Belum ada pertandingan terjadwal.</p>
                        <p className="text-sm text-slate-500">
                            Pertandingan akan muncul setelah organizer mempublish jadwal.
                        </p>
                    </div>
                </Card>
            ) : (
                <>
                    {/* Upcoming Matches */}
                    {upcoming.length > 0 && (
                        <div className="space-y-3">
                            <h2 className="text-lg font-semibold text-slate-200">Pertandingan Mendatang</h2>
                            {upcoming.map((match) => {
                                const isHome = match.homeTeam.id === match.myTeamId;
                                const opponent = isHome ? match.awayTeam : match.homeTeam;
                                const countdown = getCountdown(match.lineupOpensAt);

                                return (
                                    <Card key={match.id} className="p-5">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <Badge className={statusColors[match.status] || 'bg-slate-700/50 text-slate-300'}>
                                                        {statusLabels[match.status] || match.status}
                                                    </Badge>
                                                    {match.eventCategory && (
                                                        <Badge className="bg-emerald-900/50 text-emerald-300 text-xs">
                                                            {match.eventCategory.name}
                                                        </Badge>
                                                    )}
                                                    {match.hasLineup && !match.isLineupLocked && (
                                                        <Badge className="bg-green-900/50 text-green-300 text-xs">
                                                            ✓ Lineup Terkirim
                                                        </Badge>
                                                    )}
                                                    {match.isLineupLocked && (
                                                        <Badge className="bg-yellow-900/50 text-yellow-300 text-xs">
                                                            🔒 Lineup Terkunci
                                                        </Badge>
                                                    )}
                                                </div>

                                                <div className="mt-2 flex items-center gap-3">
                                                    <span className="font-semibold text-slate-100">
                                                        {match.homeTeam.shortName || match.homeTeam.name}
                                                    </span>
                                                    <span className="text-slate-500 text-sm">vs</span>
                                                    <span className="font-semibold text-slate-100">
                                                        {match.awayTeam.shortName || match.awayTeam.name}
                                                    </span>
                                                </div>

                                                <div className="mt-1 flex items-center gap-3 text-sm text-slate-400">
                                                    <span>{formatDate(match.scheduledAt)}</span>
                                                    <span>{formatTime(match.scheduledAt)}</span>
                                                    {match.venue && <span>• {match.venue}</span>}
                                                </div>

                                                {match.tournament && (
                                                    <p className="text-xs text-slate-500 mt-1">{match.tournament.name}</p>
                                                )}
                                            </div>

                                            <div className="flex flex-col items-end gap-2 shrink-0">
                                                {match.canSubmitLineup && (
                                                    <Button
                                                        size="sm"
                                                        onClick={() => router.push(`/team-manager/matches/${match.id}/lineup`)}
                                                    >
                                                        Atur Lineup
                                                    </Button>
                                                )}
                                                {match.canEditLineup && (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => router.push(`/team-manager/matches/${match.id}/lineup`)}
                                                    >
                                                        Ubah Lineup
                                                    </Button>
                                                )}
                                                {match.hasLineup && match.isLineupLocked && (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => router.push(`/team-manager/matches/${match.id}/lineup`)}
                                                    >
                                                        Lihat Lineup
                                                    </Button>
                                                )}
                                                {countdown && !match.hasLineup && (
                                                    <span className="text-xs text-slate-500">
                                                        Lineup dibuka dalam {countdown}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </Card>
                                );
                            })}
                        </div>
                    )}

                    {/* Past Matches */}
                    {past.length > 0 && (
                        <div className="space-y-3">
                            <h2 className="text-lg font-semibold text-slate-200">Pertandingan Selesai</h2>
                            {past.map((match) => (
                                <Card key={match.id} className="p-4 opacity-70">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4 flex-1">
                                            <span className="font-medium text-right flex-1 truncate">
                                                {match.homeTeam.shortName || match.homeTeam.name}
                                            </span>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <span className="text-lg font-bold">
                                                    {match.matchScore?.homeScore ?? '-'}
                                                </span>
                                                <span className="text-slate-500">vs</span>
                                                <span className="text-lg font-bold">
                                                    {match.matchScore?.awayScore ?? '-'}
                                                </span>
                                            </div>
                                            <span className="font-medium flex-1 truncate">
                                                {match.awayTeam.shortName || match.awayTeam.name}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 ml-4">
                                            <Badge className={statusColors[match.status] || 'bg-slate-700/50 text-slate-300'}>
                                                {statusLabels[match.status] || match.status}
                                            </Badge>
                                            <span className="text-xs text-slate-500">
                                                {formatDate(match.scheduledAt)}
                                            </span>
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

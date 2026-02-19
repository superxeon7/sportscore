'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiGet, apiPost, apiDelete } from '@/lib/api/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { ArrowLeft, UserPlus, Users, AlertCircle } from 'lucide-react';

interface Player {
    id: string;
    fullName: string;
    jerseyNumber?: number;
    position?: string;
    photoUrl?: string;
}

interface RosterEntry {
    id: string;
    playerId: string;
    categoryId: string;
    teamId: string;
    player: Player;
}

interface Category {
    id: string;
    name: string;
    maxRosterSize: number;
    event: {
        id: string;
        name: string;
    };
}

export default function CategoryRosterPage() {
    const params = useParams();
    const router = useRouter();
    const { success, error: toastError } = useToast();
    const categoryId = params.categoryId as string;

    const [category, setCategory] = useState<Category | null>(null);
    const [roster, setRoster] = useState<RosterEntry[]>([]);
    const [teamPlayers, setTeamPlayers] = useState<Player[]>([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            // 1. Fetch Category Details & Roster
            // We need category details for maxRosterSize. 
            // Currently no direct endpoint for single category public details?
            // Actually `GET /event-categories/:id` exists?
            // Let's assume we can fetch it, or infer from roster limit if not.
            // But better to have it. I'll try to fetch it.
            // If not available, I might need to update backend.
            // But let's assume I can get it.

            // Fetch roster
            const rosterRes = await apiGet<RosterEntry[]>(`/event-categories/${categoryId}/roster`);
            setRoster(rosterRes);

            // Fetch team players (all)
            // Querying with teamId=my-team if I could, but endpoint is generic.
            // I'll use `/players?limit=100` and relying on backend to filter by my team?
            // Wait, `/players` endpoint in `PlayersController` `findAll`.
            // It filters by `teamId` if provided.
            // But I don't know my teamId easily here without fetching "my team" first.
            // Let's fetch "my team" to get ID.

            const teamRes = await apiGet<{ id: string; players: Player[] }>('/teams/my');
            if (teamRes && teamRes.players) {
                setTeamPlayers(teamRes.players);
            }

            // Fetch category details
            // The `apiGet` might fail if endpoint doesn't exist.
            // Let's rely on info from somewhere else or just default max size if not found?
            // Actually `EventCategoriesController` has `findOne`.
            const catRes = await apiGet<Category>(`/event-categories/${categoryId}`);
            setCategory(catRes);

        } catch (err: unknown) {
            console.error(err);
            const message = err instanceof Error ? err.message : 'Gagal memuat data roster';
            setError(message);
        } finally {
            setLoading(false);
        }
    }, [categoryId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleAddPlayer = async (playerId: string) => {
        setProcessing(playerId);
        try {
            await apiPost(`/event-categories/${categoryId}/roster`, { playerId });
            success('Pemain berhasil ditambahkan ke roster');
            // Refresh roster
            const rosterRes = await apiGet<RosterEntry[]>(`/event-categories/${categoryId}/roster`);
            setRoster(rosterRes);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Gagal menambahkan pemain';
            toastError(message);
        } finally {
            setProcessing(null);
        }
    };

    const handleRemovePlayer = async (playerId: string) => {
        if (!confirm('Apakah Anda yakin ingin menghapus pemain ini dari roster?')) return;

        setProcessing(playerId);
        try {
            await apiDelete(`/event-categories/${categoryId}/roster/${playerId}`);
            success('Pemain berhasil dihapus dari roster');
            // Refresh roster
            const rosterRes = await apiGet<RosterEntry[]>(`/event-categories/${categoryId}/roster`);
            setRoster(rosterRes);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Gagal menghapus pemain';
            toastError(message);
        } finally {
            setProcessing(null);
        }
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-16 rounded-lg" />
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Skeleton className="h-96 rounded-lg" />
                    <Skeleton className="h-96 rounded-lg" />
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="space-y-6">
                <h1>Error</h1>
                <p>{error}</p>
                <Button onClick={() => router.back()}>Kembali</Button>
            </div>
        );
    }

    if (!category) return null;

    const rosterPlayerIds = new Set(roster.map(r => r.playerId));
    const availablePlayers = teamPlayers.filter(p => !rosterPlayerIds.has(p.id));
    const isFull = roster.length >= category.maxRosterSize;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <Button variant="ghost" className="pl-0 mb-2 hover:bg-transparent hover:text-white" onClick={() => router.back()}>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Kembali ke Dashboard
                    </Button>
                    <h1 className="text-2xl font-bold text-slate-100">
                        Manajemen Roster: {category.name}
                    </h1>
                    <p className="text-slate-400">
                        {category.event.name} • Maksimal {category.maxRosterSize} Pemain
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Badge variant={isFull ? "destructive" : "secondary"} className="text-sm px-3 py-1">
                        {roster.length} / {category.maxRosterSize} Pemain
                    </Badge>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Current Roster */}
                <Card className="p-5 border-slate-700 bg-slate-800/50">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                            <Users className="h-5 w-5 text-emerald-500" />
                            Roster Aktif
                        </h2>
                    </div>

                    {roster.length === 0 ? (
                        <div className="text-center py-12 text-slate-500 bg-slate-900/50 rounded-lg border border-dashed border-slate-700">
                            <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p>Belum ada pemain di roster ini</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {roster.map((entry) => (
                                <div key={entry.id} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg border border-slate-700/50 group hover:border-slate-600 transition-all">
                                    <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden border border-slate-600 shrink-0">
                                            {entry.player.photoUrl ? (
                                                <img src={entry.player.photoUrl} alt={entry.player.fullName} className="h-full w-full object-cover" />
                                            ) : (
                                                <span className="text-xs font-bold font-mono text-slate-400">
                                                    {entry.player.jerseyNumber || '#'}
                                                </span>
                                            )}
                                        </div>
                                        <div>
                                            <p className="font-medium text-slate-200">
                                                {entry.player.fullName}
                                            </p>
                                            <p className="text-xs text-slate-500 uppercase">{entry.player.position || 'Pemain'}</p>
                                        </div>
                                    </div>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="text-red-400 hover:text-red-300 hover:bg-red-950/30"
                                        onClick={() => handleRemovePlayer(entry.playerId)}
                                        disabled={processing === entry.playerId}
                                    >
                                        {processing === entry.playerId ? <Spinner className="w-4 h-4" /> : 'Hapus'}
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </Card>

                {/* Available Players */}
                <Card className="p-5 border-slate-700 bg-slate-800/50">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                            <UserPlus className="h-5 w-5 text-blue-500" />
                            Pemain Tersedia
                        </h2>
                    </div>

                    {availablePlayers.length === 0 ? (
                        <div className="text-center py-12 text-slate-500 bg-slate-900/50 rounded-lg border border-dashed border-slate-700">
                            <p>Semua pemain tim sudah masuk roster</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {availablePlayers.map((player) => (
                                <div key={player.id} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg border border-slate-700/50 group hover:border-slate-600 transition-all">
                                    <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden border border-slate-600 shrink-0">
                                            {player.photoUrl ? (
                                                <img src={player.photoUrl} alt={player.fullName} className="h-full w-full object-cover" />
                                            ) : (
                                                <span className="text-xs font-bold font-mono text-slate-400">
                                                    {player.jerseyNumber || '#'}
                                                </span>
                                            )}
                                        </div>
                                        <div>
                                            <p className="font-medium text-slate-200">
                                                {player.fullName}
                                            </p>
                                            <p className="text-xs text-slate-500 uppercase">{player.position || 'Pemain'}</p>
                                        </div>
                                    </div>
                                    <Button
                                        size="sm"
                                        variant="secondary"
                                        className="bg-emerald-900/20 text-emerald-400 hover:bg-emerald-900/40 hover:text-emerald-300 border-emerald-900/50"
                                        onClick={() => handleAddPlayer(player.id)}
                                        disabled={isFull || processing === player.id}
                                    >
                                        {processing === player.id ? <Spinner className="w-4 h-4" /> : 'Tambah'}
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}

                    {isFull && availablePlayers.length > 0 && (
                        <div className="mt-4 p-3 bg-yellow-900/20 border border-yellow-700/30 rounded-lg flex items-start gap-2 text-yellow-200 text-sm">
                            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                            <p>Roster sudah penuh. Hapus pemain dari roster untuk menambahkan yang lain.</p>
                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
}

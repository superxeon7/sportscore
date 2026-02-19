'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiGet, apiPost, apiPatch, apiPut } from '@/lib/api/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';

// ─── Types ────────────────────────────────────────────────────────

interface Player {
    id: string;
    fullName: string;
    jerseyNumber?: number;
    position?: string;
    photoUrl?: string;
}

interface TeamOfficialItem {
    id: string;
    fullName: string;
    role: string;
    photoUrl?: string;
    dateOfBirth?: string;
    nationality?: string;
}

interface MatchOfficialEntry {
    id: string;
    officialId: string;
    isHeadCoach: boolean;
    official: TeamOfficialItem;
}

interface LineupPlayer {
    playerId: string;
    jerseyNumber: number;
    isStarter: boolean;
    isCaptain: boolean;
    player: Player;
}

interface Lineup {
    id: string;
    matchId: string;
    teamId: string;
    isLocked: boolean;
    team: { id: string; name: string; shortName?: string; logoUrl?: string };
    players: LineupPlayer[];
}

interface MatchInfo {
    id: string;
    status: string;
    scheduledAt: string;
    venue?: string;
    homeTeam: { id: string; name: string; shortName?: string };
    awayTeam: { id: string; name: string; shortName?: string };
    myTeamId: string;
    lineupOpensAt: string;
    canSubmitLineup: boolean;
    canEditLineup: boolean;
    hasLineup: boolean;
    isLineupLocked: boolean;
    eventCategory?: { id: string; name: string; sportType?: string };
}

interface SelectedPlayer {
    playerId: string;
    jerseyNumber: number;
    isStarter: boolean;
    isCaptain: boolean;
    player: Player;
}

// ─── Constants ────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
    COACH: 'Pelatih',
    ASSISTANT_COACH: 'Asisten Pelatih',
    MANAGER: 'Manajer',
    PHYSIO: 'Fisioterapis',
    OTHER: 'Lainnya',
};

const STARTER_COUNTS: Record<string, number> = {
    FUTSAL: 5,
    FOOTBALL: 11,
    BASKETBALL: 5,
    VOLLEYBALL: 6,
    BADMINTON: 1,
};
const DEFAULT_MAX_STARTERS = 5;

// ─── Component ────────────────────────────────────────────────────

export default function TeamManagerLineupPage() {
    const params = useParams();
    const router = useRouter();
    const toast = useToast();
    const matchId = params.matchId as string;

    const [matchInfo, setMatchInfo] = useState<MatchInfo | null>(null);
    const [lineup, setLineup] = useState<Lineup | null>(null);
    const [availablePlayers, setAvailablePlayers] = useState<Player[]>([]);
    const [availableOfficials, setAvailableOfficials] = useState<TeamOfficialItem[]>([]);
    const [selectedOfficials, setSelectedOfficials] = useState<MatchOfficialEntry[]>([]);
    const [selectedPlayers, setSelectedPlayers] = useState<SelectedPlayer[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [savingOfficials, setSavingOfficials] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [myTeamId, setMyTeamId] = useState<string | null>(null);

    // ─── Data fetching ────────────────────────────────────────────

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const matchesRes = await apiGet<{ data: MatchInfo[]; meta: any }>('/matches/my-team');
            const match = matchesRes.data?.find((m: MatchInfo) => m.id === matchId);

            if (!match) {
                setError('Pertandingan tidak ditemukan atau belum dipublish.');
                setLoading(false);
                return;
            }

            setMatchInfo(match);
            setMyTeamId(match.myTeamId);

            const [lineupRes, playersRes, availOfficialsRes, matchOfficialsRes] = await Promise.all([
                apiGet<Lineup | null>(`/matches/${matchId}/lineups/${match.myTeamId}`).catch(() => null),
                apiGet<Player[]>(`/matches/${matchId}/lineups/${match.myTeamId}/available-players`),
                apiGet<TeamOfficialItem[]>(`/matches/${matchId}/officials/${match.myTeamId}/available`).catch(() => [] as TeamOfficialItem[]),
                apiGet<MatchOfficialEntry[]>(`/matches/${matchId}/officials/${match.myTeamId}`).catch(() => [] as MatchOfficialEntry[]),
            ]);

            if (lineupRes && lineupRes.players) {
                setLineup(lineupRes);

                // Determine max starters from sport type
                const sportType = match.eventCategory?.sportType;
                const maxStart = sportType
                    ? (STARTER_COUNTS[sportType] ?? DEFAULT_MAX_STARTERS)
                    : DEFAULT_MAX_STARTERS;

                // Map lineup players, auto-distributing starters for legacy data
                const mapped = lineupRes.players.map((lp: LineupPlayer, idx: number) => ({
                    playerId: lp.player.id,
                    jerseyNumber: lp.jerseyNumber,
                    isStarter: idx < maxStart ? lp.isStarter : false,
                    isCaptain: lp.isCaptain,
                    player: lp.player,
                }));

                // If ALL were starters (legacy), keep only first maxStart as starters
                const allStarters = lineupRes.players.every((lp: LineupPlayer) => lp.isStarter);
                if (allStarters && lineupRes.players.length > maxStart) {
                    mapped.forEach((p: SelectedPlayer, i: number) => {
                        p.isStarter = i < maxStart;
                    });
                }

                setSelectedPlayers(mapped);
            }

            setAvailablePlayers(Array.isArray(playersRes) ? playersRes : []);
            setAvailableOfficials(Array.isArray(availOfficialsRes) ? availOfficialsRes : []);
            setSelectedOfficials(Array.isArray(matchOfficialsRes) ? matchOfficialsRes : []);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Gagal memuat data pertandingan';
            setError(message);
        } finally {
            setLoading(false);
        }
    }, [matchId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // ─── Derived state ────────────────────────────────────────────

    const maxStarters = matchInfo?.eventCategory?.sportType
        ? (STARTER_COUNTS[matchInfo.eventCategory.sportType] ?? DEFAULT_MAX_STARTERS)
        : DEFAULT_MAX_STARTERS;

    const starters = selectedPlayers.filter((p) => p.isStarter);
    const bench = selectedPlayers.filter((p) => !p.isStarter);
    const selectedPlayerIds = new Set(selectedPlayers.map((p) => p.playerId));
    const unselectedPlayers = availablePlayers.filter((p) => !selectedPlayerIds.has(p.id));

    const isReadOnly = matchInfo?.isLineupLocked || false;
    const canEdit = matchInfo?.canEditLineup || matchInfo?.canSubmitLineup || false;

    // Duplicate jersey detection
    const jerseyCount = new Map<number, number>();
    selectedPlayers.forEach((p) => {
        jerseyCount.set(p.jerseyNumber, (jerseyCount.get(p.jerseyNumber) || 0) + 1);
    });
    const duplicateJerseys = new Set(
        [...jerseyCount.entries()].filter(([, count]) => count > 1).map(([num]) => num),
    );
    const hasDuplicates = duplicateJerseys.size > 0;

    // ─── Helpers ──────────────────────────────────────────────────

    const getNextAvailableNumber = (current: SelectedPlayer[]): number => {
        const used = new Set(current.map((p) => p.jerseyNumber));
        for (let n = 1; n <= 99; n++) {
            if (!used.has(n)) return n;
        }
        return current.length + 1;
    };

    const addPlayer = (player: Player) => {
        if (selectedPlayers.length >= 14) {
            toast.error('Maksimal 14 pemain dalam lineup');
            return;
        }
        if (selectedPlayers.some((p) => p.playerId === player.id)) return;

        setSelectedPlayers((prev) => {
            const currentStarters = prev.filter((p) => p.isStarter).length;
            const defaultNum = player.jerseyNumber && player.jerseyNumber > 0
                ? player.jerseyNumber
                : getNextAvailableNumber(prev);

            return [
                ...prev,
                {
                    playerId: player.id,
                    jerseyNumber: defaultNum,
                    isStarter: currentStarters < maxStarters,
                    isCaptain: false,
                    player,
                },
            ];
        });
    };

    const removePlayer = (playerId: string) => {
        setSelectedPlayers((prev) => prev.filter((p) => p.playerId !== playerId));
    };

    const updateJerseyNumber = (playerId: string, num: number) => {
        setSelectedPlayers((prev) =>
            prev.map((p) => (p.playerId === playerId ? { ...p, jerseyNumber: num } : p)),
        );
    };

    const toggleStarter = (playerId: string) => {
        setSelectedPlayers((prev) => {
            const player = prev.find((p) => p.playerId === playerId);
            if (!player) return prev;

            if (player.isStarter) {
                // Moving to bench — if captain, remove captaincy
                return prev.map((p) =>
                    p.playerId === playerId
                        ? { ...p, isStarter: false, isCaptain: false }
                        : p,
                );
            } else {
                // Moving to starter — check limit
                const currentStarters = prev.filter((p) => p.isStarter).length;
                if (currentStarters >= maxStarters) {
                    toast.error(`Maksimal ${maxStarters} pemain starter`);
                    return prev;
                }
                return prev.map((p) =>
                    p.playerId === playerId ? { ...p, isStarter: true } : p,
                );
            }
        });
    };

    const toggleCaptain = (playerId: string) => {
        setSelectedPlayers((prev) =>
            prev.map((p) => ({
                ...p,
                isCaptain: p.playerId === playerId ? !p.isCaptain : false,
            })),
        );
    };

    // ─── Official selection helpers ────────────────────────────────

    const selectedOfficialIds = new Set(selectedOfficials.map((o) => o.officialId));
    const unselectedOfficials = availableOfficials.filter((o) => !selectedOfficialIds.has(o.id));

    const toggleOfficialSelection = (official: TeamOfficialItem) => {
        if (selectedOfficialIds.has(official.id)) {
            setSelectedOfficials((prev) => prev.filter((o) => o.officialId !== official.id));
        } else {
            setSelectedOfficials((prev) => [
                ...prev,
                {
                    id: '',
                    officialId: official.id,
                    isHeadCoach: false,
                    official,
                },
            ]);
        }
    };

    const toggleHeadCoach = (officialId: string) => {
        setSelectedOfficials((prev) =>
            prev.map((o) => ({
                ...o,
                isHeadCoach: o.officialId === officialId ? !o.isHeadCoach : false,
            })),
        );
    };

    const handleSaveOfficials = async () => {
        if (!myTeamId) return;

        setSavingOfficials(true);
        try {
            const officials = selectedOfficials.map((o) => ({
                officialId: o.officialId,
                isHeadCoach: o.isHeadCoach,
            }));

            await apiPut(`/matches/${matchId}/officials/${myTeamId}`, { officials });
            toast.success('Ofisial pertandingan berhasil disimpan');
            await fetchData();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Gagal menyimpan ofisial';
            toast.error(message);
        } finally {
            setSavingOfficials(false);
        }
    };

    const handleSave = async () => {
        if (!myTeamId || selectedPlayers.length === 0) return;

        setSaving(true);
        try {
            const players = selectedPlayers.map((p) => ({
                playerId: p.playerId,
                jerseyNumber: p.jerseyNumber,
                isStarter: p.isStarter,
                isCaptain: p.isCaptain,
            }));

            if (lineup) {
                await apiPatch(`/matches/${matchId}/lineups/${myTeamId}`, { players });
                toast.success('Lineup berhasil diperbarui');
            } else {
                await apiPost(`/matches/${matchId}/lineups`, { teamId: myTeamId, players });
                toast.success('Lineup berhasil disimpan');
            }

            await fetchData();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Gagal menyimpan lineup';
            toast.error(message);
        } finally {
            setSaving(false);
        }
    };

    // ─── Loading / Error states ───────────────────────────────────

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

    if (error || !matchInfo) {
        return (
            <div className="space-y-6">
                <Card className="p-6">
                    <p className="text-red-400">{error || 'Pertandingan tidak ditemukan'}</p>
                    <Button className="mt-4" onClick={() => router.push('/team-manager/matches')}>
                        Kembali
                    </Button>
                </Card>
            </div>
        );
    }

    // ─── Player card renderer ─────────────────────────────────────

    const renderPlayerCard = (sp: SelectedPlayer, section: 'starter' | 'bench') => (
        <div
            key={sp.playerId}
            className={`flex items-center gap-3 p-3 border rounded-lg transition-colors ${duplicateJerseys.has(sp.jerseyNumber)
                ? 'border-red-500/60 bg-red-900/10'
                : section === 'starter'
                    ? 'bg-emerald-900/10 border-emerald-500/20'
                    : 'bg-slate-800/40 border-white/5'
                }`}
        >
            {/* Jersey number */}
            <div className="w-16 shrink-0">
                <Input
                    type="number"
                    min={1}
                    max={99}
                    value={sp.jerseyNumber}
                    onChange={(e) => updateJerseyNumber(sp.playerId, Number(e.target.value))}
                    className="text-center font-bold text-base px-2 py-2 h-10"
                    disabled={isReadOnly}
                />
            </div>

            {/* Avatar */}
            <div className="h-8 w-8 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden border border-slate-600 shrink-0">
                {sp.player.photoUrl ? (
                    <img src={sp.player.photoUrl} alt={sp.player.fullName} className="h-full w-full object-cover" />
                ) : (
                    <span className="text-xs font-semibold text-slate-400">
                        {sp.player.fullName.charAt(0).toUpperCase()}
                    </span>
                )}
            </div>

            {/* Name + badges */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                    <p className="font-medium text-sm text-slate-100 truncate">
                        {sp.player.fullName}
                    </p>
                    {sp.isCaptain && (
                        <Badge className="bg-amber-600/80 text-amber-100 text-[10px] px-1.5 py-0 leading-4 shrink-0">
                            C
                        </Badge>
                    )}
                </div>
                {sp.player.position && (
                    <p className="text-xs text-slate-500">{sp.player.position}</p>
                )}
                {duplicateJerseys.has(sp.jerseyNumber) && (
                    <p className="text-xs text-red-400 mt-0.5">⚠ Nomor punggung sama</p>
                )}
            </div>

            {/* Actions */}
            {!isReadOnly && (
                <div className="flex items-center gap-1 shrink-0">
                    {/* Captain toggle */}
                    {section === 'starter' && (
                        <button
                            onClick={() => toggleCaptain(sp.playerId)}
                            className={`text-xs px-2 py-1 rounded transition-colors ${sp.isCaptain
                                ? 'bg-amber-600/30 text-amber-300 border border-amber-500/40'
                                : 'text-slate-500 hover:text-amber-300 hover:bg-amber-900/20'
                                }`}
                            title={sp.isCaptain ? 'Hapus kapten' : 'Jadikan kapten'}
                        >
                            C
                        </button>
                    )}

                    {/* Starter/Bench toggle */}
                    <button
                        onClick={() => toggleStarter(sp.playerId)}
                        className="text-xs px-2 py-1 rounded text-slate-400 hover:text-blue-300 hover:bg-blue-900/20 transition-colors"
                        title={sp.isStarter ? 'Pindah ke cadangan' : 'Pindah ke starter'}
                    >
                        {sp.isStarter ? '↓' : '↑'}
                    </button>

                    {/* Remove */}
                    <button
                        onClick={() => removePlayer(sp.playerId)}
                        className="text-red-400 hover:text-red-300 text-sm px-2 py-1 rounded hover:bg-red-900/20 transition-colors"
                    >
                        ✕
                    </button>
                </div>
            )}
        </div>
    );

    // ─── Render ───────────────────────────────────────────────────

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between flex-wrap gap-4">
                <div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push('/team-manager/matches')}
                        className="mb-2"
                    >
                        ← Kembali
                    </Button>
                    <h1 className="text-2xl font-bold text-slate-100">
                        {matchInfo.homeTeam.shortName || matchInfo.homeTeam.name} vs{' '}
                        {matchInfo.awayTeam.shortName || matchInfo.awayTeam.name}
                    </h1>
                    <p className="text-sm text-slate-400 mt-1">
                        {new Date(matchInfo.scheduledAt).toLocaleDateString('id-ID', {
                            weekday: 'long',
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                        })}{' '}
                        – {new Date(matchInfo.scheduledAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                        {matchInfo.venue ? ` • ${matchInfo.venue}` : ''}
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    {isReadOnly && (
                        <Badge className="bg-yellow-900/50 text-yellow-300">🔒 Lineup Terkunci</Badge>
                    )}
                    {!isReadOnly && canEdit && (
                        <Button onClick={handleSave} disabled={saving || selectedPlayers.length === 0 || hasDuplicates}>
                            {saving ? (
                                <Spinner className="w-4 h-4" />
                            ) : lineup ? (
                                'Perbarui Lineup'
                            ) : (
                                'Simpan Lineup'
                            )}
                        </Button>
                    )}
                </div>
            </div>

            {isReadOnly && (
                <Card className="p-4 border-yellow-500/30 bg-yellow-900/10">
                    <p className="text-sm text-yellow-300">
                        Lineup sudah terkunci karena pertandingan telah dimulai. Anda hanya bisa melihat lineup.
                    </p>
                </Card>
            )}

            {/* ═══ Main Grid: Left (Starter+Bench) | Right (Available) ═══ */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left column — Starter + Bench */}
                <div className="space-y-6">
                    {/* Section 1: Starter */}
                    <Card className="p-5 border-emerald-500/20">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-slate-100">
                                ⚽ Starter ({starters.length}/{maxStarters})
                            </h2>
                            {starters.length > 0 && starters.length < maxStarters && (
                                <span className="text-xs text-emerald-400">
                                    Perlu {maxStarters - starters.length} lagi
                                </span>
                            )}
                        </div>

                        {starters.length === 0 ? (
                            <div className="py-6 text-center text-slate-500">
                                <p className="text-sm">Belum ada pemain starter.</p>
                                <p className="text-xs mt-1">Pilih pemain dari daftar Pemain Tersedia.</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {starters.map((sp) => renderPlayerCard(sp, 'starter'))}
                            </div>
                        )}
                    </Card>

                    {/* Section 2: Bench */}
                    <Card className="p-5">
                        <h2 className="text-lg font-semibold text-slate-100 mb-4">
                            🪑 Cadangan ({bench.length})
                        </h2>

                        {bench.length === 0 ? (
                            <div className="py-6 text-center text-slate-500">
                                <p className="text-sm">Belum ada pemain cadangan.</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {bench.map((sp) => renderPlayerCard(sp, 'bench'))}
                            </div>
                        )}
                    </Card>
                </div>

                {/* Right column — Available Players */}
                <Card className="p-5 h-fit">
                    <h2 className="text-lg font-semibold text-slate-100 mb-4">
                        Pemain Tersedia ({unselectedPlayers.length})
                    </h2>

                    {unselectedPlayers.length === 0 ? (
                        <div className="py-8 text-center text-slate-500">
                            <p className="text-sm">
                                {availablePlayers.length === 0
                                    ? 'Belum ada pemain terdaftar di roster kategori ini.'
                                    : 'Semua pemain sudah dipilih.'}
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                            {unselectedPlayers.map((player) => (
                                <button
                                    key={player.id}
                                    onClick={() => !isReadOnly && addPlayer(player)}
                                    disabled={isReadOnly || selectedPlayers.length >= 14}
                                    className="w-full flex items-center gap-3 p-3 bg-slate-800/40 border border-white/5 rounded-lg hover:bg-slate-700/50 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <span className="w-8 text-center font-mono text-sm text-slate-400">
                                        {player.jerseyNumber ?? '-'}
                                    </span>
                                    <div className="h-8 w-8 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden border border-slate-600 shrink-0">
                                        {player.photoUrl ? (
                                            <img src={player.photoUrl} alt={player.fullName} className="h-full w-full object-cover" />
                                        ) : (
                                            <span className="text-xs font-semibold text-slate-400">
                                                {player.fullName.charAt(0).toUpperCase()}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-sm text-slate-200 truncate">
                                            {player.fullName}
                                        </p>
                                        {player.position && (
                                            <p className="text-xs text-slate-500">{player.position}</p>
                                        )}
                                    </div>
                                    {!isReadOnly && selectedPlayers.length < 14 && (
                                        <span className="text-emerald-400 text-sm">+ Tambah</span>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                </Card>
            </div>

            {/* Section 4: Officials — Manual Selection */}
            <Card className="p-5">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-slate-100">
                        Tim Ofisial ({selectedOfficials.length})
                    </h2>
                    {!isReadOnly && canEdit && (
                        <Button
                            size="sm"
                            onClick={handleSaveOfficials}
                            disabled={savingOfficials}
                        >
                            {savingOfficials ? <Spinner className="w-4 h-4" /> : 'Simpan Ofisial'}
                        </Button>
                    )}
                </div>

                {availableOfficials.length === 0 ? (
                    <div className="py-6 text-center text-slate-500">
                        <p className="text-sm">Belum ada ofisial di tim Anda.</p>
                        <p className="text-xs mt-1">Tambahkan ofisial di halaman Ofisial Tim terlebih dahulu.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Selected Officials */}
                        <div>
                            <p className="text-sm font-medium text-slate-400 mb-2">Terpilih</p>
                            {selectedOfficials.length === 0 ? (
                                <div className="py-4 text-center text-slate-500 text-sm border border-dashed border-slate-700 rounded-lg">
                                    Belum ada ofisial dipilih
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {selectedOfficials.map((mo) => (
                                        <div
                                            key={mo.officialId}
                                            className={`flex items-center gap-3 p-3 border rounded-lg ${
                                                mo.isHeadCoach
                                                    ? 'bg-amber-900/10 border-amber-500/30'
                                                    : 'bg-emerald-900/10 border-emerald-500/20'
                                            }`}
                                        >
                                            {mo.official?.photoUrl ? (
                                                <img
                                                    src={mo.official.photoUrl}
                                                    alt={mo.official.fullName}
                                                    className="w-10 h-10 rounded-full object-cover border border-white/10"
                                                />
                                            ) : (
                                                <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-slate-400 text-sm font-semibold border border-white/10">
                                                    {mo.official?.fullName?.charAt(0).toUpperCase()}
                                                </div>
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-1.5">
                                                    <p className="font-medium text-sm text-slate-200 truncate">
                                                        {mo.official?.fullName}
                                                    </p>
                                                    {mo.isHeadCoach && (
                                                        <Badge className="bg-amber-600/80 text-amber-100 text-[10px] px-1.5 py-0 leading-4 shrink-0">
                                                            HC
                                                        </Badge>
                                                    )}
                                                </div>
                                                <p className="text-xs text-slate-500">
                                                    {ROLE_LABELS[mo.official?.role ?? ''] || mo.official?.role}
                                                </p>
                                            </div>
                                            {!isReadOnly && (
                                                <div className="flex items-center gap-1 shrink-0">
                                                    <button
                                                        onClick={() => toggleHeadCoach(mo.officialId)}
                                                        className={`text-xs px-2 py-1 rounded transition-colors ${
                                                            mo.isHeadCoach
                                                                ? 'bg-amber-600/30 text-amber-300 border border-amber-500/40'
                                                                : 'text-slate-500 hover:text-amber-300 hover:bg-amber-900/20'
                                                        }`}
                                                        title={mo.isHeadCoach ? 'Hapus Head Coach' : 'Jadikan Head Coach'}
                                                    >
                                                        HC
                                                    </button>
                                                    <button
                                                        onClick={() => toggleOfficialSelection(mo.official)}
                                                        className="text-red-400 hover:text-red-300 text-sm px-2 py-1 rounded hover:bg-red-900/20 transition-colors"
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Available Officials */}
                        <div>
                            <p className="text-sm font-medium text-slate-400 mb-2">Tersedia</p>
                            {unselectedOfficials.length === 0 ? (
                                <div className="py-4 text-center text-slate-500 text-sm border border-dashed border-slate-700 rounded-lg">
                                    Semua ofisial sudah dipilih
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {unselectedOfficials.map((official) => (
                                        <button
                                            key={official.id}
                                            onClick={() => !isReadOnly && toggleOfficialSelection(official)}
                                            disabled={isReadOnly}
                                            className="w-full flex items-center gap-3 p-3 bg-slate-800/40 border border-white/5 rounded-lg hover:bg-slate-700/50 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {official.photoUrl ? (
                                                <img
                                                    src={official.photoUrl}
                                                    alt={official.fullName}
                                                    className="w-10 h-10 rounded-full object-cover border border-white/10"
                                                />
                                            ) : (
                                                <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-slate-400 text-sm font-semibold border border-white/10">
                                                    {official.fullName.charAt(0).toUpperCase()}
                                                </div>
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-sm text-slate-200 truncate">
                                                    {official.fullName}
                                                </p>
                                                <p className="text-xs text-slate-500">
                                                    {ROLE_LABELS[official.role] || official.role}
                                                </p>
                                            </div>
                                            {!isReadOnly && (
                                                <span className="text-emerald-400 text-sm">+ Pilih</span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </Card>
        </div>
    );
}

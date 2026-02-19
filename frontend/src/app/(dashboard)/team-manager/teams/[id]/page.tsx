'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';

interface Team {
  id: string;
  name: string;
  shortName?: string;
  slug: string;
  city?: string;
  country?: string;
  sportType?: string;
}

interface Player {
  id: string;
  fullName: string;
  jerseyNumber?: number;
  position?: string;
  nationality?: string;
  teamId: string;
}

interface Match {
  id: string;
  homeTeamId: string;
  awayTeamId: string;
  homeTeam?: { id: string; name: string; shortName?: string; logoUrl?: string };
  awayTeam?: { id: string; name: string; shortName?: string; logoUrl?: string };
  matchScore?: { homeScore: number; awayScore: number };
  status: string;
  scheduledAt?: string;
  tournament?: { id: string; name: string; type: string };
}

interface Lineup {
  matchId: string;
  players: LineupPlayer[];
  formation?: string;
}

interface LineupPlayer {
  playerId: string;
  position?: string;
  isStarter: boolean;
}

interface PlayerFormData {
  fullName: string;
  jerseyNumber: number | '';
  sportType: string;
  position: string;
  nationality: string;
  dateOfBirth: string;
}

const defaultPlayerForm: PlayerFormData = {
  fullName: '',
  jerseyNumber: '',
  sportType: '',
  position: '',
  nationality: '',
  dateOfBirth: '',
};

const COUNTRIES = [
  { code: 'ID', name: 'Indonesia', flag: '\u{1F1EE}\u{1F1E9}' },
  { code: 'MY', name: 'Malaysia', flag: '\u{1F1F2}\u{1F1FE}' },
  { code: 'SG', name: 'Singapura', flag: '\u{1F1F8}\u{1F1EC}' },
  { code: 'TH', name: 'Thailand', flag: '\u{1F1F9}\u{1F1ED}' },
  { code: 'PH', name: 'Filipina', flag: '\u{1F1F5}\u{1F1ED}' },
  { code: 'VN', name: 'Vietnam', flag: '\u{1F1FB}\u{1F1F3}' },
  { code: 'MM', name: 'Myanmar', flag: '\u{1F1F2}\u{1F1F2}' },
  { code: 'KH', name: 'Kamboja', flag: '\u{1F1F0}\u{1F1ED}' },
  { code: 'LA', name: 'Laos', flag: '\u{1F1F1}\u{1F1E6}' },
  { code: 'BN', name: 'Brunei', flag: '\u{1F1E7}\u{1F1F3}' },
  { code: 'TL', name: 'Timor Leste', flag: '\u{1F1F9}\u{1F1F1}' },
  { code: 'JP', name: 'Jepang', flag: '\u{1F1EF}\u{1F1F5}' },
  { code: 'KR', name: 'Korea Selatan', flag: '\u{1F1F0}\u{1F1F7}' },
  { code: 'CN', name: 'Tiongkok', flag: '\u{1F1E8}\u{1F1F3}' },
  { code: 'AU', name: 'Australia', flag: '\u{1F1E6}\u{1F1FA}' },
  { code: 'IN', name: 'India', flag: '\u{1F1EE}\u{1F1F3}' },
  { code: 'SA', name: 'Arab Saudi', flag: '\u{1F1F8}\u{1F1E6}' },
  { code: 'AE', name: 'Uni Emirat Arab', flag: '\u{1F1E6}\u{1F1EA}' },
  { code: 'QA', name: 'Qatar', flag: '\u{1F1F6}\u{1F1E6}' },
  { code: 'BR', name: 'Brasil', flag: '\u{1F1E7}\u{1F1F7}' },
  { code: 'AR', name: 'Argentina', flag: '\u{1F1E6}\u{1F1F7}' },
  { code: 'DE', name: 'Jerman', flag: '\u{1F1E9}\u{1F1EA}' },
  { code: 'FR', name: 'Prancis', flag: '\u{1F1EB}\u{1F1F7}' },
  { code: 'ES', name: 'Spanyol', flag: '\u{1F1EA}\u{1F1F8}' },
  { code: 'IT', name: 'Italia', flag: '\u{1F1EE}\u{1F1F9}' },
  { code: 'GB', name: 'Inggris', flag: '\u{1F1EC}\u{1F1E7}' },
  { code: 'PT', name: 'Portugal', flag: '\u{1F1F5}\u{1F1F9}' },
  { code: 'NL', name: 'Belanda', flag: '\u{1F1F3}\u{1F1F1}' },
  { code: 'US', name: 'Amerika Serikat', flag: '\u{1F1FA}\u{1F1F8}' },
  { code: 'NG', name: 'Nigeria', flag: '\u{1F1F3}\u{1F1EC}' },
  { code: 'GH', name: 'Ghana', flag: '\u{1F1EC}\u{1F1ED}' },
  { code: 'CM', name: 'Kamerun', flag: '\u{1F1E8}\u{1F1F2}' },
  { code: 'SN', name: 'Senegal', flag: '\u{1F1F8}\u{1F1F3}' },
  { code: 'EG', name: 'Mesir', flag: '\u{1F1EA}\u{1F1EC}' },
  { code: 'MA', name: 'Maroko', flag: '\u{1F1F2}\u{1F1E6}' },
  { code: 'HR', name: 'Kroasia', flag: '\u{1F1ED}\u{1F1F7}' },
  { code: 'BE', name: 'Belgia', flag: '\u{1F1E7}\u{1F1EA}' },
  { code: 'UY', name: 'Uruguay', flag: '\u{1F1FA}\u{1F1FE}' },
  { code: 'CO', name: 'Kolombia', flag: '\u{1F1E8}\u{1F1F4}' },
  { code: 'MX', name: 'Meksiko', flag: '\u{1F1F2}\u{1F1FD}' },
  { code: 'TR', name: 'Turki', flag: '\u{1F1F9}\u{1F1F7}' },
];

function getCountryFlag(nationality?: string): string {
  if (!nationality) return '';
  const country = COUNTRIES.find(
    (c) => c.name === nationality || c.code === nationality,
  );
  return country?.flag || '';
}

const sportLabel: Record<string, string> = {
  FOOTBALL: 'Sepak Bola', FUTSAL: 'Futsal', BASKETBALL: 'Basket',
  VOLLEYBALL: 'Voli', HANDBALL: 'Bola Tangan', HOCKEY: 'Hoki',
  TENNIS: 'Tenis', BADMINTON: 'Bulu Tangkis', TABLE_TENNIS: 'Tenis Meja',
  RUGBY: 'Rugby', BASEBALL: 'Baseball', SOFTBALL: 'Softball',
  CRICKET: 'Kriket', OTHER: 'Lainnya',
};

const SPORT_POSITIONS: Record<string, { value: string; label: string }[]> = {
  FOOTBALL: [
    { value: 'Goalkeeper', label: 'Penjaga Gawang (GK)' },
    { value: 'Defender', label: 'Bek (DF)' },
    { value: 'Midfielder', label: 'Gelandang (MF)' },
    { value: 'Forward', label: 'Penyerang (FW)' },
  ],
  FUTSAL: [
    { value: 'Goalkeeper', label: 'Penjaga Gawang (GK)' },
    { value: 'Anchor', label: 'Anchor' },
    { value: 'Pivot', label: 'Pivot' },
    { value: 'Flank', label: 'Flank' },
  ],
  BASKETBALL: [
    { value: 'Point Guard', label: 'Point Guard (PG)' },
    { value: 'Shooting Guard', label: 'Shooting Guard (SG)' },
    { value: 'Small Forward', label: 'Small Forward (SF)' },
    { value: 'Power Forward', label: 'Power Forward (PF)' },
    { value: 'Center', label: 'Center (C)' },
  ],
  VOLLEYBALL: [
    { value: 'Setter', label: 'Setter (S)' },
    { value: 'Outside Hitter', label: 'Outside Hitter (OH)' },
    { value: 'Middle Blocker', label: 'Middle Blocker (MB)' },
    { value: 'Opposite Hitter', label: 'Opposite Hitter (OPP)' },
    { value: 'Libero', label: 'Libero (L)' },
  ],
  HANDBALL: [
    { value: 'Goalkeeper', label: 'Penjaga Gawang (GK)' },
    { value: 'Left Wing', label: 'Sayap Kiri (LW)' },
    { value: 'Right Wing', label: 'Sayap Kanan (RW)' },
    { value: 'Left Back', label: 'Bek Kiri (LB)' },
    { value: 'Right Back', label: 'Bek Kanan (RB)' },
    { value: 'Center Back', label: 'Bek Tengah (CB)' },
    { value: 'Pivot', label: 'Pivot (P)' },
  ],
  HOCKEY: [
    { value: 'Goalkeeper', label: 'Penjaga Gawang (GK)' },
    { value: 'Defender', label: 'Bek' },
    { value: 'Midfielder', label: 'Gelandang' },
    { value: 'Forward', label: 'Penyerang' },
  ],
  TENNIS: [
    { value: 'Singles', label: 'Tunggal' },
    { value: 'Doubles', label: 'Ganda' },
  ],
  BADMINTON: [
    { value: 'Singles', label: 'Tunggal' },
    { value: 'Doubles', label: 'Ganda' },
    { value: 'Mixed Doubles', label: 'Ganda Campuran' },
  ],
  TABLE_TENNIS: [
    { value: 'Singles', label: 'Tunggal' },
    { value: 'Doubles', label: 'Ganda' },
  ],
  RUGBY: [
    { value: 'Prop', label: 'Prop' },
    { value: 'Hooker', label: 'Hooker' },
    { value: 'Lock', label: 'Lock' },
    { value: 'Flanker', label: 'Flanker' },
    { value: 'Number Eight', label: 'Number Eight' },
    { value: 'Scrum-Half', label: 'Scrum-Half' },
    { value: 'Fly-Half', label: 'Fly-Half' },
    { value: 'Center', label: 'Center' },
    { value: 'Wing', label: 'Wing' },
    { value: 'Full-Back', label: 'Full-Back' },
  ],
  BASEBALL: [
    { value: 'Pitcher', label: 'Pitcher' },
    { value: 'Catcher', label: 'Catcher' },
    { value: 'First Baseman', label: 'First Baseman' },
    { value: 'Second Baseman', label: 'Second Baseman' },
    { value: 'Third Baseman', label: 'Third Baseman' },
    { value: 'Shortstop', label: 'Shortstop' },
    { value: 'Outfielder', label: 'Outfielder' },
  ],
  SOFTBALL: [
    { value: 'Pitcher', label: 'Pitcher' },
    { value: 'Catcher', label: 'Catcher' },
    { value: 'Infielder', label: 'Infielder' },
    { value: 'Outfielder', label: 'Outfielder' },
  ],
  CRICKET: [
    { value: 'Batsman', label: 'Batsman' },
    { value: 'Bowler', label: 'Bowler' },
    { value: 'All-Rounder', label: 'All-Rounder' },
    { value: 'Wicket-Keeper', label: 'Wicket-Keeper' },
  ],
  OTHER: [
    { value: 'Other', label: 'Lainnya' },
  ],
};

const statusColors: Record<string, string> = {
  SCHEDULED: 'bg-blue-900/50 text-blue-300',
  LIVE: 'bg-red-900/50 text-red-300',
  IN_PROGRESS: 'bg-orange-900/50 text-orange-300',
  COMPLETED: 'bg-green-900/50 text-green-300',
  FINISHED: 'bg-green-900/50 text-green-300',
  CANCELLED: 'bg-slate-700/50 text-slate-300',
};

export default function TeamDetailPage() {
  const params = useParams();
  const teamId = params.id as string;
  const toast = useToast();

  const [team, setTeam] = useState<Team | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('players');

  // Edit team
  const [editingTeam, setEditingTeam] = useState(false);
  const [teamForm, setTeamForm] = useState<Partial<Team>>({});
  const [savingTeam, setSavingTeam] = useState(false);

  // Player modal
  const [playerModalOpen, setPlayerModalOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [playerForm, setPlayerForm] = useState<PlayerFormData>(defaultPlayerForm);
  const [playerFormErrors, setPlayerFormErrors] = useState<Partial<Record<keyof PlayerFormData, string>>>({});
  const [submittingPlayer, setSubmittingPlayer] = useState(false);
  const [deletingPlayerId, setDeletingPlayerId] = useState<string | null>(null);

  // Lineup
  const [lineupModalOpen, setLineupModalOpen] = useState(false);
  const [lineupMatchId, setLineupMatchId] = useState<string | null>(null);
  const [lineupFormation, setLineupFormation] = useState('');
  const [selectedStarters, setSelectedStarters] = useState<Set<string>>(new Set());
  const [selectedSubs, setSelectedSubs] = useState<Set<string>>(new Set());
  const [savingLineup, setSavingLineup] = useState(false);

  const fetchTeamData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [teamRes, playersRes, matchesRes] = await Promise.all([
        apiGet<Team>(`/teams/${teamId}`),
        apiGet<Player[] | { data: Player[] }>(`/teams/${teamId}/players`).catch(() => []),
        apiGet<Match[] | { data: Match[] }>(`/teams/${teamId}/matches`).catch(() => []),
      ]);

      setTeam(teamRes);
      setTeamForm(teamRes);
      setPlayers(
        Array.isArray(playersRes) ? playersRes : (playersRes as { data: Player[] }).data ?? []
      );
      setMatches(
        Array.isArray(matchesRes) ? matchesRes : (matchesRes as { data: Match[] }).data ?? []
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load team';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    fetchTeamData();
  }, [fetchTeamData]);

  // Team edit handlers
  const handleSaveTeam = async () => {
    setSavingTeam(true);
    try {
      const updated = await apiPatch<Team>(`/teams/${teamId}`, {
        name: teamForm.name,
        shortName: teamForm.shortName,
        city: teamForm.city,
        country: teamForm.country,
      });
      setTeam((prev) => (prev ? { ...prev, ...updated } : updated));
      setEditingTeam(false);
      toast.success('Tim berhasil diperbarui');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal memperbarui tim';
      toast.error(message);
    } finally {
      setSavingTeam(false);
    }
  };

  // Player handlers
  const openCreatePlayerModal = () => {
    setEditingPlayer(null);
    setPlayerForm({
      ...defaultPlayerForm,
      sportType: team?.sportType || '',
    });
    setPlayerFormErrors({});
    setPlayerModalOpen(true);
  };

  const openEditPlayerModal = (player: Player) => {
    setEditingPlayer(player);
    setPlayerForm({
      fullName: player.fullName,
      jerseyNumber: player.jerseyNumber ?? '',
      dateOfBirth: '',
      sportType: team?.sportType || '',
      position: player.position ?? '',
      nationality: player.nationality ?? '',
    });
    setPlayerFormErrors({});
    setPlayerModalOpen(true);
  };

  const closePlayerModal = () => {
    setPlayerModalOpen(false);
    setEditingPlayer(null);
    setPlayerForm(defaultPlayerForm);
    setPlayerFormErrors({});
  };

  const validatePlayerForm = (): boolean => {
    const errors: Partial<Record<keyof PlayerFormData, string>> = {};
    if (!playerForm.fullName.trim()) errors.fullName = 'Nama lengkap wajib diisi';
    setPlayerFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmitPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validatePlayerForm()) return;

    setSubmittingPlayer(true);
    try {
      const payload = {
        fullName: playerForm.fullName.trim(),
        jerseyNumber: playerForm.jerseyNumber !== '' ? Number(playerForm.jerseyNumber) : undefined,
        position: playerForm.position || undefined,
        dateOfBirth: playerForm.dateOfBirth || undefined,
        nationality: playerForm.nationality.trim() || undefined,
      };

      if (editingPlayer) {
        const updated = await apiPatch<Player>(
          `/players/${editingPlayer.id}`,
          payload
        );
        setPlayers((prev) =>
          prev.map((p) =>
            p.id === editingPlayer.id ? { ...p, ...updated } : p
          )
        );
        toast.success('Pemain berhasil diperbarui');
      } else {
        const created = await apiPost<Player>(
          `/teams/${teamId}/players`,
          payload
        );
        setPlayers((prev) => [...prev, created]);
        toast.success('Pemain berhasil ditambahkan');
      }
      closePlayerModal();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal menyimpan pemain';
      toast.error(message);
    } finally {
      setSubmittingPlayer(false);
    }
  };

  const handleDeletePlayer = async (playerId: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus pemain ini?')) return;
    setDeletingPlayerId(playerId);
    try {
      await apiDelete(`/players/${playerId}`);
      setPlayers((prev) => prev.filter((p) => p.id !== playerId));
      toast.success('Pemain berhasil dihapus');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal menghapus pemain';
      toast.error(message);
    } finally {
      setDeletingPlayerId(null);
    }
  };

  // Lineup handlers
  const openLineupModal = (matchId: string) => {
    setLineupMatchId(matchId);
    setLineupFormation('');
    setSelectedStarters(new Set());
    setSelectedSubs(new Set());
    setLineupModalOpen(true);
  };

  const toggleStarter = (playerId: string) => {
    setSelectedStarters((prev) => {
      const next = new Set(prev);
      if (next.has(playerId)) {
        next.delete(playerId);
      } else {
        next.add(playerId);
        // Remove from subs if in starters
        setSelectedSubs((s) => {
          const ns = new Set(s);
          ns.delete(playerId);
          return ns;
        });
      }
      return next;
    });
  };

  const toggleSub = (playerId: string) => {
    setSelectedSubs((prev) => {
      const next = new Set(prev);
      if (next.has(playerId)) {
        next.delete(playerId);
      } else {
        next.add(playerId);
        // Remove from starters if in subs
        setSelectedStarters((s) => {
          const ns = new Set(s);
          ns.delete(playerId);
          return ns;
        });
      }
      return next;
    });
  };

  const handleSaveLineup = async () => {
    if (!lineupMatchId) return;
    setSavingLineup(true);
    try {
      const lineupPlayers: LineupPlayer[] = [
        ...Array.from(selectedStarters).map((playerId) => ({
          playerId,
          isStarter: true,
        })),
        ...Array.from(selectedSubs).map((playerId) => ({
          playerId,
          isStarter: false,
        })),
      ];

      await apiPost(`/matches/${lineupMatchId}/lineups`, {
        teamId,
        players: lineupPlayers,
        formation: lineupFormation || undefined,
      });

      toast.success('Susunan pemain berhasil disimpan');
      setLineupModalOpen(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal menyimpan susunan pemain';
      toast.error(message);
    } finally {
      setSavingLineup(false);
    }
  };

  // Computed values
  const upcomingMatches = matches.filter(
    (m) => m.status === 'SCHEDULED' || m.status === 'LIVE' || m.status === 'IN_PROGRESS'
  );
  const pastMatches = matches.filter(
    (m) => m.status === 'COMPLETED' || m.status === 'FINISHED'
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 rounded-lg" />
        <Skeleton className="h-96 rounded-lg" />
      </div>
    );
  }

  if (error || !team) {
    return (
      <div className="space-y-6">
        <Card className="p-6">
          <p className="text-red-600">Error: {error || 'Tim tidak ditemukan'}</p>
          <Button className="mt-4" onClick={fetchTeamData}>
            Coba Lagi
          </Button>
        </Card>
      </div>
    );
  }

  const tabs = [
    { id: 'players', label: `Pemain (${players.length})` },
    { id: 'matches', label: `Pertandingan (${matches.length})` },
    { id: 'lineups', label: 'Susunan Pemain' },
  ];

  return (
    <div className="space-y-6">
      {/* Team Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">{team.name}</h1>
          <div className="flex items-center gap-2 mt-1 text-sm text-slate-400">
            {team.shortName && <span>{team.shortName}</span>}
            {team.city && <span>{team.city}</span>}
            {team.country && <span>{team.country}</span>}
          </div>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            setEditingTeam(!editingTeam);
            setTeamForm(team);
          }}
        >
          {editingTeam ? 'Batal' : 'Ubah Tim'}
        </Button>
      </div>

      {/* Edit Team Form */}
      {editingTeam && (
        <Card className="p-6">
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Nama
                </label>
                <Input
                  value={teamForm.name || ''}
                  onChange={(e) =>
                    setTeamForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Nama Singkat
                </label>
                <Input
                  value={teamForm.shortName || ''}
                  onChange={(e) =>
                    setTeamForm((prev) => ({
                      ...prev,
                      shortName: e.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Kota
                </label>
                <Input
                  value={teamForm.city || ''}
                  onChange={(e) =>
                    setTeamForm((prev) => ({ ...prev, city: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Negara
                </label>
                <Input
                  value={teamForm.country || ''}
                  onChange={(e) =>
                    setTeamForm((prev) => ({
                      ...prev,
                      country: e.target.value,
                    }))
                  }
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSaveTeam} disabled={savingTeam}>
                {savingTeam ? <Spinner className="w-4 h-4" /> : 'Simpan'}
              </Button>
              <Button variant="outline" onClick={() => setEditingTeam(false)}>
                Batal
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Tabs */}
      <div className="border-b border-white/10">
        <nav className="flex gap-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.id
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-300'
                }`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Players Tab */}
      {activeTab === 'players' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={openCreatePlayerModal}>Tambah Pemain</Button>
          </div>

          {players.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-slate-500 mb-4">Belum ada pemain ditambahkan.</p>
              <Button onClick={openCreatePlayerModal}>Tambah Pemain</Button>
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-800/60 border-b border-white/10">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                        #
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                        Nama
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                        Posisi
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                        Kebangsaan
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                        Aksi
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {players.map((player) => (
                      <tr key={player.id} className="hover:bg-white/5">
                        <td className="px-4 py-3 text-sm font-mono">
                          {player.jerseyNumber ?? '-'}
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-medium">
                            {player.fullName}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-400">
                          {player.position || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-400">
                          {player.nationality ? (
                            <span className="inline-flex items-center gap-1.5">
                              <span>{getCountryFlag(player.nationality)}</span>
                              <span>{player.nationality}</span>
                            </span>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEditPlayerModal(player)}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              disabled={deletingPlayerId === player.id}
                              onClick={() => handleDeletePlayer(player.id)}
                            >
                              {deletingPlayerId === player.id ? (
                                <Spinner className="w-4 h-4" />
                              ) : (
                                'Hapus'
                              )}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Player Modal */}
          <Modal open={playerModalOpen} onClose={closePlayerModal}>
            <form onSubmit={handleSubmitPlayer} className="space-y-4">
              <h2 className="text-xl font-bold">
                {editingPlayer ? 'Edit Pemain' : 'Tambah Pemain'}
              </h2>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Nama Lengkap <span className="text-red-400">*</span>
                </label>
                <Input
                  value={playerForm.fullName}
                  onChange={(e) =>
                    setPlayerForm((prev) => ({
                      ...prev,
                      fullName: e.target.value,
                    }))
                  }
                  placeholder="Nama lengkap pemain"
                />
                {playerFormErrors.fullName && (
                  <p className="text-red-500 text-xs mt-1">
                    {playerFormErrors.fullName}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Nomor Punggung
                </label>
                <Input
                  type="number"
                  min={0}
                  max={99}
                  value={playerForm.jerseyNumber}
                  onChange={(e) =>
                    setPlayerForm((prev) => ({
                      ...prev,
                      jerseyNumber:
                        e.target.value === '' ? '' : Number(e.target.value),
                    }))
                  }
                  placeholder="cth. 10"
                />
              </div>

              {/* Sport selector → drives position options */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Olahraga
                </label>
                <Select
                  value={playerForm.sportType}
                  onChange={(e) =>
                    setPlayerForm((prev) => ({
                      ...prev,
                      sportType: e.target.value,
                      position: '',
                    }))
                  }
                  className="w-full"
                >
                  <option value="">-- Pilih Olahraga --</option>
                  {Object.keys(SPORT_POSITIONS).map((sport) => (
                    <option key={sport} value={sport}>
                      {sportLabel[sport] || sport}
                    </option>
                  ))}
                </Select>
              </div>

              {/* Position selector → filtered by sport */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Posisi
                </label>
                <Select
                  value={playerForm.position}
                  onChange={(e) =>
                    setPlayerForm((prev) => ({
                      ...prev,
                      position: e.target.value,
                    }))
                  }
                  className="w-full"
                  disabled={!playerForm.sportType}
                >
                  <option value="">
                    {playerForm.sportType
                      ? '-- Pilih Posisi --'
                      : '-- Pilih olahraga terlebih dahulu --'}
                  </option>
                  {(SPORT_POSITIONS[playerForm.sportType] || []).map((pos) => (
                    <option key={pos.value} value={pos.value}>
                      {pos.label}
                    </option>
                  ))}
                </Select>
              </div>

              {/* Nationality selector with flags */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Kebangsaan
                </label>
                <Select
                  value={playerForm.nationality}
                  onChange={(e) =>
                    setPlayerForm((prev) => ({
                      ...prev,
                      nationality: e.target.value,
                    }))
                  }
                  className="w-full"
                >
                  <option value="">-- Pilih Kebangsaan --</option>
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.name}>
                      {c.flag} {c.name}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={closePlayerModal}
                >
                  Batal
                </Button>
                <Button type="submit" disabled={submittingPlayer}>
                  {submittingPlayer ? (
                    <Spinner className="w-4 h-4" />
                  ) : editingPlayer ? (
                    'Perbarui Pemain'
                  ) : (
                    'Tambah Pemain'
                  )}
                </Button>
              </div>
            </form>
          </Modal>
        </div>
      )}

      {/* Matches Tab */}
      {activeTab === 'matches' && (
        <div className="space-y-6">
          {matches.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-slate-500">Belum ada pertandingan untuk tim ini.</p>
            </Card>
          ) : (
            <>
              {/* Upcoming Matches */}
              {upcomingMatches.length > 0 && (
                <div>
                  <h3 className="font-semibold text-lg mb-3">
                    Pertandingan Mendatang
                  </h3>
                  <div className="space-y-3">
                    {upcomingMatches.map((match) => (
                      <Card key={match.id} className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4 flex-1">
                            <span className="font-medium text-right flex-1 truncate">
                              {match.homeTeam?.name || match.homeTeamId}
                            </span>
                            <span className="text-slate-500 shrink-0">vs</span>
                            <span className="font-medium flex-1 truncate">
                              {match.awayTeam?.name || match.awayTeamId}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 ml-4">
                            <Badge
                              className={
                                statusColors[match.status] ||
                                'bg-slate-700/50 text-slate-300'
                              }
                            >
                              {match.status}
                            </Badge>
                            {match.scheduledAt && (
                              <span className="text-xs text-slate-400">
                                {new Date(
                                  match.scheduledAt
                                ).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Past Matches */}
              {pastMatches.length > 0 && (
                <div>
                  <h3 className="font-semibold text-lg mb-3">Pertandingan Selesai</h3>
                  <div className="space-y-3">
                    {pastMatches.map((match) => (
                      <Card key={match.id} className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4 flex-1">
                            <span className="font-medium text-right flex-1 truncate">
                              {match.homeTeam?.name || match.homeTeamId}
                            </span>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-xl font-bold">
                                {match.matchScore?.homeScore ?? '-'}
                              </span>
                              <span className="text-slate-500">-</span>
                              <span className="text-xl font-bold">
                                {match.matchScore?.awayScore ?? '-'}
                              </span>
                            </div>
                            <span className="font-medium flex-1 truncate">
                              {match.awayTeam?.name || match.awayTeamId}
                            </span>
                          </div>
                          <Badge
                            className={`ml-4 ${statusColors[match.status] ||
                              'bg-slate-700/50 text-slate-300'
                              }`}
                          >
                            {match.status}
                          </Badge>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Lineups Tab */}
      {activeTab === 'lineups' && (
        <div className="space-y-4">
          {upcomingMatches.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-slate-500">
                Tidak ada pertandingan mendatang untuk mengatur susunan pemain.
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {upcomingMatches.map((match) => (
                <Card key={match.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {match.homeTeam?.name || match.homeTeamId}
                        </span>
                        <span className="text-slate-500">vs</span>
                        <span className="font-medium">
                          {match.awayTeam?.name || match.awayTeamId}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge
                          className={
                            statusColors[match.status] ||
                            'bg-slate-700/50 text-slate-300'
                          }
                        >
                          {match.status}
                        </Badge>
                        {match.scheduledAt && (
                          <span className="text-xs text-slate-400">
                            {new Date(match.scheduledAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => openLineupModal(match.id)}
                      disabled={players.length === 0}
                    >
                      Atur Susunan
                    </Button>
                  </div>
                </Card>
              ))}
              {players.length === 0 && (
                <p className="text-sm text-amber-600 text-center">
                  Tambahkan pemain ke tim terlebih dahulu sebelum mengatur susunan.
                </p>
              )}
            </div>
          )}

          {/* Lineup Modal */}
          <Modal
            open={lineupModalOpen}
            onClose={() => setLineupModalOpen(false)}
          >
            <div className="space-y-4">
              <h2 className="text-xl font-bold">Atur Susunan Pemain</h2>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Formasi
                </label>
                <Input
                  value={lineupFormation}
                  onChange={(e) => setLineupFormation(e.target.value)}
                  placeholder="cth. 4-3-3, 4-4-2"
                />
              </div>

              <div>
                <h3 className="text-sm font-medium text-slate-300 mb-2">
                  Pemain Inti ({selectedStarters.size} dipilih)
                </h3>
                <div className="space-y-1 max-h-48 overflow-y-auto border rounded-lg p-2">
                  {players.map((player) => (
                    <label
                      key={player.id}
                      className={`flex items-center gap-3 p-2 rounded cursor-pointer hover:bg-white/5 ${selectedStarters.has(player.id) ? 'bg-emerald-900/30' : ''
                        }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedStarters.has(player.id)}
                        onChange={() => toggleStarter(player.id)}
                        className="rounded"
                      />
                      <span className="text-sm font-mono text-slate-500 w-8">
                        #{player.jerseyNumber ?? '-'}
                      </span>
                      <span className="text-sm font-medium">
                        {player.fullName}
                      </span>
                      {player.position && (
                        <span className="text-xs text-slate-400">
                          {player.position}
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-slate-300 mb-2">
                  Pemain Cadangan ({selectedSubs.size} dipilih)
                </h3>
                <div className="space-y-1 max-h-48 overflow-y-auto border rounded-lg p-2">
                  {players
                    .filter((p) => !selectedStarters.has(p.id))
                    .map((player) => (
                      <label
                        key={player.id}
                        className={`flex items-center gap-3 p-2 rounded cursor-pointer hover:bg-white/5 ${selectedSubs.has(player.id) ? 'bg-emerald-900/30' : ''
                          }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedSubs.has(player.id)}
                          onChange={() => toggleSub(player.id)}
                          className="rounded"
                        />
                        <span className="text-sm font-mono text-slate-500 w-8">
                          #{player.jerseyNumber ?? '-'}
                        </span>
                        <span className="text-sm font-medium">
                          {player.fullName}
                        </span>
                        {player.position && (
                          <span className="text-xs text-slate-400">
                            {player.position}
                          </span>
                        )}
                      </label>
                    ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setLineupModalOpen(false)}
                >
                  Batal
                </Button>
                <Button
                  onClick={handleSaveLineup}
                  disabled={
                    savingLineup || selectedStarters.size === 0
                  }
                >
                  {savingLineup ? (
                    <Spinner className="w-4 h-4" />
                  ) : (
                    'Simpan Susunan'
                  )}
                </Button>
              </div>
            </div>
          </Modal>
        </div>
      )}
    </div>
  );
}

'use client';

import { useEffect, useState, useCallback } from 'react';
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
import Link from 'next/link';
import { FolderTree, User, Upload, X } from 'lucide-react';

interface Team {
  id: string;
  name: string;
  shortName?: string;
  slug: string;
  sportType?: string;
}

interface Division {
  id: string;
  name: string;
  sportType?: string;
  ageGroup?: string;
  gender?: string;
  _count?: { players: number };
}

interface Player {
  id: string;
  fullName: string;
  jerseyNumber?: number;
  position?: string;
  dateOfBirth: string;
  placeOfBirth?: string;
  nationality?: string;
  photoUrl?: string;
  teamId: string;
  divisionId?: string;
  division?: {
    id: string;
    name: string;
    sportType?: string;
    ageGroup?: string;
    gender?: string;
  };
}

interface PlayerFormData {
  fullName: string;
  jerseyNumber: number | '';
  sportType: string;
  position: string;
  dateOfBirth: string;
  placeOfBirth: string;
  nationality: string;
  divisionId: string;
  photoUrl: string;
}

const defaultPlayerForm: PlayerFormData = {
  fullName: '',
  jerseyNumber: '',
  sportType: '',
  position: '',
  dateOfBirth: '',
  placeOfBirth: '',
  nationality: '',
  divisionId: '',
  photoUrl: '',
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

const sportLabel: Record<string, string> = {
  FOOTBALL: 'Sepak Bola', FUTSAL: 'Futsal', BASKETBALL: 'Basket',
  VOLLEYBALL: 'Voli', HANDBALL: 'Bola Tangan', HOCKEY: 'Hoki',
  TENNIS: 'Tenis', BADMINTON: 'Bulu Tangkis', TABLE_TENNIS: 'Tenis Meja',
  RUGBY: 'Rugby', BASEBALL: 'Baseball', SOFTBALL: 'Softball',
  CRICKET: 'Kriket', OTHER: 'Lainnya',
};

export default function PlayersPage() {
  const toast = useToast();

  const [team, setTeam] = useState<Team | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDivision, setFilterDivision] = useState('');

  // Player modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [playerForm, setPlayerForm] = useState<PlayerFormData>(defaultPlayerForm);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof PlayerFormData, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [deletingPlayerId, setDeletingPlayerId] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

  const handlePhotoUpload = async (file: File) => {
    if (!file) return;
    const maxSize = 2 * 1024 * 1024; // 2MB
    if (file.size > maxSize) {
      toast.error('Ukuran foto maksimal 2MB');
      return;
    }
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      toast.error('Format foto harus JPG, PNG, atau WebP');
      return;
    }
    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const token = typeof window !== 'undefined' ? localStorage.getItem('sportscore_access_token') : null;
      const res = await fetch(`${API_BASE_URL}/uploads/image`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      if (!res.ok) throw new Error('Gagal mengunggah foto');
      const json = await res.json();
      const url = json?.data?.url ?? json?.url ?? '';
      setPlayerForm((prev) => ({ ...prev, photoUrl: url }));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal mengunggah foto';
      toast.error(message);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const teamRes = await apiGet<Team | null>('/teams/my');
      setTeam(teamRes);

      if (teamRes) {
        const [playersRes, divRes] = await Promise.all([
          apiGet<Player[] | { data: Player[] }>(`/teams/${teamRes.id}/players`),
          apiGet<Division[] | { data: Division[] }>('/team-divisions'),
        ]);

        const playersData = Array.isArray(playersRes)
          ? playersRes
          : (playersRes as { data: Player[] }).data ?? [];
        setPlayers(playersData);

        const divData = Array.isArray(divRes) ? divRes : divRes.data;
        setDivisions(divData);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load data';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filtered players
  const filteredPlayers = players.filter((player) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const name = player.fullName.toLowerCase();
      const jersey = String(player.jerseyNumber ?? '');
      const pos = (player.position ?? '').toLowerCase();
      if (!name.includes(q) && !jersey.includes(q) && !pos.includes(q)) {
        return false;
      }
    }
    if (filterDivision && player.divisionId !== filterDivision) {
      return false;
    }
    return true;
  });

  // Modal handlers
  const openCreateModal = () => {
    setEditingPlayer(null);
    setPlayerForm({
      ...defaultPlayerForm,
      sportType: team?.sportType || '',
    });
    setFormErrors({});
    setModalOpen(true);
  };

  const openEditModal = (player: Player) => {
    setEditingPlayer(player);
    const derivedSport = player.division?.sportType || team?.sportType || '';
    setPlayerForm({
      fullName: player.fullName,
      jerseyNumber: player.jerseyNumber ?? '',
      sportType: derivedSport,
      position: player.position ?? '',
      dateOfBirth: player.dateOfBirth ? player.dateOfBirth.slice(0, 10) : '',
      placeOfBirth: player.placeOfBirth ?? '',
      nationality: player.nationality ?? '',
      divisionId: player.divisionId ?? '',
      photoUrl: player.photoUrl ?? '',
    });
    setFormErrors({});
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingPlayer(null);
    setPlayerForm(defaultPlayerForm);
    setFormErrors({});
  };

  const validateForm = (): boolean => {
    const errors: Partial<Record<keyof PlayerFormData, string>> = {};
    if (!playerForm.fullName.trim()) errors.fullName = 'Nama lengkap wajib diisi';
    if (!playerForm.dateOfBirth) errors.dateOfBirth = 'Tanggal lahir wajib diisi';
    if (!editingPlayer && !playerForm.photoUrl) errors.photoUrl = 'Foto pemain wajib diunggah';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm() || !team) return;

    setSubmitting(true);
    try {
      const payload = {
        fullName: playerForm.fullName.trim(),
        jerseyNumber:
          playerForm.jerseyNumber !== '' ? Number(playerForm.jerseyNumber) : undefined,
        position: playerForm.position || undefined,
        dateOfBirth: playerForm.dateOfBirth,
        placeOfBirth: playerForm.placeOfBirth.trim() || undefined,
        nationality: playerForm.nationality.trim() || undefined,
        divisionId: playerForm.divisionId || undefined,
        photoUrl: playerForm.photoUrl || undefined,
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
          `/teams/${team.id}/players`,
          payload
        );
        setPlayers((prev) => [...prev, created]);
        toast.success('Pemain berhasil ditambahkan');
      }
      closeModal();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal menyimpan pemain';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (player: Player) => {
    if (!confirm(`Hapus pemain ${player.fullName}?`)) return;
    setDeletingPlayerId(player.id);
    try {
      await apiDelete(`/players/${player.id}`);
      setPlayers((prev) => prev.filter((p) => p.id !== player.id));
      toast.success('Pemain berhasil dihapus');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal menghapus pemain';
      toast.error(message);
    } finally {
      setDeletingPlayerId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-100">Pemain</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Skeleton className="h-24 rounded-lg" />
          <Skeleton className="h-24 rounded-lg" />
        </div>
        <Skeleton className="h-96 rounded-lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-100">Pemain</h1>
        <Card className="p-6">
          <p className="text-red-400">Error: {error}</p>
          <Button className="mt-4" onClick={fetchData}>
            Coba Lagi
          </Button>
        </Card>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-100">Pemain</h1>
        <Card className="p-12 text-center">
          <h3 className="text-lg font-medium text-slate-400 mb-2">
            Belum ada tim
          </h3>
          <p className="text-slate-500 mb-6">
            Buat tim terlebih dahulu sebelum menambahkan pemain.
          </p>
          <Link href="/team-manager/teams">
            <Button>Buat Tim</Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Pemain</h1>
          <p className="text-sm text-slate-400 mt-1">{team.name}</p>
        </div>
        <Button onClick={openCreateModal}>Tambah Pemain</Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="p-5">
          <p className="text-sm text-slate-400">Total Pemain</p>
          <p className="text-2xl font-bold mt-1">{players.length}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-slate-400">Tim</p>
          <p className="text-2xl font-bold mt-1">{team.name}</p>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Input
          placeholder="Cari nama, posisi, atau nomor..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="sm:max-w-xs"
        />
        {divisions.length > 0 && (
          <Select
            value={filterDivision}
            onChange={(e) => setFilterDivision(e.target.value)}
            className="sm:max-w-xs"
          >
            <option value="">Semua Divisi</option>
            {divisions.map((div) => (
              <option key={div.id} value={div.id}>
                {div.name}
              </option>
            ))}
          </Select>
        )}
      </div>

      {/* Players table */}
      {filteredPlayers.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-slate-500 mb-4">
            {players.length === 0
              ? 'Belum ada pemain. Tambahkan pemain pertama Anda.'
              : 'Tidak ada pemain yang cocok dengan filter.'}
          </p>
          {players.length === 0 && (
            <Button onClick={openCreateModal}>Tambah Pemain</Button>
          )}
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-800/60 border-b border-white/10">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">
                    #
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">
                    Pemain
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">
                    Divisi
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">
                    Posisi
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">
                    Kebangsaan
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredPlayers.map((player) => (
                  <tr key={player.id} className="hover:bg-white/5">
                    <td className="px-4 py-3 text-sm font-mono">
                      {player.jerseyNumber ?? '-'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden border border-slate-600 shrink-0">
                          {player.photoUrl ? (
                            <img src={player.photoUrl} alt={player.fullName} className="h-full w-full object-cover" />
                          ) : (
                            <User className="h-4 w-4 text-slate-400" />
                          )}
                        </div>
                        <span className="font-medium">{player.fullName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {player.division ? (
                        <Badge variant="info">
                          {player.division.name}
                        </Badge>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-400">
                      {player.position ? (
                        <Badge variant="secondary">{player.position}</Badge>
                      ) : (
                        '-'
                      )}
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
                          onClick={() => openEditModal(player)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={deletingPlayerId === player.id}
                          onClick={() => handleDelete(player)}
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

      {/* Add/Edit Player Modal */}
      <Modal open={modalOpen} onClose={closeModal}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <h2 className="text-xl font-bold">
            {editingPlayer ? 'Edit Pemain' : 'Tambah Pemain'}
          </h2>

          {/* Photo Upload */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Foto Pemain {!editingPlayer && <span className="text-red-400">*</span>}
            </label>
            <div className="flex items-center gap-4">
              <div className="h-20 w-20 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden border-2 border-slate-600 shrink-0">
                {playerForm.photoUrl ? (
                  <img src={playerForm.photoUrl} alt="Preview" className="h-full w-full object-cover" />
                ) : (
                  <User className="h-10 w-10 text-slate-400" />
                )}
              </div>
              <div className="flex-1 space-y-2">
                {playerForm.photoUrl ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-green-400">Foto terunggah</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setPlayerForm((prev) => ({ ...prev, photoUrl: '' }))}
                    >
                      <X className="h-3 w-3 mr-1" />
                      Hapus
                    </Button>
                  </div>
                ) : (
                  <label className="inline-flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg cursor-pointer transition-colors text-sm">
                    {uploadingPhoto ? (
                      <Spinner className="w-4 h-4" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    {uploadingPhoto ? 'Mengunggah...' : 'Unggah Foto'}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handlePhotoUpload(file);
                        e.target.value = '';
                      }}
                      disabled={uploadingPhoto}
                    />
                  </label>
                )}
                <p className="text-xs text-slate-500">JPG, PNG, atau WebP. Maks 2MB.</p>
              </div>
            </div>
            {formErrors.photoUrl && (
              <p className="text-red-500 text-xs mt-1">{formErrors.photoUrl}</p>
            )}
          </div>

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
            {formErrors.fullName && (
              <p className="text-red-500 text-xs mt-1">
                {formErrors.fullName}
              </p>
            )}
          </div>

          {/* Division selector */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Divisi Tim
            </label>
            {divisions.length > 0 ? (
              <Select
                value={playerForm.divisionId}
                onChange={(e) => {
                  const divId = e.target.value;
                  const div = divisions.find((d) => d.id === divId);
                  setPlayerForm((prev) => ({
                    ...prev,
                    divisionId: divId,
                    sportType: div?.sportType || prev.sportType,
                    position: div?.sportType !== prev.sportType ? '' : prev.position,
                  }));
                }}
                className="w-full"
              >
                <option value="">-- Pilih Divisi --</option>
                {divisions.map((div) => (
                  <option key={div.id} value={div.id}>
                    {div.name}
                  </option>
                ))}
              </Select>
            ) : (
              <div className="flex items-center gap-3 p-3 bg-slate-800/60 rounded-lg border border-slate-700/50">
                <FolderTree className="h-5 w-5 text-slate-500 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm text-slate-400">
                    Belum ada divisi tim.
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Buat divisi untuk mengorganisasi pemain Anda.
                  </p>
                </div>
                <Link href="/team-manager/divisions">
                  <Button type="button" size="sm" variant="secondary">
                    Buat Divisi
                  </Button>
                </Link>
              </div>
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

          {/* Date of Birth - required */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Tanggal Lahir <span className="text-red-400">*</span>
            </label>
            <Input
              type="date"
              value={playerForm.dateOfBirth}
              onChange={(e) =>
                setPlayerForm((prev) => ({
                  ...prev,
                  dateOfBirth: e.target.value,
                }))
              }
            />
            {formErrors.dateOfBirth && (
              <p className="text-red-500 text-xs mt-1">
                {formErrors.dateOfBirth}
              </p>
            )}
          </div>

          {/* Place of Birth - optional */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Tempat Lahir
            </label>
            <Input
              value={playerForm.placeOfBirth}
              onChange={(e) =>
                setPlayerForm((prev) => ({
                  ...prev,
                  placeOfBirth: e.target.value,
                }))
              }
              placeholder="cth. Jakarta"
            />
          </div>

          {/* Sport selector -> drives position options */}
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

          {/* Position selector -> filtered by sport */}
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
            <Button type="button" variant="outline" onClick={closeModal}>
              Batal
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
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
  );
}

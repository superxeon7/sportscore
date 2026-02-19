'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiGet, apiPost, apiPatch } from '@/lib/api/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import Link from 'next/link';

interface Team {
  id: string;
  name: string;
  shortName?: string;
  slug: string;
  city?: string;
  country?: string;
}

interface EventCategory {
  id: string;
  name: string;
  eventId: string;
  sportType: string;
  gender: string;
  maxDateOfBirth: string;
  minDateOfBirth?: string | null;
  matchDurationMinutes: number;
  halfCount: number;
  breakDurationMinutes: number;
  injuryTimeMinutes: number;
}

interface TeamFormData {
  name: string;
  shortName: string;
  slug: string;
  city: string;
  country: string;
}

const defaultTeamForm: TeamFormData = {
  name: '',
  shortName: '',
  slug: '',
  city: '',
  country: '',
};

const GENDERS_MAP: Record<string, string> = {
  MALE: 'Putra', FEMALE: 'Putri', MIXED: 'Campuran',
};

const sportLabel: Record<string, string> = {
  FOOTBALL: 'Sepak Bola', FUTSAL: 'Futsal', BASKETBALL: 'Basket',
  VOLLEYBALL: 'Voli', HANDBALL: 'Bola Tangan', HOCKEY: 'Hoki',
  TENNIS: 'Tenis', BADMINTON: 'Bulu Tangkis', TABLE_TENNIS: 'Tenis Meja',
  RUGBY: 'Rugby', BASEBALL: 'Baseball', SOFTBALL: 'Softball',
  CRICKET: 'Kriket', OTHER: 'Lainnya',
};

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export default function TeamManagerTeamsPage() {
  const toast = useToast();
  const [team, setTeam] = useState<Team | null>(null);
  const [categories, setCategories] = useState<EventCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit team
  const [editingTeam, setEditingTeam] = useState(false);
  const [teamForm, setTeamForm] = useState<TeamFormData>(defaultTeamForm);
  const [teamFormErrors, setTeamFormErrors] = useState<Partial<Record<keyof TeamFormData, string>>>({});
  const [savingTeam, setSavingTeam] = useState(false);

  // Create team (when no team exists)
  const [createTeamModalOpen, setCreateTeamModalOpen] = useState(false);


  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const teamRes = await apiGet<Team | null>('/teams/my');
      setTeam(teamRes);

      // Also fetch categories list
      try {
        const catRes = await apiGet<EventCategory[] | { data: EventCategory[] }>('/event-categories');
        const catData = Array.isArray(catRes) ? catRes : catRes.data;
        setCategories(catData);
      } catch {
        setCategories([]);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load team';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Create Team
  const openCreateTeamModal = () => {
    setTeamForm(defaultTeamForm);
    setTeamFormErrors({});
    setCreateTeamModalOpen(true);
  };

  const validateTeamForm = (): boolean => {
    const errors: Partial<Record<keyof TeamFormData, string>> = {};
    if (!teamForm.name.trim()) errors.name = 'Nama tim wajib diisi';
    if (!teamForm.slug.trim()) errors.slug = 'Slug wajib diisi';
    setTeamFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateTeamForm()) return;

    setSavingTeam(true);
    try {
      const payload = {
        name: teamForm.name.trim(),
        shortName: teamForm.shortName.trim() || undefined,
        slug: teamForm.slug.trim(),
        city: teamForm.city.trim() || undefined,
        country: teamForm.country.trim() || undefined,
      };
      const created = await apiPost<Team>('/teams', payload);
      setTeam(created);
      setCreateTeamModalOpen(false);
      toast.success('Tim berhasil dibuat');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal membuat tim';
      toast.error(message);
    } finally {
      setSavingTeam(false);
    }
  };

  // Edit Team
  const handleSaveTeam = async () => {
    setSavingTeam(true);
    try {
      const updated = await apiPatch<Team>(`/teams/${team!.id}`, {
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

  const handleNameChange = (name: string) => {
    setTeamForm((prev) => ({
      ...prev,
      name,
      slug: generateSlug(name),
    }));
  };


  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-100">Tim Saya</h1>
        <Skeleton className="h-40 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-100">Tim Saya</h1>
        <Card className="p-6">
          <p className="text-red-400">Error: {error}</p>
          <Button className="mt-4" onClick={fetchData}>
            Coba Lagi
          </Button>
        </Card>
      </div>
    );
  }

  // No team yet — show create form
  if (!team) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-100">Tim Saya</h1>
        <Card className="p-12 text-center">
          <h3 className="text-lg font-medium text-slate-300 mb-2">
            Belum ada tim
          </h3>
          <p className="text-slate-500 mb-6">
            Buat tim Anda untuk mulai mengelola pemain dan kategori pertandingan.
          </p>
          <Button onClick={openCreateTeamModal}>Buat Tim</Button>
        </Card>

        {/* Create Team Modal */}
        <Modal open={createTeamModalOpen} onClose={() => setCreateTeamModalOpen(false)}>
          <form onSubmit={handleCreateTeam} className="space-y-4">
            <h2 className="text-xl font-bold">Buat Tim</h2>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Nama Tim *
              </label>
              <Input
                value={teamForm.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="cth. Garuda Futsal Club"
              />
              {teamFormErrors.name && (
                <p className="text-red-500 text-xs mt-1">{teamFormErrors.name}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Singkatan
              </label>
              <Input
                value={teamForm.shortName}
                onChange={(e) =>
                  setTeamForm((prev) => ({ ...prev, shortName: e.target.value }))
                }
                placeholder="cth. GFC"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Slug *
              </label>
              <Input
                value={teamForm.slug}
                onChange={(e) =>
                  setTeamForm((prev) => ({ ...prev, slug: e.target.value }))
                }
                placeholder="Auto-generated dari nama"
              />
              {teamFormErrors.slug && (
                <p className="text-red-500 text-xs mt-1">{teamFormErrors.slug}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Kota
                </label>
                <Input
                  value={teamForm.city}
                  onChange={(e) =>
                    setTeamForm((prev) => ({ ...prev, city: e.target.value }))
                  }
                  placeholder="cth. Jakarta"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Negara
                </label>
                <Input
                  value={teamForm.country}
                  onChange={(e) =>
                    setTeamForm((prev) => ({ ...prev, country: e.target.value }))
                  }
                  placeholder="cth. Indonesia"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setCreateTeamModalOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={savingTeam}>
                {savingTeam ? <Spinner className="w-4 h-4" /> : 'Buat Tim'}
              </Button>
            </div>
          </form>
        </Modal>
      </div>
    );
  }

  // Has team — show detail + categories
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-100">Tim Saya</h1>
        <Link href={`/team-manager/teams/${team.id}`}>
          <Button variant="outline" size="sm">Kelola Pemain</Button>
        </Link>
      </div>

      {/* Team Info */}
      <Card className="p-6">
        {editingTeam ? (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-100 mb-3">Edit Tim</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Nama</label>
                <Input
                  value={teamForm.name}
                  onChange={(e) =>
                    setTeamForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Singkatan</label>
                <Input
                  value={teamForm.shortName}
                  onChange={(e) =>
                    setTeamForm((prev) => ({ ...prev, shortName: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Kota</label>
                <Input
                  value={teamForm.city}
                  onChange={(e) =>
                    setTeamForm((prev) => ({ ...prev, city: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Negara</label>
                <Input
                  value={teamForm.country}
                  onChange={(e) =>
                    setTeamForm((prev) => ({ ...prev, country: e.target.value }))
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
        ) : (
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-100">{team.name}</h2>
              <div className="flex items-center gap-3 mt-2 text-sm text-slate-400">
                {team.shortName && (
                  <Badge variant="secondary">{team.shortName}</Badge>
                )}
                {team.city && <span>📍 {team.city}</span>}
                {team.country && <span>🌍 {team.country}</span>}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setTeamForm({
                  name: team.name,
                  shortName: team.shortName || '',
                  slug: team.slug,
                  city: team.city || '',
                  country: team.country || '',
                });
                setEditingTeam(true);
              }}
            >
              Edit
            </Button>
          </div>
        )}
      </Card>

      {/* Categories Section (read-only — categories are managed by event organizers) */}
      <Card className="p-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-100">Kategori Pertandingan</h2>
          <p className="text-sm text-slate-400 mt-1">
            Kategori dibuat oleh penyelenggara acara. Berikut kategori yang tersedia.
          </p>
        </div>

        {categories.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-slate-700 rounded-lg">
            <p className="text-slate-500">
              Belum ada kategori. Kategori akan muncul setelah penyelenggara acara membuatnya.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {categories.map((cat) => (
              <div
                key={cat.id}
                className="p-4 rounded-lg border border-slate-700/50 bg-slate-800/40"
              >
                <h3 className="text-sm font-semibold text-slate-200 mb-2">{cat.name}</h3>
                <div className="flex items-center gap-2 mb-2">
                  <Badge className="bg-emerald-900/50 text-emerald-300">
                    {sportLabel[cat.sportType] || cat.sportType}
                  </Badge>
                  <Badge className="bg-blue-900/50 text-blue-300">
                    {GENDERS_MAP[cat.gender] || cat.gender}
                  </Badge>
                </div>
                <div className="text-xs text-slate-500 space-y-0.5">
                  <p>Usia: lahir mulai {new Date(cat.maxDateOfBirth).toLocaleDateString('id-ID')}</p>
                  <p>{cat.halfCount}x{Math.round(cat.matchDurationMinutes / cat.halfCount)} menit</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

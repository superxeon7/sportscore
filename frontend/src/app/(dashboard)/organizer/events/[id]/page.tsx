'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
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


interface Event {
  id: string;
  name: string;
  slug: string;
  description: string;
  sportId: string;
  sport?: { id: string; name: string; slug: string };
  status: string;
  startDate: string;
  endDate: string;
  location?: string;
  venue?: string;
  maxTeams?: number;
}

interface Team {
  id: string;
  name: string;
  shortName?: string;
  slug: string;
  city?: string;
  country?: string;
}

interface CategoryTeam {
  id: string;
  eventCategoryId: string;
  teamId: string;
  groupId?: string | null;
  team?: Team;
  categoryGroup?: { id: string; name: string } | null;
}

interface CategoryGroup {
  id: string;
  categoryId: string;
  name: string;
}

interface CategoryStage {
  id: string;
  stageOrder: number;
  stageType: string;
  groupCount?: number | null;
  settingsJson?: Record<string, unknown> | null;
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
  stages?: CategoryStage[];
  categoryTeams?: CategoryTeam[];
  categoryGroups?: CategoryGroup[];
  _count?: { categoryTeams?: number; matches?: number };
}

const statusColors: Record<string, string> = {
  DRAFT: 'bg-slate-700/50 text-slate-300',
  PUBLISHED: 'bg-blue-900/50 text-blue-300',
  ONGOING: 'bg-orange-900/50 text-orange-300',
  COMPLETED: 'bg-purple-900/50 text-purple-300',
  CANCELLED: 'bg-red-900/50 text-red-300',
  SETUP: 'bg-slate-700/50 text-slate-300',
  REGISTRATION: 'bg-green-900/50 text-green-300',
  IN_PROGRESS: 'bg-orange-900/50 text-orange-300',
  SCHEDULED: 'bg-blue-900/50 text-blue-300',
  WARMUP: 'bg-yellow-900/50 text-yellow-300',
  LIVE: 'bg-red-900/50 text-red-300',
  HALF_TIME: 'bg-yellow-900/50 text-yellow-300',
  FINISHED: 'bg-green-900/50 text-green-300',
  POSTPONED: 'bg-slate-700/50 text-slate-300',
};

const SPORT_TYPES = [
  'FUTSAL', 'FOOTBALL', 'BASKETBALL', 'VOLLEYBALL', 'HANDBALL',
  'HOCKEY', 'TENNIS', 'BADMINTON', 'TABLE_TENNIS', 'RUGBY',
  'BASEBALL', 'SOFTBALL', 'CRICKET', 'OTHER',
];

const GENDERS = [
  { value: 'MALE', label: 'Putra' },
  { value: 'FEMALE', label: 'Putri' },
  { value: 'MIXED', label: 'Campuran' },
];

export default function EventManagementPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.id as string;
  const toast = useToast();

  const [event, setEvent] = useState<Event | null>(null);
  const [availableTeams, setAvailableTeams] = useState<Team[]>([]);
  const [categories, setCategories] = useState<EventCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('details');

  // Category management state
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    sportType: 'FUTSAL',
    gender: 'MALE',
    maxDateOfBirth: '',
    minDateOfBirth: '',
    matchDurationMinutes: 40,
    halfCount: 2,
    breakDurationMinutes: 10,
    injuryTimeMinutes: 0,
    stageCount: 1,
    stages: [{ stageOrder: 1, stageType: 'KNOCKOUT' as string, groupCount: 2, qualifyPerGroup: 2, matchPerTeam: 3, penaltyEnabled: false, swissRounds: 5, swissHasPlayoff: false, swissPlayoffTop: 4 }],
  });
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [categoryEditForm, setCategoryEditForm] = useState({
    name: '',
    sportType: 'FUTSAL',
    gender: 'MALE',
    maxDateOfBirth: '',
    minDateOfBirth: '',
    matchDurationMinutes: 40,
    halfCount: 2,
    breakDurationMinutes: 10,
    injuryTimeMinutes: 0,
    stageCount: 1,
    stages: [{ stageOrder: 1, stageType: 'KNOCKOUT' as string, groupCount: 2, qualifyPerGroup: 2, matchPerTeam: 3, penaltyEnabled: false, swissRounds: 5, swissHasPlayoff: false, swissPlayoffTop: 4 }],
  });

  // Edit event state
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Event>>({});
  const [savingEvent, setSavingEvent] = useState(false);

  // Add team to category modal
  const [teamModalOpen, setTeamModalOpen] = useState(false);
  const [teamModalCategoryId, setTeamModalCategoryId] = useState<string | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [registeringTeam, setRegisteringTeam] = useState(false);

  // Category groups for the add-team modal dropdown (keyed by categoryId)
  const [categoryStageGroups, setCategoryStageGroups] = useState<Record<string, CategoryGroup[]>>({});
  const [selectedGroupId, setSelectedGroupId] = useState('');

  // Publish event state
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [publishingEvent, setPublishingEvent] = useState(false);

  const fetchEventData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [eventRes, categoriesRes] = await Promise.all([
        apiGet<Event>(`/events/${eventId}`),
        apiGet<EventCategory[] | { data: EventCategory[] }>(`/events/${eventId}/categories`).catch(() => []),
      ]);

      setEvent(eventRes);
      setEditForm(eventRes);
      setCategories(Array.isArray(categoriesRes) ? categoriesRes : (categoriesRes as { data: EventCategory[] }).data ?? []);

      // Fetch available teams
      try {
        const allTeamsRes = await apiGet<Team[] | { data: Team[] }>('/teams');
        const allTeams = Array.isArray(allTeamsRes) ? allTeamsRes : allTeamsRes.data;
        setAvailableTeams(allTeams);
      } catch {
        // Silently fail
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load event';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchEventData();
  }, [fetchEventData]);

  const handleToggleEventPublish = async () => {
    if (!event) return;
    const newStatus = event.status === 'DRAFT' ? 'PUBLISHED' : 'DRAFT';
    setPublishingEvent(true);
    try {
      const updated = await apiPatch<Event>(`/events/${eventId}/status`, {
        status: newStatus,
      });
      setEvent((prev) => (prev ? { ...prev, ...updated } : updated));
      toast.success(
        newStatus === 'PUBLISHED'
          ? 'Acara berhasil dipublikasikan!'
          : 'Acara dikembalikan ke draf.',
      );
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Gagal mengubah status acara.';
      toast.error(message);
    } finally {
      setPublishingEvent(false);
      setPublishModalOpen(false);
    }
  };

  const handleSaveEvent = async () => {
    setSavingEvent(true);
    try {
      const updated = await apiPatch<Event>(`/events/${eventId}`, {
        name: editForm.name,
        description: editForm.description,
        location: editForm.location,
        venue: editForm.venue,
        startDate: editForm.startDate,
        endDate: editForm.endDate,
        maxTeams: editForm.maxTeams,
      });
      setEvent((prev) => (prev ? { ...prev, ...updated } : updated));
      setEditing(false);
      toast.success('Acara berhasil diperbarui');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal memperbarui acara';
      toast.error(message);
    } finally {
      setSavingEvent(false);
    }
  };

  const handleAddTeamToCategory = async () => {
    if (!selectedTeamId || !teamModalCategoryId) return;
    setRegisteringTeam(true);
    try {
      const body: Record<string, unknown> = { teamId: selectedTeamId };
      if (selectedGroupId) body.groupId = selectedGroupId;

      const result = await apiPost<CategoryTeam>(
        `/event-categories/${teamModalCategoryId}/teams`,
        body,
      );
      setCategories((prev) =>
        prev.map((cat) =>
          cat.id === teamModalCategoryId
            ? { ...cat, categoryTeams: [...(cat.categoryTeams || []), result] }
            : cat,
        ),
      );
      setTeamModalOpen(false);
      setSelectedTeamId('');
      setSelectedGroupId('');
      setTeamModalCategoryId(null);
      toast.success('Tim berhasil didaftarkan ke kategori');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal mendaftarkan tim';
      toast.error(message);
    } finally {
      setRegisteringTeam(false);
    }
  };

  const handleRemoveTeamFromCategory = async (categoryId: string, teamId: string) => {
    if (!confirm('Hapus tim ini dari kategori?')) return;
    try {
      await apiDelete(`/event-categories/${categoryId}/teams/${teamId}`);
      setCategories((prev) =>
        prev.map((cat) =>
          cat.id === categoryId
            ? { ...cat, categoryTeams: (cat.categoryTeams || []).filter((ct) => ct.teamId !== teamId) }
            : cat,
        ),
      );
      toast.success('Tim berhasil dihapus dari kategori');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal menghapus tim';
      toast.error(message);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryForm.name.trim() || !categoryForm.maxDateOfBirth) return;
    setCreatingCategory(true);
    try {
      const body: Record<string, unknown> = {
        name: categoryForm.name.trim(),
        sportType: categoryForm.sportType,
        gender: categoryForm.gender,
        maxDateOfBirth: categoryForm.maxDateOfBirth,
        matchDurationMinutes: categoryForm.matchDurationMinutes,
        halfCount: categoryForm.halfCount,
        breakDurationMinutes: categoryForm.breakDurationMinutes,
        injuryTimeMinutes: categoryForm.injuryTimeMinutes,
        stages: categoryForm.stages.slice(0, categoryForm.stageCount).map((s) => ({
          stageOrder: s.stageOrder,
          stageType: s.stageType,
          ...(s.stageType === 'GROUP' ? { groupCount: s.groupCount, qualifyPerGroup: s.qualifyPerGroup } : {}),
          ...(s.stageType === 'SPECIAL_GROUP' ? { groupCount: s.groupCount, qualifyPerGroup: s.qualifyPerGroup, matchPerTeam: s.matchPerTeam ?? 3 } : {}),
          ...(s.stageType === 'GROUP_NEIGHBOR' ? { groupCount: s.groupCount, qualifyPerGroup: s.qualifyPerGroup } : {}),
          ...(s.stageType === 'SWISS' ? { settingsJson: { rounds: s.swissRounds, hasPlayoff: s.swissHasPlayoff, playoffTop: s.swissPlayoffTop } } : {}),
          ...(['GROUP', 'SPECIAL_GROUP', 'GROUP_NEIGHBOR', 'LEAGUE'].includes(s.stageType) ? { penaltyEnabled: s.penaltyEnabled ?? false } : {}),
        })),
      };
      if (categoryForm.minDateOfBirth) {
        body.minDateOfBirth = categoryForm.minDateOfBirth;
      }
      const created = await apiPost<EventCategory>(`/events/${eventId}/categories`, body);
      setCategories((prev) => [...prev, { ...created, categoryTeams: [] }]);
      setCategoryModalOpen(false);
      setCategoryForm({
        name: '',
        sportType: 'FUTSAL',
        gender: 'MALE',
        maxDateOfBirth: '',
        minDateOfBirth: '',
        matchDurationMinutes: 40,
        halfCount: 2,
        breakDurationMinutes: 10,
        injuryTimeMinutes: 0,
        stageCount: 1,
        stages: [{ stageOrder: 1, stageType: 'KNOCKOUT', groupCount: 2, qualifyPerGroup: 2, matchPerTeam: 3, penaltyEnabled: false, swissRounds: 5, swissHasPlayoff: false, swissPlayoffTop: 4 }],
      });
      toast.success('Kategori berhasil dibuat');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal membuat kategori';
      toast.error(message);
    } finally {
      setCreatingCategory(false);
    }
  };

  const handleRemoveCategory = async (categoryId: string) => {
    if (!confirm('Hapus kategori ini? Kategori yang memiliki pertandingan tidak bisa dihapus.')) return;
    try {
      await apiDelete(`/event-categories/${categoryId}`);
      setCategories((prev) => prev.filter((c) => c.id !== categoryId));
      toast.success('Kategori berhasil dihapus');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal menghapus kategori';
      toast.error(message);
    }
  };

  const handleSaveCategory = async (categoryId: string) => {
    try {
      const body: Record<string, unknown> = {
        name: categoryEditForm.name,
        sportType: categoryEditForm.sportType,
        gender: categoryEditForm.gender,
        maxDateOfBirth: categoryEditForm.maxDateOfBirth,
        matchDurationMinutes: categoryEditForm.matchDurationMinutes,
        halfCount: categoryEditForm.halfCount,
        breakDurationMinutes: categoryEditForm.breakDurationMinutes,
        injuryTimeMinutes: categoryEditForm.injuryTimeMinutes,
      };
      if (categoryEditForm.minDateOfBirth) {
        body.minDateOfBirth = categoryEditForm.minDateOfBirth;
      } else {
        body.minDateOfBirth = null;
      }
      body.stages = categoryEditForm.stages
        .slice(0, categoryEditForm.stageCount)
        .map((s, idx) => ({
          stageOrder: idx + 1,
          stageType: s.stageType,
          ...(s.stageType === 'GROUP'
            ? { groupCount: s.groupCount, qualifyPerGroup: s.qualifyPerGroup }
            : {}),
          ...(s.stageType === 'SPECIAL_GROUP'
            ? { groupCount: s.groupCount, qualifyPerGroup: s.qualifyPerGroup, matchPerTeam: s.matchPerTeam ?? 3 }
            : {}),
          ...(s.stageType === 'GROUP_NEIGHBOR'
            ? { groupCount: s.groupCount, qualifyPerGroup: s.qualifyPerGroup }
            : {}),
          ...(s.stageType === 'SWISS'
            ? { settingsJson: { rounds: s.swissRounds, hasPlayoff: s.swissHasPlayoff, playoffTop: s.swissPlayoffTop } }
            : {}),
          ...(['GROUP', 'SPECIAL_GROUP', 'GROUP_NEIGHBOR', 'LEAGUE'].includes(s.stageType)
            ? { penaltyEnabled: s.penaltyEnabled ?? false }
            : {}),
        }));
      const updated = await apiPatch<EventCategory>(`/event-categories/${categoryId}`, body);
      setCategories((prev) =>
        prev.map((c) => (c.id === categoryId ? { ...c, ...updated } : c)),
      );
      setEditingCategoryId(null);
      toast.success('Kategori berhasil diperbarui');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal memperbarui kategori';
      toast.error(message);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 rounded-lg" />
        <Skeleton className="h-96 rounded-lg" />
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="space-y-6">
        <Card className="p-6">
          <p className="text-red-600">Error: {error || 'Acara tidak ditemukan'}</p>
          <Button className="mt-4" onClick={fetchEventData}>
            Coba Lagi
          </Button>
        </Card>
      </div>
    );
  }

  const totalTeams = new Set(
    categories.flatMap((c) => (c.categoryTeams || []).map((ct) => ct.teamId))
  ).size;

  const tabs = [
    { id: 'details', label: 'Detail' },
    { id: 'categories', label: `Kategori & Tim (${categories.length})` },
  ];

  // For the add-team-to-category modal: get teams not yet in that category
  const currentCategoryTeamIds = teamModalCategoryId
    ? new Set(
      (categories.find((c) => c.id === teamModalCategoryId)?.categoryTeams || []).map(
        (ct) => ct.teamId,
      ),
    )
    : new Set<string>();
  const unregisteredTeamsForCategory = availableTeams.filter(
    (t) => !currentCategoryTeamIds.has(t.id),
  );

  return (
    <div className="space-y-6">
      {/* Event Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-100">{event.name}</h1>
            <Badge
              className={
                statusColors[event.status] || 'bg-slate-700/50 text-slate-300'
              }
            >
              {event.status.replace(/_/g, ' ')}
            </Badge>
          </div>
          {event.sport?.name && (
            <p className="text-sm text-slate-400 mt-1">
              {event.sport.name} &middot; {totalTeams} tim terdaftar
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {(event.status === 'DRAFT' || event.status === 'PUBLISHED') && (
            <Button
              variant={event.status === 'DRAFT' ? 'default' : 'outline'}
              onClick={() => setPublishModalOpen(true)}
              disabled={publishingEvent}
              className={
                event.status === 'DRAFT'
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  : ''
              }
            >
              {publishingEvent ? (
                <Spinner className="w-4 h-4" />
              ) : event.status === 'DRAFT' ? (
                'Publikasikan'
              ) : (
                'Batalkan Publikasi'
              )}
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => setEditing(!editing)}
          >
            {editing ? 'Batal Ubah' : 'Ubah Acara'}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-white/10">
        <nav className="flex gap-4 overflow-x-auto no-scrollbar">
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

      {/* Details Tab */}
      {activeTab === 'details' && (
        <Card className="p-6">
          {editing ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Nama
                </label>
                <Input
                  value={editForm.name || ''}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Deskripsi
                </label>
                <textarea
                  className="w-full border border-slate-600/60 bg-slate-800/80 text-slate-100 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 outline-none"
                  rows={3}
                  value={editForm.description || ''}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Lokasi
                  </label>
                  <Input
                    value={editForm.location || ''}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        location: e.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Tempat
                  </label>
                  <Input
                    value={editForm.venue || ''}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        venue: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Tanggal Mulai
                  </label>
                  <Input
                    type="date"
                    value={editForm.startDate?.split('T')[0] || ''}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        startDate: e.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Tanggal Selesai
                  </label>
                  <Input
                    type="date"
                    value={editForm.endDate?.split('T')[0] || ''}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        endDate: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Maksimal Tim
                </label>
                <Input
                  type="number"
                  min={2}
                  value={editForm.maxTeams ?? ''}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      maxTeams: e.target.value
                        ? Number(e.target.value)
                        : undefined,
                    }))
                  }
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSaveEvent} disabled={savingEvent}>
                  {savingEvent ? (
                    <Spinner className="w-4 h-4" />
                  ) : (
                    'Simpan Perubahan'
                  )}
                </Button>
                <Button variant="outline" onClick={() => setEditing(false)}>
                  Batal
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-slate-400">Nama:</span>
                <p className="font-medium">{event.name}</p>
              </div>
              <div>
                <span className="text-slate-400">Slug:</span>
                <p className="font-mono text-slate-500">{event.slug}</p>
              </div>
              <div className="sm:col-span-2">
                <span className="text-slate-400">Deskripsi:</span>
                <p>{event.description || '-'}</p>
              </div>
              <div>
                <span className="text-slate-400">Lokasi:</span>
                <p>{event.location || '-'}</p>
              </div>
              <div>
                <span className="text-slate-400">Tempat:</span>
                <p>{event.venue || '-'}</p>
              </div>
              <div>
                <span className="text-slate-400">Tanggal Mulai:</span>
                <p>{new Date(event.startDate).toLocaleDateString()}</p>
              </div>
              <div>
                <span className="text-slate-400">Tanggal Selesai:</span>
                <p>{new Date(event.endDate).toLocaleDateString()}</p>
              </div>
              <div>
                <span className="text-slate-400">Maksimal Tim:</span>
                <p>{event.maxTeams ?? 'Tidak Terbatas'}</p>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Categories & Teams Tab */}
      {activeTab === 'categories' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-400">
              Kelola kategori dan tim peserta. Daftarkan tim ke kategori yang sesuai.
            </p>
            <Button onClick={() => setCategoryModalOpen(true)} className="shrink-0 ml-4">
              Buat Kategori
            </Button>
          </div>

          {categories.length === 0 ? (
            <Card className="p-8 text-center">
              <div className="space-y-2">
                <p className="text-slate-400 font-medium">Belum ada kategori.</p>
                <p className="text-sm text-slate-500">
                  Buat kategori pertama untuk mulai mendaftarkan tim.
                </p>
              </div>
            </Card>
          ) : (
            <div className="space-y-4">
              {categories.map((cat) => (
                <Card key={cat.id} className="p-4">
                  {editingCategoryId === cat.id ? (
                    /* ── Inline Edit Form ── */
                    <div className="space-y-4">
                      <h3 className="font-semibold text-emerald-400">Ubah Kategori</h3>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="sm:col-span-3">
                          <label className="block text-xs font-medium text-slate-400 mb-1">
                            Nama Kategori *
                          </label>
                          <Input
                            value={categoryEditForm.name}
                            onChange={(e) =>
                              setCategoryEditForm((prev) => ({ ...prev, name: e.target.value }))
                            }
                            placeholder="cth. Futsal Putra U-17"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-400 mb-1">
                            Jenis Olahraga
                          </label>
                          <Select
                            value={categoryEditForm.sportType}
                            onChange={(e) =>
                              setCategoryEditForm((prev) => ({ ...prev, sportType: e.target.value }))
                            }
                            className="w-full"
                          >
                            {SPORT_TYPES.map((st) => (
                              <option key={st} value={st}>{st.replace(/_/g, ' ')}</option>
                            ))}
                          </Select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-400 mb-1">
                            Gender
                          </label>
                          <Select
                            value={categoryEditForm.gender}
                            onChange={(e) =>
                              setCategoryEditForm((prev) => ({ ...prev, gender: e.target.value }))
                            }
                            className="w-full"
                          >
                            {GENDERS.map((g) => (
                              <option key={g.value} value={g.value}>{g.label}</option>
                            ))}
                          </Select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-400 mb-1">
                            Maks. Tanggal Lahir *
                          </label>
                          <Input
                            type="date"
                            value={categoryEditForm.maxDateOfBirth?.split('T')[0] || ''}
                            onChange={(e) =>
                              setCategoryEditForm((prev) => ({ ...prev, maxDateOfBirth: e.target.value }))
                            }
                          />
                          <p className="text-[10px] text-slate-500 mt-0.5">Pemain harus lahir pada atau setelah tanggal ini</p>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">
                          Min. Tanggal Lahir (opsional)
                        </label>
                        <Input
                          type="date"
                          value={categoryEditForm.minDateOfBirth?.split('T')[0] || ''}
                          onChange={(e) =>
                            setCategoryEditForm((prev) => ({ ...prev, minDateOfBirth: e.target.value }))
                          }
                          className="max-w-xs"
                        />
                        <p className="text-[10px] text-slate-500 mt-0.5">Batas atas usia (pemain harus lahir sebelum tanggal ini)</p>
                      </div>

                      <div className="border-t border-white/10 pt-3">
                        <p className="text-xs font-medium text-slate-300 mb-2">Pengaturan Waktu Pertandingan</p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div>
                            <label className="block text-[10px] font-medium text-slate-400 mb-1">
                              Durasi (menit)
                            </label>
                            <Input
                              type="number"
                              min={1}
                              value={categoryEditForm.matchDurationMinutes}
                              onChange={(e) =>
                                setCategoryEditForm((prev) => ({ ...prev, matchDurationMinutes: Number(e.target.value) }))
                              }
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-medium text-slate-400 mb-1">
                              Jumlah Babak
                            </label>
                            <Input
                              type="number"
                              min={1}
                              value={categoryEditForm.halfCount}
                              onChange={(e) =>
                                setCategoryEditForm((prev) => ({ ...prev, halfCount: Number(e.target.value) }))
                              }
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-medium text-slate-400 mb-1">
                              Istirahat (menit)
                            </label>
                            <Input
                              type="number"
                              min={0}
                              value={categoryEditForm.breakDurationMinutes}
                              onChange={(e) =>
                                setCategoryEditForm((prev) => ({ ...prev, breakDurationMinutes: Number(e.target.value) }))
                              }
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-medium text-slate-400 mb-1">
                              Injury Time (menit)
                            </label>
                            <Input
                              type="number"
                              min={0}
                              value={categoryEditForm.injuryTimeMinutes}
                              onChange={(e) =>
                                setCategoryEditForm((prev) => ({ ...prev, injuryTimeMinutes: Number(e.target.value) }))
                              }
                            />
                          </div>
                        </div>
                        {categoryEditForm.halfCount > 0 && (
                          <p className="text-[10px] text-slate-500 mt-1">
                            = {Math.round(categoryEditForm.matchDurationMinutes / categoryEditForm.halfCount)} menit per babak
                          </p>
                        )}
                      </div>

                      {/* Format Turnamen section */}
                      <div className="border-t border-white/10 pt-3">
                        <p className="text-xs font-medium text-slate-300 mb-2">Format Turnamen</p>
                        {(cat._count?.matches ?? 0) > 0 ? (
                          <div className="rounded-lg bg-amber-900/20 border border-amber-700/40 p-3">
                            <p className="text-xs text-amber-400">
                              Stage tidak bisa diubah karena pertandingan sudah dibuat.
                            </p>
                            <div className="mt-2 space-y-1">
                              {(cat.stages || []).map((s, idx) => (
                                <p key={idx} className="text-xs text-slate-400">
                                  Stage {idx + 1}: {s.stageType}
                                  {s.stageType === 'GROUP' && s.groupCount ? ` (${s.groupCount} grup)` : ''}
                                </p>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="mb-3">
                              <label className="block text-[10px] font-medium text-slate-400 mb-1">
                                Jumlah Stage
                              </label>
                              <Select
                                value={String(categoryEditForm.stageCount)}
                                onChange={(e) => {
                                  const count = Number(e.target.value);
                                  setCategoryEditForm((prev) => {
                                    const stages = [...prev.stages];
                                    while (stages.length < count) {
                                      stages.push({
                                        stageOrder: stages.length + 1,
                                        stageType: 'KNOCKOUT',
                                        groupCount: 2,
                                        qualifyPerGroup: 2,
                                        matchPerTeam: 3,
                                        penaltyEnabled: false,
                                        swissRounds: 5,
                                        swissHasPlayoff: false,
                                        swissPlayoffTop: 4,
                                      });
                                    }
                                    return { ...prev, stageCount: count, stages };
                                  });
                                }}
                                className="w-full"
                              >
                                <option value="1">1 Stage</option>
                                <option value="2">2 Stage</option>
                                <option value="3">3 Stage</option>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              {Array.from({ length: categoryEditForm.stageCount }).map((_, idx) => {
                                const stage = categoryEditForm.stages[idx] || {
                                  stageOrder: idx + 1,
                                  stageType: 'KNOCKOUT',
                                  groupCount: 2,
                                  qualifyPerGroup: 2,
                                  swissRounds: 5,
                                  swissHasPlayoff: false,
                                  swissPlayoffTop: 4,
                                };
                                return (
                                  <div key={idx} className="p-3 rounded-lg border border-white/10 bg-white/[0.02]">
                                    <p className="text-xs font-bold text-slate-300 mb-2">Stage {idx + 1}</p>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                      <div>
                                        <label className="block text-[10px] font-medium text-slate-400 mb-0.5">Tipe</label>
                                        <Select
                                          value={stage.stageType}
                                          onChange={(e) => setCategoryEditForm((prev) => {
                                            const stages = [...prev.stages];
                                            stages[idx] = { ...stages[idx], stageType: e.target.value, stageOrder: idx + 1 };
                                            return { ...prev, stages };
                                          })}
                                          className="w-full"
                                        >
                                          <option value="GROUP">GROUP</option>
                                          <option value="SPECIAL_GROUP">SPECIAL GROUP</option>
                                          <option value="GROUP_NEIGHBOR">GROUP NEIGHBOR</option>
                                          <option value="KNOCKOUT">KNOCKOUT</option>
                                          <option value="LEAGUE">LEAGUE</option>
                                          <option value="DOUBLE_ELIMINATION">DOUBLE ELIMINATION</option>
                                          <option value="SWISS">SWISS</option>
                                        </Select>
                                      </div>
                                      {(stage.stageType === 'GROUP' || stage.stageType === 'SPECIAL_GROUP' || stage.stageType === 'GROUP_NEIGHBOR') && (
                                        <>
                                          <div>
                                            <label className="block text-[10px] font-medium text-slate-400 mb-0.5">Jumlah Grup</label>
                                            <Input
                                              type="number"
                                              min={1}
                                              max={16}
                                              value={stage.groupCount}
                                              onChange={(e) => setCategoryEditForm((prev) => {
                                                const stages = [...prev.stages];
                                                stages[idx] = { ...stages[idx], groupCount: Number(e.target.value) };
                                                return { ...prev, stages };
                                              })}
                                            />
                                          </div>
                                          <div>
                                            <label className="block text-[10px] font-medium text-slate-400 mb-0.5">Lolos per Grup</label>
                                            <Input
                                              type="number"
                                              min={1}
                                              max={8}
                                              value={stage.qualifyPerGroup}
                                              onChange={(e) => setCategoryEditForm((prev) => {
                                                const stages = [...prev.stages];
                                                stages[idx] = { ...stages[idx], qualifyPerGroup: Number(e.target.value) };
                                                return { ...prev, stages };
                                              })}
                                            />
                                          </div>
                                          {stage.stageType === 'SPECIAL_GROUP' && (
                                            <div>
                                              <label className="block text-[10px] font-medium text-slate-400 mb-0.5">Match per Tim</label>
                                              <Input
                                                type="number"
                                                min={1}
                                                max={20}
                                                value={stage.matchPerTeam ?? 3}
                                                onChange={(e) => setCategoryEditForm((prev) => {
                                                  const stages = [...prev.stages];
                                                  stages[idx] = { ...stages[idx], matchPerTeam: Number(e.target.value) };
                                                  return { ...prev, stages };
                                                })}
                                              />
                                            </div>
                                          )}
                                        </>
                                      )}
                                      {(stage.stageType === 'GROUP' || stage.stageType === 'SPECIAL_GROUP' || stage.stageType === 'GROUP_NEIGHBOR' || stage.stageType === 'LEAGUE') && (
                                        <div className="col-span-full">
                                          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                                            <input
                                              type="checkbox"
                                              checked={stage.penaltyEnabled ?? false}
                                              onChange={(e) => setCategoryEditForm((prev) => {
                                                const stages = [...prev.stages];
                                                stages[idx] = { ...stages[idx], penaltyEnabled: e.target.checked };
                                                return { ...prev, stages };
                                              })}
                                              className="w-3.5 h-3.5 accent-blue-500"
                                            />
                                            Aktifkan Adu Penalti (seri → penalti)
                                          </label>
                                        </div>
                                      )}
                                      {stage.stageType === 'SWISS' && (
                                        <>
                                          <div>
                                            <label className="block text-[10px] font-medium text-slate-400 mb-0.5">Jumlah Ronde</label>
                                            <Input
                                              type="number"
                                              min={1}
                                              max={20}
                                              value={stage.swissRounds ?? 5}
                                              onChange={(e) => setCategoryEditForm((prev) => {
                                                const stages = [...prev.stages];
                                                stages[idx] = { ...stages[idx], swissRounds: Number(e.target.value) };
                                                return { ...prev, stages };
                                              })}
                                            />
                                          </div>
                                          <div className="flex flex-col gap-1">
                                            <label className="block text-[10px] font-medium text-slate-400 mb-0.5">Playoff</label>
                                            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                                              <input
                                                type="checkbox"
                                                checked={stage.swissHasPlayoff ?? false}
                                                onChange={(e) => setCategoryEditForm((prev) => {
                                                  const stages = [...prev.stages];
                                                  stages[idx] = { ...stages[idx], swissHasPlayoff: e.target.checked };
                                                  return { ...prev, stages };
                                                })}
                                                className="w-3.5 h-3.5 accent-blue-500"
                                              />
                                              Ada playoff
                                            </label>
                                            {stage.swissHasPlayoff && (
                                              <Input
                                                type="number"
                                                min={2}
                                                max={8}
                                                value={stage.swissPlayoffTop ?? 4}
                                                onChange={(e) => setCategoryEditForm((prev) => {
                                                  const stages = [...prev.stages];
                                                  stages[idx] = { ...stages[idx], swissPlayoffTop: Number(e.target.value) };
                                                  return { ...prev, stages };
                                                })}
                                                placeholder="Top N tim lolos playoff"
                                              />
                                            )}
                                          </div>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleSaveCategory(cat.id)}>
                          Simpan
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setEditingCategoryId(null)}>
                          Batal
                        </Button>
                      </div>
                    </div>
                  ) : (
                    /* ── Category Card (View Mode) ── */
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-slate-100">{cat.name}</h3>
                            <Badge variant="secondary">{cat.sportType.replace(/_/g, ' ')}</Badge>
                            <Badge className="bg-blue-900/50 text-blue-300">{GENDERS.find((g) => g.value === cat.gender)?.label || cat.gender}</Badge>
                            <Badge className="bg-slate-700/50 text-slate-300">{(cat.categoryTeams || []).length} tim</Badge>
                          </div>
                          <div className="mt-2 space-y-1">
                            <p className="text-sm text-slate-400">
                              Usia: lahir mulai{' '}
                              <span className="text-slate-300 font-medium">
                                {new Date(cat.maxDateOfBirth).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                              </span>
                              {cat.minDateOfBirth && (
                                <>
                                  {' '}s.d.{' '}
                                  <span className="text-slate-300 font-medium">
                                    {new Date(cat.minDateOfBirth).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                                  </span>
                                </>
                              )}
                            </p>
                            <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                              <span>{cat.halfCount}x{Math.round(cat.matchDurationMinutes / cat.halfCount)} menit</span>
                              <span>Istirahat: {cat.breakDurationMinutes} menit</span>
                              {cat.injuryTimeMinutes > 0 && (
                                <span>Injury Time: {cat.injuryTimeMinutes} menit</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditingCategoryId(cat.id);
                              const existingStages = cat.stages || [];
                              const stageCount = existingStages.length || 1;
                              const stages = existingStages.length > 0
                                ? existingStages.map((s, i) => {
                                  const settings = s.settingsJson as { rounds?: number; hasPlayoff?: boolean; playoffTop?: number } | null;
                                  return {
                                    stageOrder: s.stageOrder ?? i + 1,
                                    stageType: s.stageType,
                                    groupCount: s.groupCount ?? 2,
                                    qualifyPerGroup: 2,
                                    matchPerTeam: (s as any).matchPerTeam ?? 3,
                                    penaltyEnabled: (s as any).penaltyEnabled ?? false,
                                    swissRounds: settings?.rounds ?? 5,
                                    swissHasPlayoff: settings?.hasPlayoff ?? false,
                                    swissPlayoffTop: settings?.playoffTop ?? 4,
                                  };
                                })
                                : [{ stageOrder: 1, stageType: 'KNOCKOUT', groupCount: 2, qualifyPerGroup: 2, matchPerTeam: 3, penaltyEnabled: false, swissRounds: 5, swissHasPlayoff: false, swissPlayoffTop: 4 }];
                              setCategoryEditForm({
                                name: cat.name,
                                sportType: cat.sportType,
                                gender: cat.gender,
                                maxDateOfBirth: cat.maxDateOfBirth,
                                minDateOfBirth: cat.minDateOfBirth || '',
                                matchDurationMinutes: cat.matchDurationMinutes,
                                halfCount: cat.halfCount,
                                breakDurationMinutes: cat.breakDurationMinutes,
                                injuryTimeMinutes: cat.injuryTimeMinutes,
                                stageCount,
                                stages,
                              });
                            }}
                          >
                            Ubah
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleRemoveCategory(cat.id)}
                          >
                            Hapus
                          </Button>
                          <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-500 text-white"
                            onClick={() => router.push(`/organizer/category/${cat.id}`)}
                          >
                            Kelola Kategori
                          </Button>
                        </div>
                      </div>

                      {/* Team list for this category */}
                      <div className="border-t border-white/10 pt-3">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-medium text-slate-400">Tim Terdaftar</p>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              setTeamModalCategoryId(cat.id);
                              setSelectedTeamId('');
                              setSelectedGroupId('');
                              setTeamModalOpen(true);
                              // Fetch groups if category has a GROUP stage
                              const hasGroupStage = (cat.stages || []).some(
                                (s) => s.stageType === 'GROUP',
                              );
                              if (hasGroupStage && !categoryStageGroups[cat.id]) {
                                // Prefer groups already loaded in category data
                                if (cat.categoryGroups && cat.categoryGroups.length > 0) {
                                  setCategoryStageGroups((prev) => ({
                                    ...prev,
                                    [cat.id]: cat.categoryGroups!,
                                  }));
                                } else {
                                  try {
                                    const res = await apiGet<{ data: CategoryGroup[] }>(
                                      `/event-categories/${cat.id}/stage-groups`,
                                    );
                                    setCategoryStageGroups((prev) => ({
                                      ...prev,
                                      [cat.id]: res.data || [],
                                    }));
                                  } catch { /* silent */ }
                                }
                              }
                            }}
                          >
                            Tambah Tim
                          </Button>
                        </div>
                        {(cat.categoryTeams || []).length === 0 ? (
                          <p className="text-xs text-slate-500 py-2">Belum ada tim di kategori ini.</p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {(cat.categoryTeams || []).map((ct) => (
                              <div
                                key={ct.id}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/60 border border-white/10"
                              >
                                <span className="text-sm text-slate-200">{ct.team?.name || ct.teamId}</span>
                                {ct.categoryGroup && (
                                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-900/50 text-indigo-300 border border-indigo-700/40">
                                    {ct.categoryGroup.name}
                                  </span>
                                )}
                                {ct.team?.city && <span className="text-xs text-slate-500">{ct.team.city}</span>}
                                <button
                                  onClick={() => handleRemoveTeamFromCategory(cat.id, ct.teamId)}
                                  className="text-red-400 hover:text-red-300 text-xs ml-1"
                                  title="Hapus tim"
                                >
                                  &times;
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}

          {/* Create Category Modal */}
          <Modal
            open={categoryModalOpen}
            onClose={() => setCategoryModalOpen(false)}
          >
            <form onSubmit={handleCreateCategory} className="space-y-4">
              <h2 className="text-xl font-bold">Buat Kategori Baru</h2>
              <p className="text-sm text-slate-400">
                Tentukan nama, jenis olahraga, gender, aturan usia, dan pengaturan waktu pertandingan.
              </p>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Nama Kategori *
                </label>
                <Input
                  value={categoryForm.name}
                  onChange={(e) =>
                    setCategoryForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="cth. Futsal Putra U-17, Basket Putri Senior"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Jenis Olahraga *
                  </label>
                  <Select
                    value={categoryForm.sportType}
                    onChange={(e) =>
                      setCategoryForm((prev) => ({ ...prev, sportType: e.target.value }))
                    }
                    className="w-full"
                  >
                    {SPORT_TYPES.map((st) => (
                      <option key={st} value={st}>{st.replace(/_/g, ' ')}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Gender *
                  </label>
                  <Select
                    value={categoryForm.gender}
                    onChange={(e) =>
                      setCategoryForm((prev) => ({ ...prev, gender: e.target.value }))
                    }
                    className="w-full"
                  >
                    {GENDERS.map((g) => (
                      <option key={g.value} value={g.value}>{g.label}</option>
                    ))}
                  </Select>
                </div>
              </div>

              <div className="border-t border-white/10 pt-4">
                <p className="text-sm font-medium text-slate-300 mb-3">Aturan Usia</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">
                      Maks. Tanggal Lahir *
                    </label>
                    <Input
                      type="date"
                      value={categoryForm.maxDateOfBirth}
                      onChange={(e) =>
                        setCategoryForm((prev) => ({ ...prev, maxDateOfBirth: e.target.value }))
                      }
                    />
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Pemain harus lahir pada atau setelah tanggal ini
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">
                      Min. Tanggal Lahir (opsional)
                    </label>
                    <Input
                      type="date"
                      value={categoryForm.minDateOfBirth}
                      onChange={(e) =>
                        setCategoryForm((prev) => ({ ...prev, minDateOfBirth: e.target.value }))
                      }
                    />
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Batas atas usia (pemain harus lahir sebelum tanggal ini)
                    </p>
                  </div>
                </div>
              </div>

              {/* Stage Configuration */}
              <div className="border-t border-white/10 pt-4">
                <p className="text-sm font-medium text-slate-300 mb-3">Format Turnamen</p>
                <div className="mb-3">
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Jumlah Stage
                  </label>
                  <Select
                    value={String(categoryForm.stageCount)}
                    onChange={(e) => {
                      const count = Number(e.target.value);
                      setCategoryForm((prev) => {
                        const stages = [...prev.stages];
                        while (stages.length < count) {
                          stages.push({
                            stageOrder: stages.length + 1,
                            stageType: 'KNOCKOUT',
                            groupCount: 2,
                            qualifyPerGroup: 2,
                            matchPerTeam: 3,
                            penaltyEnabled: false,
                            swissRounds: 5,
                            swissHasPlayoff: false,
                            swissPlayoffTop: 4,
                          });
                        }
                        return { ...prev, stageCount: count, stages };
                      });
                    }}
                    className="w-full"
                  >
                    <option value="1">1 Stage</option>
                    <option value="2">2 Stage</option>
                    <option value="3">3 Stage</option>
                  </Select>
                </div>

                <div className="space-y-3">
                  {Array.from({ length: categoryForm.stageCount }).map((_, idx) => {
                    const stage = categoryForm.stages[idx] || {
                      stageOrder: idx + 1,
                      stageType: 'KNOCKOUT',
                      groupCount: 2,
                      qualifyPerGroup: 2,
                      swissRounds: 5,
                      swissHasPlayoff: false,
                      swissPlayoffTop: 4,
                    };
                    return (
                      <div
                        key={idx}
                        className="p-3 rounded-lg border border-white/10 bg-white/[0.02]"
                      >
                        <p className="text-xs font-bold text-slate-300 mb-2">
                          Stage {idx + 1}
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div>
                            <label className="block text-[10px] font-medium text-slate-400 mb-0.5">
                              Tipe
                            </label>
                            <Select
                              value={stage.stageType}
                              onChange={(e) => {
                                setCategoryForm((prev) => {
                                  const stages = [...prev.stages];
                                  stages[idx] = {
                                    ...stages[idx],
                                    stageType: e.target.value,
                                    stageOrder: idx + 1,
                                  };
                                  return { ...prev, stages };
                                });
                              }}
                              className="w-full"
                            >
                              <option value="GROUP">GROUP</option>
                              <option value="SPECIAL_GROUP">SPECIAL GROUP</option>
                              <option value="GROUP_NEIGHBOR">GROUP NEIGHBOR</option>
                              <option value="KNOCKOUT">KNOCKOUT</option>
                              <option value="LEAGUE">LEAGUE</option>
                              <option value="DOUBLE_ELIMINATION">DOUBLE ELIMINATION</option>
                              <option value="SWISS">SWISS</option>
                            </Select>
                          </div>
                          {(stage.stageType === 'GROUP' || stage.stageType === 'SPECIAL_GROUP' || stage.stageType === 'GROUP_NEIGHBOR') && (
                            <>
                              <div>
                                <label className="block text-[10px] font-medium text-slate-400 mb-0.5">
                                  Jumlah Grup
                                </label>
                                <Input
                                  type="number"
                                  min={1}
                                  max={16}
                                  value={stage.groupCount}
                                  onChange={(e) => {
                                    setCategoryForm((prev) => {
                                      const stages = [...prev.stages];
                                      stages[idx] = {
                                        ...stages[idx],
                                        groupCount: Number(e.target.value),
                                      };
                                      return { ...prev, stages };
                                    });
                                  }}
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-medium text-slate-400 mb-0.5">
                                  Lolos per Grup
                                </label>
                                <Input
                                  type="number"
                                  min={1}
                                  max={8}
                                  value={stage.qualifyPerGroup}
                                  onChange={(e) => {
                                    setCategoryForm((prev) => {
                                      const stages = [...prev.stages];
                                      stages[idx] = {
                                        ...stages[idx],
                                        qualifyPerGroup: Number(e.target.value),
                                      };
                                      return { ...prev, stages };
                                    });
                                  }}
                                />
                              </div>
                              {stage.stageType === 'SPECIAL_GROUP' && (
                                <div>
                                  <label className="block text-[10px] font-medium text-slate-400 mb-0.5">Match per Tim</label>
                                  <Input
                                    type="number"
                                    min={1}
                                    max={20}
                                    value={stage.matchPerTeam ?? 3}
                                    onChange={(e) => {
                                      setCategoryForm((prev) => {
                                        const stages = [...prev.stages];
                                        stages[idx] = { ...stages[idx], matchPerTeam: Number(e.target.value) };
                                        return { ...prev, stages };
                                      });
                                    }}
                                  />
                                </div>
                              )}
                            </>
                          )}
                          {(stage.stageType === 'GROUP' || stage.stageType === 'SPECIAL_GROUP' || stage.stageType === 'GROUP_NEIGHBOR' || stage.stageType === 'LEAGUE') && (
                            <div className="col-span-full">
                              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={stage.penaltyEnabled ?? false}
                                  onChange={(e) => {
                                    setCategoryForm((prev) => {
                                      const stages = [...prev.stages];
                                      stages[idx] = { ...stages[idx], penaltyEnabled: e.target.checked };
                                      return { ...prev, stages };
                                    });
                                  }}
                                  className="w-3.5 h-3.5 accent-blue-500"
                                />
                                Aktifkan Adu Penalti (seri → penalti)
                              </label>
                            </div>
                          )}
                          {stage.stageType === 'SWISS' && (
                            <>
                              <div>
                                <label className="block text-[10px] font-medium text-slate-400 mb-0.5">
                                  Jumlah Ronde
                                </label>
                                <Input
                                  type="number"
                                  min={1}
                                  max={20}
                                  value={stage.swissRounds ?? 5}
                                  onChange={(e) => {
                                    setCategoryForm((prev) => {
                                      const stages = [...prev.stages];
                                      stages[idx] = { ...stages[idx], swissRounds: Number(e.target.value) };
                                      return { ...prev, stages };
                                    });
                                  }}
                                />
                              </div>
                              <div className="flex flex-col gap-1">
                                <label className="block text-[10px] font-medium text-slate-400 mb-0.5">
                                  Playoff
                                </label>
                                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={stage.swissHasPlayoff ?? false}
                                    onChange={(e) => {
                                      setCategoryForm((prev) => {
                                        const stages = [...prev.stages];
                                        stages[idx] = { ...stages[idx], swissHasPlayoff: e.target.checked };
                                        return { ...prev, stages };
                                      });
                                    }}
                                    className="w-3.5 h-3.5 accent-blue-500"
                                  />
                                  Ada playoff
                                </label>
                                {stage.swissHasPlayoff && (
                                  <Input
                                    type="number"
                                    min={2}
                                    max={8}
                                    value={stage.swissPlayoffTop ?? 4}
                                    onChange={(e) => {
                                      setCategoryForm((prev) => {
                                        const stages = [...prev.stages];
                                        stages[idx] = { ...stages[idx], swissPlayoffTop: Number(e.target.value) };
                                        return { ...prev, stages };
                                      });
                                    }}
                                    placeholder="Top N tim lolos playoff"
                                  />
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="border-t border-white/10 pt-4">
                <p className="text-sm font-medium text-slate-300 mb-3">Pengaturan Waktu Pertandingan</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">
                      Total Durasi (menit) *
                    </label>
                    <Input
                      type="number"
                      min={1}
                      value={categoryForm.matchDurationMinutes}
                      onChange={(e) =>
                        setCategoryForm((prev) => ({ ...prev, matchDurationMinutes: Number(e.target.value) }))
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">
                      Jumlah Babak *
                    </label>
                    <Input
                      type="number"
                      min={1}
                      value={categoryForm.halfCount}
                      onChange={(e) =>
                        setCategoryForm((prev) => ({ ...prev, halfCount: Number(e.target.value) }))
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">
                      Istirahat (menit)
                    </label>
                    <Input
                      type="number"
                      min={0}
                      value={categoryForm.breakDurationMinutes}
                      onChange={(e) =>
                        setCategoryForm((prev) => ({ ...prev, breakDurationMinutes: Number(e.target.value) }))
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">
                      Injury Time (menit)
                    </label>
                    <Input
                      type="number"
                      min={0}
                      value={categoryForm.injuryTimeMinutes}
                      onChange={(e) =>
                        setCategoryForm((prev) => ({ ...prev, injuryTimeMinutes: Number(e.target.value) }))
                      }
                    />
                  </div>
                </div>
                {categoryForm.halfCount > 0 && categoryForm.matchDurationMinutes > 0 && (
                  <p className="text-xs text-slate-500 mt-2">
                    = {categoryForm.halfCount}x{Math.round(categoryForm.matchDurationMinutes / categoryForm.halfCount)} menit per babak
                    {categoryForm.breakDurationMinutes > 0 && `, istirahat ${categoryForm.breakDurationMinutes} menit`}
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCategoryModalOpen(false)}
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  disabled={creatingCategory || !categoryForm.name.trim() || !categoryForm.maxDateOfBirth}
                >
                  {creatingCategory ? <Spinner className="w-4 h-4" /> : 'Buat Kategori'}
                </Button>
              </div>
            </form>
          </Modal>

          {/* Add Team to Category Modal */}
          <Modal
            open={teamModalOpen}
            onClose={() => { setTeamModalOpen(false); setTeamModalCategoryId(null); setSelectedGroupId(''); }}
          >
            <div className="space-y-4">
              <h2 className="text-xl font-bold">Tambah Tim ke Kategori</h2>
              {teamModalCategoryId && (
                <p className="text-sm text-slate-400">
                  Kategori: <span className="text-slate-200 font-medium">{categories.find((c) => c.id === teamModalCategoryId)?.name}</span>
                </p>
              )}

              {/* Group dropdown — shown when category has a GROUP stage */}
              {teamModalCategoryId && (() => {
                const cat = categories.find((c) => c.id === teamModalCategoryId);
                const hasGroupStage = (cat?.stages || []).some((s) => s.stageType === 'GROUP');
                const groups = categoryStageGroups[teamModalCategoryId] || [];
                if (!hasGroupStage) return null;
                return (
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">
                      Pilih Grup <span className="text-red-400">*</span>
                    </label>
                    <Select
                      value={selectedGroupId}
                      onChange={(e) => setSelectedGroupId(e.target.value)}
                      className="w-full"
                    >
                      <option value="">-- Pilih grup --</option>
                      {groups.map((g) => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </Select>
                    {groups.length === 0 && (
                      <p className="text-xs text-amber-400 mt-1">
                        Grup belum tersedia untuk kategori ini.
                      </p>
                    )}
                  </div>
                );
              })()}

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Pilih Tim
                </label>
                <Select
                  value={selectedTeamId}
                  onChange={(e) => setSelectedTeamId(e.target.value)}
                  className="w-full"
                >
                  <option value="">-- Pilih tim --</option>
                  {unregisteredTeamsForCategory.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </Select>
                {unregisteredTeamsForCategory.length === 0 && (
                  <p className="text-sm text-slate-500 mt-1">
                    Semua tim yang tersedia sudah terdaftar di kategori ini.
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => { setTeamModalOpen(false); setTeamModalCategoryId(null); setSelectedGroupId(''); }}
                >
                  Batal
                </Button>
                <Button
                  onClick={handleAddTeamToCategory}
                  disabled={!selectedTeamId || registeringTeam || (() => {
                    if (!teamModalCategoryId) return false;
                    const cat = categories.find((c) => c.id === teamModalCategoryId);
                    const hasGroupStage = (cat?.stages || []).some((s) => s.stageType === 'GROUP');
                    return hasGroupStage && !selectedGroupId;
                  })()}
                >
                  {registeringTeam ? (
                    <Spinner className="w-4 h-4" />
                  ) : (
                    'Daftarkan'
                  )}
                </Button>
              </div>
            </div>
          </Modal>
        </div>
      )}

      {/* Publish Confirmation Modal */}
      <Modal
        open={publishModalOpen}
        onClose={() => setPublishModalOpen(false)}
      >
        <div className="space-y-4">
          <h2 className="text-xl font-bold">
            {event?.status === 'DRAFT'
              ? 'Publikasikan Acara'
              : 'Batalkan Publikasi'}
          </h2>
          <p className="text-slate-400">
            {event?.status === 'DRAFT'
              ? 'Publikasikan acara ini agar terlihat oleh publik?'
              : 'Kembalikan acara ini ke status draf? Acara tidak akan terlihat oleh publik.'}
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => setPublishModalOpen(false)}
              disabled={publishingEvent}
            >
              Batal
            </Button>
            <Button
              onClick={handleToggleEventPublish}
              disabled={publishingEvent}
              className={
                event?.status === 'DRAFT'
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  : ''
              }
            >
              {publishingEvent ? (
                <Spinner className="w-4 h-4" />
              ) : event?.status === 'DRAFT' ? (
                'Ya, Publikasikan'
              ) : (
                'Ya, Batalkan'
              )}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}


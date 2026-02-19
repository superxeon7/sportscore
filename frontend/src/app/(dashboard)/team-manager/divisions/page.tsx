'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import type { TeamDivision } from '@/lib/types';
import {
  FolderTree,
  Plus,
  Pencil,
  Trash2,
  Users,
} from 'lucide-react';

const SPORT_OPTIONS = [
  { value: '', label: 'Tidak ditentukan' },
  { value: 'FOOTBALL', label: 'Sepak Bola' },
  { value: 'FUTSAL', label: 'Futsal' },
  { value: 'BASKETBALL', label: 'Basket' },
  { value: 'VOLLEYBALL', label: 'Voli' },
  { value: 'BADMINTON', label: 'Bulu Tangkis' },
  { value: 'TABLE_TENNIS', label: 'Tenis Meja' },
  { value: 'OTHER', label: 'Lainnya' },
];

const AGE_OPTIONS = [
  { value: '', label: 'Tidak ditentukan' },
  { value: 'U8', label: 'U-8' },
  { value: 'U10', label: 'U-10' },
  { value: 'U12', label: 'U-12' },
  { value: 'U14', label: 'U-14' },
  { value: 'U16', label: 'U-16' },
  { value: 'U18', label: 'U-18' },
  { value: 'U20', label: 'U-20' },
  { value: 'U23', label: 'U-23' },
  { value: 'SENIOR', label: 'Senior' },
  { value: 'VETERAN', label: 'Veteran' },
  { value: 'OPEN', label: 'Terbuka' },
];

const GENDER_OPTIONS = [
  { value: '', label: 'Tidak ditentukan' },
  { value: 'MALE', label: 'Putra' },
  { value: 'FEMALE', label: 'Putri' },
  { value: 'MIXED', label: 'Campuran' },
];

interface DivisionForm {
  name: string;
  description: string;
  sportType: string;
  ageGroup: string;
  gender: string;
}

const emptyForm: DivisionForm = {
  name: '',
  description: '',
  sportType: '',
  ageGroup: '',
  gender: '',
};

export default function DivisionsPage() {
  const [divisions, setDivisions] = useState<TeamDivision[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<DivisionForm>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchDivisions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<TeamDivision[]>('/team-divisions');
      setDivisions(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal memuat divisi');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDivisions();
  }, [fetchDivisions]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEdit(d: TeamDivision) {
    setEditingId(d.id);
    setForm({
      name: d.name,
      description: d.description ?? '',
      sportType: d.sportType ?? '',
      ageGroup: d.ageGroup ?? '',
      gender: d.gender ?? '',
    });
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const body: Record<string, string | undefined> = {
        name: form.name,
      };
      if (form.description) body.description = form.description;
      if (form.sportType) body.sportType = form.sportType;
      if (form.ageGroup) body.ageGroup = form.ageGroup;
      if (form.gender) body.gender = form.gender;

      if (editingId) {
        await apiPatch(`/team-divisions/${editingId}`, body);
      } else {
        await apiPost('/team-divisions', body);
      }
      setModalOpen(false);
      fetchDivisions();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Gagal menyimpan');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await apiDelete(`/team-divisions/${deleteId}`);
      setDeleteId(null);
      fetchDivisions();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Gagal menghapus');
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-100">Divisi Tim</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-36 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-100">Divisi Tim</h1>
        <Card className="p-6">
          <p className="text-red-400">Error: {error}</p>
          <Button className="mt-4" onClick={fetchDivisions}>Coba Lagi</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Divisi Tim</h1>
          <p className="text-sm text-slate-400 mt-1">
            Kelola divisi internal tim Anda (akademi, kelompok umur, dll.)
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Tambah Divisi
        </Button>
      </div>

      {divisions.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-700 mx-auto mb-4">
            <FolderTree className="h-8 w-8 text-white" />
          </div>
          <h3 className="text-lg font-semibold text-slate-100 mb-2">
            Belum Ada Divisi
          </h3>
          <p className="text-slate-400 mb-6 max-w-md mx-auto">
            Buat divisi untuk mengorganisasi pemain secara internal, seperti Akademi, U-17, Tim Utama, dll.
          </p>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Buat Divisi Pertama
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {divisions.map((d) => (
            <Card key={d.id} className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-700">
                    <FolderTree className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-100">{d.name}</h3>
                    {d.description && (
                      <p className="text-xs text-slate-400 mt-0.5">{d.description}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5 mb-3">
                {d.sportType && (
                  <Badge variant="default">
                    {SPORT_OPTIONS.find((s) => s.value === d.sportType)?.label ?? d.sportType}
                  </Badge>
                )}
                {d.ageGroup && (
                  <Badge variant="secondary">
                    {AGE_OPTIONS.find((a) => a.value === d.ageGroup)?.label ?? d.ageGroup}
                  </Badge>
                )}
                {d.gender && (
                  <Badge variant="info">
                    {GENDER_OPTIONS.find((g) => g.value === d.gender)?.label ?? d.gender}
                  </Badge>
                )}
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-sm text-slate-400">
                  <Users className="h-4 w-4" />
                  <span>{d._count?.players ?? 0} pemain</span>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(d)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setDeleteId(d.id)}>
                    <Trash2 className="h-4 w-4 text-red-400" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? 'Edit Divisi' : 'Tambah Divisi'}
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleSubmit} disabled={submitting || !form.name.trim()}>
              {submitting ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Nama Divisi <span className="text-red-400">*</span>
            </label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Contoh: Akademi, U-17, Tim Utama"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Deskripsi
            </label>
            <Input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Deskripsi singkat (opsional)"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Olahraga
              </label>
              <Select
                value={form.sportType}
                onChange={(e) => setForm({ ...form, sportType: e.target.value })}
                options={SPORT_OPTIONS}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Usia
              </label>
              <Select
                value={form.ageGroup}
                onChange={(e) => setForm({ ...form, ageGroup: e.target.value })}
                options={AGE_OPTIONS}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Gender
              </label>
              <Select
                value={form.gender}
                onChange={(e) => setForm({ ...form, gender: e.target.value })}
                options={GENDER_OPTIONS}
              />
            </div>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Hapus Divisi"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Batal
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Hapus
            </Button>
          </>
        }
      >
        <p className="text-slate-300">
          Apakah Anda yakin ingin menghapus divisi ini? Semua data pemain di divisi ini akan dihapus.
        </p>
      </Modal>
    </div>
  );
}

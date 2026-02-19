'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiGet, apiPost, apiPatch, apiDelete, apiUpload } from '@/lib/api/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { Spinner } from '@/components/ui/spinner';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { Briefcase, User, Camera } from 'lucide-react';

enum OfficialRole {
    COACH = 'COACH',
    ASSISTANT_COACH = 'ASSISTANT_COACH',
    MANAGER = 'MANAGER',
    PHYSIO = 'PHYSIO',
    OTHER = 'OTHER',
}

const ROLE_LABELS: Record<OfficialRole, string> = {
    [OfficialRole.COACH]: 'Pelatih Kepala',
    [OfficialRole.ASSISTANT_COACH]: 'Asisten Pelatih',
    [OfficialRole.MANAGER]: 'Manajer Tim',
    [OfficialRole.PHYSIO]: 'Fisioterapis',
    [OfficialRole.OTHER]: 'Staf Lain',
};

const COUNTRIES = [
    { code: 'ID', name: 'Indonesia' },
    { code: 'MY', name: 'Malaysia' },
    { code: 'SG', name: 'Singapura' },
    { code: 'TH', name: 'Thailand' },
    { code: 'PH', name: 'Filipina' },
    { code: 'VN', name: 'Vietnam' },
    { code: 'JP', name: 'Jepang' },
    { code: 'KR', name: 'Korea Selatan' },
    { code: 'CN', name: 'Tiongkok' },
    { code: 'AU', name: 'Australia' },
    { code: 'BR', name: 'Brasil' },
    { code: 'AR', name: 'Argentina' },
    { code: 'DE', name: 'Jerman' },
    { code: 'FR', name: 'Prancis' },
    { code: 'ES', name: 'Spanyol' },
    { code: 'IT', name: 'Italia' },
    { code: 'GB', name: 'Inggris' },
    { code: 'PT', name: 'Portugal' },
    { code: 'NL', name: 'Belanda' },
    { code: 'US', name: 'Amerika Serikat' },
    { code: 'NG', name: 'Nigeria' },
];

interface TeamOfficial {
    id: string;
    fullName: string;
    dateOfBirth?: string;
    placeOfBirth?: string;
    nationality?: string;
    role: OfficialRole;
    photoUrl?: string;
    isActive: boolean;
}

interface OfficialFormData {
    fullName: string;
    dateOfBirth: string;
    placeOfBirth: string;
    nationality: string;
    role: OfficialRole;
    photoUrl: string;
}

const defaultForm: OfficialFormData = {
    fullName: '',
    dateOfBirth: '',
    placeOfBirth: '',
    nationality: '',
    role: OfficialRole.COACH,
    photoUrl: '',
};

export default function TeamOfficialsPage() {
    const toast = useToast();

    const [officials, setOfficials] = useState<TeamOfficial[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [modalOpen, setModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState<OfficialFormData>(defaultForm);
    const [formErrors, setFormErrors] = useState<Partial<Record<keyof OfficialFormData, string>>>({});
    const [submitting, setSubmitting] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    // Photo upload
    const [uploading, setUploading] = useState(false);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await apiGet<TeamOfficial[]>('/team-officials');
            setOfficials(Array.isArray(res) ? res : []);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Gagal memuat data';
            setError(message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const openCreateModal = () => {
        setEditingId(null);
        setForm(defaultForm);
        setFormErrors({});
        setModalOpen(true);
    };

    const openEditModal = (official: TeamOfficial) => {
        setEditingId(official.id);
        setForm({
            fullName: official.fullName,
            dateOfBirth: official.dateOfBirth ? official.dateOfBirth.slice(0, 10) : '',
            placeOfBirth: official.placeOfBirth ?? '',
            nationality: official.nationality ?? '',
            role: official.role,
            photoUrl: official.photoUrl ?? '',
        });
        setFormErrors({});
        setModalOpen(true);
    };

    const closeModal = () => {
        setModalOpen(false);
        setEditingId(null);
        setForm(defaultForm);
        setFormErrors({});
    };

    const validateForm = (): boolean => {
        const errors: Partial<Record<keyof OfficialFormData, string>> = {};
        if (!form.fullName.trim()) errors.fullName = 'Nama lengkap wajib diisi';
        if (!editingId) {
            if (!form.dateOfBirth) errors.dateOfBirth = 'Tanggal lahir wajib diisi';
            if (!form.photoUrl) errors.photoUrl = 'Foto wajib diunggah';
        }
        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const result = await apiUpload<{ url: string }>('/uploads/image', formData);
            setForm((prev) => ({ ...prev, photoUrl: result.url }));
            toast.success('Foto berhasil diunggah');
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Upload gagal';
            toast.error(message);
        } finally {
            setUploading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validateForm()) return;

        setSubmitting(true);
        try {
            const payload = {
                fullName: form.fullName.trim(),
                dateOfBirth: form.dateOfBirth || undefined,
                placeOfBirth: form.placeOfBirth.trim() || undefined,
                nationality: form.nationality || undefined,
                role: form.role,
                photoUrl: form.photoUrl || undefined,
            };

            if (editingId) {
                const updated = await apiPatch<TeamOfficial>(
                    `/team-officials/${editingId}`,
                    payload,
                );
                setOfficials((prev) =>
                    prev.map((o) => (o.id === editingId ? { ...o, ...updated } : o)),
                );
                toast.success('Ofisial berhasil diperbarui');
            } else {
                const created = await apiPost<TeamOfficial>('/team-officials', payload);
                setOfficials((prev) => [...prev, created]);
                toast.success('Ofisial berhasil ditambahkan');
            }
            closeModal();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Gagal menyimpan data';
            toast.error(message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (official: TeamOfficial) => {
        if (!confirm(`Hapus ofisial ${official.fullName}?`)) return;

        setDeletingId(official.id);
        try {
            await apiDelete(`/team-officials/${official.id}`);
            setOfficials((prev) => prev.filter((o) => o.id !== official.id));
            toast.success('Ofisial berhasil dihapus');
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Gagal menghapus data';
            toast.error(message);
        } finally {
            setDeletingId(null);
        }
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <h1 className="text-2xl font-bold text-slate-100">Ofisial Tim</h1>
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
                <h1 className="text-2xl font-bold text-slate-100">Ofisial Tim</h1>
                <Card className="p-6">
                    <p className="text-red-400">Error: {error}</p>
                    <Button className="mt-4" onClick={fetchData}>
                        Coba Lagi
                    </Button>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-100">Ofisial Tim</h1>
                    <p className="text-sm text-slate-400 mt-1">
                        Kelola pelatih dan staf pendukung tim Anda
                    </p>
                </div>
                <Button onClick={openCreateModal}>Tambah Ofisial</Button>
            </div>

            {/* Summary */}
            <Card className="p-5">
                <p className="text-sm text-slate-400">Total Ofisial</p>
                <p className="text-2xl font-bold mt-1">{officials.length}</p>
            </Card>

            {/* Officials list */}
            {officials.length === 0 ? (
                <Card className="p-12 text-center text-slate-500 bg-slate-900/50 border-dashed border-slate-700">
                    <Briefcase className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <h3 className="text-lg font-medium text-slate-300">Belum ada ofisial</h3>
                    <p className="mb-6">Tambahkan pelatih dan staf pendukung untuk tim Anda.</p>
                    <Button onClick={openCreateModal}>Tambah Ofisial</Button>
                </Card>
            ) : (
                <Card className="overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-800/60 border-b border-white/10">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">
                                        Foto
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">
                                        Nama
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">
                                        Peran
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">
                                        Kebangsaan
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">
                                        Tgl Lahir
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">
                                        Aksi
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {officials.map((official) => (
                                    <tr key={official.id} className="hover:bg-white/5">
                                        <td className="px-4 py-3">
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
                                        </td>
                                        <td className="px-4 py-3 font-medium">
                                            {official.fullName}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-slate-400">
                                            {ROLE_LABELS[official.role] || official.role}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-slate-400">
                                            {official.nationality || '-'}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-slate-400">
                                            {official.dateOfBirth
                                                ? new Date(official.dateOfBirth).toLocaleDateString('id-ID')
                                                : '-'}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex gap-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => openEditModal(official)}
                                                >
                                                    Edit
                                                </Button>
                                                <Button
                                                    variant="destructive"
                                                    size="sm"
                                                    disabled={deletingId === official.id}
                                                    onClick={() => handleDelete(official)}
                                                >
                                                    {deletingId === official.id ? (
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

            {/* Add/Edit Modal */}
            <Modal open={modalOpen} onClose={closeModal}>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <h2 className="text-xl font-bold">
                        {editingId ? 'Edit Ofisial' : 'Tambah Ofisial'}
                    </h2>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">
                            Nama Lengkap <span className="text-red-400">*</span>
                        </label>
                        <Input
                            value={form.fullName}
                            onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))}
                            placeholder="Nama lengkap ofisial"
                        />
                        {formErrors.fullName && (
                            <p className="text-red-500 text-xs mt-1">{formErrors.fullName}</p>
                        )}
                    </div>

                    <div>
                        <Select
                            label="Peran"
                            value={form.role}
                            onChange={(e) =>
                                setForm((prev) => ({ ...prev, role: e.target.value as OfficialRole }))
                            }
                        >
                            {Object.entries(ROLE_LABELS).map(([key, label]) => (
                                <option key={key} value={key}>
                                    {label}
                                </option>
                            ))}
                        </Select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">
                            Tanggal Lahir {!editingId && <span className="text-red-400">*</span>}
                        </label>
                        <Input
                            type="date"
                            value={form.dateOfBirth}
                            onChange={(e) =>
                                setForm((prev) => ({ ...prev, dateOfBirth: e.target.value }))
                            }
                        />
                        {formErrors.dateOfBirth && (
                            <p className="text-red-500 text-xs mt-1">{formErrors.dateOfBirth}</p>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">
                            Tempat Lahir
                        </label>
                        <Input
                            value={form.placeOfBirth}
                            onChange={(e) =>
                                setForm((prev) => ({ ...prev, placeOfBirth: e.target.value }))
                            }
                            placeholder="cth. Jakarta"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">
                            Kebangsaan
                        </label>
                        <Select
                            value={form.nationality}
                            onChange={(e) =>
                                setForm((prev) => ({ ...prev, nationality: e.target.value }))
                            }
                        >
                            <option value="">-- Pilih Kebangsaan --</option>
                            {COUNTRIES.map((c) => (
                                <option key={c.code} value={c.name}>
                                    {c.name}
                                </option>
                            ))}
                        </Select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">
                            Foto {!editingId && <span className="text-red-400">*</span>}
                        </label>
                        <div className="flex items-center gap-3">
                            <div className="h-16 w-16 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center overflow-hidden flex-shrink-0">
                                {form.photoUrl ? (
                                    <img
                                        src={form.photoUrl}
                                        alt="Preview"
                                        className="h-full w-full object-cover"
                                        onError={(e) => (e.currentTarget.src = '')}
                                    />
                                ) : (
                                    <Camera className="h-6 w-6 text-slate-500" />
                                )}
                            </div>
                            <div className="flex-1 space-y-2">
                                <label className="inline-flex items-center gap-2 cursor-pointer text-sm text-blue-400 hover:text-blue-300">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={handlePhotoUpload}
                                        disabled={uploading}
                                    />
                                    {uploading ? (
                                        <Spinner className="w-4 h-4" />
                                    ) : (
                                        'Upload Foto'
                                    )}
                                </label>
                                <Input
                                    placeholder="Atau masukkan URL foto"
                                    value={form.photoUrl}
                                    onChange={(e) =>
                                        setForm((prev) => ({ ...prev, photoUrl: e.target.value }))
                                    }
                                    className="text-sm"
                                />
                            </div>
                        </div>
                        {formErrors.photoUrl && (
                            <p className="text-red-500 text-xs mt-1">{formErrors.photoUrl}</p>
                        )}
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <Button type="button" variant="outline" onClick={closeModal}>
                            Batal
                        </Button>
                        <Button type="submit" disabled={submitting}>
                            {submitting ? (
                                <Spinner className="w-4 h-4" />
                            ) : editingId ? (
                                'Perbarui'
                            ) : (
                                'Tambah Ofisial'
                            )}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}

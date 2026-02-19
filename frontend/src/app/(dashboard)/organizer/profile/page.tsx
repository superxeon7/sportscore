'use client';

import { useEffect, useState, useRef } from 'react';
import { useAuthStore } from '@/lib/stores/auth.store';
import { apiPatch, apiUpload } from '@/lib/api/client';
import { useToast } from '@/components/ui/toast';
import InitialsAvatar from '@/components/ui/initials-avatar';
import { Camera, Save, Loader2, User, Phone, Mail, FileText } from 'lucide-react';

export default function OrganizerProfilePage() {
    const { user, initialize } = useAuthStore();
    const toast = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [phone, setPhone] = useState('');
    const [bio, setBio] = useState('');
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        if (user) {
            setFirstName(user.firstName || '');
            setLastName(user.lastName || '');
            setPhone((user as any).phone || '');
            setBio((user as any).bio || '');
        }
    }, [user]);

    const handleSave = async () => {
        setSaving(true);
        try {
            await apiPatch('/users/me', { firstName, lastName, phone, bio });
            await initialize();
            toast.success('Profil berhasil diperbarui');
        } catch {
            toast.error('Gagal menyimpan profil');
        } finally {
            setSaving(false);
        }
    };

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            await apiUpload('/users/me/avatar', formData);
            await initialize();
            toast.success('Foto profil diperbarui');
        } catch {
            toast.error('Gagal mengunggah foto');
        } finally {
            setUploading(false);
        }
    };

    if (!user) return null;

    const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();

    return (
        <div className="max-w-2xl mx-auto">
            {/* Page Header */}
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-white">Profil Saya</h1>
                <p className="text-sm text-slate-400 mt-1">Kelola informasi profil dan foto Anda</p>
            </div>

            {/* Avatar Section */}
            <div className="glass-card p-6 mb-6">
                <div className="flex items-center gap-6">
                    <div className="relative group">
                        <InitialsAvatar
                            name={fullName || 'U'}
                            imageUrl={user.avatarUrl}
                            size="xl"
                        />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploading}
                            className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                        >
                            {uploading ? (
                                <Loader2 className="h-6 w-6 text-white animate-spin" />
                            ) : (
                                <Camera className="h-6 w-6 text-white" />
                            )}
                        </button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleAvatarUpload}
                            className="hidden"
                        />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-white">{fullName || 'Pengguna'}</h2>
                        <p className="text-sm text-slate-400">{user.email}</p>
                        <span className="inline-block mt-2 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                            Penyelenggara
                        </span>
                    </div>
                </div>
            </div>

            {/* Profile Form */}
            <div className="glass-card p-6">
                <h3 className="text-base font-semibold text-white mb-5 flex items-center gap-2">
                    <User className="h-4 w-4 text-emerald-400" />
                    Informasi Profil
                </h3>

                <div className="space-y-5">
                    {/* Name Row */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1.5">Nama Depan</label>
                            <input
                                type="text"
                                value={firstName}
                                onChange={(e) => setFirstName(e.target.value)}
                                className="input-dark w-full"
                                placeholder="Nama depan"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1.5">Nama Belakang</label>
                            <input
                                type="text"
                                value={lastName}
                                onChange={(e) => setLastName(e.target.value)}
                                className="input-dark w-full"
                                placeholder="Nama belakang"
                            />
                        </div>
                    </div>

                    {/* Email (read-only) */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                            <Mail className="h-3.5 w-3.5 text-slate-500" />
                            Email
                        </label>
                        <input
                            type="email"
                            value={user.email || ''}
                            disabled
                            className="input-dark w-full opacity-60 cursor-not-allowed"
                        />
                    </div>

                    {/* Phone */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                            <Phone className="h-3.5 w-3.5 text-slate-500" />
                            Nomor Telepon
                        </label>
                        <input
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            className="input-dark w-full"
                            placeholder="+62 812 3456 7890"
                        />
                    </div>

                    {/* Bio */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                            <FileText className="h-3.5 w-3.5 text-slate-500" />
                            Bio
                        </label>
                        <textarea
                            value={bio}
                            onChange={(e) => setBio(e.target.value)}
                            rows={3}
                            maxLength={500}
                            className="input-dark w-full resize-none"
                            placeholder="Ceritakan sedikit tentang Anda..."
                        />
                        <p className="text-xs text-slate-500 mt-1 text-right">{bio.length}/500</p>
                    </div>

                    {/* Save Button */}
                    <div className="flex justify-end pt-2">
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors disabled:opacity-50"
                        >
                            {saving ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Save className="h-4 w-4" />
                            )}
                            Simpan Profil
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

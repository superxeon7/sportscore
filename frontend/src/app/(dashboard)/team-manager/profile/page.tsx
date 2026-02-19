'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useAuthStore } from '@/lib/stores/auth.store';
import { apiGet, apiPatch, apiUpload } from '@/lib/api/client';
import { useToast } from '@/components/ui/toast';
import InitialsAvatar from '@/components/ui/initials-avatar';
import {
    Camera, Save, Loader2, User, Phone, Mail, FileText,
    Flag, MapPin, ImageIcon,
} from 'lucide-react';

interface TeamData {
    id: string;
    name: string;
    shortName?: string;
    slug: string;
    logoUrl?: string | null;
    city?: string | null;
    description?: string | null;
}

export default function TeamManagerProfilePage() {
    const { user, initialize } = useAuthStore();
    const toast = useToast();
    const avatarInputRef = useRef<HTMLInputElement>(null);
    const logoInputRef = useRef<HTMLInputElement>(null);

    // Profile state
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [phone, setPhone] = useState('');
    const [bio, setBio] = useState('');
    const [savingProfile, setSavingProfile] = useState(false);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);

    // Team state
    const [team, setTeam] = useState<TeamData | null>(null);
    const [teamCity, setTeamCity] = useState('');
    const [teamBio, setTeamBio] = useState('');
    const [savingTeam, setSavingTeam] = useState(false);
    const [uploadingLogo, setUploadingLogo] = useState(false);
    const [loadingTeam, setLoadingTeam] = useState(true);

    useEffect(() => {
        if (user) {
            setFirstName(user.firstName || '');
            setLastName(user.lastName || '');
            setPhone((user as any).phone || '');
            setBio((user as any).bio || '');
        }
    }, [user]);

    const fetchTeam = useCallback(async () => {
        try {
            const data = await apiGet<TeamData>('/teams/my');
            setTeam(data);
            setTeamCity(data?.city || '');
            setTeamBio(data?.description || '');
        } catch {
            setTeam(null);
        } finally {
            setLoadingTeam(false);
        }
    }, []);

    useEffect(() => {
        fetchTeam();
    }, [fetchTeam]);

    // ── Profile Handlers ──

    const handleSaveProfile = async () => {
        setSavingProfile(true);
        try {
            await apiPatch('/users/me', { firstName, lastName, phone, bio });
            await initialize();
            toast.success('Profil berhasil diperbarui');
        } catch {
            toast.error('Gagal menyimpan profil');
        } finally {
            setSavingProfile(false);
        }
    };

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploadingAvatar(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            await apiUpload('/users/me/avatar', formData);
            await initialize();
            toast.success('Foto profil diperbarui');
        } catch {
            toast.error('Gagal mengunggah foto');
        } finally {
            setUploadingAvatar(false);
        }
    };

    // ── Team Handlers ──

    const handleSaveTeam = async () => {
        if (!team) return;
        setSavingTeam(true);
        try {
            await apiPatch(`/teams/${team.id}`, { city: teamCity, description: teamBio });
            toast.success('Info tim berhasil diperbarui');
            fetchTeam();
        } catch {
            toast.error('Gagal menyimpan info tim');
        } finally {
            setSavingTeam(false);
        }
    };

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !team) return;
        setUploadingLogo(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            await apiUpload(`/teams/${team.id}/logo`, formData);
            toast.success('Logo tim diperbarui');
            fetchTeam();
        } catch {
            toast.error('Gagal mengunggah logo');
        } finally {
            setUploadingLogo(false);
        }
    };

    if (!user) return null;

    const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();

    return (
        <div className="max-w-2xl mx-auto space-y-8">
            {/* Page Header */}
            <div>
                <h1 className="text-2xl font-bold text-white">Profil & Tim</h1>
                <p className="text-sm text-slate-400 mt-1">Kelola profil pribadi dan pengaturan tim Anda</p>
            </div>

            {/* ═══ SECTION 1: MY PROFILE ═══ */}
            <div className="glass-card p-6">
                <h3 className="text-base font-semibold text-white mb-5 flex items-center gap-2">
                    <User className="h-4 w-4 text-emerald-400" />
                    Profil Saya
                </h3>

                {/* Avatar Row */}
                <div className="flex items-center gap-5 mb-6 pb-6 border-b border-white/[0.06]">
                    <div className="relative group">
                        <InitialsAvatar
                            name={fullName || 'U'}
                            imageUrl={user.avatarUrl}
                            size="xl"
                        />
                        <button
                            onClick={() => avatarInputRef.current?.click()}
                            disabled={uploadingAvatar}
                            className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                        >
                            {uploadingAvatar ? (
                                <Loader2 className="h-6 w-6 text-white animate-spin" />
                            ) : (
                                <Camera className="h-6 w-6 text-white" />
                            )}
                        </button>
                        <input
                            ref={avatarInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleAvatarUpload}
                            className="hidden"
                        />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-white">{fullName || 'Pengguna'}</h2>
                        <p className="text-sm text-slate-400">{user.email}</p>
                        <span className="inline-block mt-2 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/20">
                            Manajer Tim
                        </span>
                    </div>
                </div>

                {/* Profile Form */}
                <div className="space-y-4">
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

                    <div className="flex justify-end pt-1">
                        <button
                            onClick={handleSaveProfile}
                            disabled={savingProfile}
                            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors disabled:opacity-50"
                        >
                            {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            Simpan Profil
                        </button>
                    </div>
                </div>
            </div>

            {/* ═══ SECTION 2: TEAM SETTINGS ═══ */}
            {loadingTeam ? (
                <div className="glass-card p-6 flex items-center justify-center h-48">
                    <Loader2 className="h-6 w-6 text-slate-500 animate-spin" />
                </div>
            ) : team ? (
                <div className="glass-card p-6">
                    <h3 className="text-base font-semibold text-white mb-5 flex items-center gap-2">
                        <Flag className="h-4 w-4 text-blue-400" />
                        Pengaturan Tim
                    </h3>

                    {/* Logo + Team Name Row */}
                    <div className="flex items-center gap-5 mb-6 pb-6 border-b border-white/[0.06]">
                        <div className="relative group">
                            <InitialsAvatar
                                name={team.name}
                                imageUrl={team.logoUrl}
                                size="xl"
                                shape="square"
                            />
                            <button
                                onClick={() => logoInputRef.current?.click()}
                                disabled={uploadingLogo}
                                className="absolute inset-0 flex items-center justify-center rounded-md bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                            >
                                {uploadingLogo ? (
                                    <Loader2 className="h-6 w-6 text-white animate-spin" />
                                ) : (
                                    <ImageIcon className="h-6 w-6 text-white" />
                                )}
                            </button>
                            <input
                                ref={logoInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleLogoUpload}
                                className="hidden"
                            />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-white">{team.name}</h2>
                            {team.shortName && (
                                <p className="text-sm text-slate-500 font-medium">{team.shortName}</p>
                            )}
                            <p className="text-xs text-slate-500 mt-1">Klik logo untuk mengganti</p>
                        </div>
                    </div>

                    {/* Team Form */}
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                                <MapPin className="h-3.5 w-3.5 text-slate-500" />
                                Kota
                            </label>
                            <input
                                type="text"
                                value={teamCity}
                                onChange={(e) => setTeamCity(e.target.value)}
                                className="input-dark w-full"
                                placeholder="Kota asal tim"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                                <FileText className="h-3.5 w-3.5 text-slate-500" />
                                Deskripsi Tim
                            </label>
                            <textarea
                                value={teamBio}
                                onChange={(e) => setTeamBio(e.target.value)}
                                rows={3}
                                maxLength={1000}
                                className="input-dark w-full resize-none"
                                placeholder="Ceritakan tentang tim Anda..."
                            />
                            <p className="text-xs text-slate-500 mt-1 text-right">{teamBio.length}/1000</p>
                        </div>

                        <div className="flex justify-end pt-1">
                            <button
                                onClick={handleSaveTeam}
                                disabled={savingTeam}
                                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors disabled:opacity-50"
                            >
                                {savingTeam ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                Simpan Tim
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="glass-card p-6 text-center">
                    <Flag className="h-10 w-10 text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-400">Anda belum memiliki tim.</p>
                    <p className="text-xs text-slate-500 mt-1">Buat tim terlebih dahulu di halaman Tim Saya.</p>
                </div>
            )}
        </div>
    );
}

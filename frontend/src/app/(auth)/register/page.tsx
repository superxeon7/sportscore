'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/lib/stores/auth.store';
import { UserRole } from '@/lib/types';
import { Mail, Lock, User, ArrowRight } from 'lucide-react';

const roleOptions = [
  { value: UserRole.TEAM_MANAGER, label: 'Manajer Tim' },
  { value: UserRole.ORGANIZER, label: 'Penyelenggara' },
];

function getDashboardPath(role: UserRole): string {
  switch (role) {
    case UserRole.ADMIN:
      return '/admin';
    case UserRole.ORGANIZER:
      return '/organizer';
    case UserRole.TEAM_MANAGER:
      return '/team-manager';
    default:
      return '/';
  }
}

export default function RegisterPage() {
  const router = useRouter();
  const { register, isLoading, error, clearError } = useAuthStore();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    role: UserRole.TEAM_MANAGER as UserRole,
  });
  const [formError, setFormError] = useState('');

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    clearError();

    const { email, password, firstName, lastName, role } = formData;
    if (!email || !password || !firstName || !lastName) {
      setFormError('Harap isi semua kolom.');
      return;
    }

    if (password.length < 8) {
      setFormError('Kata sandi minimal 8 karakter.');
      return;
    }

    try {
      await register({ email, password, firstName, lastName, role });
      const user = useAuthStore.getState().user;
      if (user) {
        router.push(getDashboardPath(user.role));
      }
    } catch {
      // Error is already set in the store
    }
  };

  const displayError = formError || error;

  return (
    <>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white sm:text-3xl">
          Buat Akun Baru 🚀
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Mulai kelola tim dan turnamen Anda hari ini
        </p>
      </div>

      {/* Error message */}
      {displayError && (
        <div className="mb-5 flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          <div className="h-2 w-2 shrink-0 rounded-full bg-red-400" />
          {displayError}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Nama Depan"
            name="firstName"
            placeholder="Budi"
            value={formData.firstName}
            onChange={handleChange}
            icon={<User className="h-4 w-4" />}
            required
          />
          <Input
            label="Nama Belakang"
            name="lastName"
            placeholder="Santoso"
            value={formData.lastName}
            onChange={handleChange}
            required
          />
        </div>

        <Input
          label="Email"
          type="email"
          name="email"
          placeholder="anda@contoh.com"
          value={formData.email}
          onChange={handleChange}
          autoComplete="email"
          icon={<Mail className="h-4 w-4" />}
          required
        />

        <Input
          label="Kata Sandi"
          type="password"
          name="password"
          placeholder="Minimal 8 karakter"
          value={formData.password}
          onChange={handleChange}
          autoComplete="new-password"
          icon={<Lock className="h-4 w-4" />}
          required
        />

        <Select
          label="Peran"
          name="role"
          value={formData.role}
          onChange={handleChange}
          options={roleOptions}
        />

        <Button type="submit" loading={isLoading} className="mt-1 w-full py-2.5 text-base font-semibold">
          <span className="flex items-center justify-center gap-2">
            Buat Akun
            {!isLoading && <ArrowRight className="h-4 w-4" />}
          </span>
        </Button>
      </form>

      {/* Divider */}
      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-white/[0.06]" />
        <span className="text-xs text-slate-600">atau</span>
        <div className="h-px flex-1 bg-white/[0.06]" />
      </div>

      {/* Login link */}
      <p className="text-center text-sm text-slate-400">
        Sudah punya akun?{' '}
        <Link
          href="/login"
          className="font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
        >
          Masuk
        </Link>
      </p>
    </>
  );
}

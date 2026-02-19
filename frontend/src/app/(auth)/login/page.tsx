'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/lib/stores/auth.store';
import { UserRole } from '@/lib/types';
import { Mail, Lock } from 'lucide-react';

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

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoading, error, clearError } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    clearError();

    if (!email || !password) {
      setFormError('Harap isi semua kolom.');
      return;
    }

    try {
      await login({ email, password });
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
      <h1 className="mb-2 text-center text-2xl font-bold text-gray-900">
        Selamat Datang Kembali
      </h1>
      <p className="mb-6 text-center text-sm text-gray-500">
        Masuk ke akun Anda untuk melanjutkan
      </p>

      {displayError && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {displayError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Email"
          type="email"
          name="email"
          placeholder="anda@contoh.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          icon={<Mail className="h-4 w-4" />}
          required
        />

        <Input
          label="Kata Sandi"
          type="password"
          name="password"
          placeholder="Masukkan kata sandi Anda"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          icon={<Lock className="h-4 w-4" />}
          required
        />

        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
          Ingat saya
        </label>

        <Button type="submit" loading={isLoading} className="mt-2 w-full">
          Masuk
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        Belum punya akun?{' '}
        <Link
          href="/register"
          className="font-medium text-blue-600 hover:text-blue-700"
        >
          Daftar
        </Link>
      </p>
    </>
  );
}

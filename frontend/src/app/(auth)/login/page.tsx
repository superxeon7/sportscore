'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/lib/stores/auth.store';
import { UserRole } from '@/lib/types';
import { Mail, Lock, ArrowRight } from 'lucide-react';

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
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white sm:text-3xl">
          Selamat Datang 👋
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Masuk ke akun Anda untuk melanjutkan
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

        <div>
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
        </div>

        <div className="flex items-center justify-between">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-400 hover:text-slate-300 transition-colors">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-emerald-500/30 focus:ring-offset-0"
            />
            Ingat saya
          </label>
        </div>

        <Button type="submit" loading={isLoading} className="mt-1 w-full py-2.5 text-base font-semibold">
          <span className="flex items-center justify-center gap-2">
            Masuk
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

      {/* Register link */}
      <p className="text-center text-sm text-slate-400">
        Belum punya akun?{' '}
        <Link
          href="/register"
          className="font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
        >
          Daftar Sekarang
        </Link>
      </p>
    </>
  );
}

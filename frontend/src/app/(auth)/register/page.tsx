'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/lib/stores/auth.store';
import { UserRole } from '@/lib/types';

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
      <h1 className="mb-6 text-center text-2xl font-semibold text-gray-900">
        Buat Akun Anda
      </h1>

      {displayError && (
        <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {displayError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Nama Depan"
            name="firstName"
            placeholder="Budi"
            value={formData.firstName}
            onChange={handleChange}
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
          required
        />

        <Select
          label="Peran"
          name="role"
          value={formData.role}
          onChange={handleChange}
          options={roleOptions}
        />

        <Button type="submit" loading={isLoading} className="mt-2 w-full">
          Buat Akun
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-600">
        Sudah punya akun?{' '}
        <Link
          href="/login"
          className="font-medium text-blue-600 hover:text-blue-700"
        >
          Masuk
        </Link>
      </p>
    </>
  );
}

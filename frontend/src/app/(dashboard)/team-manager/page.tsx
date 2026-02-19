'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/stores/auth.store';
import { apiGet } from '@/lib/api/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { Flag, Users, Settings, FolderTree, Medal } from 'lucide-react';

interface Team {
  id: string;
  name: string;
  shortName?: string;
  slug: string;
  city?: string;
  country?: string;
  players?: { id: string }[];
  categoryTeams?: {
    eventCategory: {
      id: string;
      name: string;
      event: {
        id: string;
        name: string;
        slug: string;
      };
    };
  }[];
}

export default function TeamManagerDashboardPage() {
  const { user } = useAuthStore();
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchMyTeam() {
      setLoading(true);
      setError(null);
      try {
        const res = await apiGet<Team | null>('/teams/my');
        setTeam(res);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to load team';
        setError(message);
      } finally {
        setLoading(false);
      }
    }
    fetchMyTeam();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-100">Dasbor Manajer Tim</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Skeleton className="h-24 rounded-lg" />
          <Skeleton className="h-24 rounded-lg" />
        </div>
        <Skeleton className="h-48 rounded-lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-100">Dasbor Manajer Tim</h1>
        <Card className="p-6">
          <p className="text-red-400">Error: {error}</p>
          <Button className="mt-4" onClick={() => window.location.reload()}>
            Coba Lagi
          </Button>
        </Card>
      </div>
    );
  }

  const playerCount = team?.players?.length ?? 0;

  // No team yet — show create CTA
  if (!team) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-100">Dasbor Manajer Tim</h1>
          {user && (
            <p className="text-sm text-slate-400">
              Selamat datang, {user.firstName ?? user.email}
            </p>
          )}
        </div>

        <Card className="p-12 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 mx-auto mb-4">
            <Flag className="h-8 w-8 text-white" />
          </div>
          <h3 className="text-lg font-semibold text-slate-100 mb-2">
            Belum ada tim
          </h3>
          <p className="text-slate-400 mb-6 max-w-md mx-auto">
            Anda belum memiliki tim. Buat tim Anda untuk mulai mengelola pemain
            dan kategori pertandingan.
          </p>
          <Link href="/team-manager/teams">
            <Button>Buat Tim</Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-100">Dasbor Manajer Tim</h1>
        {user && (
          <p className="text-sm text-slate-400">
            Selamat datang, {user.firstName ?? user.email}
          </p>
        )}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Tim Saya</p>
              <p className="text-xl font-bold text-slate-100 mt-1">{team.name}</p>
              <div className="flex items-center gap-2 mt-1 text-sm text-slate-400">
                {team.shortName && <span>{team.shortName}</span>}
                {team.city && <span>• {team.city}</span>}
                {team.country && <span>• {team.country}</span>}
              </div>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-700">
              <Flag className="h-5 w-5 text-white" />
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Total Pemain</p>
              <p className="text-2xl font-bold text-slate-100 mt-1">{playerCount}</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-700">
              <Users className="h-5 w-5 text-white" />
            </div>
          </div>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="p-5">
        <h2 className="text-lg font-semibold text-slate-100 mb-3">Aksi Cepat</h2>
        <div className="flex flex-wrap gap-2">
          <Link href="/team-manager/teams">
            <Button>
              <Settings className="mr-2 h-4 w-4" />
              Kelola Tim
            </Button>
          </Link>
          <Link href="/team-manager/players">
            <Button variant="outline">
              <Users className="mr-2 h-4 w-4" />
              Kelola Pemain
            </Button>
          </Link>
          <Link href="/team-manager/divisions">
            <Button variant="outline">
              <FolderTree className="mr-2 h-4 w-4" />
              Divisi Tim
            </Button>
          </Link>
          <Link href="/team-manager/tournament-categories">
            <Button variant="outline">
              <Medal className="mr-2 h-4 w-4" />
              Kategori Turnamen
            </Button>
          </Link>
        </div>
      </Card>

      {/* Tournament Categories (registered only) */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-slate-100">Kategori Turnamen Terdaftar</h2>
          <Link href="/team-manager/tournament-categories">
            <Button variant="ghost" size="sm">Lihat Semua &rarr;</Button>
          </Link>
        </div>
        {!team.categoryTeams || team.categoryTeams.length === 0 ? (
          <div className="text-center py-6">
            <Medal className="h-8 w-8 text-slate-600 mx-auto mb-2" />
            <p className="text-slate-400">
              Tim Anda belum terdaftar di kategori turnamen manapun.
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Hubungi penyelenggara atau daftar melalui halaman acara.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {team.categoryTeams.map((ct) => (
              <div key={ct.eventCategory.id} className="flex items-center justify-between p-4 bg-slate-800 rounded-lg border border-slate-700">
                <div>
                  <p className="font-medium text-slate-200">{ct.eventCategory.name}</p>
                  <p className="text-sm text-slate-400">{ct.eventCategory.event.name}</p>
                </div>
                <div className="flex gap-2">
                  <Link href={`/team-manager/categories/${ct.eventCategory.id}/roster`}>
                    <Button size="sm" variant="secondary">
                      Kelola Roster
                    </Button>
                  </Link>
                  <Link href={`/team-manager/categories/${ct.eventCategory.id}/officials`}>
                    <Button size="sm" variant="secondary">
                      Kelola Ofisial
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Team Info */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-slate-100">Info Tim</h2>
          <Link href="/team-manager/teams">
            <Button variant="ghost" size="sm">Detail Tim →</Button>
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-slate-500 uppercase">Nama</p>
            <p className="text-sm font-medium text-slate-200 mt-1">{team.name}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase">Singkatan</p>
            <p className="text-sm font-medium text-slate-200 mt-1">{team.shortName || '-'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase">Kota</p>
            <p className="text-sm font-medium text-slate-200 mt-1">{team.city || '-'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase">Negara</p>
            <p className="text-sm font-medium text-slate-200 mt-1">{team.country || '-'}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}

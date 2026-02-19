'use client';

import { useEffect, useState } from 'react';
import { apiGet } from '@/lib/api/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import type { EventCategory } from '@/lib/types';
import {
  Medal,
  Trophy,
  Users,
  Calendar,
  Clock,
} from 'lucide-react';

interface TournamentCategoryEvent {
  id: string;
  name: string;
  slug: string;
  status: string;
  startDate: string;
  endDate: string;
}

interface TournamentCategoryRegistration {
  registeredAt: string;
  seed?: number;
  group?: string;
}

interface TournamentCategory extends Omit<EventCategory, 'categoryTeams' | '_count'> {
  event?: TournamentCategoryEvent;
  categoryTeams?: TournamentCategoryRegistration[];
  _count?: {
    matches: number;
    categoryTeams: number;
    categoryRosters: number;
  };
}

const SPORT_LABELS: Record<string, string> = {
  FOOTBALL: 'Sepak Bola',
  FUTSAL: 'Futsal',
  BASKETBALL: 'Basket',
  VOLLEYBALL: 'Voli',
  BADMINTON: 'Bulu Tangkis',
  TABLE_TENNIS: 'Tenis Meja',
  HANDBALL: 'Bola Tangan',
  OTHER: 'Lainnya',
};

const GENDER_LABELS: Record<string, string> = {
  MALE: 'Putra',
  FEMALE: 'Putri',
  MIXED: 'Campuran',
};

const EVENT_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draf',
  PUBLISHED: 'Dipublikasi',
  ONGOING: 'Berlangsung',
  COMPLETED: 'Selesai',
  CANCELLED: 'Dibatalkan',
};

function formatDuration(minutes: number, halves: number): string {
  const perHalf = Math.round(minutes / halves);
  return `${halves}x${perHalf} menit`;
}

export default function TournamentCategoriesPage() {
  const [categories, setCategories] = useState<TournamentCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetch() {
      setLoading(true);
      setError(null);
      try {
        const data = await apiGet<TournamentCategory[]>('/teams/my/tournament-categories');
        setCategories(data);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Gagal memuat kategori');
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-100">Kategori Turnamen</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-48 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-100">Kategori Turnamen</h1>
        <Card className="p-6">
          <p className="text-red-400">Error: {error}</p>
          <Button className="mt-4" onClick={() => window.location.reload()}>
            Coba Lagi
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Kategori Turnamen</h1>
        <p className="text-sm text-slate-400 mt-1">
          Kategori turnamen yang diikuti tim Anda
        </p>
      </div>

      {categories.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-amber-700 mx-auto mb-4">
            <Trophy className="h-8 w-8 text-white" />
          </div>
          <h3 className="text-lg font-semibold text-slate-100 mb-2">
            Belum Terdaftar di Turnamen
          </h3>
          <p className="text-slate-400 mb-6 max-w-md mx-auto">
            Tim Anda belum terdaftar di kategori turnamen manapun.
            Hubungi penyelenggara atau daftar melalui halaman acara.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {categories.map((cat) => (
            <Card key={cat.id} className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-amber-700">
                    <Medal className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-100">{cat.name}</h3>
                    {cat.event && (
                      <p className="text-xs text-slate-400 mt-0.5">{cat.event.name}</p>
                    )}
                  </div>
                </div>
                {cat.event && (
                  <Badge variant="secondary">
                    {EVENT_STATUS_LABELS[cat.event.status] ?? cat.event.status}
                  </Badge>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5 mb-3">
                <Badge variant="default">
                  {SPORT_LABELS[cat.sportType] ?? cat.sportType}
                </Badge>
                <Badge variant="info">
                  {GENDER_LABELS[cat.gender] ?? cat.gender}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm text-slate-400 mb-4">
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  <span>{formatDuration(cat.matchDurationMinutes, cat.halfCount)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" />
                  <span>{cat._count?.categoryTeams ?? 0} tim</span>
                </div>
                {cat.event && (
                  <div className="flex items-center gap-1.5 col-span-2">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>
                      {new Date(cat.event.startDate).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Link href={`/team-manager/categories/${cat.id}/roster`} className="flex-1">
                  <Button size="sm" variant="secondary" className="w-full">
                    Kelola Roster
                  </Button>
                </Link>
                <Link href={`/team-manager/categories/${cat.id}/officials`} className="flex-1">
                  <Button size="sm" variant="secondary" className="w-full">
                    Kelola Ofisial
                  </Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

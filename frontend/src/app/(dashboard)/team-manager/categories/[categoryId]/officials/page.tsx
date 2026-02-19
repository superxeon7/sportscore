'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiGet } from '@/lib/api/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, User, Plus, ExternalLink } from 'lucide-react';
import Link from 'next/link';

enum OfficialRole {
    COACH = 'COACH',
    ASSISTANT_COACH = 'ASSISTANT_COACH',
    MANAGER = 'MANAGER',
    PHYSIO = 'PHYSIO',
    OTHER = 'OTHER',
}

const ROLE_LABELS: Record<string, string> = {
    [OfficialRole.COACH]: 'Pelatih Kepala',
    [OfficialRole.ASSISTANT_COACH]: 'Asisten Pelatih',
    [OfficialRole.MANAGER]: 'Manajer Tim',
    [OfficialRole.PHYSIO]: 'Fisioterapis',
    [OfficialRole.OTHER]: 'Staf Lain',
};

interface TeamOfficial {
    id: string;
    fullName: string;
    role: string;
    photoUrl?: string;
    dateOfBirth?: string;
    nationality?: string;
    isActive: boolean;
}

interface Category {
    id: string;
    name: string;
    event: {
        id: string;
        name: string;
    };
}

export default function CategoryOfficialsPage() {
    const params = useParams();
    const router = useRouter();
    const categoryId = params.categoryId as string;

    const [category, setCategory] = useState<Category | null>(null);
    const [officials, setOfficials] = useState<TeamOfficial[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [catRes, offRes] = await Promise.all([
                apiGet<Category>(`/event-categories/${categoryId}`),
                apiGet<TeamOfficial[]>('/team-officials'),
            ]);
            setCategory(catRes);
            setOfficials(Array.isArray(offRes) ? offRes : []);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Gagal memuat data ofisial';
            setError(message);
        } finally {
            setLoading(false);
        }
    }, [categoryId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    if (loading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-16 rounded-lg" />
                <Skeleton className="h-48 rounded-lg" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="space-y-6">
                <Card className="p-6">
                    <p className="text-red-400">{error}</p>
                    <Button className="mt-4" onClick={() => router.back()}>Kembali</Button>
                </Card>
            </div>
        );
    }

    if (!category) return null;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <Button variant="ghost" className="pl-0 mb-2 hover:bg-transparent hover:text-white" onClick={() => router.back()}>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Kembali
                    </Button>
                    <h1 className="text-2xl font-bold text-slate-100">
                        Ofisial: {category.name}
                    </h1>
                    <p className="text-slate-400">
                        {category.event.name}
                    </p>
                </div>
                <Link href="/team-manager/officials">
                    <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        Tambah Ofisial
                    </Button>
                </Link>
            </div>

            {/* Team Officials */}
            {officials.length > 0 ? (
                <>
                    <p className="text-sm text-slate-400">
                        Ofisial tim Anda yang terdaftar. Ofisial ini dapat dipilih untuk pertandingan di kategori ini.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {officials.map((official) => (
                            <Card key={official.id} className="p-5 flex items-center gap-4 bg-slate-800/50 border-slate-700">
                                <div className="h-14 w-14 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden border-2 border-slate-600 shrink-0">
                                    {official.photoUrl ? (
                                        <img src={official.photoUrl} alt={official.fullName} className="h-full w-full object-cover" />
                                    ) : (
                                        <User className="h-7 w-7 text-slate-400" />
                                    )}
                                </div>
                                <div className="min-w-0">
                                    <h3 className="font-semibold text-slate-100 truncate">{official.fullName}</h3>
                                    <p className="text-sm text-slate-400">{ROLE_LABELS[official.role] || official.role}</p>
                                    {official.nationality && (
                                        <p className="text-xs text-slate-500">{official.nationality}</p>
                                    )}
                                </div>
                            </Card>
                        ))}
                    </div>

                    <Card className="p-4 border-blue-500/20 bg-blue-900/5">
                        <div className="flex items-center justify-between">
                            <p className="text-sm text-slate-400">
                                Kelola semua ofisial tim di halaman Ofisial Tim
                            </p>
                            <Link href="/team-manager/officials">
                                <Button variant="outline" size="sm">
                                    <ExternalLink className="h-3 w-3 mr-2" />
                                    Buka Ofisial Tim
                                </Button>
                            </Link>
                        </div>
                    </Card>
                </>
            ) : (
                <Card className="p-8 text-center">
                    <User className="h-12 w-12 text-slate-600 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-slate-300 mb-2">Belum Ada Ofisial</h3>
                    <p className="text-sm text-slate-500 mb-4">
                        Tambahkan pelatih dan staf pendukung tim Anda agar dapat dipilih untuk pertandingan.
                    </p>
                    <Link href="/team-manager/officials">
                        <Button>
                            <Plus className="h-4 w-4 mr-2" />
                            Tambah Ofisial
                        </Button>
                    </Link>
                </Card>
            )}
        </div>
    );
}

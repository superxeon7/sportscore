'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiGet, apiPost } from '@/lib/api/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/components/ui/toast';

interface Sport {
  id: string;
  name: string;
  slug: string;
}

interface FormData {
  name: string;
  slug: string;
  description: string;
  sportId: string;
  location: string;
  venue: string;
  startDate: string;
  endDate: string;
  maxTeams: number | '';
}

const defaultFormData: FormData = {
  name: '',
  slug: '',
  description: '',
  sportId: '',
  location: '',
  venue: '',
  startDate: '',
  endDate: '',
  maxTeams: '',
};

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

const STEPS = ['Info Dasar', 'Pilih Olahraga', 'Detail', 'Tinjau & Kirim'];

export default function CreateEventPage() {
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState<FormData>(defaultFormData);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [sports, setSports] = useState<Sport[]>([]);
  const [sportsLoading, setSportsLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function fetchSports() {
      setSportsLoading(true);
      try {
        const res = await apiGet<Sport[] | { data: Sport[] }>('/sports');
        const data = Array.isArray(res) ? res : res.data;
        setSports(data);
      } catch {
        // Sports will be empty, user will see an empty dropdown
      } finally {
        setSportsLoading(false);
      }
    }
    fetchSports();
  }, []);

  const updateField = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    setFormErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const handleNameChange = (name: string) => {
    updateField('name', name);
    updateField('slug', generateSlug(name));
  };

  const validateStep = (currentStep: number): boolean => {
    const errors: Partial<Record<keyof FormData, string>> = {};

    if (currentStep === 0) {
      if (!formData.name.trim()) errors.name = 'Nama acara wajib diisi';
      if (!formData.slug.trim()) errors.slug = 'Slug wajib diisi';
    }

    if (currentStep === 1) {
      if (!formData.sportId) errors.sportId = 'Silakan pilih olahraga';
    }

    if (currentStep === 2) {
      if (!formData.startDate) errors.startDate = 'Tanggal mulai wajib diisi';
      if (!formData.endDate) errors.endDate = 'Tanggal selesai wajib diisi';
      if (formData.startDate && formData.endDate && formData.startDate > formData.endDate) {
        errors.endDate = 'Tanggal selesai harus setelah tanggal mulai';
      }
      if (formData.maxTeams !== '' && Number(formData.maxTeams) < 2) {
        errors.maxTeams = 'Minimal harus ada 2 tim';
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(step)) {
      setStep((prev) => Math.min(prev + 1, STEPS.length - 1));
    }
  };

  const handleBack = () => {
    setStep((prev) => Math.max(prev - 1, 0));
  };

  const handleSubmit = async () => {
    if (!validateStep(0) || !validateStep(1) || !validateStep(2)) {
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: formData.name.trim(),
        slug: formData.slug.trim(),
        description: formData.description.trim(),
        sportId: formData.sportId,
        location: formData.location.trim() || undefined,
        venue: formData.venue.trim() || undefined,
        startDate: formData.startDate,
        endDate: formData.endDate,
        maxTeams: formData.maxTeams !== '' ? Number(formData.maxTeams) : undefined,
      };

      const created = await apiPost<{ id: string }>('/events', payload);
      toast.success('Acara berhasil dibuat');
      router.push(`/organizer/events/${created.id}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal membuat acara';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const selectedSport = sports.find((s) => s.id === formData.sportId);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-slate-100">Buat Acara</h1>

      {/* Step Indicator */}
      <div className="flex items-center gap-2">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center">
            <div
              className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${i === step
                  ? 'bg-emerald-600 text-white'
                  : i < step
                    ? 'bg-emerald-500 text-white'
                    : 'bg-slate-700 text-slate-400'
                }`}
            >
              {i < step ? '\u2713' : i + 1}
            </div>
            <span
              className={`ml-2 text-sm hidden sm:inline ${i === step ? 'font-medium text-slate-100' : 'text-slate-500'
                }`}
            >
              {label}
            </span>
            {i < STEPS.length - 1 && (
              <div
                className={`w-8 sm:w-16 h-0.5 mx-2 ${i < step ? 'bg-emerald-500' : 'bg-slate-700'
                  }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <Card className="p-6">
        {/* Step 1: Basic Info */}
        {step === 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Informasi Dasar</h2>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Nama Acara *
              </label>
              <Input
                value={formData.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="cth. Liga Sepak Bola Musim Panas 2025"
              />
              {formErrors.name && (
                <p className="text-red-500 text-xs mt-1">{formErrors.name}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Slug *
              </label>
              <Input
                value={formData.slug}
                onChange={(e) => updateField('slug', e.target.value)}
                placeholder="Dibuat otomatis dari nama"
              />
              {formErrors.slug && (
                <p className="text-red-500 text-xs mt-1">{formErrors.slug}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Deskripsi
              </label>
              <textarea
                className="w-full border border-slate-600/60 bg-slate-800/80 text-slate-100 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 outline-none"
                rows={3}
                value={formData.description}
                onChange={(e) => updateField('description', e.target.value)}
                placeholder="Deskripsi singkat acara"
              />
            </div>
          </div>
        )}

        {/* Step 2: Sport Selection */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Pilih Olahraga</h2>

            {sportsLoading ? (
              <Spinner className="w-6 h-6" />
            ) : (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Pilih Olahraga *
                </label>
                <Select
                  value={formData.sportId}
                  onChange={(e) => updateField('sportId', e.target.value)}
                  className="w-full"
                >
                  <option value="">-- Pilih olahraga --</option>
                  {sports.map((sport) => (
                    <option key={sport.id} value={sport.id}>
                      {sport.name}
                    </option>
                  ))}
                </Select>
                {formErrors.sportId && (
                  <p className="text-red-500 text-xs mt-1">
                    {formErrors.sportId}
                  </p>
                )}
                {sports.length === 0 && (
                  <p className="text-amber-600 text-xs mt-1">
                    Tidak ada olahraga tersedia. Silakan minta admin untuk menambahkan olahraga terlebih dahulu.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Details */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Detail Acara</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Lokasi
                </label>
                <Input
                  value={formData.location}
                  onChange={(e) => updateField('location', e.target.value)}
                  placeholder="cth. Jakarta, Indonesia"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Tempat
                </label>
                <Input
                  value={formData.venue}
                  onChange={(e) => updateField('venue', e.target.value)}
                  placeholder="cth. Stadion Utama"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Tanggal Mulai *
                </label>
                <Input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => updateField('startDate', e.target.value)}
                />
                {formErrors.startDate && (
                  <p className="text-red-500 text-xs mt-1">
                    {formErrors.startDate}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Tanggal Selesai *
                </label>
                <Input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => updateField('endDate', e.target.value)}
                />
                {formErrors.endDate && (
                  <p className="text-red-500 text-xs mt-1">
                    {formErrors.endDate}
                  </p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Maksimal Tim
              </label>
              <Input
                type="number"
                min={2}
                value={formData.maxTeams}
                onChange={(e) =>
                  updateField(
                    'maxTeams',
                    e.target.value === '' ? '' : Number(e.target.value)
                  )
                }
                placeholder="Kosongkan untuk tidak terbatas"
              />
              {formErrors.maxTeams && (
                <p className="text-red-500 text-xs mt-1">
                  {formErrors.maxTeams}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Step 4: Review */}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Tinjau & Kirim</h2>

            <div className="bg-slate-800/60 rounded-lg p-4 space-y-3 border border-white/10">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="text-slate-400">Nama:</span>
                <span className="font-medium text-slate-100">{formData.name}</span>

                <span className="text-slate-400">Slug:</span>
                <span className="font-mono text-slate-400">{formData.slug}</span>

                <span className="text-slate-400">Deskripsi:</span>
                <span className="text-slate-300">{formData.description || '-'}</span>

                <span className="text-slate-400">Olahraga:</span>
                <span className="font-medium text-slate-100">
                  {selectedSport?.name || '-'}
                </span>

                <span className="text-slate-400">Lokasi:</span>
                <span className="text-slate-300">{formData.location || '-'}</span>

                <span className="text-slate-400">Tempat:</span>
                <span className="text-slate-300">{formData.venue || '-'}</span>

                <span className="text-slate-400">Tanggal Mulai:</span>
                <span className="text-slate-300">
                  {formData.startDate
                    ? new Date(formData.startDate).toLocaleDateString()
                    : '-'}
                </span>

                <span className="text-slate-400">Tanggal Selesai:</span>
                <span className="text-slate-300">
                  {formData.endDate
                    ? new Date(formData.endDate).toLocaleDateString()
                    : '-'}
                </span>

                <span className="text-slate-400">Maksimal Tim:</span>
                <span className="text-slate-300">
                  {formData.maxTeams !== '' ? formData.maxTeams : 'Tidak Terbatas'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex justify-between mt-6 pt-4 border-t border-white/10">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={step === 0}
          >
            Kembali
          </Button>

          <div className="flex gap-2">
            {step < STEPS.length - 1 ? (
              <Button onClick={handleNext}>Lanjut</Button>
            ) : (
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <Spinner className="w-4 h-4" /> Membuat...
                  </span>
                ) : (
                  'Buat Acara'
                )}
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

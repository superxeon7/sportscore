'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Spinner } from '@/components/ui/spinner';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';

interface Sport {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  rules?: Record<string, unknown>;
  scoringSystem?: Record<string, unknown>;
  eventTypes?: Record<string, unknown>;
  isActive?: boolean;
}

interface SportFormData {
  name: string;
  slug: string;
  description: string;
  icon: string;
  rules: string;
  scoringSystem: string;
  eventTypes: string;
}

const defaultFormData: SportFormData = {
  name: '',
  slug: '',
  description: '',
  icon: '',
  rules: '{}',
  scoringSystem: '{}',
  eventTypes: '[]',
};

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export default function AdminSportsPage() {
  const toast = useToast();
  const [sports, setSports] = useState<Sport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSport, setEditingSport] = useState<Sport | null>(null);
  const [formData, setFormData] = useState<SportFormData>(defaultFormData);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof SportFormData, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchSports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet<Sport[] | { data: Sport[] }>('/sports');
      const data = Array.isArray(res) ? res : res.data;
      setSports(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load sports';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSports();
  }, [fetchSports]);

  const openCreateModal = () => {
    setEditingSport(null);
    setFormData(defaultFormData);
    setFormErrors({});
    setModalOpen(true);
  };

  const openEditModal = (sport: Sport) => {
    setEditingSport(sport);
    setFormData({
      name: sport.name,
      slug: sport.slug,
      description: sport.description || '',
      icon: sport.icon || '',
      rules: JSON.stringify(sport.rules ?? {}, null, 2),
      scoringSystem: JSON.stringify(sport.scoringSystem ?? {}, null, 2),
      eventTypes: JSON.stringify(sport.eventTypes ?? [], null, 2),
    });
    setFormErrors({});
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingSport(null);
    setFormData(defaultFormData);
    setFormErrors({});
  };

  const validateForm = (): boolean => {
    const errors: Partial<Record<keyof SportFormData, string>> = {};

    if (!formData.name.trim()) errors.name = 'Name is required';
    if (!formData.slug.trim()) errors.slug = 'Slug is required';

    try {
      JSON.parse(formData.rules);
    } catch {
      errors.rules = 'Invalid JSON';
    }

    try {
      JSON.parse(formData.scoringSystem);
    } catch {
      errors.scoringSystem = 'Invalid JSON';
    }

    try {
      JSON.parse(formData.eventTypes);
    } catch {
      errors.eventTypes = 'Invalid JSON';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      const payload = {
        name: formData.name.trim(),
        slug: formData.slug.trim(),
        description: formData.description.trim(),
        icon: formData.icon.trim(),
        rules: JSON.parse(formData.rules),
        scoringSystem: JSON.parse(formData.scoringSystem),
        eventTypes: JSON.parse(formData.eventTypes),
      };

      if (editingSport) {
        const updated = await apiPatch<Sport>(`/sports/${editingSport.id}`, payload);
        setSports((prev) =>
          prev.map((s) => (s.id === editingSport.id ? { ...s, ...updated } : s))
        );
        toast.success('Sport updated successfully');
      } else {
        const created = await apiPost<Sport>('/sports', payload);
        setSports((prev) => [...prev, created]);
        toast.success('Sport created successfully');
      }
      closeModal();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save sport';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (sportId: string) => {
    if (!confirm('Are you sure you want to delete this sport?')) return;
    setDeletingId(sportId);
    try {
      await apiDelete(`/sports/${sportId}`);
      setSports((prev) => prev.filter((s) => s.id !== sportId));
      toast.success('Sport deleted successfully');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete sport';
      toast.error(message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleNameChange = (name: string) => {
    setFormData((prev) => ({
      ...prev,
      name,
      slug: editingSport ? prev.slug : generateSlug(name),
    }));
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-100">Sports Configuration</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-100">Sports Configuration</h1>
        <Card className="p-6">
          <p className="text-red-600">Error: {error}</p>
          <Button className="mt-4" onClick={fetchSports}>Retry</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-100">Sports Configuration</h1>
        <Button onClick={openCreateModal}>Add Sport</Button>
      </div>

      {sports.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-slate-500">No sports configured yet.</p>
          <Button className="mt-4" onClick={openCreateModal}>
            Add Your First Sport
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sports.map((sport) => (
            <Card key={sport.id} className="p-5">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  {sport.icon && <span className="text-2xl">{sport.icon}</span>}
                  <div>
                    <h3 className="font-semibold">{sport.name}</h3>
                    <p className="text-xs text-slate-500">{sport.slug}</p>
                  </div>
                </div>
              </div>
              {sport.description && (
                <p className="text-sm text-slate-300 mb-4 line-clamp-2">
                  {sport.description}
                </p>
              )}
              <div className="flex gap-2 mt-auto pt-3 border-t border-white/10">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openEditModal(sport)}
                >
                  Edit
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={deletingId === sport.id}
                  onClick={() => handleDelete(sport.id)}
                >
                  {deletingId === sport.id ? (
                    <Spinner className="w-4 h-4" />
                  ) : (
                    'Delete'
                  )}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal open={modalOpen} onClose={closeModal} title={editingSport ? 'Edit Sport' : 'Add Sport'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Name *
            </label>
            <Input
              value={formData.name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g. Football"
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
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, slug: e.target.value }))
              }
              placeholder="e.g. football"
            />
            {formErrors.slug && (
              <p className="text-red-500 text-xs mt-1">{formErrors.slug}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Description
            </label>
            <Input
              value={formData.description}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, description: e.target.value }))
              }
              placeholder="Brief description"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Icon (emoji or icon name)
            </label>
            <Input
              value={formData.icon}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, icon: e.target.value }))
              }
              placeholder="e.g. &#9917;"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Rules (JSON)
            </label>
            <textarea
              className="w-full border border-slate-600/60 bg-slate-800/80 text-slate-100 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 outline-none"
              rows={4}
              value={formData.rules}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, rules: e.target.value }))
              }
            />
            {formErrors.rules && (
              <p className="text-red-500 text-xs mt-1">{formErrors.rules}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Scoring System (JSON)
            </label>
            <textarea
              className="w-full border border-slate-600/60 bg-slate-800/80 text-slate-100 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 outline-none"
              rows={4}
              value={formData.scoringSystem}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  scoringSystem: e.target.value,
                }))
              }
            />
            {formErrors.scoringSystem && (
              <p className="text-red-500 text-xs mt-1">
                {formErrors.scoringSystem}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Event Types (JSON)
            </label>
            <textarea
              className="w-full border border-slate-600/60 bg-slate-800/80 text-slate-100 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 outline-none"
              rows={4}
              value={formData.eventTypes}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  eventTypes: e.target.value,
                }))
              }
            />
            {formErrors.eventTypes && (
              <p className="text-red-500 text-xs mt-1">
                {formErrors.eventTypes}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={closeModal}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <Spinner className="w-4 h-4" />
              ) : editingSport ? (
                'Update Sport'
              ) : (
                'Create Sport'
              )}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

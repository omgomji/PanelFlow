'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getPositions, createPosition, type Position } from '@/lib/api';
import axios from 'axios';

export default function PositionsPage() {
  const router = useRouter();
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);

  // Create form state
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getPositions()
      .then(setPositions)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);
    try {
      const position = await createPosition({ title, description });
      setPositions((prev) => [position, ...prev]);
      setTitle('');
      setDescription('');
      setCreating(false);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setFormError((err.response?.data as { error?: string })?.error ?? 'Failed to create position');
      } else {
        setFormError('Something went wrong');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink">Projects & Roles</h1>
          <p className="text-[14px] font-display font-semibold tracking-wide text-ink/60 mt-1">Manage initiatives, roles, and group meeting panels</p>
        </div>
        <button
          id="create-position-btn"
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-2 rounded-sm bg-stamp px-4 py-2 text-[14px] font-display font-semibold tracking-wide font-bold text-paper hover:bg-blue-700 transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          New Project / Role
        </button>
      </div>

      {/* Create Position Form */}
      {creating && (
        <div className="mb-6 rounded-sm border-2 border-ink bg-paper p-6">
          <h2 className="text-base font-bold text-ink mb-4">Create Project or Role</h2>
          {formError && (
            <div className="mb-4 rounded-sm bg-red-50 border border-red-200 px-4 py-3 text-[14px] font-display font-semibold tracking-wide text-red-700">
              {formError}
            </div>
          )}
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-[14px] font-display font-semibold tracking-wide font-bold text-ink mb-1.5">Title *</label>
              <input
                id="position-title"
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3.5 py-2.5 border-2 border-ink rounded-sm text-[14px] font-display font-semibold tracking-wide focus:outline-none focus:ring-2 focus:ring-stamp/30 focus:border-stamp border-2"
                placeholder="e.g. Senior Frontend Engineer"
              />
            </div>
            <div>
              <label className="block text-[14px] font-display font-semibold tracking-wide font-bold text-ink mb-1.5">Description</label>
              <textarea
                id="position-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3.5 py-2.5 border-2 border-ink rounded-sm text-[14px] font-display font-semibold tracking-wide focus:outline-none focus:ring-2 focus:ring-stamp/30 focus:border-stamp border-2"
                rows={3}
                placeholder="Role overview..."
              />
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                id="position-submit"
                disabled={submitting}
                className="rounded-sm bg-stamp px-4 py-2 text-[14px] font-display font-semibold tracking-wide font-bold text-paper hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? 'Creating…' : 'Create'}
              </button>
              <button
                type="button"
                onClick={() => setCreating(false)}
                className="rounded-sm border-2 border-ink px-4 py-2 text-[14px] font-display font-semibold tracking-wide font-bold text-ink/80 hover:bg-clay/5"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Positions List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-sm border-b-2 border-stamp border-2" />
        </div>
      ) : positions.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-sm border-2 border-dashed border-ink border-2 bg-clay/5 py-24 text-center">
          <div className="h-16 w-16 mb-4 rounded-sm bg-paper border-2 border-ink flex items-center justify-center">
            <span className="material-symbols-outlined text-3xl text-ink/50">work</span>
          </div>
          <p className="text-ink font-bold text-lg">No projects or roles yet</p>
          <p className="text-ink/60 text-[14px] font-display font-semibold tracking-wide mt-1 max-w-sm">Create a project or role to start building meeting panels for your team.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {positions.map((pos) => (
            <button
              key={pos.id}
              onClick={() => router.push(`/positions/${pos.id}`)}
              className="w-full text-left rounded-sm border-2 border-ink bg-paper p-5 transition-all hover:border-stamp border-2/30 hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] hover:shadow-primary/5 hover:-translate-y-0.5 group"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-bold text-ink">{pos.title}</h3>
                  {pos.description && (
                    <p className="text-[14px] font-display font-semibold tracking-wide text-ink/60 mt-1 line-clamp-1">{pos.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-2">
                    <span
                      className={`inline-flex items-center rounded-sm px-2.5 py-0.5 text-xs font-bold ${
 pos.status === 'OPEN'
 ? 'bg-green-100 text-green-700'
 : 'bg-clay/10 text-ink/70'
 }`}
                    >
                      {pos.status}
                    </span>
                    <span className="text-xs text-ink/50">
                      {pos.panels?.length ?? 0} panel{pos.panels?.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
                <span className="material-symbols-outlined text-ink/50 text-[20px] font-display font-semibold tracking-wide transition-transform group-hover:translate-x-1 group-hover:text-stamp">chevron_right</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

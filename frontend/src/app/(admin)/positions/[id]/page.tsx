'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  getPosition,
  createPanel,
  updatePanel,
  deletePanel,
  getInterviewers,
  getPositionCandidates,
  type Position,
  type AuthUser,
  type CandidateRow,
} from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import axios from 'axios';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { AlertDialog } from '@/components/ui/AlertDialog';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Switch } from '@/components/ui/Switch';
import PanelDrawer from '@/components/PanelDrawer';
import { useToast } from '@/components/ui/Toast';

export default function PositionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const positionId = parseInt(id, 10);
  const { showToast } = useToast();

  const [position, setPosition] = useState<Position | null>(null);
  const [loading, setLoading] = useState(true);
  const [interviewers, setInterviewers] = useState<AuthUser[]>([]);
  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const { user } = useAuth();

  // Panel drawer state
  const [panelDrawerOpen, setPanelDrawerOpen] = useState(false);
  const [editingPanelId, setEditingPanelId] = useState<number | null>(null);
  const [creatingPanel, setCreatingPanel] = useState(false);

  // Archive/delete confirm
  const [deleteConfirmPanelId, setDeleteConfirmPanelId] = useState<number | null>(null);
  const [deleteConfirmPanelTitle, setDeleteConfirmPanelTitle] = useState('');

  // Alert state
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');

  const closeAlert = () => setAlertOpen(false);

  const load = useCallback(async () => {
    try {
      const [pos, ivs, cands] = await Promise.all([
        getPosition(positionId),
        getInterviewers(),
        getPositionCandidates(positionId),
      ]);
      setPosition(pos);
      setInterviewers(ivs);
      setCandidates(cands);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [positionId]);

  useEffect(() => { load(); }, [load]);

  const handleAddPanel = async (data: {
    title: string;
    slug: string;
    duration: number;
    isActive: boolean;
    interviewerIds: number[];
  }) => {
    setCreatingPanel(true);
    try {
      const created = await createPanel(positionId, {
        title: data.title,
        slug: data.slug,
        duration: data.duration,
        interviewerIds: data.interviewerIds,
      });
      setPanelDrawerOpen(false);
      await load();
      showToast({
        title: 'Panel created',
        message: `${data.title} is ready to accept bookings.`,
        type: 'success',
      });
    } catch (err) {
      if (axios.isAxiosError(err)) {
        showToast({
          title: 'Failed to create panel',
          message: err?.response?.data?.error || 'Something went wrong.',
          type: 'error',
        });
      } else {
        showToast({
          title: 'Failed to create panel',
          message: 'Something went wrong.',
          type: 'error',
        });
      }
    } finally {
      setCreatingPanel(false);
    }
  };

  const handleUpdatePanel = async (data: {
    title: string;
    slug: string;
    duration: number;
    isActive: boolean;
    interviewerIds: number[];
  }) => {
    if (!editingPanelId) return;
    setCreatingPanel(true);
    try {
      await updatePanel(editingPanelId, {
        title: data.title,
        slug: data.slug,
        duration: data.duration,
        isActive: data.isActive,
      });
      setPanelDrawerOpen(false);
      setEditingPanelId(null);
      await load();
      showToast({
        title: 'Panel updated',
        message: `${data.title} has been updated.`,
        type: 'success',
      });
    } catch (err: any) {
      if (axios.isAxiosError(err)) {
        showToast({
          title: 'Failed to update panel',
          message: err?.response?.data?.error || 'Something went wrong.',
          type: 'error',
        });
      } else {
        showToast({
          title: 'Failed to update panel',
          message: 'Something went wrong.',
          type: 'error',
        });
      }
    } finally {
      setCreatingPanel(false);
    }
  };

  const copyLink = (slug: string) => {
    const url = `${window.location.origin}/panel/${slug}`;
    navigator.clipboard.writeText(url);
  };

  const openBookingPage = (slug: string) => {
    window.open(`/panel/${slug}`, '_blank');
  };

type PanelEditorInput = {
  id: number;
  title: string;
  slug: string;
  duration: number;
  isActive: boolean;
  interviewers?: Array<{ user: { id: number } }>;
};

  const handleEditPanel = (panel: PanelEditorInput) => {
    setEditingPanelId(panel.id);
    setPanelDrawerOpen(true);
  };

  const handleArchive = async () => {
    if (!deleteConfirmPanelId) return;
    setCreatingPanel(true);
    try {
      await deletePanel(deleteConfirmPanelId);
      setDeleteConfirmPanelId(null);
      setDeleteConfirmPanelTitle('');
      await load();
      showToast({
        title: 'Panel archived',
        message: `${deleteConfirmPanelTitle} is no longer accepting bookings.`,
        type: 'success',
      });
    } catch (err: any) {
      if (axios.isAxiosError(err)) {
        showToast({
          title: 'Failed to archive panel',
          message: err?.response?.data?.error || 'Something went wrong.',
          type: 'error',
        });
      } else {
        showToast({
          title: 'Failed to archive panel',
          message: 'Something went wrong.',
          type: 'error',
        });
      }
    } finally {
      setCreatingPanel(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-stamp border-2" />
      </div>
    );
  }

  if (!position) {
    return <div className="text-red-500">Position not found</div>;
  }

  return (
    <div>
      {/* Breadcrumb */}
      <button
        onClick={() => router.push('/positions')}
        className="mb-4 inline-flex items-center gap-1 text-[14px] font-display font-semibold tracking-wide text-ink/60 hover:text-ink/80"
      >
        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        Projects & Roles
      </button>

      {/* Header */}
      <PageHeader
        title={position.title}
        description={position.description ?? 'Manage panels and team members for this role'}
        action={
          <Button
            type="button"
            onClick={() => {
              setEditingPanelId(null);
              setPanelDrawerOpen(true);
            }}
            disabled={creatingPanel}
          >
            <span className="material-symbols-outlined text-[16px] mr-2">add</span>
            Add Panel
          </Button>
        }
      />

      {/* Panel Creation / Edit Drawer */}
      <PanelDrawer
        isOpen={panelDrawerOpen}
        onClose={() => {
          setPanelDrawerOpen(false);
          setEditingPanelId(null);
        }}
        onSave={editingPanelId ? handleUpdatePanel : handleAddPanel}
        initialData={
          editingPanelId
            ? {
                title: position?.panels?.find((p) => p.id === editingPanelId)?.title ?? '',
                slug: position?.panels?.find((p) => p.id === editingPanelId)?.slug ?? '',
                duration: position?.panels?.find((p) => p.id === editingPanelId)?.duration ?? 45,
                isActive: position?.panels?.find((p) => p.id === editingPanelId)?.isActive ?? true,
                interviewerIds: position?.panels?.find((p) => p.id === editingPanelId)?.interviewers?.map((pi) => pi.user.id) ?? [],
              }
            : undefined
        }
        interviewers={interviewers.map((iv) => ({
          id: iv.id,
          name: iv.name,
          email: iv.email,
        }))}
      />

      {/* Panels List */}
      <div className="mt-8">
        <h2 className="text-base font-bold text-ink mb-3 flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-stamp">groups</span>
          Panels ({position.panels?.length ?? 0})
        </h2>

        {!position.panels?.length ? (
          <div className="flex flex-col items-center justify-center rounded-sm border border-dashed border-ink border-2 py-16 text-center">
            <span className="material-symbols-outlined text-4xl text-clay/50 mb-3">groups</span>
            <p className="text-ink/60 font-medium">No panels yet</p>
            <p className="text-ink/50 text-[14px] font-display font-semibold tracking-wide mt-1">
              Add a panel to assign team members and start booking interviews.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {position.panels.map((panel) => (
              <div
                key={panel.id}
                className="rounded-sm border-2 border-ink bg-paper p-5"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="text-base font-bold text-ink">{panel.title}</h3>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[14px] font-display font-semibold tracking-wide text-ink/60">
                        {panel.duration} min
                      </span>
                      <span className="text-clay/50">·</span>
                      <span className="font-mono text-xs text-ink/50">
                        /panel/{panel.slug}
                      </span>
                      <span className="text-clay/50">·</span>
                      <StatusBadge
                        status={panel.isActive ? 'active' : 'inactive'}
                        label={panel.isActive ? 'Active' : 'Inactive'}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href={`/panel/${panel.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-sm border-2 border-ink bg-paper text-ink hover:bg-clay/10 transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span className="material-symbols-outlined text-[14px] font-display font-semibold tracking-wide">open_in_new</span>
                    </a>
                    <button
                      onClick={() => copyLink(panel.slug)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-sm border-2 border-ink bg-paper text-ink hover:bg-clay/10 transition-colors"
                      title="Copy booking link"
                    >
                      <span className="material-symbols-outlined text-[14px] font-display font-semibold tracking-wide">content_copy</span>
                    </button>
                    {panel.isActive ? (
                      <button
                        onClick={() => handleEditPanel(panel)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-sm border-2 border-ink bg-paper text-ink hover:bg-clay/10 transition-colors"
                        title="Edit panel"
                      >
                        <span className="material-symbols-outlined text-[14px] font-display font-semibold tracking-wide">edit</span>
                      </button>
                    ) : null}
                    <button
                      onClick={() => {
                        setDeleteConfirmPanelId(panel.id);
                        setDeleteConfirmPanelTitle(panel.title);
                      }}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-sm border-2 border-ink bg-paper text-ink hover:bg-oxblood/10 transition-colors"
                      title="Archive panel"
                    >
                      <span className="material-symbols-outlined text-[14px] font-display font-semibold tracking-wide">archive</span>
                    </button>
                  </div>
                </div>

                {/* Interviewers */}
                <div className="flex flex-wrap gap-2 mt-3">
                  {panel.interviewers?.map((pi) => (
                    <div
                      key={pi.id}
                      className="inline-flex items-center gap-1.5 rounded-sm bg-clay/10 px-3 py-1 text-xs font-bold text-ink/80"
                    >
                      <span className="material-symbols-outlined text-[14px] font-display font-semibold tracking-wide text-ink/50">
                        person
                      </span>
                      {pi.user.name}
                    </div>
                  ))}
                  {!panel.interviewers?.length && (
                    <span className="text-xs text-ink/50">No team members assigned</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {deleteConfirmPanelId && (
          <ConfirmDialog
            isOpen={true}
            title="Archive Panel"
            message={`Archive “${deleteConfirmPanelTitle}”? Candidates will no longer be able to book this panel.`}
            confirmText="Archive"
            cancelText="Cancel"
            variant="danger"
            onConfirm={handleArchive}
            onCancel={() => setDeleteConfirmPanelId(null)}
          />
        )}

        <AlertDialog
          isOpen={alertOpen}
          title={alertTitle}
          message={alertMessage}
          onClose={closeAlert}
          buttonText="Dismiss"
        />
      </div>
    </div>
  );
}

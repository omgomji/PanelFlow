'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getPositions, createPosition, type Position } from '@/lib/api';
import axios from 'axios';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import PositionDrawer from '@/components/PositionDrawer';
import { useToast } from '@/components/ui/Toast';

export default function PositionsPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);

  // Create Position drawer state
  const [positionDrawerOpen, setPositionDrawerOpen] = useState(false);
  const [creatingPosition, setCreatingPosition] = useState(false);

  useEffect(() => {
    fetchPositions();
  }, []);

  const handleOpenCreate = () => {
    setPositionDrawerOpen(true);
  };

  useEffect(() => {
    const handleOpenCreateEvent = (event: Event) => {
      const customEvent = event as CustomEvent<{ type: string }>;
      const { type } = customEvent.detail ?? {};
      if (type === 'position') {
        setPositionDrawerOpen(true);
      } else if (type === 'panel') {
        showToast({
          title: 'Create a panel from a position',
          message: 'Select a position from the list, then add panels inside it.',
          type: 'info',
        });
      }
    };

    window.addEventListener('open-create-event', handleOpenCreateEvent as EventListener);
    return () => window.removeEventListener('open-create-event', handleOpenCreateEvent as EventListener);
  }, []);

  const fetchPositions = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getPositions();
      setPositions(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleCreatePosition = async (data: {
    title: string;
    description: string;
    isActive: boolean;
  }) => {
    setCreatingPosition(true);
    try {
      await createPosition({
        title: data.title,
        description: data.description,
        status: data.isActive ? 'OPEN' : 'CLOSED',
      });
      setPositionDrawerOpen(false);
      await fetchPositions();
      showToast({
        title: 'Position created',
        message: `${data.title} is ready to add panels.`,
        type: 'success',
      });
    } catch (err) {
      if (axios.isAxiosError(err)) {
        showToast({
          title: 'Failed to create position',
          message: err?.response?.data?.error || 'Something went wrong.',
          type: 'error',
        });
      } else {
        showToast({
          title: 'Failed to create position',
          message: 'Something went wrong.',
          type: 'error',
        });
      }
    } finally {
      setCreatingPosition(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-stamp border-2" />
      </div>
    );
  }

  return (
    <div className="pb-20">
      <PageHeader
        title="Projects & Roles"
        description="Manage initiatives, roles, and group meeting panels"
        action={
          <Button
            type="button"
            onClick={handleOpenCreate}
          >
            <span className="material-symbols-outlined text-[16px] mr-2">add</span>
            New Position
          </Button>
        }
      />

      {/* Position Creation Drawer */}
      <PositionDrawer
        isOpen={positionDrawerOpen}
        onClose={() => setPositionDrawerOpen(false)}
        onSave={handleCreatePosition}
      />

      {/* Positions List */}
      <div className="mt-8">
        <h2 className="text-base font-bold text-ink mb-3 flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-stamp">work</span>
          Positions ({positions.length})
        </h2>

        {!positions.length ? (
          <div className="flex flex-col items-center justify-center rounded-sm border border-dashed border-ink border-2 py-16 text-center">
            <span className="material-symbols-outlined text-4xl text-clay/50 mb-3">work</span>
            <p className="text-ink/60 font-medium">No positions yet</p>
            <p className="text-ink/50 text-[14px] font-display font-semibold tracking-wide mt-1">
              Create a position to start organizing your hiring panels.
            </p>
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
                      <StatusBadge status={pos.status === 'OPEN' ? 'open' : 'closed'} />
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
    </div>
  );
}

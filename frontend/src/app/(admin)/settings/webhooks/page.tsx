'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

type WebhookEndpoint = {
  id: number;
  url: string;
  events: string[];
  isActive: boolean;
  createdAt: string;
};

type WebhookDelivery = {
  id: number;
  event: string;
  payload: Record<string, unknown>;
  statusCode: number | null;
  success: boolean;
  attempt: number;
  createdAt: string;
};

const AVAILABLE_EVENTS = [
  'booking.created',
  'booking.cancelled',
  'booking.rescheduled',
  'booking.no_show',
];

export default function WebhooksPage() {
  const { user } = useAuth();
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([]);
  const [deliveries, setDeliveries] = useState<Record<number, WebhookDelivery[]>>({});
  const [selectedEndpointForDeliveries, setSelectedEndpointForDeliveries] = useState<number | null>(null);
  
  const [newUrl, setNewUrl] = useState('');
  const [newEvents, setNewEvents] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newSecret, setNewSecret] = useState('');

  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  useEffect(() => {
    if (user && user.role === 'ADMIN') {
      fetchEndpoints();
    } else if (user) {
      setError('You must be an admin to manage webhooks.');
      setLoading(false);
    }
  }, [user]);

  const fetchEndpoints = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/webhooks');
      setEndpoints(data);
    } catch (err) {
      setError('Failed to load webhooks');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUrl || newEvents.length === 0) return;

    try {
      const { data } = await api.post('/webhooks', { url: newUrl, events: newEvents });
      setNewSecret(data.secret);
      setNewUrl('');
      setNewEvents([]);
      fetchEndpoints();
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || err.message || 'Failed to create webhook');
      } else {
        setError('Failed to create webhook');
      }
    }
  };

  const handleDeleteClick = (id: number) => {
    setDeleteConfirmId(id);
  };

  const confirmDelete = async () => {
    if (deleteConfirmId === null) return;
    const id = deleteConfirmId;
    setDeleteConfirmId(null);
    try {
      await api.delete(`/webhooks/${id}`);
      fetchEndpoints();
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || err.message || 'Failed to delete webhook');
      } else {
        setError('Failed to delete webhook');
      }
    }
  };

  const fetchDeliveries = async (id: number) => {
    try {
      const { data } = await api.get(`/webhooks/${id}/deliveries`);
      setDeliveries({ ...deliveries, [id]: data });
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || err.message || 'Failed to load deliveries');
      } else {
        setError('Failed to load deliveries');
      }
    }
  };

  if (!user || loading) return <div>Loading...</div>;
  if (user.role !== 'ADMIN') return <div className="text-red-500">{error}</div>;

  return (
    <div className="pb-20 pt-4">
      <h1 className="text-[20px] font-display font-semibold tracking-wide font-bold text-ink mb-6">Webhooks</h1>
      
      {error && <div className="bg-red-100 text-red-700 p-3 rounded mb-6">{error}</div>}
      
      {newSecret && (
        <div className="bg-green-100 text-green-800 p-4 rounded mb-6">
          <p className="font-bold">Webhook created successfully!</p>
          <p>Your signing secret is: <code className="bg-paper px-2 py-1 rounded select-all">{newSecret}</code></p>
          <p className="text-[14px] font-display font-semibold tracking-wide mt-2">Please copy this now, you won&apos;t be able to see it again.</p>
        </div>
      )}

      <div className="bg-paper border rounded-sm p-6 mb-8">
        <h2 className="text-xl font-bold mb-4">Add Endpoint</h2>
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-[14px] font-display font-semibold tracking-wide font-bold mb-1">Payload URL</label>
            <input
              type="url"
              required
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              className="w-full px-3 py-2 border-2 border-ink bg-paper rounded-sm text-[13px] font-medium focus:outline-none focus:ring-2 focus:ring-stamp/30 focus:border-stamp border-2 transition-all hover:bg-clay/5"
              placeholder="https://example.com/webhook"
            />
          </div>
          <div>
            <label className="block text-[14px] font-display font-semibold tracking-wide font-bold mb-2">Events</label>
            <div className="space-y-2">
              {AVAILABLE_EVENTS.map(ev => (
                <label key={ev} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={newEvents.includes(ev)}
                    onChange={(e) => {
                      if (e.target.checked) setNewEvents([...newEvents, ev]);
                      else setNewEvents(newEvents.filter(x => x !== ev));
                    }}
                  />
                  <span>{ev}</span>
                </label>
              ))}
            </div>
          </div>
          <button type="submit" disabled={newEvents.length === 0 || !newUrl} className="bg-stamp text-paper px-5 py-2 text-[13px] font-medium rounded-sm disabled:opacity-50 font-bold hover:bg-stamp/90 transition-colors">
            Add Webhook
          </button>
        </form>
      </div>

      <div className="bg-paper border rounded-sm overflow-hidden">
        <table className="w-full text-left text-[14px] font-display font-semibold tracking-wide">
          <thead className="bg-clay/5 border-b border-ink border-2">
            <tr>
              <th className="px-4 py-3 font-bold text-ink/70">URL</th>
              <th className="px-4 py-3 font-bold text-ink/70">Events</th>
              <th className="px-4 py-3 font-bold text-ink/70 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {endpoints.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-ink/60">No webhooks registered</td>
              </tr>
            )}
            {endpoints.map(ep => (
              <React.Fragment key={ep.id}>
                <tr className="border-b">
                  <td className="px-4 py-3">{ep.url}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {ep.events.map(ev => (
                        <span key={ev} className="text-[11px] bg-clay/10 text-ink/70 px-2 py-1 rounded-sm">{ev}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => {
                        if (selectedEndpointForDeliveries === ep.id) {
                          setSelectedEndpointForDeliveries(null);
                        } else {
                          setSelectedEndpointForDeliveries(ep.id);
                          fetchDeliveries(ep.id);
                        }
                      }}
                      className="text-stamp font-bold mr-4 text-[14px] font-display font-semibold tracking-wide"
                    >
                      {selectedEndpointForDeliveries === ep.id ? 'Hide Deliveries' : 'View Deliveries'}
                    </button>
                    <button onClick={() => handleDeleteClick(ep.id)} className="text-red-500 font-bold text-[14px] font-display font-semibold tracking-wide">
                      Delete
                    </button>
                  </td>
                </tr>
                {selectedEndpointForDeliveries === ep.id && (
                  <tr>
                    <td colSpan={3} className="bg-clay/5 p-4 border-b">
                      <h4 className="font-bold mb-2">Recent Deliveries</h4>
                      {deliveries[ep.id] ? (
                        deliveries[ep.id].length > 0 ? (
                          <div className="space-y-2">
                            {deliveries[ep.id].map(delivery => (
                              <div key={delivery.id} className="text-xs flex items-center gap-4 bg-paper p-2 rounded border">
                                <span className={delivery.success ? 'text-green-600 font-bold' : 'text-oxblood font-bold'}>
                                  {delivery.success ? '✓ Delivered' : '✗ Failed'}
                                </span>
                                <span className="text-ink/60">{new Date(delivery.createdAt).toLocaleString()}</span>
                                <span className="font-mono bg-clay/10 px-1 rounded">{delivery.event}</span>
                                {delivery.statusCode && <span className="text-ink/50">HTTP {delivery.statusCode}</span>}
                                {delivery.attempt > 1 && <span className="text-amber-600">Retry {delivery.attempt - 1}</span>}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-[14px] font-display font-semibold tracking-wide text-ink/60">No deliveries yet.</div>
                        )
                      ) : (
                        <div className="text-[14px] font-display font-semibold tracking-wide">Loading deliveries...</div>
                      )}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        isOpen={deleteConfirmId !== null}
        title="Delete Webhook"
        message="Are you sure you want to delete this webhook?"
        confirmText="Delete"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirmId(null)}
      />
    </div>
  );
}

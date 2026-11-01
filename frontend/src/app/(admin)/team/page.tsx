'use client';

import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { AlertDialog } from '@/components/ui/AlertDialog';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useAuth } from '@/context/AuthContext';
import {
  getUsers,
  inviteUser,
  getInvitations,
  revokeInvitation,
  resendInvitation,
  type InvitationRow,
} from '@/lib/api';

type UserRow = {
  id: number;
  name: string;
  email: string;
  username?: string | null;
  role: 'ADMIN' | 'INTERVIEWER';
  timezone?: string;
  tokenVersion?: number;
  createdAt: string;
};

type InviteRole = 'ADMIN' | 'INTERVIEWER';

export default function TeamPage() {
  const { user, loading: authLoading } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [invitations, setInvitations] = useState<InvitationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Alert state
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');

  const closeAlert = () => setAlertOpen(false);
  const showAlert = (title: string, message: string) => {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertOpen(true);
  };

  // Invite form state
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<InviteRole>('INTERVIEWER');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');

  useEffect(() => {
    if (!authLoading && user?.role === 'ADMIN') {
      fetchData();
    }
  }, [authLoading, user?.role]);

  useEffect(() => {
    if (error) {
      showAlert('Error', error);
      setError(null);
    }
  }, [error]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const usersData = await getUsers({ role: undefined });
      setUsers(
        usersData.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          username: u.username ?? null,
          role: u.role,
          timezone: u.timezone,
          tokenVersion: (u as any).tokenVersion,
          createdAt: (u as any).createdAt ?? new Date().toISOString(),
        }))
      );
    } catch (err) {
      showAlert('Error', 'Failed to load team members');
      console.error('Team fetch error:', err);
    }

    try {
      const invitationsData = await getInvitations({ active: true });
      setInvitations(invitationsData);
    } catch (err) {
      // Invitations table may not exist yet (migration pending) — degrade gracefully
      setInvitations([]);
      console.warn('Invitations fetch failed (may need DB migration):', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError('');
    try {
      setInviting(true);
      await inviteUser({ email: inviteEmail, role: inviteRole });
      setInviteEmail('');
      setInviteRole('INTERVIEWER');
      setInviteOpen(false);
      await fetchData();
      showAlert('Invitation Sent', `${inviteEmail} has been invited successfully.`);
    } catch (err: any) {
      setInviteError(
        err?.response?.data?.error || 'Failed to send invitation. Please try again.'
      );
    } finally {
      setInviting(false);
    }
  };

  const handleRevoke = async (id: number) => {
    try {
      await revokeInvitation(id);
      await fetchData();
      showAlert('Revoked', 'Invitation has been revoked.');
    } catch (err: any) {
      showAlert('Error', err?.response?.data?.error || 'Failed to revoke invitation.');
    }
  };

  const handleResend = async (id: number) => {
    try {
      const result = await resendInvitation(id);
      await fetchData();
      showAlert('Resent', `Invitation link copied. Expires ${new Date(result.expiresAt).toLocaleDateString()}.`);
      navigator.clipboard.writeText(result.inviteUrl);
    } catch (err: any) {
      showAlert('Error', err?.response?.data?.error || 'Failed to resend invitation.');
    }
  };

  const copyInviteLink = (id: number) => {
    const inv = invitations.find((i) => i.id === id);
    if (inv) {
      navigator.clipboard.writeText(`${window.location.origin}/register?token=${inv.email}&invite=1`);
      showAlert('Copied', 'Invitation link copied to clipboard.');
    }
  };

  if (authLoading || !user) return null;
  if (user.role !== 'ADMIN') {
    return (
      <div className="pb-20">
        <PageHeader
          title="Team & Invitations"
          description="Manage your interviewing team and invite new members"
        />
        <div className="max-w-md">
          <div className="border-2 border-oxblood bg-oxblood/5 p-6 text-center">
            <h2 className="font-display text-lg font-bold text-oxblood mb-2">
              Access Denied
            </h2>
            <p className="text-oxblood/70 font-mono text-sm">
              You need admin permissions to manage the team.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-20">
      <PageHeader
        title="Team & Invitations"
        description="Manage your interviewing team and send invitations to new members"
        action={
          <Button
            variant="primary"
            size="sm"
            onClick={() => setInviteOpen(true)}
          >
            <span className="material-symbols-outlined text-[16px] mr-2">person_add</span>
            Invite Member
          </Button>
        }
      />

      <AlertDialog
        isOpen={alertOpen}
        title={alertTitle}
        message={alertMessage}
        onClose={closeAlert}
        buttonText="Dismiss"
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Team Members */}
        <div className="lg:col-span-8">
          <Card className="border-2">
            <CardHeader>
              <CardTitle>Team Members</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-16">
                  <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-stamp" />
                </div>
              ) : users.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-ink bg-paper">
                  <span className="material-symbols-outlined text-[48px] text-clay/60 mb-4">people</span>
                  <h3 className="font-display text-lg font-bold text-ink mb-2">
                    No team members yet
                  </h3>
                  <p className="text-ink/60 font-mono text-sm max-w-xs mb-6">
                    Invite your first interviewer to start building panels together.
                  </p>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setInviteOpen(true)}
                  >
                    <span className="material-symbols-outlined text-[16px] mr-2">person_add</span>
                    Invite Member
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b-2 border-ink font-display text-ink uppercase tracking-wider text-xs">
                      <tr>
                        <th className="p-4 font-bold align-middle">Name</th>
                        <th className="p-4 font-bold align-middle">Email</th>
                        <th className="p-4 font-bold align-middle">Role</th>
                        <th className="p-4 font-bold align-middle text-right">Joined</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-clay/30 font-mono text-ink">
                      {users.map((member) => (
                        <tr key={member.id} className="transition-colors hover:bg-clay/5">
                          <td className="p-4 align-middle font-bold text-ink">
                            {member.name}
                          </td>
                          <td className="p-4 align-middle text-ink/70">
                            {member.email}
                          </td>
                          <td className="p-4 align-middle">
                            <StatusBadge
                              status={member.role === 'ADMIN' ? 'active' : 'inactive'}
                              label={member.role}
                            />
                          </td>
                          <td className="p-4 align-middle text-right text-ink/60">
                            {new Date(member.createdAt).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Pending Invitations */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="border-2">
            <CardHeader>
              <CardTitle>Pending Invitations</CardTitle>
            </CardHeader>
            <CardContent>
              {invitations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center border-2 border-dashed border-ink bg-paper">
                  <span className="material-symbols-outlined text-3xl text-clay/50 mb-2">hourglass_empty</span>
                  <p className="text-sm font-mono text-ink/60">No pending invitations</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {invitations.map((inv) => {
                    const expiresAt = new Date(inv.expiresAt);
                    const isExpired = expiresAt <= new Date() || Boolean(inv.usedAt);
                    const daysLeft = Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
                    return (
                      <div key={inv.id} className="p-3 rounded-sm border border-clay/20 bg-paper/50">
                        <div className="flex justify-between items-start mb-1">
                          <div className="font-display text-sm font-bold text-ink">{inv.email}</div>
                          <StatusBadge
                            status={isExpired ? 'inactive' : 'pending'}
                            label={inv.role}
                          />
                        </div>
                        <div className="flex items-center gap-2 text-xs text-ink/60 font-mono mb-2">
                          <span>
                            {isExpired
                              ? inv.usedAt
                                ? 'Used'
                                : 'Expired'
                              : `Expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`}
                          </span>
                          {inv.createdBy && (
                            <>
                              <span className="text-clay/40">·</span>
                              <span>by {inv.createdBy.name}</span>
                            </>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={isExpired}
                            onClick={() => copyInviteLink(inv.id)}
                          >
                            <span className="material-symbols-outlined text-[14px]">content_copy</span>
                            Copy
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={isExpired}
                            onClick={() => handleResend(inv.id)}
                          >
                            Resend
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => {
                              // inline confirm handled via dialog state would go here
                              handleRevoke(inv.id);
                            }}
                          >
                            <span className="material-symbols-outlined text-[14px]">delete</span>
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {inviteOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setInviteOpen(false);
          }}
        >
          <div className="w-full max-w-md bg-paper border-2 border-ink shadow-[4px_4px_0px_rgba(27,31,43,1)] p-6">
            <h2 className="font-display text-xl font-bold text-ink mb-4">
              Invite Team Member
            </h2>
            <form onSubmit={handleInviteSubmit} className="space-y-4">
              <div>
                <label className="block text-[14px] font-bold text-ink mb-2">
                  Email address
                </label>
                <Input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="interviewer@company.com"
                  className="w-full"
                  required
                />
              </div>
              <div>
                <label className="block text-[14px] font-bold text-ink mb-2">
                  Role
                </label>
                <Select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as InviteRole)}
                >
                  <option value="INTERVIEWER">Interviewer</option>
                  <option value="ADMIN">Admin</option>
                </Select>
              </div>
              {inviteError && (
                <div className="mb-4 p-3 rounded-sm border-2 border-oxblood bg-oxblood/5 text-oxblood text-sm font-bold">
                  {inviteError}
                </div>
              )}
              <div className="flex justify-end gap-3 mt-6">
                <Button
                  variant="secondary"
                  type="button"
                  onClick={() => setInviteOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={inviting}
                >
                  {inviting ? 'Sending...' : 'Send Invitation'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
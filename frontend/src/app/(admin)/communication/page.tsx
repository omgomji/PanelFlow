'use client';

import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { Switch } from '@/components/ui/Switch';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { AlertDialog } from '@/components/ui/AlertDialog';
import { useAuth } from '@/context/AuthContext';

type EmailProvider = 'resend' | 'smtp' | 'none';

export default function CommunicationPage() {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Alert state
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');

  // Form state
  const [emailProvider, setEmailProvider] = useState<EmailProvider>('resend');
  const [fromEmail, setFromEmail] = useState('');
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('');
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [saving, setSaving] = useState(false);

  const closeAlert = () => setAlertOpen(false);
  const showAlert = (title: string, message: string) => {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertOpen(true);
  };

  useEffect(() => {
    if (!authLoading && user?.role === 'ADMIN') {
      // Load existing communication settings from localStorage (stub until backend API)
      try {
        const stored = localStorage.getItem('panelflow:communication');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.emailProvider) setEmailProvider(parsed.emailProvider);
          if (parsed.fromEmail !== undefined) setFromEmail(parsed.fromEmail);
          if (parsed.smtpHost !== undefined) setSmtpHost(parsed.smtpHost);
          if (parsed.smtpPort !== undefined) setSmtpPort(parsed.smtpPort);
          if (parsed.smtpUser !== undefined) setSmtpUser(parsed.smtpUser);
          if (parsed.smtpPass !== undefined) setSmtpPass(parsed.smtpPass);
          if (parsed.emailEnabled !== undefined) setEmailEnabled(parsed.emailEnabled);
        }
      } catch {
        // ignore parse errors, defaults apply
      }
      setLoading(false);
    } else if (!authLoading) {
      setLoading(false);
    }
  }, [authLoading, user?.role]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      // Persist communication settings locally (stub until backend API)
      try {
        localStorage.setItem('panelflow:communication', JSON.stringify({
          emailProvider,
          fromEmail,
          smtpHost,
          smtpPort,
          smtpUser,
          smtpPass,
          emailEnabled,
        }));
      } catch {
        // ignore storage errors
      }
      // Stub: wire to backend settings API when available
      showAlert('Settings Saved', 'Communication settings have been updated.');
    } catch (err) {
      showAlert('Error', 'Failed to save communication settings.');
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || !user) return null;
  if (user.role !== 'ADMIN') {
    return (
      <div className="pb-20">
        <PageHeader
          title="Communication Settings"
          description="Configure email delivery and notification preferences"
        />
        <div className="max-w-md">
          <div className="border-2 border-oxblood bg-oxblood/5 p-6 text-center">
            <h2 className="font-display text-lg font-bold text-oxblood mb-2">
              Access Denied
            </h2>
            <p className="text-oxblood/70 font-mono text-sm">
              You need admin permissions to configure communication settings.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-20">
      <PageHeader
        title="Communication Settings"
        description="Configure email delivery and notification preferences for booking confirmations and reminders"
      />

      {error && (
        <AlertDialog
          isOpen={true}
          title="Error"
          message={error}
          onClose={() => setError(null)}
          buttonText="Dismiss"
        />
      )}

      <Card className="border-2">
        <CardHeader>
          <CardTitle>Email Delivery</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <label className="block text-[14px] font-bold text-ink mb-2">
              Email Provider
            </label>
            <Select
              value={emailProvider}
              onChange={(e) => setEmailProvider(e.target.value as EmailProvider)}
            >
              <option value="none">None (emails disabled)</option>
              <option value="resend">Resend (Transactional)</option>
              <option value="smtp">Custom SMTP</option>
            </Select>
            <p className="mt-2 text-[12px] text-ink/60 font-mono">
              Resend is recommended for transactional booking emails. Free tier includes 3,000 emails/month.
            </p>
          </div>

          {emailProvider === 'resend' && (
            <div>
              <label className="block text-[14px] font-bold text-ink mb-2">
                From Email Address
              </label>
              <Input
                type="email"
                value={fromEmail}
                onChange={(e) => setFromEmail(e.target.value)}
                placeholder="interviews@yourdomain.com"
                className="w-full"
              />
              <p className="mt-2 text-[12px] text-ink/60 font-mono">
                Verified sender address in Resend. Used as the From address on all outbound emails.
              </p>
            </div>
          )}

          {emailProvider === 'smtp' && (
            <>
              <div>
                <label className="block text-[14px] font-bold text-ink mb-2">
                  SMTP Host
                </label>
                <Input
                  type="text"
                  value={smtpHost}
                  onChange={(e) => setSmtpHost(e.target.value)}
                  placeholder="smtp.example.com"
                  className="w-full"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[14px] font-bold text-ink mb-2">
                    Port
                  </label>
                  <Input
                    type="text"
                    value={smtpPort}
                    onChange={(e) => setSmtpPort(e.target.value)}
                    placeholder="587"
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-[14px] font-bold text-ink mb-2">
                    Username
                  </label>
                  <Input
                    type="text"
                    value={smtpUser}
                    onChange={(e) => setSmtpUser(e.target.value)}
                    className="w-full"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[14px] font-bold text-ink mb-2">
                  Password
                </label>
                <Input
                  type="password"
                  value={smtpPass}
                  onChange={(e) => setSmtpPass(e.target.value)}
                  className="w-full"
                />
              </div>
            </>
          )}

          <div className="flex items-center gap-3 pt-4 border-t border-clay/30">
            <Switch
              checked={emailEnabled}
              onCheckedChange={setEmailEnabled}
              aria-label="Enable email notifications"
            />
            <label className="font-display text-sm font-bold text-ink">
              {emailEnabled ? 'Email notifications enabled' : 'Email notifications disabled'}
            </label>
          </div>

          <div className="pt-4 border-t border-clay/30 flex justify-end">
            <Button
              variant="primary"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Communication Settings'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="mt-8">
        <Card className="border-2 border-clay/30 bg-clay/5">
          <CardHeader>
            <CardTitle>Supported Providers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 border border-clay/20 rounded-sm bg-paper">
                <h4 className="font-display text-sm font-bold text-ink mb-2">Resend</h4>
                <p className="text-[12px] text-ink/60 font-mono mb-3">
                  Free tier: 3,000 emails/month. Best for transactional booking confirmations.
                </p>
                <StatusBadge status="active" label="Recommended" />
              </div>
              <div className="p-4 border border-clay/20 rounded-sm bg-paper">
                <h4 className="font-display text-sm font-bold text-ink mb-2">Custom SMTP</h4>
                <p className="text-[12px] text-ink/60 font-mono mb-3">
                  Use your own SMTP server for email delivery.
                </p>
                <StatusBadge status="pending" label="Self-managed" />
              </div>
              <div className="p-4 border border-clay/20 rounded-sm bg-paper">
                <h4 className="font-display text-sm font-bold text-ink mb-2">None</h4>
                <p className="text-[12px] text-ink/60 font-mono mb-3">
                  Emails are disabled. Booking confirmations will not be sent.
                </p>
                <StatusBadge status="inactive" label="Disabled" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <AlertDialog
        isOpen={alertOpen}
        title={alertTitle}
        message={alertMessage}
        onClose={closeAlert}
        buttonText="Dismiss"
      />
    </div>
  );
}
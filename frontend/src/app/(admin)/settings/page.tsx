'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { updateUser } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Switch } from '@/components/ui/Switch';
import { Input } from '@/components/ui/Input';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';

const COMMON_TIMEZONES = [
  'America/Los_Angeles',
  'America/Denver',
  'America/Chicago',
  'America/New_York',
  'America/Sao_Paulo',
  'Europe/London',
  'Europe/Paris',
  'Asia/Kolkata',
  'Asia/Tokyo',
  'Australia/Sydney',
];

type EmailProvider = 'resend' | 'smtp' | 'none';

type NotificationPreferences = {
  bookingConfirmations: boolean;
  rescheduleNotices: boolean;
  cancellationNotices: boolean;
  interviewerNotifications: boolean;
};

const DEFAULT_NOTIFICATIONS: NotificationPreferences = {
  bookingConfirmations: true,
  rescheduleNotices: true,
  cancellationNotices: true,
  interviewerNotifications: true,
};

export default function SettingsPage() {
  const { user, loading, refreshUser } = useAuth();
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [notifications, setNotifications] = useState<NotificationPreferences>(DEFAULT_NOTIFICATIONS);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  // Communication settings state
  const [emailProvider, setEmailProvider] = useState<EmailProvider>('resend');
  const [fromEmail, setFromEmail] = useState('');
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('');
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [emailEnabled, setEmailEnabled] = useState(false);

  useEffect(() => {
    if (user?.timezone) {
      setTimezone(user.timezone);
    }
    // Load stored notification preferences
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('panelflow:notifications');
        if (stored) {
          setNotifications({ ...DEFAULT_NOTIFICATIONS, ...JSON.parse(stored) });
        }
      } catch {
        // ignore
      }
    }
    // Load stored communication settings
    if (typeof window !== 'undefined') {
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
        // ignore
      }
    }
  }, [user]);

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage('');
      await updateUser({ timezone });
      await refreshUser();

      // Persist notification preferences
      if (typeof window !== 'undefined') {
        localStorage.setItem('panelflow:notifications', JSON.stringify(notifications));
      }

      // Persist communication settings
      if (typeof window !== 'undefined') {
        localStorage.setItem('panelflow:communication', JSON.stringify({
          emailProvider,
          fromEmail,
          smtpHost,
          smtpPort,
          smtpUser,
          smtpPass,
          emailEnabled,
        }));
      }

      setMessage('Settings saved.');
    } catch (err) {
      setMessage('Failed to update settings.');
    } finally {
      setSaving(false);
    }
  };

  const toggleNotification = (key: keyof NotificationPreferences) => {
    setNotifications((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (loading || !user) return <div className="p-8">Loading...</div>;

  return (
    <div className="pb-20">
      <PageHeader
        title="Account Settings"
        description="Configure your timezone, notification preferences, and personal settings"
      />

      <Card className="border-2 max-w-xl">
        <CardHeader>
          <CardTitle>Preferences</CardTitle>
        </CardHeader>
        <CardContent className="space-y-8">
          <section>
            <h2 className="font-display text-lg font-bold text-ink mb-4">Timezone</h2>
            <div className="mb-6">
              <label className="block text-[14px] font-bold text-ink mb-2">Timezone</label>
              <Select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
              >
                {COMMON_TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </Select>
              <p className="text-[12px] text-ink/70 mt-2">
                This timezone will be used for your dashboard and availability schedules.
              </p>
            </div>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-ink mb-4">Notification Preferences</h2>
            <p className="text-sm text-ink/60 font-mono mb-6">
              Choose which email and in-app notifications you receive. Changes are saved locally and synced with your account.
            </p>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-sm border-2 border-clay/20 bg-paper/50">
                <div>
                  <p className="font-display text-sm font-bold text-ink">Booking confirmations</p>
                  <p className="text-[12px] text-ink/60 font-mono">
                    Receive confirmation emails when you book an interview
                  </p>
                </div>
                <Switch
                  checked={notifications.bookingConfirmations}
                  onCheckedChange={() => toggleNotification('bookingConfirmations')}
                  aria-label="Booking confirmations"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-sm border-2 border-clay/20 bg-paper/50">
                <div>
                  <p className="font-display text-sm font-bold text-ink">Reschedule notices</p>
                  <p className="text-[12px] text-ink/60 font-mono">
                    Receive notifications when interviews are rescheduled
                  </p>
                </div>
                <Switch
                  checked={notifications.rescheduleNotices}
                  onCheckedChange={() => toggleNotification('rescheduleNotices')}
                  aria-label="Reschedule notices"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-sm border-2 border-clay/20 bg-paper/50">
                <div>
                  <p className="font-display text-sm font-bold text-ink">Cancellation notices</p>
                  <p className="text-[12px] text-ink/60 font-mono">
                    Receive notifications when interviews are cancelled
                  </p>
                </div>
                <Switch
                  checked={notifications.cancellationNotices}
                  onCheckedChange={() => toggleNotification('cancellationNotices')}
                  aria-label="Cancellation notices"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-sm border-2 border-clay/20 bg-paper/50">
                <div>
                  <p className="font-display text-sm font-bold text-ink">Interviewer notifications</p>
                  <p className="text-[12px] text-ink/60 font-mono">
                    Receive notifications about interviewer assignments and panel changes
                  </p>
                </div>
                <Switch
                  checked={notifications.interviewerNotifications}
                  onCheckedChange={() => toggleNotification('interviewerNotifications')}
                  aria-label="Interviewer notifications"
                />
              </div>
            </div>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-ink mb-4">Communication Settings</h2>
            <p className="text-sm text-ink/60 font-mono mb-6">
              Configure email delivery for booking confirmations, reschedule notices, and cancellations.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-[14px] font-bold text-ink mb-2">Email Provider</label>
                <Select
                  value={emailProvider}
                  onChange={(e) => setEmailProvider(e.target.value as EmailProvider)}
                >
                  <option value="none">None (emails disabled)</option>
                  <option value="resend">Resend (Transactional)</option>
                  <option value="smtp">Custom SMTP</option>
                </Select>
                <p className="text-[12px] text-ink/60 font-mono mt-2">
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
                  <p className="text-[12px] text-ink/60 font-mono mt-2">
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
            </div>
          </section>

          {message && (
            <div className="mb-4 p-3 rounded-sm border-2 border-sage bg-sage/5 text-sage text-sm font-bold">
              {message}
            </div>
          )}

          <Button
            variant="primary"
            onClick={handleSave}
            disabled={saving || (timezone === user.timezone && Object.keys(notifications).every((k) => notifications[k as keyof NotificationPreferences] === DEFAULT_NOTIFICATIONS[k as keyof NotificationPreferences]))}
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
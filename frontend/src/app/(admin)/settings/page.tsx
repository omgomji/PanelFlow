'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { updateUser } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';

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

export default function SettingsPage() {
  const { user, loading } = useAuth();
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (user?.timezone) {
      setTimezone(user.timezone);
    }
  }, [user]);

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage('');
      await updateUser({ timezone });
      // In a real app we'd trigger a context refresh here
      // For now, reload to ensure state is completely synced
      window.location.reload();
    } catch (err) {
      setMessage('Failed to update settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !user) return <div className="p-8">Loading...</div>;

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-ink mb-6">Account Settings</h1>

      <div className="bg-paper border-2 border-ink p-6 max-w-xl">
        <h2 className="font-display text-lg font-bold text-ink mb-4">Preferences</h2>
        
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

        {message && (
          <div className="mb-4 text-sm font-bold text-oxblood">
            {message}
          </div>
        )}

        <Button 
          variant="primary" 
          onClick={handleSave} 
          disabled={saving || timezone === user.timezone}
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </div>
  );
}

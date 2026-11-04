import { useState, type FormEvent } from 'react';
import { KeyRound, ShieldCheck, UserRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api, errorMessage } from '../lib/api';
import { Avatar, Card, SectionTitle } from './ui';

const fieldClass = 'w-full rounded-xl border border-line bg-canvas/60 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition focus:border-brand/60 focus:ring-4 focus:ring-brand/10';

export default function ProfilePanel() {
  const { user, updateUser } = useAuth();
  const notify = useToast();
  const [name, setName] = useState(user?.name || '');
  const [savingName, setSavingName] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  if (!user) return null;

  const saveName = async (e: FormEvent) => {
    e.preventDefault();
    setSavingName(true);
    try {
      const res = await api.patch('/auth/profile', { name });
      updateUser({ name: res.data.user.name });
      notify('success', 'Profile updated.');
    } catch (err) {
      notify('error', errorMessage(err, 'Could not update your profile.'));
    } finally {
      setSavingName(false);
    }
  };

  const savePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      notify('error', 'New passwords do not match.');
      return;
    }
    setSavingPassword(true);
    try {
      await api.post('/auth/change-password', { currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      notify('success', 'Password changed successfully.');
    } catch (err) {
      notify('error', errorMessage(err, 'Could not change your password.'));
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card className="p-5">
        <SectionTitle icon={<UserRound className="h-4 w-4" />} title="Your profile" subtitle="How your name appears to the support team" />
        <div className="mt-5 flex items-center gap-3 rounded-xl bg-canvas/40 p-3">
          <Avatar name={user.name || user.email} tone={user.role === 'ADMIN' ? 'staff' : 'brand'} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{user.name || 'No name set'}</p>
            <p className="truncate text-xs text-slate-400">{user.email}</p>
          </div>
          <span className="ml-auto inline-flex items-center gap-1 rounded-md bg-white/5 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-300">
            <ShieldCheck className="h-3 w-3" /> {user.role === 'ADMIN' ? 'Admin' : 'Customer'}
          </span>
        </div>
        <form onSubmit={saveName} className="mt-5 space-y-3">
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-slate-300">Full name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required className={fieldClass} />
          </label>
          <button disabled={savingName || !name.trim() || name.trim() === user.name} className="rounded-xl bg-brand px-4 py-2 text-sm font-bold text-canvas hover:bg-teal-300 disabled:opacity-40">
            {savingName ? 'Saving…' : 'Save name'}
          </button>
        </form>
      </Card>

      <Card className="p-5">
        <SectionTitle icon={<KeyRound className="h-4 w-4" />} title="Change password" subtitle="Use at least 8 characters" />
        <form onSubmit={savePassword} className="mt-5 space-y-3">
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-slate-300">Current password</span>
            <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required autoComplete="current-password" className={fieldClass} />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-slate-300">New password</span>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8} autoComplete="new-password" className={fieldClass} />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-slate-300">Confirm new password</span>
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={8} autoComplete="new-password" className={fieldClass} />
          </label>
          <button disabled={savingPassword} className="rounded-xl bg-white/10 px-4 py-2 text-sm font-bold text-white hover:bg-white/15 disabled:opacity-40">
            {savingPassword ? 'Updating…' : 'Update password'}
          </button>
        </form>
      </Card>
    </div>
  );
}

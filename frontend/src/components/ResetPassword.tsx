import { useState, type FormEvent } from 'react';
import { ArrowLeft, CircleAlert, CircleCheck, KeyRound } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import { Logo } from './ui';

const goToSignIn = () => {
  window.location.href = '/';
};

export default function ResetPassword() {
  const token = new URLSearchParams(window.location.search).get('token');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const handleReset = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) {
      setStatus({ type: 'error', message: 'This reset link is invalid or incomplete. Request a new one.' });
      return;
    }
    if (newPassword.length < 8 || newPassword !== confirmPassword) {
      setStatus({ type: 'error', message: newPassword.length < 8 ? 'Password must be at least 8 characters.' : 'Passwords do not match.' });
      return;
    }

    setLoading(true);
    setStatus(null);
    try {
      const res = await api.post('/auth/reset-password', { token, newPassword });
      setStatus({ type: 'success', message: res.data.message || 'Password updated successfully!' });
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setStatus({ type: 'error', message: errorMessage(err, 'Password reset failed.') });
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'w-full rounded-xl border border-line bg-canvas/60 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition focus:border-brand/60 focus:ring-4 focus:ring-brand/10';

  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center bg-canvas p-4 text-slate-200">
      <div className="glow pointer-events-none absolute inset-0 opacity-60" />
      <div className="relative w-full max-w-md space-y-6 rounded-2xl border border-line bg-surface p-7 shadow-2xl shadow-black/40 sm:p-8">
        <Logo size="sm" />
        <div className="space-y-1.5">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand/10 text-brand"><KeyRound className="h-5 w-5" /></span>
          <h2 className="pt-2 text-xl font-bold text-white">Set a new password</h2>
          <p className="text-sm text-slate-400">Choose a password with at least 8 characters.</p>
        </div>

        {status && (
          <div className={`flex items-start gap-2 rounded-xl border p-3 text-sm ${status.type === 'success' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200' : 'border-rose-500/30 bg-rose-500/10 text-rose-200'}`}>
            {status.type === 'success' ? <CircleCheck className="mt-0.5 h-4 w-4 shrink-0" /> : <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />}
            <span>{status.message}</span>
          </div>
        )}

        {status?.type === 'success' ? (
          <button onClick={goToSignIn} className="w-full rounded-xl bg-brand py-2.5 text-sm font-bold text-canvas transition hover:bg-teal-300">
            Continue to sign in
          </button>
        ) : (
          <form onSubmit={handleReset} className="space-y-4">
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold text-slate-300">New password</span>
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" required autoComplete="new-password" className={inputClass} />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold text-slate-300">Confirm new password</span>
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" required autoComplete="new-password" className={inputClass} />
            </label>
            <button type="submit" disabled={loading} className="w-full rounded-xl bg-brand py-2.5 text-sm font-bold text-canvas transition hover:bg-teal-300 disabled:opacity-60">
              {loading ? 'Updating…' : 'Reset password'}
            </button>
          </form>
        )}

        <button onClick={goToSignIn} className="flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-white">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
        </button>
      </div>
    </div>
  );
}

import { useState, type FormEvent } from 'react';
import { ArrowRight, Bot, CircleAlert, CircleCheck, Eye, EyeOff, Gauge, Lock, Mail, MessagesSquare, ShieldCheck, UserRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api, errorMessage } from '../lib/api';
import { APP_NAME } from '../config';
import { Logo } from './ui';

type ViewMode = 'login' | 'register' | 'forgot';

const passwordStrength = (password: string) => {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  if (password.length < 8) return { score: 1, label: 'Too short', color: 'bg-rose-400' };
  if (score <= 2) return { score: 2, label: 'Fair', color: 'bg-amber-400' };
  if (score <= 3) return { score: 3, label: 'Good', color: 'bg-teal-400' };
  return { score: 4, label: 'Strong', color: 'bg-emerald-400' };
};

const FEATURES = [
  { icon: Bot, title: 'AI triage', text: 'Every ticket is categorised and prioritised the moment it arrives.' },
  { icon: MessagesSquare, title: 'Live conversation', text: 'Chat with the support team right inside each ticket.' },
  { icon: Gauge, title: 'SLA insights', text: 'Track resolution time, overdue tickets and customer satisfaction.' }
];

export default function AuthForms() {
  const { login } = useAuth();
  const [mode, setMode] = useState<ViewMode>('login');

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  // Fields stay read-only until the user touches them, so the browser cannot autofill
  // saved credentials when the page opens — the boxes always start empty.
  const [fieldsUnlocked, setFieldsUnlocked] = useState(false);
  const unlockFields = () => setFieldsUnlocked(true);
  const guardProps = { readOnly: !fieldsUnlocked, onFocus: unlockFields, onPointerDown: unlockFields };

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const switchMode = (next: ViewMode) => {
    setMode(next);
    setError(null);
    setSuccess(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        const res = await api.post('/auth/login', { email, password });
        login(res.data.token, res.data.user);
      } else if (mode === 'register') {
        await api.post('/auth/register', { name, email, password });
        setSuccess('Account created! Sign in to continue.');
        setPassword('');
        setMode('login');
      } else {
        const res = await api.post('/auth/forgot-password', { email });
        setSuccess(res.data.message || 'Reset link sent to your email.');
      }
    } catch (err) {
      setError(errorMessage(err, 'Something went wrong. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const strength = passwordStrength(password);
  const inputClass =
    'w-full rounded-xl border border-line bg-canvas/60 py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 outline-none transition focus:border-brand/60 focus:ring-4 focus:ring-brand/10';

  return (
    <div className="grid min-h-[100dvh] bg-canvas text-slate-200 lg:grid-cols-[1.1fr_1fr]">
      {/* Brand panel */}
      <aside className="relative hidden overflow-hidden border-r border-line lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="glow pointer-events-none absolute inset-0" />
        <div className="relative"><Logo size="lg" /></div>
        <div className="relative max-w-md space-y-8">
          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-brand">Customer support, simplified</p>
            <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-white">
              Every support request,<br />resolved faster.
            </h1>
            <p className="mt-4 text-sm leading-relaxed text-slate-400">
              {APP_NAME} routes, tracks and resolves customer issues in one place — so nothing slips through the cracks.
            </p>
          </div>
          <ul className="space-y-4">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/5 text-brand ring-1 ring-white/10"><Icon className="h-4 w-4" /></span>
                <div>
                  <p className="text-sm font-semibold text-white">{title}</p>
                  <p className="text-xs leading-relaxed text-slate-400">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-slate-500">© {new Date().getFullYear()} {APP_NAME}</p>
      </aside>

      {/* Form panel */}
      <main className="flex items-center justify-center p-5 sm:p-10">
        <div className="w-full max-w-[400px] space-y-7">
          <div className="lg:hidden"><Logo /></div>

          <div className="space-y-1.5">
            <h2 className="text-2xl font-bold tracking-tight text-white">
              {mode === 'login' && 'Welcome back'}
              {mode === 'register' && 'Create your account'}
              {mode === 'forgot' && 'Reset your password'}
            </h2>
            <p className="text-sm text-slate-400">
              {mode === 'login' && 'Sign in to track and manage your support tickets.'}
              {mode === 'register' && `Join ${APP_NAME} to raise and follow support requests.`}
              {mode === 'forgot' && 'Enter your registered email and we will send you a reset link.'}
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200" role="alert">
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="flex items-start gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200" role="status">
              <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
            {mode === 'register' && (
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-slate-300">Full name</span>
                <div className="relative">
                  <UserRound className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" required autoComplete="off" {...guardProps} className={inputClass} />
                </div>
              </label>
            )}

            <label className="block space-y-1.5">
              <span className="text-xs font-semibold text-slate-300">Email address</span>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" required autoComplete="off" {...guardProps} className={inputClass} />
              </div>
            </label>

            {mode !== 'forgot' && (
              <div className="space-y-1.5">
                <span className="flex items-center justify-between text-xs font-semibold text-slate-300">
                  <label htmlFor="auth-password">Password</label>
                  {mode === 'login' && (
                    <button type="button" onClick={() => switchMode('forgot')} className="font-medium text-brand hover:underline">
                      Forgot password?
                    </button>
                  )}
                </span>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                  <input
                    id="auth-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={mode === 'register' ? 'At least 8 characters' : '••••••••'}
                    required
                    minLength={mode === 'register' ? 8 : undefined}
                    autoComplete={mode === 'register' ? 'new-password' : 'off'}
                    {...guardProps}
                    className={`${inputClass} pr-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-3 text-slate-500 transition hover:text-slate-200"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {mode === 'register' && password && (
                  <div className="flex items-center gap-2 pt-1">
                    <div className="flex flex-1 gap-1">
                      {[1, 2, 3, 4].map((step) => (
                        <span key={step} className={`h-1 flex-1 rounded-full ${step <= strength.score ? strength.color : 'bg-white/10'}`} />
                      ))}
                    </div>
                    <span className="w-16 text-right text-[11px] text-slate-400">{strength.label}</span>
                  </div>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="group flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-2.5 text-sm font-bold text-canvas shadow-lg shadow-teal-500/20 transition hover:bg-teal-300 disabled:opacity-60"
            >
              {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : mode === 'register' ? 'Create account' : 'Send reset link'}
              {!loading && <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />}
            </button>
          </form>

          <p className="text-center text-sm text-slate-400">
            {mode === 'login' ? (
              <>New to {APP_NAME}? <button onClick={() => switchMode('register')} className="font-semibold text-brand hover:underline">Create an account</button></>
            ) : mode === 'register' ? (
              <>Already have an account? <button onClick={() => switchMode('login')} className="font-semibold text-brand hover:underline">Sign in</button></>
            ) : (
              <>Remembered it? <button onClick={() => switchMode('login')} className="font-semibold text-brand hover:underline">Back to sign in</button></>
            )}
          </p>

          <div className="flex items-center justify-center gap-1.5 border-t border-line pt-5 text-[11px] text-slate-500">
            <ShieldCheck className="h-3.5 w-3.5" />
            Passwords are hashed and sessions expire after 24 hours.
          </div>
        </div>
      </main>
    </div>
  );
}

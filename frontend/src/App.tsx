import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { BookOpen, Download, Inbox, LayoutDashboard, LogOut, Menu, Plus, RefreshCw, Star, UserRound, X } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider, useToast } from './context/ToastContext';
import { api, errorMessage } from './lib/api';
import { isClosed } from './lib/format';
import { APP_TAGLINE } from './config';
import type { Metrics, Ticket } from './types';
import AuthForms from './components/AuthForms';
import ResetPassword from './components/ResetPassword';
import TicketList from './components/TicketList';
import TicketDrawer from './components/TicketDrawer';
import NewTicketModal from './components/NewTicketModal';
import AdminOverview from './components/AdminOverview';
import HelpCenter from './components/HelpCenter';
import ProfilePanel from './components/ProfilePanel';
import { Avatar, Logo } from './components/ui';

type View = 'overview' | 'tickets' | 'help' | 'profile';

const REFRESH_MS = 15000;

const greeting = () => {
  const hour = new Date().getHours();
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
};

const csvCell = (value: unknown) => {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const exportCsv = (tickets: Ticket[]) => {
  const header = ['id', 'title', 'category', 'priority', 'status', 'customer_name', 'customer_email', 'created_at', 'resolved_at', 'replies', 'rating', 'feedback'];
  const rows = tickets.map((t) => [t.id, t.title, t.category, t.priority, t.status, t.owner_name, t.owner_email, t.created_at, t.resolved_at, t.comment_count, t.rating, t.feedback]);
  const csv = [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }));
  const link = Object.assign(document.createElement('a'), { href: url, download: `resolvehub-tickets-${new Date().toISOString().slice(0, 10)}.csv` });
  link.click();
  URL.revokeObjectURL(url);
};

function MiniStat({ label, value, tone, icon }: { label: string; value: number; tone: string; icon?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-surface px-4 py-3">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">{icon}{label}</p>
      <p className={`mt-1 text-xl font-extrabold ${tone}`}>{value}</p>
    </div>
  );
}

function Dashboard() {
  const { user, logout } = useAuth();
  const notify = useToast();
  const isAdmin = user?.role === 'ADMIN';

  const [view, setView] = useState<View>(isAdmin ? 'overview' : 'tickets');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [newTicketOpen, setNewTicketOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

  const fetchData = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    try {
      const [ticketsRes, metricsRes] = await Promise.all([
        api.get('/tickets'),
        isAdmin ? api.get('/tickets/metrics') : Promise.resolve(null)
      ]);
      setTickets(ticketsRes.data.data || []);
      if (metricsRes?.data?.data) setMetrics(metricsRes.data.data);
    } catch (err) {
      if (manual || !loaded) notify('error', errorMessage(err, 'Could not load tickets.'));
    } finally {
      setLoaded(true);
      setRefreshing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  useEffect(() => {
    fetchData();
    const tick = () => document.visibilityState === 'visible' && fetchData();
    const id = window.setInterval(tick, REFRESH_MS);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [fetchData]);

  const selected = useMemo(() => tickets.find((t) => t.id === selectedId) || null, [tickets, selectedId]);
  const closeDrawer = useCallback(() => setSelectedId(null), []);
  const openNewTicket = useCallback(() => setNewTicketOpen(true), []);
  const closeNewTicket = useCallback(() => setNewTicketOpen(false), []);

  const handleChanged = (updated?: Ticket) => {
    if (updated) setTickets((list) => list.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)));
    fetchData();
  };

  const handleDeleted = (id: number) => {
    setSelectedId(null);
    setTickets((list) => list.filter((t) => t.id !== id));
    fetchData();
  };

  const handleCreated = (ticket: Ticket) => {
    setNewTicketOpen(false);
    setTickets((list) => [ticket, ...list]);
    setView('tickets');
    notify('success', `Ticket #${ticket.id} submitted. Our team will get back to you soon.`);
    fetchData();
  };

  const userStats = useMemo(() => ({
    open: tickets.filter((t) => t.status === 'OPEN').length,
    inProgress: tickets.filter((t) => t.status === 'IN_PROGRESS').length,
    resolved: tickets.filter((t) => t.status === 'RESOLVED').length,
    toRate: tickets.filter((t) => isClosed(t.status) && t.rating == null).length
  }), [tickets]);

  if (!user) return null;

  const nav: { id: View; label: string; icon: ReactNode; badge?: number }[] = isAdmin
    ? [
        { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="h-4 w-4" /> },
        { id: 'tickets', label: 'Ticket queue', icon: <Inbox className="h-4 w-4" />, badge: tickets.filter((t) => t.status === 'OPEN').length },
        { id: 'profile', label: 'Profile', icon: <UserRound className="h-4 w-4" /> }
      ]
    : [
        { id: 'tickets', label: 'My tickets', icon: <Inbox className="h-4 w-4" />, badge: userStats.toRate || undefined },
        { id: 'help', label: 'Help center', icon: <BookOpen className="h-4 w-4" /> },
        { id: 'profile', label: 'Profile', icon: <UserRound className="h-4 w-4" /> }
      ];

  const titles: Record<View, { title: string; subtitle: string }> = {
    overview: { title: 'Support overview', subtitle: 'Live health of your support desk' },
    tickets: isAdmin
      ? { title: 'Ticket queue', subtitle: 'Review, reply to and resolve customer tickets' }
      : { title: `${greeting()}, ${user.name?.split(' ')[0] || 'there'}`, subtitle: 'Track your requests and chat with our support team' },
    help: { title: 'Help center', subtitle: 'Find answers before raising a ticket' },
    profile: { title: 'Profile & security', subtitle: 'Manage your account details' }
  };

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-5 py-5">
        <Logo size="sm" />
        <button onClick={() => setNavOpen(false)} className="rounded-lg p-1 text-slate-400 lg:hidden" aria-label="Close menu"><X className="h-5 w-5" /></button>
      </div>
      {!isAdmin && (
        <div className="px-3 pb-3">
          <button onClick={() => { setNewTicketOpen(true); setNavOpen(false); }} className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-2.5 text-sm font-bold text-canvas shadow-lg shadow-teal-500/15 transition hover:bg-teal-300">
            <Plus className="h-4 w-4" /> New ticket
          </button>
        </div>
      )}
      <nav className="flex-1 space-y-1 px-3">
        {nav.map((item) => (
          <button
            key={item.id}
            onClick={() => { setView(item.id); setNavOpen(false); }}
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${view === item.id ? 'bg-white/10 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'}`}
          >
            <span className={view === item.id ? 'text-brand' : ''}>{item.icon}</span>
            {item.label}
            {!!item.badge && <span className="ml-auto rounded-md bg-brand/15 px-1.5 py-0.5 text-[10px] font-bold text-brand">{item.badge}</span>}
          </button>
        ))}
      </nav>
      <div className="m-3 rounded-2xl border border-line bg-canvas/40 p-3">
        <div className="flex items-center gap-2.5">
          <Avatar name={user.name || user.email} tone={isAdmin ? 'staff' : 'brand'} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{user.name || user.email.split('@')[0]}</p>
            <p className="truncate text-[11px] text-slate-500">{user.email}</p>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${isAdmin ? 'bg-violet-400/15 text-violet-200' : 'bg-teal-400/10 text-teal-200'}`}>{isAdmin ? 'Admin' : 'Customer'}</span>
          <button onClick={logout} className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-slate-400 hover:bg-rose-500/10 hover:text-rose-300">
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </div>
      </div>
      <p className="px-5 pb-4 text-[10px] text-slate-600">{APP_TAGLINE}</p>
    </div>
  );

  return (
    <div className="min-h-[100dvh] bg-canvas text-slate-200 lg:grid lg:grid-cols-[248px_1fr]">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-[100dvh] border-r border-line bg-surface/60 lg:block">{sidebar}</aside>

      {/* Mobile sidebar */}
      {navOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setNavOpen(false)}>
          <aside className="drawer-left-in h-full w-72 border-r border-line bg-surface" onClick={(e) => e.stopPropagation()}>{sidebar}</aside>
        </div>
      )}

      <div className="min-w-0">
        {/* Mobile top bar */}
        <div className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-canvas/90 px-4 py-3 backdrop-blur lg:hidden">
          <button onClick={() => setNavOpen(true)} className="rounded-lg p-1.5 text-slate-300 hover:bg-white/5" aria-label="Open menu"><Menu className="h-5 w-5" /></button>
          <Logo size="sm" />
          {!isAdmin ? (
            <button onClick={openNewTicket} className="rounded-lg bg-brand p-1.5 text-canvas" aria-label="New ticket"><Plus className="h-5 w-5" /></button>
          ) : <span className="w-8" />}
        </div>

        <main className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <header className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-white">{titles[view].title}</h1>
              <p className="mt-1 text-sm text-slate-400">{titles[view].subtitle}</p>
            </div>
            {(view === 'tickets' || view === 'overview') && (
              <button onClick={() => fetchData(true)} className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/5">
                <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
              </button>
            )}
          </header>

          {!loaded ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => <div key={i} className="h-20 animate-pulse rounded-2xl border border-line bg-surface" />)}
            </div>
          ) : (
            <>
              {view === 'overview' && isAdmin && metrics && (
                <AdminOverview metrics={metrics} tickets={tickets} onOpen={(t) => setSelectedId(t.id)} onViewQueue={() => setView('tickets')} />
              )}

              {view === 'tickets' && (
                <>
                  {!isAdmin && (
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                      <MiniStat label="Open" value={userStats.open} tone="text-amber-300" />
                      <MiniStat label="In progress" value={userStats.inProgress} tone="text-sky-300" />
                      <MiniStat label="Resolved" value={userStats.resolved} tone="text-emerald-300" />
                      <MiniStat label="Awaiting your rating" value={userStats.toRate} tone="text-amber-200" icon={<Star className="h-3 w-3" />} />
                    </div>
                  )}
                  <TicketList
                    tickets={tickets}
                    isAdmin={isAdmin}
                    onOpen={(t) => setSelectedId(t.id)}
                    toolbarExtra={isAdmin ? (
                      <button onClick={() => exportCsv(tickets)} disabled={tickets.length === 0} className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-white/5 disabled:opacity-40">
                        <Download className="h-3.5 w-3.5" /> Export CSV
                      </button>
                    ) : undefined}
                    emptyAction={!isAdmin ? (
                      <button onClick={openNewTicket} className="flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-bold text-canvas hover:bg-teal-300"><Plus className="h-4 w-4" /> Raise your first ticket</button>
                    ) : undefined}
                  />
                </>
              )}

              {view === 'help' && !isAdmin && <HelpCenter onNewTicket={openNewTicket} />}
              {view === 'profile' && <ProfilePanel />}
            </>
          )}
        </main>
      </div>

      {selected && (
        <TicketDrawer key={selected.id} ticket={selected} isAdmin={isAdmin} onClose={closeDrawer} onChanged={handleChanged} onDeleted={handleDeleted} />
      )}
      {!isAdmin && <NewTicketModal open={newTicketOpen} onClose={closeNewTicket} onCreated={handleCreated} />}
    </div>
  );
}

function MainAppLayout() {
  const { user } = useAuth();

  const queryParams = new URLSearchParams(window.location.search);
  if (window.location.pathname === '/reset-password' || queryParams.has('token')) {
    return <ResetPassword />;
  }

  if (!user) {
    return <AuthForms />;
  }

  // key forces a clean dashboard when a different account signs in
  return <Dashboard key={user.id} />;
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <MainAppLayout />
      </AuthProvider>
    </ToastProvider>
  );
}

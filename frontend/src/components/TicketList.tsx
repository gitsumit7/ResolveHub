import { useMemo, useState, type ReactNode } from 'react';
import { ArrowUpDown, Inbox, MessageSquare, Paperclip, Search, Star } from 'lucide-react';
import type { Ticket, TicketStatus } from '../types';
import { PRIORITIES, PRIORITY_META, STATUSES, STATUS_META, timeAgo } from '../lib/format';
import { PriorityBadge, StatusBadge } from './ui';

type SortKey = 'newest' | 'oldest' | 'priority' | 'updated';

interface Props {
  tickets: Ticket[];
  isAdmin: boolean;
  onOpen: (ticket: Ticket) => void;
  toolbarExtra?: ReactNode;
  emptyAction?: ReactNode;
}

export default function TicketList({ tickets, isAdmin, onOpen, toolbarExtra, emptyAction }: Props) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<TicketStatus | 'ALL'>('ALL');
  const [priority, setPriority] = useState<string>('ALL');
  const [sort, setSort] = useState<SortKey>('newest');

  const counts = useMemo(() => {
    const result: Record<string, number> = { ALL: tickets.length };
    STATUSES.forEach((s) => (result[s] = tickets.filter((t) => t.status === s).length));
    return result;
  }, [tickets]);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase().replace(/^#/, '');
    const filtered = tickets.filter((t) => {
      if (status !== 'ALL' && t.status !== status) return false;
      if (priority !== 'ALL' && t.priority !== priority) return false;
      if (!query) return true;
      return [String(t.id), t.title, t.description, t.category, t.owner_name || '', t.owner_email || '']
        .some((field) => field.toLowerCase().includes(query));
    });
    const time = (iso?: string | null) => (iso ? new Date(iso).getTime() : 0);
    return [...filtered].sort((a, b) => {
      if (sort === 'oldest') return time(a.created_at) - time(b.created_at);
      if (sort === 'priority') return PRIORITY_META[b.priority].rank - PRIORITY_META[a.priority].rank || time(b.created_at) - time(a.created_at);
      if (sort === 'updated') return time(b.updated_at || b.created_at) - time(a.updated_at || a.created_at);
      return time(b.created_at) - time(a.created_at);
    });
  }, [tickets, search, status, priority, sort]);

  const selectClass = 'rounded-lg border border-line bg-canvas/60 px-2.5 py-2 text-xs font-medium text-slate-300 outline-none focus:border-brand/50';

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="space-y-3 rounded-2xl border border-line bg-surface p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={isAdmin ? 'Search by #id, title, customer…' : 'Search by #id or title…'}
              className="w-full rounded-lg border border-line bg-canvas/60 py-2 pl-9 pr-3 text-sm text-white placeholder-slate-500 outline-none focus:border-brand/50"
            />
          </div>
          <select value={priority} onChange={(e) => setPriority(e.target.value)} className={selectClass} aria-label="Filter by priority">
            <option value="ALL">All priorities</option>
            {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_META[p].label}</option>)}
          </select>
          <label className="flex items-center gap-1.5">
            <ArrowUpDown className="h-3.5 w-3.5 text-slate-500" />
            <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className={selectClass} aria-label="Sort tickets">
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="priority">Highest priority</option>
              <option value="updated">Recently updated</option>
            </select>
          </label>
          {toolbarExtra}
        </div>
        <div className="flex gap-1 overflow-x-auto" role="tablist">
          {(['ALL', ...STATUSES] as const).map((s) => (
            <button
              key={s}
              role="tab"
              aria-selected={status === s}
              onClick={() => setStatus(s)}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${status === s ? 'bg-white/10 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'}`}
            >
              {s === 'ALL' ? 'All' : STATUS_META[s].label}
              <span className={`rounded-md px-1.5 text-[10px] ${status === s ? 'bg-brand/20 text-brand' : 'bg-white/5 text-slate-500'}`}>{counts[s]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {visible.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line bg-surface/50 px-6 py-14 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/5 text-slate-500"><Inbox className="h-6 w-6" /></span>
          <div>
            <p className="text-sm font-semibold text-white">{tickets.length === 0 ? 'No tickets yet' : 'No tickets match your filters'}</p>
            <p className="mt-1 text-xs text-slate-400">{tickets.length === 0 ? (isAdmin ? 'New customer tickets will appear here.' : 'Raise a ticket and our team will get back to you.') : 'Try clearing the search or choosing another status.'}</p>
          </div>
          {tickets.length === 0 && emptyAction}
        </div>
      ) : (
        <ul className="space-y-2">
          {visible.map((ticket) => (
            <li key={ticket.id}>
              <button
                onClick={() => onOpen(ticket)}
                className={`group w-full rounded-2xl border bg-surface p-4 text-left transition hover:border-brand/40 hover:bg-surface-2 ${ticket.priority === 'CRITICAL' && !['RESOLVED', 'REJECTED'].includes(ticket.status) ? 'border-rose-500/30' : 'border-line'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-semibold text-white">
                      <span className="font-mono text-xs font-medium text-slate-500">#{ticket.id}</span>
                      <span className="truncate group-hover:text-teal-100">{ticket.title}</span>
                    </p>
                    <p className="mt-1 line-clamp-1 text-xs text-slate-400">{ticket.description}</p>
                  </div>
                  <PriorityBadge priority={ticket.priority} />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-[11px] text-slate-400">
                  <StatusBadge status={ticket.status} />
                  <span className="rounded-md bg-white/5 px-2 py-0.5 font-medium text-slate-300">{ticket.category || 'General'}</span>
                  {isAdmin && <span className="max-w-[200px] truncate">{ticket.owner_name || ticket.owner_email || 'Unknown customer'}</span>}
                  <span title={new Date(ticket.created_at).toLocaleString()}>{timeAgo(ticket.created_at)}</span>
                  <span className="ml-auto flex items-center gap-3">
                    {ticket.attachment_url && <Paperclip className="h-3.5 w-3.5" aria-label="Has attachment" />}
                    {typeof ticket.rating === 'number' && (
                      <span className="flex items-center gap-1 text-amber-300"><Star className="h-3.5 w-3.5 fill-current" />{ticket.rating}</span>
                    )}
                    <span className="flex items-center gap-1"><MessageSquare className="h-3.5 w-3.5" />{ticket.comment_count || 0}</span>
                  </span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

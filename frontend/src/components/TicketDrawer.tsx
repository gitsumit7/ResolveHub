import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Clock, LoaderCircle, Paperclip, Pencil, Send, Star, Trash2, UserRound, X } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import { useToast } from '../context/ToastContext';
import { API_ORIGIN, DELETE_WINDOW_HOURS, EDIT_WINDOW_HOURS } from '../config';
import { PRIORITIES, PRIORITY_META, STATUSES, STATUS_META, formatDate, hoursLeft, isClosed, timeAgo } from '../lib/format';
import type { Ticket, TicketComment, TicketPriority, TicketStatus } from '../types';
import { Avatar, PriorityBadge, StatusBadge } from './ui';

interface Props {
  ticket: Ticket;
  isAdmin: boolean;
  onClose: () => void;
  onChanged: (updated?: Ticket) => void;
  onDeleted: (id: number) => void;
}

const STATUS_BUTTON: Record<TicketStatus, string> = {
  OPEN: 'data-[active=true]:bg-amber-400/15 data-[active=true]:text-amber-200 data-[active=true]:ring-amber-400/40',
  IN_PROGRESS: 'data-[active=true]:bg-sky-400/15 data-[active=true]:text-sky-200 data-[active=true]:ring-sky-400/40',
  RESOLVED: 'data-[active=true]:bg-emerald-400/15 data-[active=true]:text-emerald-200 data-[active=true]:ring-emerald-400/40',
  REJECTED: 'data-[active=true]:bg-rose-400/15 data-[active=true]:text-rose-200 data-[active=true]:ring-rose-400/40'
};

const RATING_LABELS = ['', 'Very poor', 'Poor', 'Okay', 'Good', 'Excellent'];

export default function TicketDrawer({ ticket, isAdmin, onClose, onChanged, onDeleted }: Props) {
  const notify = useToast();
  const [comments, setComments] = useState<TicketComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(true);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(ticket.title);
  const [editDescription, setEditDescription] = useState(ticket.description);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const threadEnd = useRef<HTMLDivElement>(null);

  const loadComments = useCallback(async () => {
    try {
      const res = await api.get(`/tickets/${ticket.id}/comments`);
      setComments(res.data.data || []);
    } catch (err) {
      console.error('Could not load conversation', err);
    } finally {
      setLoadingComments(false);
    }
  }, [ticket.id]);

  useEffect(() => {
    setLoadingComments(true);
    setComments([]);
    setEditing(false);
    setRating(0);
    setFeedback('');
    loadComments();
    const id = window.setInterval(() => document.visibilityState === 'visible' && loadComments(), 10000);
    return () => window.clearInterval(id);
  }, [loadComments]);

  useEffect(() => {
    threadEnd.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [comments.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const run = async (action: () => Promise<void>, failure: string) => {
    setBusy(true);
    try {
      await action();
    } catch (err) {
      notify('error', errorMessage(err, failure));
    } finally {
      setBusy(false);
    }
  };

  const changeStatus = (status: TicketStatus) =>
    run(async () => {
      const res = await api.patch(`/tickets/${ticket.id}/status`, { status });
      onChanged(res.data.data);
      await loadComments();
      notify('success', `Ticket #${ticket.id} marked ${STATUS_META[status].label.toLowerCase()}${res.data.notificationQueued ? ' — customer notified by email' : ''}.`);
    }, 'Could not update the status.');

  const changePriority = (priority: TicketPriority) =>
    run(async () => {
      const res = await api.patch(`/tickets/${ticket.id}/priority`, { priority });
      onChanged(res.data.data);
      await loadComments();
      notify('success', `Priority set to ${PRIORITY_META[priority].label}.`);
    }, 'Could not update the priority.');

  const saveEdit = () =>
    run(async () => {
      if (!editTitle.trim() || !editDescription.trim()) throw new Error('Title and description are required.');
      const res = await api.patch(`/tickets/${ticket.id}`, { title: editTitle, description: editDescription });
      onChanged(res.data.data);
      setEditing(false);
      notify('success', 'Ticket updated.');
    }, 'Could not save your changes.');

  const deleteTicket = () => {
    if (!window.confirm(`Delete ticket #${ticket.id}? This cannot be undone.`)) return;
    run(async () => {
      await api.delete(`/tickets/${ticket.id}`);
      onDeleted(ticket.id);
      notify('success', `Ticket #${ticket.id} deleted.`);
    }, 'Could not delete the ticket.');
  };

  const submitRating = () =>
    run(async () => {
      const res = await api.post(`/tickets/${ticket.id}/rating`, { rating, feedback });
      onChanged(res.data.data);
      await loadComments();
      notify('success', 'Thanks for rating your support experience!');
    }, 'Could not save your rating.');

  const sendMessage = async () => {
    const text = message.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      await api.post(`/tickets/${ticket.id}/comments`, { message: text });
      setMessage('');
      await loadComments();
      onChanged();
    } catch (err) {
      notify('error', errorMessage(err, 'Could not send your message.'));
    } finally {
      setSending(false);
    }
  };

  const onComposerKey = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      sendMessage();
    }
  };

  const editHours = hoursLeft(ticket.created_at, EDIT_WINDOW_HOURS);
  const deleteHours = hoursLeft(ticket.created_at, DELETE_WINDOW_HOURS);
  const closed = isClosed(ticket.status);
  const myRole = isAdmin ? 'ADMIN' : 'USER';

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/50 backdrop-blur-[2px]" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="drawer-in flex h-full w-full max-w-2xl flex-col border-l border-line bg-surface shadow-2xl" role="dialog" aria-modal="true" aria-label={`Ticket ${ticket.id}`}>
        {/* Header */}
        <header className="border-b border-line px-6 pb-4 pt-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="font-mono text-xs text-slate-500">Ticket #{ticket.id}</p>
              {editing ? (
                <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} maxLength={255} className="mt-1 w-full rounded-lg border border-line bg-canvas/60 px-3 py-2 text-base font-bold text-white outline-none focus:border-brand/60" />
              ) : (
                <h2 className="mt-0.5 text-lg font-bold leading-snug text-white">{ticket.title}</h2>
              )}
            </div>
            <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-white" aria-label="Close ticket">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <StatusBadge status={ticket.status} />
            <PriorityBadge priority={ticket.priority} />
            <span className="rounded-md bg-white/5 px-2 py-0.5 text-[11px] font-medium text-slate-300">{ticket.category || 'General'}</span>
          </div>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {/* Meta */}
          <dl className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
            {isAdmin && (
              <div className="col-span-2 sm:col-span-1">
                <dt className="text-slate-500">Customer</dt>
                <dd className="mt-0.5 truncate font-medium text-slate-200" title={ticket.owner_email || ''}>{ticket.owner_name || ticket.owner_email || 'Unknown'}</dd>
                {ticket.owner_name && ticket.owner_email && <dd className="truncate text-slate-500">{ticket.owner_email}</dd>}
              </div>
            )}
            <div>
              <dt className="text-slate-500">Created</dt>
              <dd className="mt-0.5 font-medium text-slate-200" title={formatDate(ticket.created_at)}>{timeAgo(ticket.created_at)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">{ticket.resolved_at ? 'Closed' : 'Last update'}</dt>
              <dd className="mt-0.5 font-medium text-slate-200">{timeAgo(ticket.resolved_at || ticket.updated_at || ticket.created_at)}</dd>
            </div>
          </dl>

          {/* Description */}
          <div className="rounded-xl border border-line bg-canvas/40 p-4">
            {editing ? (
              <textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={5} className="w-full resize-y rounded-lg border border-line bg-canvas/60 px-3 py-2 text-sm leading-relaxed text-white outline-none focus:border-brand/60" />
            ) : (
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-300">{ticket.description}</p>
            )}
            {ticket.attachment_url && (
              <a href={`${API_ORIGIN}${ticket.attachment_url}`} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-white/5 px-2.5 py-1.5 text-xs font-medium text-sky-300 hover:bg-white/10">
                <Paperclip className="h-3.5 w-3.5" /> {ticket.attachment_name || 'View attachment'}
              </a>
            )}
          </div>

          {/* Owner actions */}
          {!isAdmin && (editHours > 0 || deleteHours > 0) && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {editing ? (
                <>
                  <button disabled={busy} onClick={saveEdit} className="rounded-lg bg-brand px-3 py-1.5 font-bold text-canvas hover:bg-teal-300 disabled:opacity-60">Save changes</button>
                  <button onClick={() => { setEditing(false); setEditTitle(ticket.title); setEditDescription(ticket.description); }} className="rounded-lg px-3 py-1.5 font-semibold text-slate-300 hover:bg-white/5">Cancel</button>
                </>
              ) : (
                <>
                  {editHours > 0 && (
                    <button onClick={() => { setEditTitle(ticket.title); setEditDescription(ticket.description); setEditing(true); }} className="flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-1.5 font-semibold text-slate-200 hover:bg-white/10">
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </button>
                  )}
                  {deleteHours > 0 && (
                    <button disabled={busy} onClick={deleteTicket} className="flex items-center gap-1.5 rounded-lg bg-rose-500/10 px-3 py-1.5 font-semibold text-rose-300 hover:bg-rose-500/20">
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </button>
                  )}
                  <span className="flex items-center gap-1 text-slate-500">
                    <Clock className="h-3.5 w-3.5" />
                    {editHours > 0 ? `Editable for ${Math.ceil(editHours)}h more` : `Can be deleted for ${Math.ceil(deleteHours)}h more`}
                  </span>
                </>
              )}
            </div>
          )}

          {/* Admin controls */}
          {isAdmin && (
            <div className="space-y-3 rounded-xl border border-line p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Manage ticket</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {STATUSES.map((s) => (
                  <button
                    key={s}
                    data-active={ticket.status === s}
                    disabled={busy || ticket.status === s}
                    onClick={() => changeStatus(s)}
                    className={`rounded-lg bg-white/5 px-2 py-2 text-xs font-semibold text-slate-300 ring-1 ring-inset ring-transparent transition hover:bg-white/10 disabled:cursor-default ${STATUS_BUTTON[s]}`}
                  >
                    {STATUS_META[s].label}
                  </button>
                ))}
              </div>
              <label className="flex items-center justify-between gap-3 text-xs">
                <span className="font-semibold text-slate-300">Priority</span>
                <select disabled={busy} value={ticket.priority} onChange={(e) => changePriority(e.target.value as TicketPriority)} className="rounded-lg border border-line bg-canvas/60 px-3 py-1.5 font-medium text-slate-200 outline-none focus:border-brand/60">
                  {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_META[p].label}</option>)}
                </select>
              </label>
            </div>
          )}

          {/* Satisfaction rating */}
          {closed && (typeof ticket.rating === 'number' ? (
            <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-4">
              <p className="text-xs font-semibold text-amber-200">{isAdmin ? 'Customer rating' : 'Your rating'}</p>
              <div className="mt-1.5 flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((n) => <Star key={n} className={`h-4 w-4 ${n <= (ticket.rating || 0) ? 'fill-amber-300 text-amber-300' : 'text-slate-600'}`} />)}
                <span className="ml-2 text-xs text-slate-300">{RATING_LABELS[ticket.rating]}</span>
              </div>
              {ticket.feedback && <p className="mt-2 text-sm italic text-slate-300">“{ticket.feedback}”</p>}
            </div>
          ) : !isAdmin ? (
            <div className="space-y-3 rounded-xl border border-amber-400/20 bg-amber-400/5 p-4">
              <div>
                <p className="text-sm font-semibold text-white">How was your support experience?</p>
                <p className="text-xs text-slate-400">Your rating helps the team improve.</p>
              </div>
              <div className="flex items-center gap-1" onMouseLeave={() => setHoverRating(0)}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" onClick={() => setRating(n)} onMouseEnter={() => setHoverRating(n)} aria-label={`${n} star${n > 1 ? 's' : ''}`} className="p-0.5">
                    <Star className={`h-6 w-6 transition ${n <= (hoverRating || rating) ? 'fill-amber-300 text-amber-300' : 'text-slate-600 hover:text-slate-400'}`} />
                  </button>
                ))}
                <span className="ml-2 text-xs text-slate-300">{RATING_LABELS[hoverRating || rating]}</span>
              </div>
              {rating > 0 && (
                <>
                  <textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} maxLength={1000} rows={2} placeholder="Anything you'd like to add? (optional)" className="w-full rounded-lg border border-line bg-canvas/60 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-brand/60" />
                  <button disabled={busy} onClick={submitRating} className="rounded-lg bg-amber-300 px-4 py-1.5 text-xs font-bold text-canvas hover:bg-amber-200 disabled:opacity-60">Submit rating</button>
                </>
              )}
            </div>
          ) : null)}

          {/* Conversation */}
          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Conversation & activity</p>
            {loadingComments ? (
              <div className="flex items-center gap-2 py-6 text-xs text-slate-500"><LoaderCircle className="h-4 w-4 animate-spin" /> Loading conversation…</div>
            ) : comments.length === 0 ? (
              <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-xs text-slate-500">
                {isAdmin ? 'No replies yet. Your first reply moves this ticket to “In progress”.' : 'No replies yet. The support team will respond here.'}
              </p>
            ) : (
              <ol className="space-y-3">
                {comments.map((comment) => {
                  if (comment.is_system) {
                    return (
                      <li key={comment.id} className="flex items-center gap-2 px-1 text-[11px] text-slate-500">
                        <span className="h-px flex-1 bg-line" />
                        <span title={formatDate(comment.created_at)}>{comment.message} · {timeAgo(comment.created_at)}</span>
                        <span className="h-px flex-1 bg-line" />
                      </li>
                    );
                  }
                  const mine = comment.author_role === myRole;
                  const staff = comment.author_role === 'ADMIN';
                  const name = staff ? (isAdmin ? comment.author_name || 'Support' : 'Support team') : comment.author_name || 'Customer';
                  return (
                    <li key={comment.id} className={`flex gap-2.5 ${mine ? 'flex-row-reverse' : ''}`}>
                      <Avatar name={name} tone={staff ? 'staff' : 'brand'} />
                      <div className={`max-w-[80%] ${mine ? 'items-end text-right' : ''} flex flex-col`}>
                        <p className="mb-1 text-[11px] text-slate-500">
                          <span className="font-semibold text-slate-300">{mine ? 'You' : name}</span> · {timeAgo(comment.created_at)}
                        </p>
                        <p className={`whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-left text-sm leading-relaxed ${mine ? 'rounded-tr-sm bg-brand/15 text-teal-50' : staff ? 'rounded-tl-sm bg-violet-400/10 text-violet-50' : 'rounded-tl-sm bg-white/5 text-slate-200'}`}>
                          {comment.message}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
            <div ref={threadEnd} />
          </div>
        </div>

        {/* Composer */}
        <footer className="border-t border-line bg-surface-2/60 px-6 py-4">
          <div className="flex items-end gap-2">
            <span className="hidden sm:block">{isAdmin ? <Avatar name="Support" tone="staff" /> : <span className="grid h-8 w-8 place-items-center rounded-full bg-white/5 text-slate-400"><UserRound className="h-4 w-4" /></span>}</span>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={onComposerKey}
              rows={2}
              maxLength={2000}
              placeholder={isAdmin ? 'Reply to the customer… (they will get an email)' : 'Add more details or ask for an update…'}
              className="min-h-[44px] flex-1 resize-none rounded-xl border border-line bg-canvas/60 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-brand/60"
            />
            <button onClick={sendMessage} disabled={sending || !message.trim()} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand text-canvas transition hover:bg-teal-300 disabled:opacity-40" aria-label="Send message">
              {sending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
          <p className="mt-1.5 text-right text-[10px] text-slate-500">Ctrl + Enter to send</p>
        </footer>
      </aside>
    </div>
  );
}

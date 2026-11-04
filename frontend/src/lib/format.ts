import type { TicketPriority, TicketStatus } from '../types';

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export const timeAgo = (iso: string) => {
  const seconds = (Date.now() - new Date(iso).getTime()) / 1000;
  if (seconds < 60) return 'just now';
  const minutes = seconds / 60;
  if (minutes < 60) return `${Math.floor(minutes)}m ago`;
  const hours = minutes / 60;
  if (hours < 24) return `${Math.floor(hours)}h ago`;
  const days = hours / 24;
  if (days < 30) return `${Math.floor(days)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

export const formatDuration = (hours: number | null | undefined) => {
  if (hours === null || hours === undefined) return '—';
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`;
  if (hours < 48) return `${hours.toFixed(1)} h`;
  return `${(hours / 24).toFixed(1)} days`;
};

/** Hours left in a window that started at `iso` (negative when it has passed). */
export const hoursLeft = (iso: string, windowHours: number) =>
  windowHours - (Date.now() - new Date(iso).getTime()) / 3_600_000;

export const STATUS_META: Record<TicketStatus, { label: string; pill: string; dot: string }> = {
  OPEN: { label: 'Open', pill: 'bg-amber-400/10 text-amber-300 ring-amber-400/25', dot: 'bg-amber-400' },
  IN_PROGRESS: { label: 'In progress', pill: 'bg-sky-400/10 text-sky-300 ring-sky-400/25', dot: 'bg-sky-400' },
  RESOLVED: { label: 'Resolved', pill: 'bg-emerald-400/10 text-emerald-300 ring-emerald-400/25', dot: 'bg-emerald-400' },
  REJECTED: { label: 'Not genuine', pill: 'bg-rose-400/10 text-rose-300 ring-rose-400/25', dot: 'bg-rose-400' }
};

export const PRIORITY_META: Record<TicketPriority, { label: string; pill: string; rank: number }> = {
  CRITICAL: { label: 'Critical', pill: 'bg-rose-500/15 text-rose-300 ring-rose-500/30', rank: 4 },
  HIGH: { label: 'High', pill: 'bg-orange-400/15 text-orange-300 ring-orange-400/30', rank: 3 },
  MEDIUM: { label: 'Medium', pill: 'bg-yellow-300/10 text-yellow-200 ring-yellow-300/25', rank: 2 },
  LOW: { label: 'Low', pill: 'bg-slate-400/10 text-slate-300 ring-slate-400/25', rank: 1 }
};

export const STATUSES: TicketStatus[] = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'REJECTED'];
export const PRIORITIES: TicketPriority[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
export const CATEGORIES = ['Billing', 'Technical', 'Account', 'General'];

export const isClosed = (status: TicketStatus) => status === 'RESOLVED' || status === 'REJECTED';

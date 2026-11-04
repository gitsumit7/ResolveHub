import { LifeBuoy, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { APP_NAME } from '../config';
import { PRIORITY_META, STATUS_META } from '../lib/format';
import type { TicketPriority, TicketStatus } from '../types';

export function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const box = size === 'lg' ? 'h-11 w-11 rounded-2xl' : size === 'sm' ? 'h-8 w-8 rounded-lg' : 'h-9 w-9 rounded-xl';
  const icon = size === 'lg' ? 'h-6 w-6' : 'h-5 w-5';
  const text = size === 'lg' ? 'text-2xl' : 'text-lg';
  return (
    <div className="flex items-center gap-2.5">
      <span className={`${box} grid place-items-center bg-gradient-to-br from-teal-300 to-cyan-500 text-canvas shadow-lg shadow-teal-500/20`}>
        <LifeBuoy className={icon} strokeWidth={2.4} />
      </span>
      <span className={`${text} font-extrabold tracking-tight text-white`}>
        {APP_NAME.replace('Hub', '')}<span className="text-brand">Hub</span>
      </span>
    </div>
  );
}

export function StatusBadge({ status }: { status: TicketStatus }) {
  const meta = STATUS_META[status];
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${meta.pill}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: TicketPriority }) {
  const meta = PRIORITY_META[priority];
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ring-1 ring-inset ${meta.pill}`}>
      {priority === 'CRITICAL' && <TriangleAlert className="h-3 w-3" />}
      {meta.label}
    </span>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-line bg-surface ${className}`}>{children}</section>;
}

export function SectionTitle({ icon, title, subtitle, action }: { icon?: ReactNode; title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        {icon && <span className="mt-0.5 grid h-8 w-8 place-items-center rounded-lg bg-white/5 text-brand">{icon}</span>}
        <div>
          <h2 className="text-sm font-bold text-white">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export function Avatar({ name, tone = 'brand' }: { name: string; tone?: 'brand' | 'staff' }) {
  const initials = name
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
  const colors = tone === 'staff' ? 'bg-violet-400/15 text-violet-200 ring-violet-400/30' : 'bg-teal-400/15 text-teal-200 ring-teal-400/30';
  return <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-[11px] font-bold ring-1 ${colors}`}>{initials || '?'}</span>;
}

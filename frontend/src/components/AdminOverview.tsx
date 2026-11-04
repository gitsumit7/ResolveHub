import { useState, type ReactNode } from 'react';
import { Activity, ChevronRight, CircleCheck, Hourglass, Inbox, Star, Table2, TrendingUp, TriangleAlert } from 'lucide-react';
import type { ComplaintPeriod, Metrics, Ticket } from '../types';
import { STATUS_META, formatDuration, isClosed, timeAgo } from '../lib/format';
import { Card, PriorityBadge, SectionTitle, StatusBadge } from './ui';

interface Props {
  metrics: Metrics;
  tickets: Ticket[];
  onOpen: (ticket: Ticket) => void;
  onViewQueue: () => void;
}

function Kpi({ label, value, hint, icon, tone = 'text-white' }: { label: string; value: ReactNode; hint: ReactNode; icon: ReactNode; tone?: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between text-slate-400">
        <p className="text-xs font-semibold">{label}</p>
        <span className="text-slate-500">{icon}</span>
      </div>
      <p className={`mt-2 text-2xl font-extrabold tracking-tight ${tone}`}>{value}</p>
      <p className="mt-1 text-[11px] text-slate-500">{hint}</p>
    </Card>
  );
}

/** 14-day intake: single series, one hue, hover tooltip on every bar. */
function TrendChart({ data }: { data: Metrics['trend'] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.count));
  const label = (day: string) => new Date(`${day}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  const active = hover !== null ? data[hover] : null;
  return (
    <div>
      <div className="mb-2 h-5 text-xs text-slate-300">
        {active ? <><span className="font-bold text-white">{active.count}</span> ticket{active.count === 1 ? '' : 's'} on {label(active.day)}</> : <span className="text-slate-500">Hover a bar for details</span>}
      </div>
      <div className="relative h-52">
        {[0.5, 1].map((f) => (
          <div key={f} className="absolute inset-x-0 border-t border-dashed border-white/5" style={{ bottom: `${f * 100}%` }}>
            <span className="absolute -top-2.5 right-0 bg-surface pl-1 text-[10px] text-slate-600">{Math.round(max * f)}</span>
          </div>
        ))}
        <div className="absolute inset-0 flex items-end gap-[2px] pr-6">
          {data.map((d, i) => (
            <button
              key={d.day}
              type="button"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              aria-label={`${d.count} tickets on ${label(d.day)}`}
              className="flex h-full flex-1 items-end"
            >
              <span
                className={`w-full rounded-t-[4px] transition-colors ${hover === i ? 'bg-teal-300' : 'bg-teal-400/70'}`}
                style={{ height: `${d.count === 0 ? 0 : Math.max(4, (d.count / max) * 100)}%` }}
              />
            </button>
          ))}
        </div>
      </div>
      <div className="mt-2 flex justify-between pr-6 text-[10px] text-slate-500">
        <span>{data[0] && label(data[0].day)}</span>
        <span>Today</span>
      </div>
    </div>
  );
}

function ComplaintBreakdown({ title, rows }: { title: string; rows: ComplaintPeriod[] }) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-line px-4 py-3">
        <SectionTitle icon={<Table2 className="h-4 w-4" />} title={title} subtitle="Ticket count per customer" />
      </div>
      {rows.length === 0 ? (
        <p className="p-4 text-xs text-slate-500">No data yet.</p>
      ) : (
        <div className="max-h-64 overflow-auto">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-surface-2 text-slate-400">
              <tr>
                <th className="px-4 py-2 font-semibold">Period</th>
                <th className="px-4 py-2 font-semibold">Customer</th>
                <th className="px-4 py-2 text-right font-semibold">Tickets</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.period}-${row.user_name}`} className="border-t border-line/60 text-slate-300">
                  <td className="whitespace-nowrap px-4 py-2.5 font-mono text-slate-400">{row.period}</td>
                  <td className="break-all px-4 py-2.5">{row.user_name}</td>
                  <td className="px-4 py-2.5 text-right font-bold text-white">{row.complaint_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

export default function AdminOverview({ metrics, tickets, onOpen, onViewQueue }: Props) {
  const active = metrics.open + metrics.inProgress;
  const maxCategory = Math.max(1, ...metrics.byCategory.map((c) => c.count));
  const statusRows = [
    { key: 'OPEN' as const, value: metrics.open },
    { key: 'IN_PROGRESS' as const, value: metrics.inProgress },
    { key: 'RESOLVED' as const, value: metrics.resolved },
    { key: 'REJECTED' as const, value: metrics.rejected }
  ];

  const slaMs = metrics.slaHours * 3_600_000;
  const attention = tickets
    .filter((t) => !isClosed(t.status) && (t.priority === 'CRITICAL' || t.priority === 'HIGH' || Date.now() - new Date(t.created_at).getTime() > slaMs))
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .slice(0, 5);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Total tickets" value={metrics.total} hint={`${metrics.last7Days} in the last 7 days`} icon={<Activity className="h-4 w-4" />} />
        <Kpi label="Active queue" value={active} hint={`${metrics.open} open · ${metrics.inProgress} in progress`} icon={<Inbox className="h-4 w-4" />} tone="text-sky-300" />
        <Kpi label={`Overdue (> ${metrics.slaHours}h)`} value={metrics.overdue} hint={`${metrics.slaBreachRate}% of resolved were late`} icon={<Hourglass className="h-4 w-4" />} tone={metrics.overdue > 0 ? 'text-amber-300' : 'text-white'} />
        <Kpi label="Critical open" value={metrics.criticalOpen} hint={`${metrics.critical} critical overall`} icon={<TriangleAlert className="h-4 w-4" />} tone={metrics.criticalOpen > 0 ? 'text-rose-300' : 'text-white'} />
        <Kpi label="Avg. resolution" value={formatDuration(metrics.avgResolutionHours)} hint={`${metrics.resolved} resolved tickets`} icon={<CircleCheck className="h-4 w-4" />} tone="text-emerald-300" />
        <Kpi
          label="Customer rating"
          value={metrics.avgRating ? <>{metrics.avgRating.toFixed(1)}<span className="text-sm font-semibold text-slate-500"> / 5</span></> : '—'}
          hint={metrics.ratedCount ? `from ${metrics.ratedCount} rating${metrics.ratedCount === 1 ? '' : 's'}` : 'No ratings yet'}
          icon={<Star className="h-4 w-4" />}
          tone="text-amber-200"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="p-5 xl:col-span-2">
          <SectionTitle icon={<TrendingUp className="h-4 w-4" />} title="New tickets per day" subtitle="Last 14 days" />
          <div className="mt-4"><TrendChart data={metrics.trend} /></div>
        </Card>

        <Card className="space-y-5 p-5">
          <div>
            <h3 className="text-sm font-bold text-white">By status</h3>
            <ul className="mt-3 space-y-2.5">
              {statusRows.map((row) => (
                <li key={row.key} className="flex items-center gap-3 text-xs">
                  <span className="w-28 shrink-0"><StatusBadge status={row.key} /></span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-white/5">
                    <span className={`block h-full rounded-full ${STATUS_META[row.key].dot}`} style={{ width: `${metrics.total ? (row.value / metrics.total) * 100 : 0}%` }} />
                  </span>
                  <span className="w-8 text-right font-semibold text-slate-200">{row.value}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">By category</h3>
            {metrics.byCategory.length === 0 ? (
              <p className="mt-2 text-xs text-slate-500">No tickets yet.</p>
            ) : (
              <ul className="mt-3 space-y-2.5">
                {metrics.byCategory.map((c) => (
                  <li key={c.label} className="text-xs" title={`${c.label}: ${c.count}`}>
                    <div className="mb-1 flex justify-between text-slate-300"><span>{c.label}</span><span className="font-semibold text-slate-200">{c.count}</span></div>
                    <span className="block h-2 overflow-hidden rounded-full bg-white/5">
                      <span className="block h-full rounded-full bg-teal-400/70" style={{ width: `${(c.count / maxCategory) * 100}%` }} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <SectionTitle
          icon={<TriangleAlert className="h-4 w-4" />}
          title="Needs attention"
          subtitle={`High or critical priority, or open longer than ${metrics.slaHours}h — oldest first`}
          action={<button onClick={onViewQueue} className="flex items-center gap-1 text-xs font-semibold text-brand hover:underline">Open full queue <ChevronRight className="h-3.5 w-3.5" /></button>}
        />
        {attention.length === 0 ? (
          <p className="mt-4 rounded-xl bg-emerald-400/5 px-4 py-3 text-xs text-emerald-200">All caught up — nothing urgent in the queue.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line">
            {attention.map((t) => (
              <li key={t.id}>
                <button onClick={() => onOpen(t)} className="flex w-full items-center gap-3 py-2.5 text-left text-sm hover:text-teal-100">
                  <span className="font-mono text-xs text-slate-500">#{t.id}</span>
                  <span className="min-w-0 flex-1 truncate text-slate-200">{t.title}</span>
                  <span className="hidden text-xs text-slate-500 sm:inline">{t.owner_name || t.owner_email}</span>
                  <PriorityBadge priority={t.priority} />
                  <span className="w-16 text-right text-xs text-slate-500">{timeAgo(t.created_at)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <ComplaintBreakdown title="Monthly tickets by customer" rows={metrics.monthly} />
        <ComplaintBreakdown title="Yearly tickets by customer" rows={metrics.yearly} />
      </div>
    </div>
  );
}

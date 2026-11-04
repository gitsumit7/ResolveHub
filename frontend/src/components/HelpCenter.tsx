import { useState } from 'react';
import { BookOpen, ChevronRight, Clock3, Mail, Plus, Search } from 'lucide-react';
import { FAQ } from '../lib/faq';
import { SUPPORT_EMAIL, SUPPORT_HOURS } from '../config';
import { Card, SectionTitle } from './ui';

export default function HelpCenter({ onNewTicket }: { onNewTicket: () => void }) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const entries = q
    ? FAQ.filter((f) => f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q) || f.keywords.some((k) => q.includes(k)))
    : FAQ;

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <SectionTitle icon={<BookOpen className="h-4 w-4" />} title="Knowledge base" subtitle="Quick answers to common questions" />
        <div className="relative mt-4">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search help articles…" className="w-full rounded-lg border border-line bg-canvas/60 py-2 pl-9 pr-3 text-sm text-white placeholder-slate-500 outline-none focus:border-brand/50" />
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {entries.map((item) => (
            <details key={item.question} className="group rounded-xl border border-line bg-canvas/30 p-4 open:border-brand/30 open:bg-brand/5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-semibold text-slate-200 group-open:text-teal-100">
                {item.question}
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-500 transition group-open:rotate-90" />
              </summary>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">{item.answer}</p>
            </details>
          ))}
        </div>
        {entries.length === 0 && <p className="mt-4 text-xs text-slate-500">No articles match “{query}”. Raise a ticket and we will help you directly.</p>}
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="flex items-center gap-3 p-4">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-400/10 text-amber-300"><Clock3 className="h-5 w-5" /></span>
          <div>
            <p className="text-xs text-slate-400">Support hours</p>
            <p className="text-sm font-semibold text-white">{SUPPORT_HOURS}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3 p-4">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-sky-400/10 text-sky-300"><Mail className="h-5 w-5" /></span>
          <div className="min-w-0">
            <p className="text-xs text-slate-400">Email us</p>
            <a href={`mailto:${SUPPORT_EMAIL}`} className="block truncate text-sm font-semibold text-white hover:text-sky-300">{SUPPORT_EMAIL}</a>
          </div>
        </Card>
        <button onClick={onNewTicket} className="flex items-center gap-3 rounded-2xl border border-brand/30 bg-brand/10 p-4 text-left transition hover:bg-brand/15">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand text-canvas"><Plus className="h-5 w-5" /></span>
          <div>
            <p className="text-xs text-teal-200/80">Still stuck?</p>
            <p className="text-sm font-semibold text-white">Raise a ticket</p>
          </div>
        </button>
      </div>
    </div>
  );
}

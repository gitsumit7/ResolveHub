import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { BookOpen, Paperclip, Sparkles, X } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import { suggestArticles } from '../lib/faq';
import { CATEGORIES } from '../lib/format';
import type { Ticket } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (ticket: Ticket) => void;
}

const MAX_TITLE = 120;
const MAX_DESCRIPTION = 2000;

export default function NewTicketModal({ open, onClose, onCreated }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const suggestions = useMemo(() => suggestArticles(`${title} ${description}`), [title, description]);

  if (!open) return null;

  const reset = () => {
    setTitle('');
    setDescription('');
    setCategory('');
    setAttachment(null);
    setError(null);
  };

  const handleFile = (file: File | null) => {
    if (file && file.size > 5 * 1024 * 1024) {
      setError('Attachment must be 5 MB or smaller.');
      return;
    }
    setError(null);
    setAttachment(file);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('title', title.trim());
      formData.append('description', description.trim());
      if (category) formData.append('category', category);
      if (attachment) formData.append('attachment', attachment);
      const res = await api.post('/tickets', formData);
      reset();
      onCreated(res.data.data as Ticket);
    } catch (err) {
      setError(errorMessage(err, 'Could not submit your ticket.'));
    } finally {
      setLoading(false);
    }
  };

  const fieldClass = 'w-full rounded-xl border border-line bg-canvas/60 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition focus:border-brand/60 focus:ring-4 focus:ring-brand/10';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-in flex max-h-[92dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl border border-line bg-surface shadow-2xl sm:rounded-2xl" role="dialog" aria-modal="true" aria-labelledby="new-ticket-title">
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <div>
            <h2 id="new-ticket-title" className="text-base font-bold text-white">Raise a new ticket</h2>
            <p className="text-xs text-slate-400">Our AI assistant will set the priority automatically.</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-white" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <label className="block space-y-1.5">
            <span className="flex justify-between text-xs font-semibold text-slate-300">
              Subject <span className="font-normal text-slate-500">{title.length}/{MAX_TITLE}</span>
            </span>
            <input value={title} maxLength={MAX_TITLE} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Payment failed but money was deducted" required autoFocus className={fieldClass} />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-slate-300">Category</span>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={fieldClass}>
              <option value="">Let AI decide</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>

          <label className="block space-y-1.5">
            <span className="flex justify-between text-xs font-semibold text-slate-300">
              Describe the issue <span className="font-normal text-slate-500">{description.length}/{MAX_DESCRIPTION}</span>
            </span>
            <textarea
              value={description}
              maxLength={MAX_DESCRIPTION}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What happened, what did you expect, and the steps to reproduce it…"
              rows={5}
              required
              className={`${fieldClass} resize-y leading-relaxed`}
            />
          </label>

          {suggestions.length > 0 && (
            <div className="rounded-xl border border-teal-400/20 bg-teal-400/5 p-3.5">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-teal-200">
                <Sparkles className="h-3.5 w-3.5" /> These help articles might solve it right away
              </p>
              <ul className="space-y-2">
                {suggestions.map((item) => (
                  <li key={item.question} className="text-xs">
                    <p className="flex items-center gap-1.5 font-semibold text-white"><BookOpen className="h-3.5 w-3.5 text-teal-300" />{item.question}</p>
                    <p className="mt-0.5 pl-5 leading-relaxed text-slate-400">{item.answer}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-slate-300">Attachment <span className="font-normal text-slate-500">(optional · PNG, JPG, WEBP, PDF, TXT · max 5 MB)</span></span>
            <div className="flex items-center gap-2">
              <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-xl border border-dashed border-line bg-canvas/40 px-4 py-3 text-xs text-slate-400 transition hover:border-brand/40 hover:text-slate-200">
                <Paperclip className="h-4 w-4 shrink-0" />
                <span className="truncate">{attachment ? attachment.name : 'Choose a screenshot, log or document'}</span>
                <input
                  type="file"
                  className="sr-only"
                  accept="image/png,image/jpeg,image/webp,application/pdf,text/plain"
                  onChange={(e) => { handleFile(e.target.files?.[0] || null); e.target.value = ''; }}
                />
              </label>
              {attachment && (
                <button type="button" onClick={() => handleFile(null)} className="rounded-lg px-3 py-3 text-xs text-slate-400 hover:bg-white/5 hover:text-rose-300">Remove</button>
              )}
            </div>
          </div>

          {error && <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-300 hover:bg-white/5">Cancel</button>
            <button type="submit" disabled={loading} className="rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-canvas transition hover:bg-teal-300 disabled:opacity-60">
              {loading ? 'Submitting…' : 'Submit ticket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

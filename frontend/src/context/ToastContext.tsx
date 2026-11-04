import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { CircleAlert, CircleCheck, Info, X } from 'lucide-react';

type ToastKind = 'success' | 'error' | 'info';
interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

const ToastContext = createContext<((kind: ToastKind, message: string) => void) | undefined>(undefined);

const ICONS = {
  success: <CircleCheck className="h-4 w-4 text-emerald-400" />,
  error: <CircleAlert className="h-4 w-4 text-rose-400" />,
  info: <Info className="h-4 w-4 text-sky-400" />
};

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = (id: number) => setToasts((list) => list.filter((t) => t.id !== id));

  const notify = useCallback((kind: ToastKind, message: string) => {
    const id = Date.now() + Math.random();
    setToasts((list) => [...list.slice(-3), { id, kind, message }]);
    window.setTimeout(() => dismiss(id), 4500);
  }, []);

  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[70] flex w-[min(92vw,360px)] flex-col gap-2" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className="toast-in pointer-events-auto flex items-start gap-3 rounded-xl border border-line bg-surface-2 px-4 py-3 text-sm text-slate-200 shadow-2xl shadow-black/40">
            <span className="mt-0.5">{ICONS[toast.kind]}</span>
            <p className="flex-1 leading-snug">{toast.message}</p>
            <button onClick={() => dismiss(toast.id)} className="text-slate-500 hover:text-slate-200" aria-label="Dismiss">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const notify = useContext(ToastContext);
  if (!notify) throw new Error('useToast must be used within a ToastProvider');
  return notify;
};

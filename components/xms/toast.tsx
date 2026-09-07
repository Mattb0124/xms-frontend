"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type ToastTone = "info" | "success" | "error";

export interface ToastItem {
  id: number;
  title: string;
  detail?: string;
  tone: ToastTone;
}

interface ToastApi {
  toasts: ToastItem[];
  push: (toast: Omit<ToastItem, "id">) => void;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children, ttlMs = 6000 }: { children: ReactNode; ttlMs?: number }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const dismiss = useCallback((id: number) => setToasts((current) => current.filter((t) => t.id !== id)), []);
  const push = useCallback(
    (toast: Omit<ToastItem, "id">) => {
      const id = Date.now() + Math.random();
      setToasts((current) => [...current, { ...toast, id }]);
      if (ttlMs > 0) window.setTimeout(() => dismiss(id), ttlMs);
    },
    [dismiss, ttlMs],
  );
  const api = useMemo(() => ({ toasts, push, dismiss }), [toasts, push, dismiss]);
  return <ToastContext.Provider value={api}>{children}</ToastContext.Provider>;
}

export function useToast(): Pick<ToastApi, "push"> {
  const api = useContext(ToastContext);
  if (!api) throw new Error("useToast must be used inside ToastProvider");
  return { push: api.push };
}

const TONE: Record<ToastTone, string> = {
  info: "border-xms-line",
  success: "border-[color:var(--state-complete-border)]",
  error: "border-[color:var(--state-overdue-border)]",
};

/** Bottom-right toast stack; one Toaster per app root. */
export function Toaster() {
  const api = useContext(ToastContext);
  if (!api) return null;
  return (
    <div aria-live="polite" className="fixed right-4 bottom-4 z-50 flex w-[320px] flex-col gap-2">
      {api.toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          data-tone={toast.tone}
          className={cn("xms-card flex gap-3 border-l-4 p-3", TONE[toast.tone])}
        >
          <div className="text-[13px]">
            <p className="text-xms-ink font-medium">{toast.title}</p>
            {toast.detail ? <p className="text-xms-label text-[12px]">{toast.detail}</p> : null}
          </div>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => api.dismiss(toast.id)}
            className="text-xms-muted hover:text-xms-ink ml-auto text-[14px] leading-none"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

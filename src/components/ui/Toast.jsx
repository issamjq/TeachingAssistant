import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, AlertTriangle, XCircle, X, Info } from "lucide-react";

const ToastContext = createContext({ toast: () => {} });

const VARIANTS = {
  neutral: { icon: Info, color: "var(--color-text-secondary)" },
  success: { icon: CheckCircle2, color: "var(--color-success)" },
  warning: { icon: AlertTriangle, color: "var(--color-warning)" },
  error: { icon: XCircle, color: "var(--color-danger)" },
};

export function ToastProvider({ children, duration = 4000 }) {
  const [toasts, setToasts] = useState([]);
  const idCounter = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const toast = useCallback(
    (message, opts = {}) => {
      const id = ++idCounter.current;
      const variant = opts.variant || "neutral";
      setToasts((t) => [...t, { id, message, variant, title: opts.title }]);
      if (opts.duration !== 0) {
        setTimeout(() => dismiss(id), opts.duration ?? duration);
      }
      return id;
    },
    [duration, dismiss],
  );

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}
      <div
        className="fixed z-[100] flex flex-col gap-2 pointer-events-none"
        style={{
          insetInlineEnd: 16,
          bottom: 16,
          maxWidth: "min(400px, calc(100vw - 32px))",
        }}
      >
        <AnimatePresence initial={false}>
          {toasts.map((t) => {
            const V = VARIANTS[t.variant] || VARIANTS.neutral;
            const Icon = V.icon;
            return (
              <motion.div
                key={t.id}
                role={t.variant === "error" || t.variant === "warning" ? "alert" : "status"}
                aria-live={t.variant === "error" ? "assertive" : "polite"}
                initial={{ opacity: 0, y: 12, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.98, transition: { duration: 0.18 } }}
                transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                className="pointer-events-auto flex items-start gap-3 ps-3 pe-2 py-3 rounded-[12px] bg-[var(--color-surface-elevated)] border border-[var(--color-border-subtle)]"
                style={{ boxShadow: "var(--shadow-3)" }}
              >
                <span aria-hidden className="mt-0.5" style={{ color: V.color }}>
                  <Icon className="w-4 h-4" strokeWidth={2} />
                </span>
                <div className="flex-1 min-w-0">
                  {t.title && (
                    <p className="text-[13px] font-semibold text-ink leading-tight mb-0.5">
                      {t.title}
                    </p>
                  )}
                  <p className="text-[13px] text-ink-soft leading-snug">{t.message}</p>
                </div>
                <button
                  onClick={() => dismiss(t.id)}
                  aria-label="Dismiss"
                  className="text-muted hover:text-ink p-1 -m-1 rounded"
                >
                  <X className="w-3.5 h-3.5" strokeWidth={2} />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

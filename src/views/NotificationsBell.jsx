import React, { useEffect, useRef, useState } from "react";
import { Bell, X } from "lucide-react";
import { api, timeAgo } from "./_shared";
import { useT } from "../lib/i18n";

// Header bell — drops down a list of unread notifications, click to dismiss.
export default function NotificationsBell() {
  const t = useT();
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Ask the server to emit any new reminders (lessons starting soon, homework
  // due, quizzes scheduled), then read the resulting list. Both calls are safe
  // to repeat — the refresh endpoint dedups.
  const reload = async () => {
    try { await api("/api/notifications/refresh", { method: "POST", body: {} }); } catch {}
    api("/api/notifications").then(setItems).catch(() => {});
  };

  useEffect(() => {
    reload();
    const id = setInterval(reload, 60000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [open]);

  const unreadCount = items.filter((n) => !n.is_read).length;

  const markAllRead = async () => {
    await api("/api/notifications/mark-read", { method: "POST", body: {} });
    reload();
  };

  const dismiss = async (id) => {
    await api(`/api/notifications/${id}`, { method: "DELETE" });
    setItems((rows) => rows.filter((r) => r.id !== id));
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="h-9 w-9 rounded-md border border-line hover:bg-paper-warm flex items-center justify-center transition relative"
        title={t("nb.title")}
      >
        <Bell size={15} className="text-ink-soft" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-accent text-paper-cool text-[9px] font-mono font-bold rounded-full h-4 min-w-[16px] px-1 flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-96 bg-paper-cool border border-line rounded-xl shadow-lg z-50">
          <div className="px-5 py-3 border-b border-line flex items-center justify-between">
            <p className="font-serif text-lg text-ink">{t("nb.title")}</p>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-accent hover:text-ink font-mono text-[10px] uppercase tracking-wider"
              >
                {t("nb.markAllRead")}
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted text-center">{t("nb.empty")}</p>
            ) : (
              items.map((n) => (
                <div
                  key={n.id}
                  className={`px-5 py-3 border-b border-line/60 last:border-0 flex items-start gap-3 ${
                    n.is_read ? "" : "bg-paper-warm/40"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full mt-2 flex-shrink-0 ${
                      n.is_read ? "bg-line" : "bg-accent"
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-ink-soft leading-snug">{n.message}</p>
                    <p className="font-mono text-[10px] uppercase tracking-wider text-muted mt-1">
                      {n.kind.replace(/_/g, " ")} · {timeAgo(n.created_at)}
                    </p>
                  </div>
                  <button
                    onClick={() => dismiss(n.id)}
                    className="text-muted hover:text-ink"
                    title={t("nb.dismiss")}
                  >
                    <X size={13} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

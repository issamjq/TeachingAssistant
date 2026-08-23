"use client";

// The popover that opens when the teacher clicks their name/avatar at
// the bottom of the sidebar. Modeled after Claude's account menu —
// Settings / Language / Get help / Upgrade plan / Log out. Language
// is an inline EN | AR toggle so there's no nested-submenu state to
// debug. Upgrade plan only shows when the teacher has no paid account
// on file (i.e. still on the free trial).
//
// The menu uses a transparent fullscreen scrim to capture outside clicks
// and Escape — same pattern as the rest of the app's popovers — so it
// can't get into a half-closed state from event-listener races.
import React, { useEffect } from "react";
import { Settings, Globe, HelpCircle, Sparkles, LogOut, Check, Repeat, Coins } from "lucide-react";
import { useT, useI18n } from "../lib/i18n";
import { ROLE_LABELS } from "../lib/role";

export default function AccountMenu({
  open,
  onClose,
  onOpenSettings,
  onOpenHelp,
  onUpgrade,
  onOpenUsage,
  onLogout,
  showUpgrade,
  showUsage,
  user,
  roles = [],
  activeRole,
  onSwitchRole,
}) {
  const t = useT();
  const { lang, setLang } = useI18n();

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      {/* Click-outside scrim — fullscreen, transparent, behind the menu */}
      <div
        onClick={onClose}
        className="fixed inset-0 z-40 bg-transparent"
        aria-hidden="true"
      />
      <div
        role="menu"
        aria-label={t("accountMenu.label")}
        onClick={(e) => e.stopPropagation()}
        className="absolute z-50 bottom-full mb-2 start-3 end-3 max-w-[280px] rounded-2xl border border-line bg-paper-cool shadow-[0_24px_60px_rgba(26,24,20,0.22)] overflow-hidden"
      >
        {user?.email && (
          <div className="px-4 py-3 border-b border-line">
            <p className="text-[12px] text-muted truncate">{user.email}</p>
          </div>
        )}

        {/* Someone can hold more than one role — a teacher who is also on a
            roster, an admin who also teaches. One interface is active at a
            time and this is where it changes; the shell follows the choice
            to that role's home. Hidden entirely in the ordinary case. */}
        {roles.length > 1 && (
          <div className="px-4 py-3 border-b border-line">
            <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted mb-2 flex items-center gap-1.5">
              <Repeat size={11} /> {t("accountMenu.viewAs")}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {roles.map((r) => (
                <button
                  key={r}
                  type="button"
                  role="menuitemradio"
                  aria-checked={r === activeRole}
                  onClick={() => { if (r !== activeRole) { onClose(); onSwitchRole?.(r); } }}
                  className={
                    "font-mono text-[10px] uppercase tracking-wider rounded-md border px-2 py-1 transition " +
                    (r === activeRole
                      ? "border-accent text-accent bg-accent-soft"
                      : "border-line text-ink-soft hover:border-accent hover:text-accent")
                  }
                >
                  {ROLE_LABELS[r] || r}
                </button>
              ))}
            </div>
          </div>
        )}

        <ul className="py-1">
          <MenuItem
            icon={Settings}
            label={t("accountMenu.settings")}
            onClick={() => { onClose(); onOpenSettings?.(); }}
          />

          {/* Inline language row — label on the left, EN | AR pill on the right */}
          <li className="flex items-center gap-3 px-4 py-2 text-ink">
            <Globe size={16} className="text-ink-soft flex-shrink-0" />
            <span className="flex-1 text-sm">{t("accountMenu.language")}</span>
            <div className="flex items-center rounded-md border border-line bg-paper overflow-hidden">
              <LangChoice active={lang === "en"} onClick={() => setLang("en")} label="EN" />
              <span className="w-px h-4 bg-line" aria-hidden="true" />
              <LangChoice active={lang === "ar"} onClick={() => setLang("ar")} label="ع" />
            </div>
          </li>

          <MenuItem
            icon={HelpCircle}
            label={t("accountMenu.help")}
            onClick={() => { onClose(); onOpenHelp?.(); }}
          />

          {/* Where her credits went. Sits beside the upgrade prompt
              because the two questions arrive together: a teacher who is
              being asked to pay more wants to see what she used first. */}
          {showUsage && (
            <MenuItem
              icon={Coins}
              label={t("accountMenu.usage")}
              onClick={() => { onClose(); onOpenUsage?.(); }}
            />
          )}

          {showUpgrade && (
            <MenuItem
              icon={Sparkles}
              label={t("accountMenu.upgrade")}
              accent
              onClick={() => { onClose(); onUpgrade?.(); }}
            />
          )}
        </ul>

        <div className="border-t border-line py-1">
          <MenuItem
            icon={LogOut}
            label={t("accountMenu.logout")}
            onClick={() => { onClose(); onLogout?.(); }}
          />
        </div>
      </div>
    </>
  );
}

function MenuItem({ icon: Icon, label, onClick, accent }) {
  return (
    <li>
      <button
        type="button"
        role="menuitem"
        onClick={onClick}
        className={`w-full flex items-center gap-3 px-4 py-2.5 text-start hover:bg-paper-warm transition-colors ${
          accent ? "text-accent" : "text-ink"
        }`}
      >
        <Icon size={16} className={`flex-shrink-0 ${accent ? "text-accent" : "text-ink-soft"}`} />
        <span className="flex-1 text-sm">{label}</span>
      </button>
    </li>
  );
}

function LangChoice({ active, onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`px-2 py-1 text-[11px] font-mono uppercase tracking-wider transition-colors ${
        active ? "bg-ink text-paper-cool" : "text-ink-soft hover:bg-paper-warm"
      }`}
    >
      {label}
    </button>
  );
}

// The popover that opens when the teacher clicks their name/avatar at
// the bottom of the sidebar. Modeled after Claude's account menu —
// Settings / Language / Get help / Upgrade plan / Log out. Language
// has an inline submenu (EN ↔ AR). Upgrade plan only shows when the
// teacher has no paid account on file (i.e. still on the free trial).
import React, { useEffect, useRef, useState } from "react";
import { Settings, Globe, HelpCircle, Sparkles, LogOut, Check, ChevronRight } from "lucide-react";
import { useT, useI18n } from "../lib/i18n";

export default function AccountMenu({
  open,
  onClose,
  onOpenSettings,
  onOpenHelp,
  onUpgrade,
  onLogout,
  onTeacherProfile,
  showUpgrade,
  user,
}) {
  const t = useT();
  const { lang, setLang } = useI18n();
  const [langSubOpen, setLangSubOpen] = useState(false);
  const menuRef = useRef(null);

  // Close on click-outside / Escape.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) onClose();
    };
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    // Defer attaching the listener so the click that opened the menu
    // doesn't immediately close it.
    const id = window.setTimeout(() => {
      document.addEventListener("mousedown", onDoc);
    }, 0);
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) setLangSubOpen(false);
  }, [open]);

  if (!open) return null;

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label={t("accountMenu.label")}
      className="absolute z-50 bottom-full mb-2 start-3 w-[260px] rounded-2xl border border-line bg-paper-cool shadow-[0_24px_60px_rgba(26,24,20,0.22)] overflow-hidden"
    >
      {/* Email / user line */}
      {user?.email && (
        <div className="px-4 py-3 border-b border-line">
          <p className="text-[12px] text-muted truncate">{user.email}</p>
        </div>
      )}

      <ul className="py-1">
        <MenuItem
          icon={Settings}
          label={t("accountMenu.settings")}
          onClick={() => { onClose(); onOpenSettings?.(); }}
        />

        {/* Language submenu — clicking the row toggles a small inline
            EN/AR chooser inside the same panel (no popover-of-popover). */}
        <li>
          <button
            type="button"
            role="menuitem"
            onClick={() => setLangSubOpen((o) => !o)}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-start hover:bg-paper-warm transition-colors"
          >
            <Globe size={16} className="text-ink-soft flex-shrink-0" />
            <span className="flex-1 text-sm text-ink">{t("accountMenu.language")}</span>
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
              {lang === "ar" ? "AR" : "EN"}
            </span>
            <ChevronRight
              size={14}
              className={`text-muted flex-shrink-0 transition-transform rtl:rotate-180 ${
                langSubOpen ? "rotate-90 rtl:rotate-90" : ""
              }`}
            />
          </button>
          {langSubOpen && (
            <div className="bg-paper-warm/50 border-y border-line">
              <LangRow active={lang === "en"} onClick={() => setLang("en")} label="English" />
              <LangRow active={lang === "ar"} onClick={() => setLang("ar")} label="العربية" />
            </div>
          )}
        </li>

        <MenuItem
          icon={HelpCircle}
          label={t("accountMenu.help")}
          onClick={() => { onClose(); onOpenHelp?.(); }}
        />

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

function LangRow({ active, onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 ps-9 pe-4 py-2 text-start hover:bg-paper-warm transition-colors"
    >
      <span className="flex-1 text-sm text-ink">{label}</span>
      {active && <Check size={14} className="text-accent flex-shrink-0" />}
    </button>
  );
}

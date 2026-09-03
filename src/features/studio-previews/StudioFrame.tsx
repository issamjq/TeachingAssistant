"use client";

// =====================================================================
// The studio chrome every design variant renders inside
//
// Sidebar and top bar only — and both are FIXED. Same navigation, same
// spacing, same colours in all ten previews, because the shell is not
// what is being chosen between. The nav is TEACHER_NAV from
// src/config/nav.ts, item for item.
//
// What is NOT here any more: the conversation list. It used to live in
// this file as a right rail, which meant all ten designs answered
// "where do recent conversations go?" identically. Each variant now owns
// that question — a printed index in the margin, a table across the top,
// a dock at the foot, a strip of chips, a fanned stack — and answering it
// differently is most of what separates them.
//
// Colour comes from --p-* tokens throughout. No variant re-tints the
// shell; DESIGN.md is one world for the whole product.
// =====================================================================

import type { ReactNode } from "react";
import {
  LayoutDashboard, Sparkles,
  PanelLeftClose, Search, Bell, HelpCircle, Plus, ChevronRight,
} from "lucide-react";
// The same map the shipped rail uses. This preview had its own copy of
// thirteen of these entries; there is one now.
import { NAV_ICON } from "@/shared/shell/navIcons";
import { ACTIVE_NAV, NAV, teacher } from "./fixture";
import f from "./StudioFrame.module.css";

// Same mapping StudioShell uses — semantic key to icon.
export type FrameProps = {
  children: ReactNode;
  /** Render on the product's shipped dark theme rather than on paper. */
  dark?: boolean;
};

export default function StudioFrame({ children, dark = false }: FrameProps) {
  const pct = Math.round((teacher.creditsUsed / teacher.creditsTotal) * 100);

  return (
    <div className={dark ? `${f.frame} ${f.dark}` : f.frame}>
      {/* ── sidebar · identical in every design ───────────────────── */}
      <aside className={f.side}>
        <div className={f.brand}>
          <span className={f.brandMark}>
            <Sparkles size={15} />
          </span>
          <span className={f.brandName}>Murchid</span>
          <button type="button" className={f.collapse} aria-label="Collapse sidebar">
            <PanelLeftClose size={15} />
          </button>
        </div>

        <nav className={f.nav} aria-label="Studio sections">
          {NAV.map((group) => (
            <div key={group.section} className={f.navGroup}>
              <span className={f.navLabel}>{group.section}</span>
              {group.items.map((item) => {
                const Icon = NAV_ICON[item.icon] ?? LayoutDashboard;
                const on = item.key === ACTIVE_NAV;
                return (
                  <button
                    key={item.key}
                    type="button"
                    className={f.navItem}
                    data-on={on}
                    title={item.label}
                    aria-current={on ? "page" : undefined}
                  >
                    <span className={f.navIcon}>
                      <Icon size={15} strokeWidth={1.9} />
                    </span>
                    <span className={f.navText}>{item.label}</span>
                    {item.badge != null && <span className={f.navBadge}>{item.badge}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className={f.foot}>
          <div className={f.footRow}>
            <span className={f.face}>{teacher.initials}</span>
            <span className={f.footText}>
              <span className={f.footName}>{teacher.name}</span>
              <span className={f.footRole}>{teacher.role}</span>
            </span>
          </div>
          <span className={f.meter}>
            <span className={f.meterFill} style={{ width: `${100 - pct}%` }} />
          </span>
          <span className={f.meterText}>
            {teacher.creditsTotal - teacher.creditsUsed} of {teacher.creditsTotal} credits left
          </span>
        </div>
      </aside>

      {/* ── top bar · identical in every design ───────────────────── */}
      <div className={f.main}>
        <header className={f.top}>
          <span className={f.crumb}>
            Overview
            <ChevronRight size={13} />
            <span className={f.crumbNow}>AI Studio</span>
          </span>
          <span className={f.search}>
            <Search size={13} />
            Search your library…
            <span className={f.searchKey}>⌘K</span>
          </span>
          <span className={f.topRight}>
            <button type="button" className={f.iconBtn} aria-label="Help">
              <HelpCircle size={15} />
            </button>
            <button type="button" className={f.iconBtn} aria-label="Notifications">
              <Bell size={15} />
              <span className={f.ping} />
            </button>
            <button type="button" className={f.newBtn}>
              <Plus size={14} />
              New
            </button>
          </span>
        </header>

        <main className={f.content}>{children}</main>
      </div>
    </div>
  );
}

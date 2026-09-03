"use client";

// =====================================================================
// The admin surface, which the subject-first proposal does not touch
//
// Worth saying plainly, because the temptation is to file the consoles
// under something too. They are not a teacher's work: there is no class,
// no subject and no grade in "how much did the platform spend on tokens
// this month". PRODUCT.md already settles it — the consoles are
// "administrative plumbing… they do not set patterns, do not lead design
// decisions". So this screen keeps the shell and changes what is in it.
//
// What it DOES answer is the question an admin who also teaches actually
// has: which consoles am I granted, and which am I not. That comes from
// /api/me's resolved capability map — the admin.* half read from
// role_capabilities in the database by my_capabilities(), which is the
// same admin_can() the RPCs re-check server-side. So this page cannot
// show a console the API would then refuse, and it cannot hide one a
// super admin granted an hour ago.
// =====================================================================

import {
  Activity, BarChart3, Coins, KeyRound, KeySquare, LayoutDashboard, Lock, Shield,
  Building2, Tags, TrendingDown, Users, type LucideIcon,
} from "lucide-react";
import { ADMIN_SURFACES, DEFAULT_ADMIN_PERMS } from "@/config/nav";
import type { Identity } from "./types";
import { Empty, SectionHead } from "./parts";
import s from "./Screens.module.css";

const ICON: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  keys: KeyRound,
  students: Users,
  orgs: Building2,
  activity: Activity,
  friction: TrendingDown,
  tokens: BarChart3,
  coins: Coins,
  pricing: Tags,
  shield: Shield,
  keypool: KeySquare,
};

/** What each console is for, in one line — the nav label alone is thin. */
const BLURB: Record<string, string> = {
  "superadmin-dashboard": "Accounts, activity and the state of the platform at a glance.",
  "superadmin-console": "Every account, and what has been granted to it.",
  "superadmin-students": "Students across every teacher, and the invitations they hold.",
  "superadmin-orgs": "Schools and the faculty attached to them.",
  "superadmin-product": "What people actually use, feature by feature.",
  "superadmin-friction": "Where they stop — the screens that lose them.",
  "superadmin-usage": "Token spend by model, by feature, by day.",
  "superadmin-revenue": "Plans, payments and what came in.",
  "superadmin-costs": "What generation costs, and what it is priced at.",
  "superadmin-roles": "Who may reach which console, and the defaults behind it.",
  "superadmin-keys": "The OpenRouter keys every generation is dialled through.",
};

/**
 * The role strings the database actually uses.
 *
 * my_roles() ranks over ARRAY['dev','super_admin','admin','moe','owner',
 * 'teacher','student'] — `super_admin` with an underscore. This file
 * checked for "superadmin", which matches nothing, so the Admin switch
 * would never have appeared for the one account that most needs it. The
 * capability path happened to cover for it, since admin_can() returns
 * true for a super admin on everything, but a bug that is only invisible
 * because a second check saved it is still a bug.
 */
const PLATFORM_ROLES = new Set(["super_admin", "dev", "admin"]);
/** super_admin and dev bypass admin_can() entirely — they can reach all of it. */
const UNLIMITED = new Set(["super_admin", "dev"]);

/** Roles as a person would say them, not as the column stores them. */
export const roleLabel = (r: string) =>
  ({ super_admin: "super admin", dev: "developer", moe: "ministry" }[r] ?? r);

/** An account holding a platform role but no resolved map falls back. */
export function permsOf(identity: Identity): Record<string, boolean> {
  if (identity.roles.some((r) => UNLIMITED.has(r))) {
    return Object.fromEntries(ADMIN_SURFACES.map((x) => [x.cap, true]));
  }
  const has = Object.keys(identity.permissions).some((k) => k.startsWith("admin."));
  if (has) return identity.permissions;
  return identity.roles.includes("admin") ? DEFAULT_ADMIN_PERMS : {};
}

/** The consoles this account may reach, in nav order. */
export function grantedSurfaces(identity: Identity) {
  const perms = permsOf(identity);
  return ADMIN_SURFACES.filter((x) => perms[x.cap]);
}

/** Whether the Admin option belongs on the preview's role switch at all. */
export function isAdmin(identity: Identity): boolean {
  return (
    identity.roles.some((r) => PLATFORM_ROLES.has(r)) ||
    Object.entries(identity.permissions).some(([k, v]) => k.startsWith("admin.") && v)
  );
}

export default function AdminHome({ identity }: { identity: Identity }) {
  // Reachable by typing the hash even when the switch does not offer it,
  // so it answers for that case rather than telling a teacher that Admin
  // "appears on your switch" when it plainly does not.
  if (!isAdmin(identity)) {
    return (
      <div className={`${s.page} ${s.enter}`}>
        <Empty
          icon={<Lock size={19} />}
          title="This account holds no admin role"
          text={`You are signed in as ${identity.roles.map(roleLabel).join(" and ") || "a teacher"}. The platform consoles are granted per account in Roles and access, and the switch only offers Admin once one of them is.`}
        />
      </div>
    );
  }

  const perms = permsOf(identity);
  const granted = ADMIN_SURFACES.filter((x) => perms[x.cap]);
  const withheld = ADMIN_SURFACES.filter((x) => !perms[x.cap]);
  const superAdmin = identity.roles.some((r) => UNLIMITED.has(r));

  return (
    <div className={`${s.page} ${s.enter}`}>
      <section>
        <p className={s.sectionMeta} style={{ marginBottom: 10 }}>
          {[
            identity.roles.length
              ? `You hold ${identity.roles.map(roleLabel).join(" and ")}`
              : "No role resolved",
            `${granted.length} of ${ADMIN_SURFACES.length} consoles granted`,
          ].join(" · ")}
        </p>

        <div className={s.banner}>
          <span className={s.bannerIcon}><Shield size={19} /></span>
          <span className={s.bannerText}>
            <span className={s.bannerTitle}>
              The consoles are not filed under a subject, and should not be
            </span>
            <span className={s.bannerMeta}>
              There is no class in &ldquo;what did the platform spend on tokens&rdquo;.
              The nesting this preview proposes is for a teacher&rsquo;s own work.
            </span>
          </span>
        </div>
      </section>

      <section>
        <SectionHead
          title="Consoles you can reach"
          meta={superAdmin ? "You bypass the capability check — every console" : "Resolved from your grants"}
        />
        {granted.length ? (
          <div className={s.makeGrid}>
            {granted.map((x) => {
              const Icon = ICON[x.icon ?? "dashboard"] ?? LayoutDashboard;
              return (
                <a key={x.key} className={s.make} href={`/${x.key}`}>
                  <span className={s.makeIcon}><Icon size={17} strokeWidth={1.9} /></span>
                  <span className={s.makeTitle}>{x.label}</span>
                  <span className={s.makeBlurb}>{BLURB[x.key] ?? ""}</span>
                  <span className={s.makeGo}>Open the console</span>
                </a>
              );
            })}
          </div>
        ) : (
          <Empty
            icon={<Lock size={19} />}
            title="No console is granted to this account"
            text="You hold the role, but every capability behind it is currently off. A super admin turns them on in Roles and access."
          />
        )}
      </section>

      {withheld.length > 0 && (
        <section>
          <SectionHead
            title="Not granted"
            meta={`${withheld.length} console${withheld.length === 1 ? "" : "s"}`}
          />
          {/* Shown rather than hidden on purpose: an admin who cannot see
              revenue should know that is a decision, not a missing page.
              The capability key is printed because it is the exact string
              a super admin grants in Roles and access. */}
          <div className={`${s.card} ${s.tight}`}>
            {withheld.map((x) => (
              <div key={x.key} className={s.unit}>
                <span className={s.unitMark}><Lock size={12} /></span>
                <span className={s.unitName}>{x.label}</span>
                <span className={s.unitMeta}>{x.cap}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

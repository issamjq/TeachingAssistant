import React, { useEffect, useState } from "react";
import {
  ChevronRight, X, Sparkles, ArrowUpRight, ArrowRight, Crown, Menu,
} from "lucide-react";
import Dashboard from "./views/Dashboard";
import TemplatesLibrary from "./views/TemplatesLibrary";
import NewTemplate from "./views/NewTemplate";
import EditDraft from "./views/EditDraft";
import TeachingRail from "./views/TeachingRail";
import Database from "./views/Database";
import AccountProfile from "./views/AccountProfile";
import Schedule from "./views/Schedule";
import Planner from "./views/Planner";
import Quizzes from "./views/Quizzes";
import QuizBuilder from "./views/QuizBuilder";
import Homework from "./views/Homework";
import HomeworkBuilder from "./views/HomeworkBuilder";
import Presentations from "./views/Presentations";
import PresentationBuilder from "./views/PresentationBuilder";
import Activities from "./views/Activities";
import ActivityBuilder from "./views/ActivityBuilder";
import Reports from "./views/Reports";
import Studio from "./views/Studio";
import AdminConsole from "./views/AdminConsole";
import DevConsole from "./views/DevConsole";
import { getRole, onRoleChange, ROLE_LABELS } from "./lib/role";
import { api } from "./views/_shared";
import { useRoute, navigate, replace, clearRoute } from "./lib/route";
import { useT, LangToggle } from "./lib/i18n";
import { useAccount, clearAccount } from "./lib/account";
import AccountMenu from "./views/AccountMenu";
import HelpPopover from "./views/HelpPopover";

// Sectioned nav matching the 2026 mockup — italic Fraunces section
// headers + small letter/icon badges next to each label. All routes
// preserved.
const TEACHER_NAV = [
  {
    section: "Planning",
    items: [
      { key: "planner", label: "Planner", icon: "▦" },
    ],
  },
  {
    section: "Teaching",
    items: [
      { key: "lesson-plans",  label: "Lesson Plans",  letter: "L" },
      { key: "quizzes",       label: "Quizzes",       letter: "Q" },
      { key: "homework",      label: "Homework",      letter: "H" },
      { key: "presentations", label: "Presentations", letter: "P" },
      { key: "activities",    label: "Activities",    letter: "A" },
    ],
  },
  {
    section: "Data",
    items: [
      { key: "database", label: "My students", letter: "C" },
    ],
  },
];

const ADMIN_NAV = [
  { section: "Admin", items: [{ key: "admin-console", label: "Admin console", letter: "A" }] },
];

const DEV_NAV = [
  { section: "Dev", items: [{ key: "dev-console", label: "Dev console", letter: "D" }] },
];

const NAV_BY_ROLE = { teacher: TEACHER_NAV, admin: ADMIN_NAV, dev: DEV_NAV };

const DEFAULT_ROUTE = { teacher: "planner", admin: "admin-console", dev: "dev-console" };

// Sections that get the Outlook-style right rail (mini-calendar + upcoming
// days). Planner already has its own calendar so it stays out.
const TEACHING_RAIL_SECTIONS = new Set([
  "lesson-plans", "quizzes", "homework", "presentations", "activities",
]);

// Sections legitimately reachable from the URL bar for each role. Anything
// outside this list bounces back to the role's default — keeps a stale
// `#/quizzes` from rendering for an admin who switched roles.
const SECTIONS_BY_ROLE = {
  teacher: new Set([
    "dashboard", "studio", "planner",
    "lesson-plans", "schedule", "quizzes", "homework", "presentations", "activities",
    "database", "reports",
    "account",
  ]),
  admin: new Set(["admin-console", "account"]),
  dev: new Set(["dev-console", "account"]),
};

function NavBadge({ letter, icon, lucide: Lucide }) {
  // Three modes: a lucide React icon (current 2026 mockup), a unicode
  // glyph ("◇", "+"), or a fallback mono letter. Lucide wins, then
  // glyph, then letter — first-defined wins.
  if (Lucide) {
    return (
      <span className="murchid-sidebar-badge">
        <Lucide size={15} strokeWidth={1.75} />
      </span>
    );
  }
  if (icon) {
    return <span className="murchid-sidebar-badge text-base leading-none">{icon}</span>;
  }
  return <span className="murchid-sidebar-badge">{letter}</span>;
}

export default function StudioApp({ onClose }) {
  const [role, setRoleState] = useState(getRole());
  const [navOpen, setNavOpen] = useState(false); // mobile drawer
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const account = useAccount();
  // Free-trial users (no paid account in storage) see "Upgrade plan".
  // Once they pick a plan, the row hides automatically.
  const showUpgrade = !account;
  const route = useRoute();
  const t = useT();

  // Any route change closes the mobile drawer + account menu so the
  // new screen is visible immediately after tapping a nav item.
  useEffect(() => { setNavOpen(false); setAccountMenuOpen(false); }, [route]);
  // Translate a nav/section key, falling back to its English label when
  // a key isn't in the dictionary yet (phased rollout).
  const navT = (key, fallback) => {
    const s = t(`nav.${key}`);
    return s === `nav.${key}` ? (fallback ?? key) : s;
  };

  // Derive what to render purely from the URL — single source of truth.
  // Falls back to the role's default if the URL section doesn't apply.
  const section = route?.section || DEFAULT_ROUTE[role];
  const sub = route?.sub || null;
  const extraId = route?.extra?.[0] || null;

  // Listen for role changes from Account → role switcher.
  useEffect(() => {
    return onRoleChange((next) => {
      setRoleState(next);
      navigate([DEFAULT_ROUTE[next]]);
    });
  }, []);

  // Bounce sections that don't apply to the current role to the role's home.
  // Replace (not push) so the back button doesn't re-trigger the bounce.
  useEffect(() => {
    if (!route) {
      replace([DEFAULT_ROUTE[role]]);
      return;
    }
    if (!SECTIONS_BY_ROLE[role].has(section)) {
      replace([DEFAULT_ROUTE[role]]);
    }
  }, [role, route, section]);

  const nav = NAV_BY_ROLE[role];
  const itemLabel = Object.fromEntries(
    nav.flatMap((s) => s.items.map((i) => [i.key, i.label]))
  );
  itemLabel["account"] = "Account";

  const goLessonPlans = (subView = "templates") => navigate(["lesson-plans", subView]);
  const goNewTemplate = () => navigate(["lesson-plans", "newTemplate"]);
  const goEditDraft  = (draft) => navigate(["lesson-plans", "edit", draft.id]);
  // All Teaching builders share one routed pattern: no id → <section>/new,
  // existing row → <section>/edit/:id (mirrors quizzes/new + quizzes/edit/3).
  const goQuizBuilder = (quiz) => navigate(["quizzes", quiz?.id ? "edit" : "new", quiz?.id].filter(Boolean));
  const goHomework = (hw) => navigate(["homework", hw?.id ? "edit" : "new", hw?.id].filter(Boolean));
  const goActivity = (ac) => navigate(["activities", ac?.id ? "edit" : "new", ac?.id].filter(Boolean));
  const goPresentation = (pr) => navigate(["presentations", pr?.id ? "edit" : "new", pr?.id].filter(Boolean));

  const handleNavClick = (key) => {
    // Top-level sections that have a default sub-tab pre-fill it so the
    // breadcrumbs and tabs show the right thing immediately.
    if (key === "lesson-plans") return navigate(["lesson-plans", "templates"]);
    if (key === "database") return navigate(["database", "profile"]);
    return navigate([key]);
  };

  let crumbs = [{ label: itemLabel[section] || "Studio" }];
  let mainContent;

  if (section === "account") {
    crumbs = [{ label: "Account" }];
    mainContent = <AccountProfile />;
  } else if (role === "admin") {
    crumbs = [{ label: "Admin console" }];
    mainContent = <AdminConsole />;
  } else if (role === "dev") {
    crumbs = [{ label: "Dev console" }];
    mainContent = <DevConsole />;
  } else if (section === "dashboard") {
    mainContent = <Dashboard onJump={handleNavClick} />;
  } else if (section === "database") {
    mainContent = <Database sub={sub || "profile"} />;
  } else if (section === "schedule") {
    mainContent = <Schedule />;
  } else if (section === "planner") {
    mainContent = <Planner />;
  } else if (section === "homework") {
    if (sub === "new" || sub === "edit") {
      crumbs = [
        { label: "Homework", onClick: () => navigate(["homework"]) },
        { label: sub === "edit" ? "Edit homework" : "New homework" },
      ];
      mainContent = (
        <HomeworkBuilder
          homework={sub === "edit" ? { id: Number(extraId) } : null}
          onClose={() => navigate(["homework"])}
        />
      );
    } else {
      mainContent = <Homework onOpenHomework={goHomework} />;
    }
  } else if (section === "presentations") {
    if (sub === "new" || sub === "edit") {
      crumbs = [
        { label: "Presentations", onClick: () => navigate(["presentations"]) },
        { label: sub === "edit" ? "Edit presentation" : "New presentation" },
      ];
      mainContent = (
        <PresentationBuilder
          presentation={sub === "edit" ? { id: Number(extraId) } : null}
          onClose={() => navigate(["presentations"])}
        />
      );
    } else {
      mainContent = <Presentations onOpenPresentation={goPresentation} />;
    }
  } else if (section === "activities") {
    if (sub === "new" || sub === "edit") {
      crumbs = [
        { label: "Activities", onClick: () => navigate(["activities"]) },
        { label: sub === "edit" ? "Edit activity" : "New activity" },
      ];
      mainContent = (
        <ActivityBuilder
          activity={sub === "edit" ? { id: Number(extraId) } : null}
          onClose={() => navigate(["activities"])}
        />
      );
    } else {
      mainContent = <Activities onOpenActivity={goActivity} />;
    }
  } else if (section === "studio") {
    mainContent = <Studio onJump={handleNavClick} initialKind={sub} />;
  } else if (section === "reports") {
    mainContent = <Reports />;
  } else if (section === "quizzes") {
    if (sub === "new" || sub === "edit") {
      crumbs = [
        { label: "Quizzes", onClick: () => navigate(["quizzes"]) },
        { label: sub === "edit" ? "Edit quiz" : "New quiz" },
      ];
      mainContent = (
        <QuizBuilder
          quiz={sub === "edit" ? { id: Number(extraId) } : null}
          onClose={() => navigate(["quizzes"])}
        />
      );
    } else {
      mainContent = <Quizzes onOpenQuiz={goQuizBuilder} />;
    }
  } else if (section === "lesson-plans") {
    crumbs = [{ label: "Lesson Plans", onClick: () => goLessonPlans("templates") }];
    const view = sub || "templates";

    let inner;
    switch (view) {
      case "templates":
        inner = (
          <TemplatesLibrary
            onNewTemplate={goNewTemplate}
            onUseTemplate={async (t) => {
              try {
                const stages = Array.isArray(t.stages) ? t.stages : [];
                let intro = "", main_activity = "", conclusion = "";
                if (stages.length === 1) intro = `${stages[0].name}: ${stages[0].note || ""}`.trim();
                else if (stages.length === 2) {
                  intro = `${stages[0].name}: ${stages[0].note || ""}`.trim();
                  main_activity = `${stages[1].name}: ${stages[1].note || ""}`.trim();
                } else if (stages.length >= 3) {
                  intro = `${stages[0].name}: ${stages[0].note || ""}`.trim();
                  conclusion = `${stages[stages.length - 1].name}: ${stages[stages.length - 1].note || ""}`.trim();
                  main_activity = stages.slice(1, -1).map((s) => `${s.name}: ${s.note || ""}`.trim()).join("\n");
                } else if (t.flow) {
                  main_activity = t.flow;
                }
                const newDraft = await api("/api/drafts", {
                  method: "POST",
                  body: {
                    name: `${t.name} (from template)`,
                    subject: t.subject,
                    grade: t.grade,
                    duration_minutes: t.duration,
                    status: "In progress",
                    progress: 25,
                    objectives: Array.isArray(t.objectives) ? t.objectives : [],
                    intro,
                    main_activity,
                    conclusion,
                    tags: t.tags || [],
                  },
                });
                api(`/api/templates/${t.id}`, {
                  method: "PATCH",
                  body: { used_count: (t.used_count || 0) + 1 },
                }).catch(() => {});
                goEditDraft(newDraft);
              } catch (e) {
                alert(`Could not clone template: ${e.message}`);
              }
            }}
          />
        );
        break;
      case "newTemplate":
        crumbs.push({ label: "New template" });
        inner = (
          <NewTemplate
            onCancel={() => goLessonPlans("templates")}
            onSave={() => goLessonPlans("templates")}
          />
        );
        break;
      case "new":
      case "edit":
        crumbs.push({ label: view === "edit" ? "Edit lesson plan" : "New lesson plan" });
        inner = (
          <EditDraft
            // EditDraft fetches the latest from /api/drafts/:id on mount, so
            // passing just the id is enough — survives a refresh. With no id
            // it POSTs a fresh draft on first save (same as QuizBuilder).
            draft={view === "edit" && extraId ? { id: Number(extraId) } : null}
            onClose={() => goLessonPlans("templates")}
            onMarkReady={() => goLessonPlans("templates")}
          />
        );
        break;
      default:
        // Unknown sub (incl. the old "drafts" tab, now removed) — bounce
        // back to the templates library.
        replace(["lesson-plans", "templates"]);
        inner = null;
    }

    mainContent = (
      <div>
        {inner}
      </div>
    );
  } else {
    mainContent = (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-3 inline-flex items-center gap-2.5">
          <span className="w-6 h-px bg-accent" /> {navT(section, itemLabel[section] || section)}
        </p>
        <h2 className="font-serif text-5xl font-medium text-ink mb-3">
          Coming <em className="italic font-light text-accent">soon</em>
        </h2>
      </div>
    );
  }

  const sidebarActive = section === "account" ? "account" : section;

  // Sidebar contents — rendered once for the desktop rail and again
  // inside the mobile drawer, so the navigation is identical everywhere.
  const sidebarBody = (
    <>
        {/* Brand block — accent-square mark + Fraunces wordmark. The
            mark plays a one-shot halo on mount and a subtle hover-rotate
            so the sidebar has a small piece of life the moment you
            land. */}
        <button
          onClick={() => navigate([DEFAULT_ROUTE[role]])}
          className="murchid-sidebar-brand flex items-center gap-3 px-5 pt-6 pb-4 text-left"
          aria-label="Go home"
        >
          <span className="murchid-sidebar-brand-mark" aria-hidden>
            M
          </span>
          <span className="font-serif text-[1.4rem] font-medium text-ink leading-none">
            Murchid
          </span>
        </button>

        {/* Studio launcher — the hero CTA of the app, lifted out of the
            nav list. Dark ink card with an accent-red bolt circle on the
            left, big serif title, italic subtitle. Same vocabulary as the
            "Activate Pro" pill in the design handoff, in Murchid's palette
            and on a vertical card form factor so it fits the sidebar.
            Hover lifts -2px, accent halo brightens, chevron slides 4px. */}
        {role === "teacher" && (
          <button
            type="button"
            onClick={() => navigate(["studio"])}
            className={`murchid-studio-launcher ${section === "studio" ? "murchid-studio-launcher-active" : ""}`}
            aria-label="Open AI studio"
            aria-current={section === "studio" ? "page" : undefined}
          >
            <span className="murchid-studio-launcher-head">
              <span className="murchid-studio-launcher-brand">
                <span className="murchid-studio-launcher-icon" aria-hidden>
                  <Sparkles size={15} strokeWidth={2.25} />
                </span>
                <span className="murchid-studio-launcher-title">{t("studio.name")}</span>
              </span>
              <span className="murchid-studio-launcher-pill">{t("studio.badge")}</span>
            </span>

            <span className="murchid-studio-launcher-body">
              <span className="murchid-studio-launcher-subtitle">
                {t("studio.subtitle")}
              </span>
              <span className="murchid-studio-launcher-tagline">
                {t("studio.tagline")}
              </span>
            </span>

            <span className="murchid-studio-launcher-cta">
              <span>{t("studio.open")}</span>
              <ArrowRight size={14} strokeWidth={2.25} className="murchid-studio-launcher-cta-arrow" />
            </span>
          </button>
        )}

        <nav className="px-2 flex-1 overflow-y-auto pb-3" aria-label="Primary">
          {/* Items get a per-item stagger via inline --mi (mount index).
              Index is global across the whole nav so sections cascade in
              one after another, not in parallel. */}
          {(() => {
            let mi = 0;
            return nav.map((s, sectionIdx) => (
              <section key={s.section || `sec-${sectionIdx}`} className="murchid-sidebar-section">
                {s.section && (
                  <p className="murchid-sidebar-section-label">
                    {navT(s.section.toLowerCase(), s.section)}
                  </p>
                )}
                <div className="space-y-0.5 px-1">
                  {s.items.map((item) => {
                    const isActive = sidebarActive === item.key;
                    const myIndex = mi++;
                    return (
                      <button
                        key={item.key}
                        onClick={() => handleNavClick(item.key)}
                        style={{ "--mi": myIndex }}
                        className={`murchid-sidebar-item ${isActive ? "murchid-sidebar-item-active" : ""}`}
                        aria-current={isActive ? "page" : undefined}
                      >
                        <NavBadge letter={item.letter} icon={item.icon} lucide={item.lucide} />
                        <span className="truncate flex-1">{navT(item.key, item.label)}</span>
                      </button>
                    );
                  })}
                </div>
              </section>
            ));
          })()}
        </nav>

        <div className="relative">
          <button
            onClick={() => setAccountMenuOpen((o) => !o)}
            title={t("accountMenu.open")}
            aria-haspopup="menu"
            aria-expanded={accountMenuOpen}
            className={`murchid-sidebar-account ${accountMenuOpen ? "murchid-sidebar-account-active" : ""}`}
          >
            <span className="murchid-sidebar-account-avatar">SA</span>
            <div className="flex-1 min-w-0 text-start">
              <p className="text-sm font-medium leading-tight truncate text-ink">
                Sara
              </p>
              <p className="font-serif italic text-[11px] text-muted mt-0.5">
                {t(`account.${role}`) === `account.${role}` ? ROLE_LABELS[role] : t(`account.${role}`)}
              </p>
            </div>
            <ChevronRight size={14} className="text-muted flex-shrink-0 rtl:rotate-180" />
          </button>
          <AccountMenu
            open={accountMenuOpen}
            onClose={() => setAccountMenuOpen(false)}
            user={account}
            showUpgrade={showUpgrade}
            onOpenSettings={() => navigate(["account"])}
            onOpenHelp={() => setHelpOpen(true)}
            onUpgrade={() => navigate(["signup"])}
            onLogout={() => {
              // Clear the local account + return to the marketing landing.
              clearAccount();
              clearRoute();
              onClose?.();
            }}
          />
        </div>
    </>
  );

  return (
    <div className="h-[100dvh] bg-paper flex text-ink font-sans overflow-hidden">
      {/* Desktop / iPad-landscape rail */}
      <aside className="murchid-sidebar w-64 flex-col flex-shrink-0 hidden md:flex h-full print:hidden">
        {sidebarBody}
      </aside>

      {/* Mobile / iPad-portrait drawer — the sidebar slides in over a
          scrim. Identical nav to desktop; closes on any route change. */}
      <div className={`md:hidden ${navOpen ? "" : "pointer-events-none"}`}>
        <div
          onClick={() => setNavOpen(false)}
          className={`fixed inset-0 z-40 bg-ink/40 backdrop-blur-sm transition-opacity duration-300 print:hidden ${
            navOpen ? "opacity-100" : "opacity-0"
          }`}
          aria-hidden
        />
        <aside
          className={`murchid-sidebar fixed inset-y-0 start-0 z-50 w-[82vw] max-w-xs flex flex-col h-[100dvh] shadow-2xl transition-transform duration-300 ease-out print:hidden ${
            navOpen ? "translate-x-0" : "-translate-x-full rtl:translate-x-full"
          }`}
          aria-label="Primary"
          aria-hidden={!navOpen}
        >
          <button
            onClick={() => setNavOpen(false)}
            aria-label="Close menu"
            className="absolute top-3 end-3 z-10 h-9 w-9 rounded-md text-ink-soft hover:bg-accent hover:text-paper-cool flex items-center justify-center transition"
          >
            <X size={16} />
          </button>
          {sidebarBody}
        </aside>
      </div>

      <main className="flex-1 flex flex-col min-w-0 h-full">
        {/* Mobile top bar — the only nav affordance below md */}
        <div className="md:hidden flex items-center gap-2 px-3 h-14 border-b border-line bg-paper-cool flex-shrink-0 print:hidden">
          <button
            onClick={() => setNavOpen(true)}
            aria-label="Open menu"
            className="h-10 w-10 rounded-md text-ink hover:bg-paper-warm flex items-center justify-center transition"
          >
            <Menu size={20} />
          </button>
          <button
            onClick={() => navigate([DEFAULT_ROUTE[role]])}
            className="font-serif text-lg font-medium text-ink leading-none flex-1 text-start truncate"
          >
            Murchid
          </button>
          <LangToggle />
          {onClose && (
            <button
              onClick={onClose}
              title="Back to landing page"
              aria-label="Back to landing page"
              className="h-10 w-10 rounded-md text-ink-soft hover:bg-accent hover:text-paper-cool flex items-center justify-center transition"
            >
              <X size={16} />
            </button>
          )}
        </div>

        <div
          className={`relative flex-1 overflow-y-auto bg-[#fbf2e6] px-4 pt-4 pb-6 sm:px-6 md:ps-8 md:pt-3 md:pb-2 ${
            onClose ? "md:pe-20" : "md:pe-8"
          }`}
        >
          {onClose && (
            <button
              onClick={onClose}
              title="Back to landing page"
              className="hidden md:flex absolute top-3 end-8 z-20 h-9 w-9 rounded-md text-ink-soft hover:bg-accent hover:text-paper-cool items-center justify-center transition print:hidden"
            >
              <X size={15} />
            </button>
          )}
          {TEACHING_RAIL_SECTIONS.has(section) ? (
            <div className="lg:flex lg:gap-6 h-full">
              <div className="flex-1 min-w-0">{mainContent}</div>
              <div className="hidden lg:block flex-shrink-0">
                <TeachingRail />
              </div>
            </div>
          ) : (
            mainContent
          )}
        </div>
      </main>

      <HelpPopover open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}

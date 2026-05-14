import React, { useEffect, useState } from "react";
import {
  ChevronRight, X, Sparkles, ArrowUpRight, ArrowRight, Crown,
} from "lucide-react";
import Dashboard from "./views/Dashboard";
import TemplatesLibrary from "./views/TemplatesLibrary";
import NewTemplate from "./views/NewTemplate";
import ReusableDrafts from "./views/ReusableDrafts";
import NewDraft from "./views/NewDraft";
import EditDraft from "./views/EditDraft";
import Database from "./views/Database";
import AccountProfile from "./views/AccountProfile";
import Schedule from "./views/Schedule";
import Planner from "./views/Planner";
import Quizzes from "./views/Quizzes";
import QuizBuilder from "./views/QuizBuilder";
import Homework from "./views/Homework";
import Presentations from "./views/Presentations";
import Activities from "./views/Activities";
import Reports from "./views/Reports";
import Studio from "./views/Studio";
import AdminConsole from "./views/AdminConsole";
import DevConsole from "./views/DevConsole";
import { getRole, onRoleChange, ROLE_LABELS } from "./lib/role";
import { api } from "./views/_shared";
import { useRoute, navigate, replace } from "./lib/route";

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
      <span className="mudir-sidebar-badge">
        <Lucide size={15} strokeWidth={1.75} />
      </span>
    );
  }
  if (icon) {
    return <span className="mudir-sidebar-badge text-base leading-none">{icon}</span>;
  }
  return <span className="mudir-sidebar-badge">{letter}</span>;
}

export default function StudioApp({ onClose }) {
  const [role, setRoleState] = useState(getRole());
  const route = useRoute();

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
  const goNewDraft   = () => navigate(["lesson-plans", "newDraft"]);
  const goEditDraft  = (draft) => navigate(["lesson-plans", "edit-draft", draft.id]);
  const goQuizBuilder = (quiz) => navigate(["quizzes", quiz?.id ? "edit" : "new", quiz?.id].filter(Boolean));

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
    mainContent = <Homework />;
  } else if (section === "presentations") {
    mainContent = <Presentations />;
  } else if (section === "activities") {
    mainContent = <Activities />;
  } else if (section === "studio") {
    mainContent = <Studio onJump={handleNavClick} />;
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

    const tab = (key, label, onClick, isActive) => (
      <button
        key={key}
        onClick={onClick}
        className={`px-4 py-2 font-mono text-[11px] uppercase tracking-[0.15em] border-b-2 transition ${
          isActive ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink"
        }`}
      >
        {label}
      </button>
    );

    const isTemplatesArea = ["templates", "newTemplate"].includes(view);
    const isDraftsArea    = ["drafts", "newDraft", "edit-draft"].includes(view);

    let inner;
    switch (view) {
      case "templates":
        crumbs.push({ label: "Templates library" });
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
        crumbs.push(
          { label: "Templates library", onClick: () => goLessonPlans("templates") },
          { label: "New template" }
        );
        inner = (
          <NewTemplate
            onCancel={() => goLessonPlans("templates")}
            onSave={() => goLessonPlans("templates")}
          />
        );
        break;
      case "drafts":
        crumbs.push({ label: "Reusable drafts" });
        inner = <ReusableDrafts onNewDraft={goNewDraft} onEditDraft={goEditDraft} />;
        break;
      case "newDraft":
        crumbs.push(
          { label: "Reusable drafts", onClick: () => goLessonPlans("drafts") },
          { label: "New draft" }
        );
        inner = (
          <NewDraft
            onCancel={() => goLessonPlans("drafts")}
            onSave={(saved) => saved?.id ? goEditDraft(saved) : goLessonPlans("drafts")}
            onOpenFull={() => goLessonPlans("drafts")}
          />
        );
        break;
      case "edit-draft":
        crumbs.push(
          { label: "Reusable drafts", onClick: () => goLessonPlans("drafts") },
          { label: "Edit lesson plan" }
        );
        inner = (
          <EditDraft
            // EditDraft fetches the latest from /api/drafts/:id on mount,
            // so passing just the id is enough — survives a refresh.
            draft={extraId ? { id: Number(extraId) } : null}
            onClose={() => goLessonPlans("drafts")}
            onMarkReady={() => goLessonPlans("drafts")}
          />
        );
        break;
      default:
        // Unknown sub — bounce to the templates tab.
        replace(["lesson-plans", "templates"]);
        inner = null;
    }

    mainContent = (
      <div>
        <div className="flex items-center gap-2 border-b border-line mb-8">
          {tab("templates", "Templates library", () => goLessonPlans("templates"), isTemplatesArea)}
          {tab("drafts", "Reusable drafts", () => goLessonPlans("drafts"), isDraftsArea)}
        </div>
        {inner}
      </div>
    );
  } else {
    mainContent = (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-3 inline-flex items-center gap-2.5">
          <span className="w-6 h-px bg-accent" /> {itemLabel[section] || section}
        </p>
        <h2 className="font-serif text-5xl font-medium text-ink mb-3">
          Coming <em className="italic font-light text-accent">soon</em>
        </h2>
      </div>
    );
  }

  const sidebarActive = section === "account" ? "account" : section;

  return (
    <div className="h-screen bg-paper flex text-ink font-sans overflow-hidden">
      <aside className="mudir-sidebar w-64 flex-col flex-shrink-0 hidden md:flex h-full print:hidden">
        {/* Brand block — accent-square mark + Fraunces wordmark. The
            mark plays a one-shot halo on mount and a subtle hover-rotate
            so the sidebar has a small piece of life the moment you
            land. */}
        <button
          onClick={() => navigate([DEFAULT_ROUTE[role]])}
          className="mudir-sidebar-brand flex items-center gap-3 px-5 pt-6 pb-4 text-left"
          aria-label="Go home"
        >
          <span className="mudir-sidebar-brand-mark" aria-hidden>
            M
          </span>
          <span className="font-serif text-[1.4rem] font-medium text-ink leading-none">
            Mudir
          </span>
        </button>

        {/* Studio launcher — the hero CTA of the app, lifted out of the
            nav list. Dark ink card with an accent-red bolt circle on the
            left, big serif title, italic subtitle. Same vocabulary as the
            "Activate Pro" pill in the design handoff, in Mudir's palette
            and on a vertical card form factor so it fits the sidebar.
            Hover lifts -2px, accent halo brightens, chevron slides 4px. */}
        {role === "teacher" && (
          <button
            type="button"
            onClick={() => navigate(["studio"])}
            className={`mudir-studio-launcher ${section === "studio" ? "mudir-studio-launcher-active" : ""}`}
            aria-label="Open AI studio"
            aria-current={section === "studio" ? "page" : undefined}
          >
            <span className="mudir-studio-launcher-head">
              <span className="mudir-studio-launcher-brand">
                <span className="mudir-studio-launcher-icon" aria-hidden>
                  <Sparkles size={15} strokeWidth={2.25} />
                </span>
                <span className="mudir-studio-launcher-title">Studio</span>
              </span>
              <span className="mudir-studio-launcher-pill">AI</span>
            </span>

            <span className="mudir-studio-launcher-body">
              <span className="mudir-studio-launcher-subtitle">
                Your AI co-pilot for teaching
              </span>
              <span className="mudir-studio-launcher-tagline">
                Create &middot; Plan &middot; Inspire
              </span>
            </span>

            <span className="mudir-studio-launcher-cta">
              <span>Open Studio</span>
              <ArrowRight size={14} strokeWidth={2.25} className="mudir-studio-launcher-cta-arrow" />
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
              <section key={s.section || `sec-${sectionIdx}`} className="mudir-sidebar-section">
                {s.section && (
                  <p className="mudir-sidebar-section-label">{s.section}</p>
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
                        className={`mudir-sidebar-item ${isActive ? "mudir-sidebar-item-active" : ""}`}
                        aria-current={isActive ? "page" : undefined}
                      >
                        <NavBadge letter={item.letter} icon={item.icon} lucide={item.lucide} />
                        <span className="truncate flex-1">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </section>
            ));
          })()}
        </nav>

        <button
          onClick={() => navigate(["account"])}
          title="Open account"
          className={`mudir-sidebar-account ${section === "account" ? "mudir-sidebar-account-active" : ""}`}
        >
          <span className="mudir-sidebar-account-avatar">SA</span>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-sm font-medium leading-tight truncate text-ink">
              Sara Al-Mansoori
            </p>
            <p className="font-serif italic text-[11px] text-muted mt-0.5">
              {ROLE_LABELS[role]}
            </p>
          </div>
          <ChevronRight size={14} className="text-muted flex-shrink-0" />
        </button>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 h-full">
        <div className="relative flex-1 px-8 pt-3 pb-2 overflow-y-auto bg-[#fbf2e6]">
          {onClose && (
            <button
              onClick={onClose}
              title="Back to landing page"
              className="absolute top-3 right-8 z-20 h-9 w-9 rounded-md border border-line hover:bg-accent hover:text-paper-cool hover:border-accent text-ink-soft flex items-center justify-center transition print:hidden"
            >
              <X size={15} />
            </button>
          )}
          {mainContent}
        </div>
      </main>
    </div>
  );
}

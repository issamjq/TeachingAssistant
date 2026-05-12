import React, { useEffect, useState } from "react";
import { ChevronRight, X } from "lucide-react";
import Dashboard from "./views/Dashboard";
import TemplatesLibrary from "./views/TemplatesLibrary";
import NewTemplate from "./views/NewTemplate";
import ReusableDrafts from "./views/ReusableDrafts";
import NewDraft from "./views/NewDraft";
import EditDraft from "./views/EditDraft";
import Database from "./views/Database";
import AccountProfile from "./views/AccountProfile";
import Schedule from "./views/Schedule";
import Quizzes from "./views/Quizzes";
import QuizBuilder from "./views/QuizBuilder";
import Homework from "./views/Homework";
import Presentations from "./views/Presentations";
import Activities from "./views/Activities";
import Reports from "./views/Reports";
import Studio from "./views/Studio";
import AdminConsole from "./views/AdminConsole";
import DevConsole from "./views/DevConsole";
import NotificationsBell from "./views/NotificationsBell";
import { getRole, onRoleChange, ROLE_LABELS } from "./lib/role";
import { api } from "./views/_shared";
import { useRoute, navigate, replace } from "./lib/route";

const TEACHER_NAV = [
  {
    section: "Workspace",
    items: [
      { key: "studio",    label: "Studio",    icon: "+" },
    ],
  },
  {
    section: "Teaching",
    items: [
      { key: "lesson-plans",  label: "Lesson Plans",  letter: "L" },
      { key: "schedule",      label: "Schedule",      letter: "S" },
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

const DEFAULT_ROUTE = { teacher: "studio", admin: "admin-console", dev: "dev-console" };

// Sections legitimately reachable from the URL bar for each role. Anything
// outside this list bounces back to the role's default — keeps a stale
// `#/quizzes` from rendering for an admin who switched roles.
const SECTIONS_BY_ROLE = {
  teacher: new Set([
    "dashboard", "studio",
    "lesson-plans", "schedule", "quizzes", "homework", "presentations", "activities",
    "database", "reports",
    "account",
  ]),
  admin: new Set(["admin-console", "account"]),
  dev: new Set(["dev-console", "account"]),
};

function NavBadge({ letter, icon, active }) {
  const base =
    "h-7 w-7 rounded-md flex items-center justify-center font-mono text-[11px] font-medium tracking-wider flex-shrink-0";
  const colors = active ? "bg-white/20 text-white" : "bg-white/10 text-white/75";
  if (icon) {
    return <span className={`${base} ${colors} text-base leading-none`}>{icon}</span>;
  }
  return <span className={`${base} ${colors}`}>{letter}</span>;
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
      <aside className="w-64 flex-col flex-shrink-0 hidden md:flex h-full print:hidden" style={{ backgroundColor: "#1a1814" }}>
        <div className="px-6 py-7">
          <div className="font-serif italic font-semibold text-2xl text-white">
            <span className="text-accent not-italic mr-1.5">◈</span>Mudir
          </div>
        </div>

        <nav className="px-3 flex-1 overflow-y-auto pb-4">
          {nav.map((s) => (
            <div key={s.section} className="mb-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/40 mb-2 px-3">
                {s.section}
              </p>
              <div className="space-y-0.5">
                {s.items.map((item) => {
                  const isActive = sidebarActive === item.key;
                  return (
                    <button
                      key={item.key}
                      onClick={() => handleNavClick(item.key)}
                      className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-sm transition ${
                        isActive ? "bg-accent text-white font-medium" : "text-white/85 hover:bg-white/5"
                      }`}
                    >
                      <NavBadge letter={item.letter} icon={item.icon} active={isActive} />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-white/10">
          <button
            onClick={() => navigate(["account"])}
            title="Open account"
            className={`w-full flex items-center gap-3 p-2 rounded-lg text-left transition ${
              section === "account" ? "bg-white/10" : "hover:bg-white/5"
            }`}
          >
            <div className="h-9 w-9 rounded-full bg-white/10 text-white flex items-center justify-center font-mono text-[11px] tracking-wider font-semibold flex-shrink-0">
              SA
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium leading-tight truncate text-white">
                Sara Al-Mansoori
              </p>
              <p className="font-mono text-[10px] uppercase tracking-wider text-white/50 mt-0.5">
                {ROLE_LABELS[role]}
              </p>
            </div>
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 h-full">
        <header className="border-b border-line bg-paper-cool px-8 py-4 flex items-center justify-between flex-shrink-0 print:hidden">
          <nav className="text-sm flex items-center gap-2 flex-wrap text-muted">
            {crumbs.map((c, i) => (
              <React.Fragment key={i}>
                {i > 0 && <ChevronRight size={14} className="text-line" />}
                {c.onClick ? (
                  <button onClick={c.onClick} className="hover:text-ink transition">
                    {c.label}
                  </button>
                ) : (
                  <span className="text-ink font-medium">{c.label}</span>
                )}
              </React.Fragment>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            {role === "teacher" && <NotificationsBell />}
            <button
              onClick={() => navigate(["account"])}
              title="Open account"
              className="h-9 w-9 rounded-full bg-ink text-paper-cool flex items-center justify-center font-mono text-[11px] tracking-wider font-semibold hover:bg-accent transition"
            >
              SA
            </button>
            {onClose && (
              <button
                onClick={onClose}
                title="Back to landing page"
                className="h-9 w-9 rounded-md border border-line hover:bg-accent hover:text-paper-cool hover:border-accent text-ink-soft flex items-center justify-center transition"
              >
                <X size={15} />
              </button>
            )}
          </div>
        </header>

        <div className="flex-1 p-8 overflow-y-auto bg-paper">{mainContent}</div>
      </main>
    </div>
  );
}

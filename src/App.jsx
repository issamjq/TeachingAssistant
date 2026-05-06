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
import Library from "./views/Library";
import Reports from "./views/Reports";
import Studio from "./views/Studio";
import AdminConsole from "./views/AdminConsole";
import DevConsole from "./views/DevConsole";
import NotificationsBell from "./views/NotificationsBell";
import { getRole, onRoleChange, ROLE_LABELS } from "./lib/role";

const TEACHER_NAV = [
  {
    section: "Workspace",
    items: [
      { key: "dashboard", label: "Dashboard", icon: "◇" },
      { key: "studio",    label: "Studio",    icon: "+" },
      { key: "library",   label: "Library",   icon: "≡" },
    ],
  },
  {
    section: "Teaching",
    items: [
      { key: "lesson-plans",  label: "Lesson Plans",     letter: "L" },
      { key: "schedule",      label: "Schedule",         letter: "S" },
      { key: "quizzes",       label: "Quizzes & Exams",  letter: "Q" },
      { key: "homework",      label: "Homework",         letter: "H" },
      { key: "presentations", label: "Presentations",    letter: "P" },
      { key: "activities",    label: "Activities",       letter: "A" },
    ],
  },
  {
    section: "Data",
    items: [
      { key: "database", label: "Class roster", letter: "C" },
    ],
  },
  {
    section: "Account",
    items: [{ key: "reports", label: "Reports", letter: "R" }],
  },
];

const ADMIN_NAV = [
  {
    section: "Admin",
    items: [{ key: "admin-console", label: "Admin console", letter: "A" }],
  },
];

const DEV_NAV = [
  {
    section: "Dev",
    items: [{ key: "dev-console", label: "Dev console", letter: "D" }],
  },
];

const NAV_BY_ROLE = {
  teacher: TEACHER_NAV,
  admin: ADMIN_NAV,
  dev: DEV_NAV,
};

const DEFAULT_ROUTE = {
  teacher: "dashboard",
  admin: "admin-console",
  dev: "dev-console",
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
  const [active, setActive] = useState(DEFAULT_ROUTE[getRole()]);
  const [view, setView] = useState({ name: "templates" });

  // React to role changes initiated elsewhere (Account → role switcher).
  useEffect(() => {
    return onRoleChange((next) => {
      setRoleState(next);
      setActive(DEFAULT_ROUTE[next]);
    });
  }, []);

  const nav = NAV_BY_ROLE[role];
  const itemLabel = Object.fromEntries(
    nav.flatMap((s) => s.items.map((i) => [i.key, i.label]))
  );
  itemLabel["account"] = "Account";

  const goLessonPlans = (subView = "templates") => {
    setActive("lesson-plans");
    setView({ name: subView });
  };
  const goNewTemplate = () => setView({ name: "newTemplate" });
  const goNewDraft   = () => setView({ name: "newDraft" });
  const goEditDraft  = (draft) => setView({ name: "editDraft", draft });
  const goQuizBuilder = (quiz) => setView({ name: "quizBuilder", quiz });

  const handleNavClick = (key) => {
    setActive(key);
    if (key === "lesson-plans") setView({ name: "templates" });
    if (key === "quizzes") setView({ name: "quizzesList" });
  };

  let crumbs = [{ label: itemLabel[active] || "Studio" }];
  let mainContent;

  if (active === "account") {
    crumbs = [{ label: "Account" }];
    mainContent = <AccountProfile />;
  } else if (role === "admin") {
    crumbs = [{ label: "Admin console" }];
    mainContent = <AdminConsole />;
  } else if (role === "dev") {
    crumbs = [{ label: "Dev console" }];
    mainContent = <DevConsole />;
  } else if (active === "dashboard") {
    mainContent = <Dashboard onJump={handleNavClick} />;
  } else if (active === "database") {
    mainContent = <Database />;
  } else if (active === "schedule") {
    mainContent = <Schedule />;
  } else if (active === "homework") {
    mainContent = <Homework />;
  } else if (active === "presentations") {
    mainContent = <Presentations />;
  } else if (active === "activities") {
    mainContent = <Activities />;
  } else if (active === "library") {
    mainContent = <Library />;
  } else if (active === "studio") {
    mainContent = <Studio onJump={handleNavClick} />;
  } else if (active === "reports") {
    mainContent = <Reports />;
  } else if (active === "quizzes") {
    if (view.name === "quizBuilder") {
      crumbs = [
        { label: "Quizzes & Exams", onClick: () => { setActive("quizzes"); setView({ name: "quizzesList" }); } },
        { label: view.quiz?.id ? "Edit quiz" : "New quiz" },
      ];
      mainContent = (
        <QuizBuilder
          quiz={view.quiz}
          onClose={() => { setActive("quizzes"); setView({ name: "quizzesList" }); }}
        />
      );
    } else {
      mainContent = <Quizzes onOpenQuiz={goQuizBuilder} />;
    }
  } else if (active === "lesson-plans") {
    crumbs = [{ label: "Lesson Plans", onClick: () => goLessonPlans("templates") }];

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

    const isTemplatesArea = ["templates", "newTemplate"].includes(view.name);
    const isDraftsArea    = ["drafts", "newDraft", "editDraft"].includes(view.name);

    let inner;
    switch (view.name) {
      case "templates":
        crumbs.push({ label: "Templates library" });
        inner = (
          <TemplatesLibrary
            onNewTemplate={goNewTemplate}
            onUseTemplate={(t) => goEditDraft({ name: `${t.name} (from template)`, progress: 25 })}
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
            onOpenFull={() => goEditDraft({ name: "Poetry — figurative language", progress: 65 })}
          />
        );
        break;
      case "editDraft":
        crumbs.push(
          { label: "Reusable drafts", onClick: () => goLessonPlans("drafts") },
          { label: "Edit lesson plan" }
        );
        inner = (
          <EditDraft
            draft={view.draft}
            onClose={() => goLessonPlans("drafts")}
            onMarkReady={() => goLessonPlans("drafts")}
          />
        );
        break;
      default:
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
          <span className="w-6 h-px bg-accent" /> {itemLabel[active] || active}
        </p>
        <h2 className="font-serif text-5xl font-medium text-ink mb-3">
          Coming <em className="italic font-light text-accent">soon</em>
        </h2>
      </div>
    );
  }

  return (
    <div className="h-screen bg-paper flex text-ink font-sans overflow-hidden">
      <aside className="w-64 flex-col flex-shrink-0 hidden md:flex h-full" style={{ backgroundColor: "#1a1814" }}>
        <div className="px-6 py-7">
          <div className="font-serif italic font-semibold text-2xl text-white">
            <span className="text-accent not-italic mr-1.5">◈</span>Mudir
          </div>
        </div>

        <nav className="px-3 flex-1 overflow-y-auto pb-4">
          {nav.map((section) => (
            <div key={section.section} className="mb-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/40 mb-2 px-3">
                {section.section}
              </p>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const isActive = active === item.key;
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
            onClick={() => setActive("account")}
            title="Open account"
            className={`w-full flex items-center gap-3 p-2 rounded-lg text-left transition ${
              active === "account" ? "bg-white/10" : "hover:bg-white/5"
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
        <header className="border-b border-line bg-paper-cool px-8 py-4 flex items-center justify-between flex-shrink-0">
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
              onClick={() => setActive("account")}
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

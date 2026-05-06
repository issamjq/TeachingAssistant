import React, { useState } from "react";
import { Bell, ChevronRight, X } from "lucide-react";
import Dashboard from "./views/Dashboard";
import TemplatesLibrary from "./views/TemplatesLibrary";
import NewTemplate from "./views/NewTemplate";
import ReusableDrafts from "./views/ReusableDrafts";
import NewDraft from "./views/NewDraft";
import EditDraft from "./views/EditDraft";
import Database from "./views/Database";
import AccountProfile from "./views/AccountProfile";

const NAV = [
  {
    section: "Workspace",
    items: [
      { key: "dashboard", label: "Dashboard", icon: "◇" },
      { key: "studio", label: "Studio", icon: "+" },
      { key: "library", label: "Library", icon: "≡" },
    ],
  },
  {
    section: "Teaching",
    items: [
      { key: "lesson-plans", label: "Lesson Plans", letter: "L" },
      { key: "schedule", label: "Schedule", letter: "S" },
      { key: "quizzes", label: "Quizzes & Exams", letter: "Q" },
      { key: "homework", label: "Homework", letter: "H" },
      { key: "presentations", label: "Presentations", letter: "P" },
      { key: "activities", label: "Activities", letter: "A" },
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

const ITEM_LABEL = Object.fromEntries(
  NAV.flatMap((s) => s.items.map((i) => [i.key, i.label]))
);

function NavBadge({ letter, icon, active }) {
  const base =
    "h-7 w-7 rounded-md flex items-center justify-center font-mono text-[11px] font-medium tracking-wider flex-shrink-0";
  const colors = active
    ? "bg-white/20 text-white"
    : "bg-white/10 text-white/75";
  if (icon) {
    return (
      <span className={`${base} ${colors} text-base leading-none`}>{icon}</span>
    );
  }
  return <span className={`${base} ${colors}`}>{letter}</span>;
}

function ComingSoon({ name }) {
  return (
    <div className="flex flex-col items-center justify-center py-32 text-center">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-3 inline-flex items-center gap-2.5">
        <span className="w-6 h-px bg-accent" /> {name}
      </p>
      <h2 className="font-serif text-5xl font-medium text-ink mb-3">
        Coming <em className="italic font-light text-accent">soon</em>
      </h2>
      <p className="text-muted max-w-md">
        This part of Mudir isn’t built yet. Lesson Plans is the live tab — that’s where the
        functional studio lives.
      </p>
    </div>
  );
}

export default function StudioApp({ onClose }) {
  const [active, setActive] = useState("dashboard");
  const [view, setView] = useState({ name: "templates" });

  const goLessonPlans = (subView = "templates") => {
    setActive("lesson-plans");
    setView({ name: subView });
  };
  const goNewTemplate = () => setView({ name: "newTemplate" });
  const goNewDraft = () => setView({ name: "newDraft" });
  const goEditDraft = (draft) => setView({ name: "editDraft", draft });

  const handleNavClick = (key) => {
    setActive(key);
    if (key === "lesson-plans") setView({ name: "templates" });
  };

  let crumbs = [{ label: ITEM_LABEL[active] || "Studio" }];
  let mainContent;

  if (active === "dashboard") {
    mainContent = <Dashboard />;
  } else if (active === "database") {
    mainContent = <Database />;
  } else if (active === "account") {
    crumbs = [{ label: "Account" }];
    mainContent = <AccountProfile />;
  } else if (active === "lesson-plans") {
    crumbs = [
      { label: "Lesson Plans", onClick: () => goLessonPlans("templates") },
    ];

    const tab = (key, label, onClick, isActive) => (
      <button
        key={key}
        onClick={onClick}
        className={`px-4 py-2 font-mono text-[11px] uppercase tracking-[0.15em] border-b-2 transition ${
          isActive
            ? "border-accent text-ink"
            : "border-transparent text-muted hover:text-ink"
        }`}
      >
        {label}
      </button>
    );

    const isTemplatesArea = ["templates", "newTemplate"].includes(view.name);
    const isDraftsArea = ["drafts", "newDraft", "editDraft"].includes(view.name);

    let inner;
    switch (view.name) {
      case "templates":
        crumbs.push({ label: "Templates library" });
        inner = (
          <TemplatesLibrary
            onNewTemplate={goNewTemplate}
            onUseTemplate={(t) =>
              goEditDraft({ name: `${t.name} (from template)`, progress: 25 })
            }
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
            onSave={() => goLessonPlans("drafts")}
            onOpenFull={() =>
              goEditDraft({ name: "Poetry — figurative language", progress: 65 })
            }
          />
        );
        break;
      case "editDraft":
        crumbs.push(
          { label: "Reusable drafts", onClick: () => goLessonPlans("drafts") },
          { label: "Edit draft" }
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
    mainContent = <ComingSoon name={ITEM_LABEL[active] || active} />;
  }

  return (
    <div className="min-h-screen bg-paper flex text-ink font-sans">
      <aside
        className="w-64 flex-col flex-shrink-0 hidden md:flex"
        style={{ backgroundColor: "#1a1814" }}
      >
        <div className="px-6 py-7">
          <div className="font-serif italic font-semibold text-2xl text-white">
            <span className="text-accent not-italic mr-1.5">◈</span>Mudir
          </div>
        </div>

        <nav className="px-3 flex-1 overflow-y-auto pb-4">
          {NAV.map((section) => (
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
                        isActive
                          ? "bg-accent text-white font-medium"
                          : "text-white/85 hover:bg-white/5"
                      }`}
                    >
                      <NavBadge
                        letter={item.letter}
                        icon={item.icon}
                        active={isActive}
                      />
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
                Teacher
              </p>
            </div>
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        <header className="border-b border-line bg-paper-cool px-8 py-4 flex items-center justify-between">
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
            <button className="h-9 w-9 rounded-md border border-line hover:bg-paper-warm flex items-center justify-center transition">
              <Bell size={15} className="text-ink-soft" />
            </button>
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

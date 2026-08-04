// My students — two tabs.
//   Students : the roster (name + grade + section + actions). Existing
//              DatabaseStudents component, untouched.
//   Scores   : per-quiz, per-student score recording. New surface backed
//              by /api/quiz-scores + /api/quizzes + /api/students.
//
// The "Teaching profile" used to live here as a third tab — moved into
// Settings → Teaching profile so the Settings page owns all the
// "about you" data.
import React, { Suspense, lazy } from "react";
import { Users, BarChart3, CalendarCheck, GraduationCap } from "lucide-react";
import { navigate } from "../lib/route";
import BrandLoader from "../components/BrandLoader";
import DatabaseStudents from "./DatabaseStudents";
import DatabaseScores from "./DatabaseScores";
import { useT } from "../lib/i18n";

// Attendance and Gradebook are the two heaviest tabs and the two a teacher
// opens least often, so they load on demand rather than riding along with the
// roster. Database.jsx is itself already a route-level chunk (App.jsx), so
// this is a second level of splitting inside it.
const DatabaseAttendance = lazy(() => import("./DatabaseAttendance"));
const DatabaseGrades = lazy(() => import("./DatabaseGrades"));

// Labels come from `db.tab.<key>` at render time rather than living here, so
// the tab strip follows the language toggle without a second lookup table.
const TABS = [
  { key: "students",   icon: Users,         route: ["database", "students"] },
  { key: "attendance", icon: CalendarCheck, route: ["database", "attendance"] },
  { key: "grades",     icon: GraduationCap, route: ["database", "grades"] },
  { key: "scores",     icon: BarChart3,     route: ["database", "scores"] },
];

const PANELS = {
  students:   DatabaseStudents,
  attendance: DatabaseAttendance,
  grades:     DatabaseGrades,
  scores:     DatabaseScores,
};

export default function Database({ sub }) {
  const t = useT();
  // Default tab is Students. Anything unrecognised — including legacy
  // /database/profile URLs from before the Teaching-profile move — falls back
  // there rather than rendering nothing.
  const active = PANELS[sub] ? sub : "students";
  const Panel = PANELS[active];

  return (
    <div>
      <header className="mb-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-2 inline-flex items-center gap-2.5">
          <span className="w-6 h-px bg-accent" /> {t("db.eyebrow")}
        </p>
        <h2 className="font-serif text-4xl font-medium text-ink">
          {t("db.titleA")} <em className="italic font-light text-accent">{t("db.titleEm")}</em>
        </h2>
      </header>

      <div className="flex flex-wrap items-center gap-1 border-b border-line mb-6">
        {TABS.map(({ key, icon: Icon, route }) => {
          const on = active === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => navigate(route)}
              aria-current={on ? "page" : undefined}
              className={`inline-flex items-center gap-2 px-3 py-2.5 text-[13px] font-medium border-b-2 -mb-px transition-colors ${
                on
                  ? "border-accent text-ink"
                  : "border-transparent text-muted hover:text-ink hover:border-line"
              }`}
            >
              <Icon size={14} />
              {t(`db.tab.${key}`)}
            </button>
          );
        })}
      </div>

      <Suspense fallback={<BrandLoader compact fullscreen={false} />}>
        <Panel />
      </Suspense>
    </div>
  );
}

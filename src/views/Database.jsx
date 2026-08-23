// My students — two tabs.
//   Students : the roster (name + grade + section + actions). Existing
//              DatabaseStudents component, untouched.
//   Scores   : per-quiz, per-student score recording. New surface backed
//              by /api/quiz-scores + /api/quizzes + /api/students.
//
// The "Teaching profile" used to live here as a third tab — moved into
// Settings → Teaching profile so the Settings page owns all the
// "about you" data.
import React from "react";
import { Users, BarChart3, CalendarCheck } from "lucide-react";
import { navigate } from "../lib/route";
import DatabaseStudents from "./DatabaseStudents";
import DatabaseScores from "./DatabaseScores";
import DatabaseAttendance from "./DatabaseAttendance";

const TABS = [
  { key: "students",   label: "Students",   icon: Users, route: ["database", "students"] },
  { key: "scores",     label: "Scores",     icon: BarChart3, route: ["database", "scores"] },
  /**
   * The register. Built long ago and never reachable — DatabaseAttendance
   * has existed in full since before the portal did, with no tab pointing
   * at it. Students now mark themselves present by opening Murchid, which
   * makes this the screen where a teacher reads and corrects that.
   */
  { key: "attendance", label: "Attendance", icon: CalendarCheck, route: ["database", "attendance"] },
];

export default function Database({ sub }) {
  // Default tab is Students. Legacy /database/profile URLs (from before
  // the Teaching-profile move) fall back to Students too.
  const active = sub === "scores" ? "scores" : sub === "attendance" ? "attendance" : "students";

  return (
    <div>
      <header className="mb-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-2 inline-flex items-center gap-2.5">
          <span className="w-6 h-px bg-accent" /> My students
        </p>
        <h2 className="font-serif text-4xl font-medium text-ink">
          Your <em className="italic font-light text-accent">class</em>
        </h2>
      </header>

      <div className="flex flex-wrap items-center gap-1 border-b border-line mb-6">
        {TABS.map(({ key, label, icon: Icon, route }) => {
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
              {label}
            </button>
          );
        })}
      </div>

      {active === "students" ? (
        <DatabaseStudents />
      ) : active === "attendance" ? (
        <DatabaseAttendance />
      ) : (
        <DatabaseScores />
      )}
    </div>
  );
}

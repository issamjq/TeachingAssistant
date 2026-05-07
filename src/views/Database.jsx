import React from "react";
import DatabaseProfile from "./DatabaseProfile";
import DatabaseStudents from "./DatabaseStudents";
import DatabaseAttendance from "./DatabaseAttendance";
import DatabaseGrades from "./DatabaseGrades";
import { navigate } from "../lib/route";

const TABS = [
  { key: "profile",    label: "Teaching profile" },
  { key: "students",   label: "My students" },
  { key: "attendance", label: "Attendance" },
  { key: "grades",     label: "Grades" },
];

// `sub` comes from the URL hash (#/database/<sub>) so reload keeps the user on
// whichever tab they were on. Defaults to "profile" when the URL is bare.
export default function Database({ sub }) {
  const active = TABS.some((t) => t.key === sub) ? sub : "profile";
  const setActive = (key) => navigate(["database", key]);

  return (
    <div>
      <div className="flex items-center gap-2 border-b border-line mb-8">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActive(t.key)}
            className={`px-4 py-2 font-mono text-[11px] uppercase tracking-[0.15em] border-b-2 transition ${
              active === t.key
                ? "border-accent text-ink"
                : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {active === "profile"    && <DatabaseProfile />}
      {active === "students"   && <DatabaseStudents />}
      {active === "attendance" && <DatabaseAttendance />}
      {active === "grades"     && <DatabaseGrades />}
    </div>
  );
}

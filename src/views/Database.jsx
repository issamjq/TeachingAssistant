import React, { useState } from "react";
import DatabaseProfile from "./DatabaseProfile";
import DatabaseStudents from "./DatabaseStudents";
import DatabaseAttendance from "./DatabaseAttendance";
import DatabaseGrades from "./DatabaseGrades";

const TABS = [
  { key: "profile",    label: "Teaching profile" },
  { key: "students",   label: "My students" },
  { key: "attendance", label: "Attendance" },
  { key: "grades",     label: "Grades" },
];

export default function Database() {
  const [active, setActive] = useState("profile");

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

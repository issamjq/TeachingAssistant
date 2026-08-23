"use client";

// Every subject this student is taught, as cards. The sidebar lists the
// same set; this is where they land if they click the section itself, and
// it carries what a sidebar row cannot — the teacher's name and how much
// is waiting.
import React, { useEffect, useState } from "react";
import { ArrowRight, BookOpen } from "lucide-react";
import { api } from "./_shared";
import BrandLoader from "../components/BrandLoader";
import { navigate } from "@/lib/route";

export default function StudentClasses() {
  const [subjects, setSubjects] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api("/api/student/subjects").then(setSubjects).catch((e) => setError(e.message));
  }, []);

  if (error) {
    return (
      <div className="bg-paper border border-accent rounded-lg p-4">
        <p className="font-mono text-[10px] uppercase tracking-wider text-accent">{error}</p>
      </div>
    );
  }
  if (!subjects) return <BrandLoader />;

  const grade = subjects[0]?.grade;

  return (
    <div className="space-y-8">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-2 inline-flex items-center gap-2.5">
          <span className="w-6 h-px bg-accent" /> {grade || "My classes"}
        </p>
        <h2 className="font-serif text-4xl font-medium text-ink">
          Your <em className="italic font-light text-accent">classes</em>
        </h2>
        <p className="text-muted mt-2">
          One for each subject. A different teacher may teach each one.
        </p>
      </div>

      {subjects.length === 0 ? (
        <div className="border border-line rounded-xl p-12 text-center">
          <p className="text-ink mb-1">You&rsquo;re not in any classes yet.</p>
          <p className="text-sm text-muted">
            Your teachers invite you by email. Open the link in an invitation and that class
            appears here.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {subjects.map((s) => (
            <button
              key={s.student_row_id}
              onClick={() => navigate(["student-class", s.student_row_id])}
              className="text-start border border-line rounded-xl p-5 bg-paper hover:border-ink transition"
            >
              <span className="text-accent"><BookOpen size={16} /></span>
              <p className="font-serif text-xl text-ink mt-3 mb-1">{s.subject || "Class"}</p>
              <p className="text-sm text-muted">{s.teacher || "Your teacher"}</p>
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-line">
                <span className="text-xs text-muted">
                  {s.work_count === 0
                    ? "Nothing set yet"
                    : `${s.work_count} ${s.work_count === 1 ? "item" : "items"}`}
                </span>
                <ArrowRight size={13} className="text-muted" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

// The student's own attendance record.
//
// Marked by turning up: opening the portal on a school day records them
// present, once per day per teacher (db/tune.sql §49). A teacher can
// still correct any day by hand, and her correction stands — the mark
// writes nothing on a date already recorded.
import React, { useEffect, useMemo, useState } from "react";
import { api } from "./_shared";
import BrandLoader from "../components/BrandLoader";

const TONE = {
  present: "text-sage",
  late: "text-gold",
  absent: "text-clay",
};

export default function StudentAttendance() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api("/api/student/attendance").then(setRows).catch((e) => setError(e.message));
  }, []);

  const stats = useMemo(() => {
    const list = rows || [];
    const present = list.filter((r) => r.status === "present").length;
    const late = list.filter((r) => r.status === "late").length;
    const absent = list.filter((r) => r.status === "absent").length;
    const total = list.length;
    return { present, late, absent, total, pct: total ? Math.round((present / total) * 100) : null };
  }, [rows]);

  if (error) {
    return (
      <div className="bg-paper border border-accent rounded-lg p-4">
        <p className="font-mono text-[10px] uppercase tracking-wider text-accent">{error}</p>
      </div>
    );
  }
  if (!rows) return <BrandLoader />;

  return (
    <div className="space-y-8">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-2 inline-flex items-center gap-2.5">
          <span className="w-6 h-px bg-accent" /> Attendance
        </p>
        <h2 className="font-serif text-4xl font-medium text-ink">
          Your <em className="italic font-light text-accent">attendance</em>
        </h2>
      </div>

      {rows.length === 0 ? (
        <div className="border border-line rounded-xl p-12 text-center">
          <p className="text-ink mb-1">Nothing recorded yet.</p>
          <p className="text-sm text-muted">
            You&rsquo;re marked present each day you open Murchid.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi label="Present" value={stats.present} tone="sage" />
            <Kpi label="Late" value={stats.late} tone="gold" />
            <Kpi label="Absent" value={stats.absent} tone="clay" />
            <Kpi label="Attendance" value={stats.pct == null ? "—" : `${stats.pct}%`} />
          </div>

          <div className="border border-line rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted border-b border-line">
                  <th className="text-left py-3 px-4 font-medium">Date</th>
                  <th className="text-left py-3 font-medium">Status</th>
                  <th className="text-left py-3 font-medium">Note</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={`${r.date}-${i}`} className="border-b border-line/60 last:border-0">
                    <td className="py-3 px-4 text-ink">
                      {new Date(r.date).toLocaleDateString(undefined, {
                        weekday: "short", day: "numeric", month: "short",
                      })}
                    </td>
                    <td className={`py-3 capitalize ${TONE[r.status] || "text-ink"}`}>{r.status}</td>
                    <td className="py-3 text-muted text-xs">{r.note || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, tone }) {
  return (
    <div className="border border-line rounded-xl p-4">
      <p className="font-mono text-[10px] uppercase tracking-wider text-muted mb-1.5">{label}</p>
      <p className={`font-serif text-3xl ${tone ? `text-${tone}` : "text-ink"}`}>{value}</p>
    </div>
  );
}

"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GRADE_LEVELS } from "../lib/enums";
import { selectClasses, inputClasses, api, DatePicker } from "./_shared";
import BrandLoader from "../components/BrandLoader";

const STATUSES = ["Present", "Absent", "Late", "Excused"];

const STATUS_COLORS = {
  Present: "bg-sage text-paper-cool border-sage",
  Absent:  "bg-accent text-paper-cool border-accent",
  Late:    "bg-gold text-paper-cool border-gold",
  Excused: "bg-paper-warm text-ink-soft border-line",
};

const isoDate = (d) => new Date(d).toISOString().slice(0, 10);

export default function DatabaseAttendance() {
  const [date, setDate] = useState(isoDate(new Date()));
  const [grade, setGrade] = useState("");
  const [section, setSection] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = () => {
    setLoading(true);
    const qs = new URLSearchParams({ date });
    if (grade) qs.set("grade", grade);
    if (section) qs.set("section", section);
    api(`/api/attendance?${qs}`)
      .then((data) => { setRows(data); setLoading(false); })
      .catch((err) => { setError(err.message); setLoading(false); });
  };
  useEffect(reload, [date, grade, section]);

  const sectionOptions = useMemo(() => {
    const set = new Set(rows.map((r) => r.section).filter(Boolean));
    return [...set].sort();
  }, [rows]);

  const setStatus = async (row, status) => {
    setRows((prev) => prev.map((r) => r.student_id === row.student_id ? { ...r, status } : r));
    try {
      await api("/api/attendance", {
        method: "PUT",
        body: { student_id: row.student_id, date, status },
      });
    } catch (e) {
      alert(`Could not save: ${e.message}`);
      reload();
    }
  };

  const setNotes = async (row, notes) => {
    try {
      await api("/api/attendance", {
        method: "PUT",
        body: { student_id: row.student_id, date, status: row.status || "Present", notes },
      });
    } catch (e) {
      alert(`Could not save: ${e.message}`);
    }
  };

  const shiftDay = (delta) => {
    const d = new Date(date);
    d.setDate(d.getDate() + delta);
    setDate(isoDate(d));
  };

  // Quick-fill: mark every unmarked student Present.
  const markAllPresent = async () => {
    const targets = rows.filter((r) => !r.status);
    for (const r of targets) {
      // Sequential is fine for ~30 students; avoids hammering the DB.
      // eslint-disable-next-line no-await-in-loop
      await api("/api/attendance", {
        method: "PUT",
        body: { student_id: r.student_id, date, status: "Present" },
      });
    }
    reload();
  };

  const counts = useMemo(() => {
    const c = { Present: 0, Absent: 0, Late: 0, Excused: 0, Unmarked: 0 };
    rows.forEach((r) => {
      if (r.status && c[r.status] !== undefined) c[r.status]++;
      else c.Unmarked++;
    });
    return c;
  }, [rows]);

  return (
    <div>
      <div className="mb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-2 inline-flex items-center gap-2.5">
            <span className="w-6 h-px bg-accent" /> Attendance
          </p>
          <h2 className="font-serif text-4xl font-medium text-ink">
            Daily <em className="italic font-light text-accent">attendance</em>
          </h2>
          <p className="text-muted mt-2">Pick a date, mark present / absent / late / excused. Saves on each click.</p>
        </div>
        <Button onClick={markAllPresent} variant="secondary">
          Mark unmarked → Present
        </Button>
      </div>

      <div className="flex flex-col md:flex-row gap-3 mb-6 items-stretch md:items-end">
        <div className="flex items-center gap-2">
          <button
            onClick={() => shiftDay(-1)}
            className="h-10 w-10 rounded-md border border-line hover:bg-paper-warm flex items-center justify-center"
          >
            <ChevronLeft size={14} />
          </button>
          <DatePicker
            value={date}
            onChange={(v) => setDate(v)}
            className="bg-paper-cool border border-line rounded-lg px-3 py-2.5 text-sm text-ink min-w-[170px]"
          />
          <button
            onClick={() => shiftDay(1)}
            className="h-10 w-10 rounded-md border border-line hover:bg-paper-warm flex items-center justify-center"
          >
            <ChevronRight size={14} />
          </button>
          <button
            onClick={() => setDate(isoDate(new Date()))}
            className="font-mono text-[10px] uppercase tracking-wider text-accent border-b border-accent hover:text-ink hover:border-ink ml-2"
          >
            Today
          </button>
        </div>
        <select className={selectClasses + " md:max-w-xs"} value={grade} onChange={(e) => setGrade(e.target.value)}>
          <option value="">All grades</option>
          {GRADE_LEVELS.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
        <select className={selectClasses + " md:max-w-xs"} value={section} onChange={(e) => setSection(e.target.value)}>
          <option value="">All sections</option>
          {sectionOptions.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {Object.entries(counts).map(([label, value]) => (
          <Card key={label}>
            <CardContent className="p-4">
              <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted mb-1">{label}</p>
              <p className="font-serif text-3xl font-medium text-accent leading-none">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {error && (
        <div className="mb-4 bg-paper border border-accent rounded-lg p-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-accent">{error}</p>
        </div>
      )}

      <Card>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted border-b border-line">
                  <th className="text-left py-3 px-5 font-medium">Student</th>
                  <th className="text-left py-3 font-medium">Class</th>
                  <th className="text-left py-3 font-medium">Status</th>
                  <th className="text-left py-3 px-5 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={4} className="py-8 text-center"><BrandLoader compact fullscreen={false} /></td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={4} className="py-8 text-center text-muted">No students match the current filter.</td></tr>
                ) : rows.map((r) => (
                  <tr key={r.student_id} className="border-b border-line/60 last:border-0 hover:bg-paper-warm transition">
                    <td className="py-3 px-5 text-ink">
                      {r.first_name} {r.last_name}
                      <span className="font-mono text-[10px] text-muted ml-2">{r.code}</span>
                    </td>
                    <td className="py-3 text-muted text-xs">
                      {r.grade}{r.section ? ` · ${r.section}` : ""}
                    </td>
                    <td className="py-3">
                      <div className="inline-flex bg-paper border border-line rounded-full p-0.5">
                        {STATUSES.map((s) => (
                          <button
                            key={s}
                            onClick={() => setStatus(r, s)}
                            className={`px-3 py-1 rounded-full font-mono text-[10px] uppercase tracking-wider border transition ${
                              r.status === s
                                ? STATUS_COLORS[s]
                                : "border-transparent text-muted hover:text-ink"
                            }`}
                          >
                            {s[0]}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-5">
                      <input
                        defaultValue={r.notes ?? ""}
                        placeholder="Optional note…"
                        onBlur={(e) => setNotes(r, e.target.value || null)}
                        className={inputClasses + " py-1 text-xs"}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

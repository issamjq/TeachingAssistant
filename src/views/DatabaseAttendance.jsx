"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, DoorOpen } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GRADE_LEVELS } from "../lib/enums";
import { selectClasses, inputClasses, api, DatePicker } from "./_shared";
import BrandLoader from "../components/BrandLoader";
import { isoDay } from "@/lib/localDate";

// Lowercase, because that is what the column defaults to and what every
// other status vocabulary in this schema uses. Capitalised values were
// stored verbatim — no CHECK constraint caught them — so a register
// marked by hand and one written by any other path disagreed, and the
// highlight matched neither.
const STATUSES = ["present", "absent", "late", "excused"];

const STATUS_COLORS = {
  present: "bg-ok text-paper-cool border-ok",
  absent:  "bg-crit text-paper-cool border-crit",
  late:    "bg-warn text-paper-cool border-warn",
  excused: "bg-paper-warm text-ink-soft border-line",
};

// Local parts, not toISOString — see src/lib/localDate.ts.
const isoDate = isoDay;

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
      .then((data) => { setRows(data); setError(null); setLoading(false); })
      .catch((err) => { setError(err.message); setLoading(false); });
  };
  useEffect(reload, [date, grade, section]);

  const sectionOptions = useMemo(() => {
    const set = new Set(rows.map((r) => r.section).filter(Boolean));
    return [...set].sort();
  }, [rows]);

  const setStatus = async (row, status) => {
    // Her click makes it her mark — the "portal" hint comes off the row.
    setRows((prev) =>
      prev.map((r) => (r.student_id === row.student_id ? { ...r, status, source: "teacher" } : r)),
    );
    try {
      await api("/api/attendance", {
        method: "PUT",
        body: { student_id: row.student_id, date, status },
      });
    } catch (e) {
      setError(`Could not save: ${e.message}`);
      reload();
    }
  };

  const setNotes = async (row, notes) => {
    try {
      await api("/api/attendance", {
        method: "PUT",
        body: { student_id: row.student_id, date, status: row.status || "present", notes },
      });
    } catch (e) {
      setError(`Could not save: ${e.message}`);
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
        body: { student_id: r.student_id, date, status: "present" },
      });
    }
    reload();
  };

  /**
   * The tally, counted case-insensitively.
   *
   * The keys were capitalised and the column stores lowercase — the same
   * mismatch the STATUSES comment above describes — so `c['present']`
   * was undefined and every marked student fell through to Unmarked. A
   * teacher taking a full register watched the row turn green and the
   * headline keep saying nobody was there.
   */
  const counts = useMemo(() => {
    const c = { Present: 0, Absent: 0, Late: 0, Excused: 0, Unmarked: 0 };
    const label = { present: "Present", absent: "Absent", late: "Late", excused: "Excused" };
    rows.forEach((r) => {
      const key = label[String(r.status || "").toLowerCase()];
      if (key) c[key]++;
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
          <p className="text-muted mt-2">
            Pick a date, mark <strong className="font-medium text-ink-soft">P</strong>resent ·{" "}
            <strong className="font-medium text-ink-soft">A</strong>bsent ·{" "}
            <strong className="font-medium text-ink-soft">L</strong>ate ·{" "}
            <strong className="font-medium text-ink-soft">E</strong>xcused. Saves on each click.
          </p>
          {/* Said always, not only on days it happened: the rule must be
              learned BEFORE the first surprise green row, or the register
              stops being trusted the day it appears. */}
          <p className="text-muted mt-1 text-[13px] inline-flex items-center gap-1.5">
            <DoorOpen size={13} className="flex-none text-ink-soft" aria-hidden />
            Students are marked present automatically when they open their portal — those rows
            carry this door icon, and your own marks always override them.
          </p>
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

      {/* The register must never quietly contain marks the teacher did
          not make. Students are marked present when they open their
          portal (db/tune.sql §student_mark_present) — said HERE, on the
          day it happened, with the rows flagged and one click to
          override. Silence was the biggest trust gap in the product. */}
      {rows.some((r) => r.source === "portal") && (
        <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-line bg-paper px-4 py-3">
          <DoorOpen size={15} className="flex-none mt-0.5 text-ink-soft" aria-hidden />
          <p className="text-[13px] text-ink-soft leading-relaxed">
            {rows.filter((r) => r.source === "portal").length} student
            {rows.filter((r) => r.source === "portal").length === 1 ? " was" : "s were"} marked
            present automatically by opening their student portal today — those rows carry a
            door icon. Your marks always win: click any letter to override, and the flag comes
            off.
          </p>
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
                      <div className="inline-flex items-center gap-1.5">
                        <div className="inline-flex bg-paper border border-line rounded-full p-0.5">
                          {STATUSES.map((s) => (
                            <button
                              key={s}
                              onClick={() => setStatus(r, s)}
                              title={s[0].toUpperCase() + s.slice(1)}
                              aria-label={`Mark ${r.first_name} ${r.last_name} ${s}`}
                              aria-pressed={r.status === s}
                              className={`px-3 py-1 rounded-full font-mono text-[10px] uppercase tracking-wider border transition ${
                                r.status === s
                                  ? STATUS_COLORS[s]
                                  : "border-transparent text-muted hover:text-ink"
                              }`}
                            >
                              {s[0].toUpperCase()}
                            </button>
                          ))}
                        </div>
                        {r.source === "portal" && (
                          <span
                            className="text-ink-soft"
                            title="Marked present automatically when they opened the student portal. Click a letter to override."
                          >
                            <DoorOpen size={13} aria-label="Marked by portal sign-in" />
                          </span>
                        )}
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

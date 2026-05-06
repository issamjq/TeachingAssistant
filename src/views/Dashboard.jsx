import React from "react";
import { Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const kpis = [
  { label: "This week", value: "12", caption: "lessons prepared" },
  { label: "Today", value: "4", caption: "scheduled classes" },
  { label: "Pending", value: "2", caption: "drafts to review" },
  { label: "Students", value: "118", caption: "across 4 sections" },
];

const todaySchedule = [
  { time: "08:00", name: "Photosynthesis", section: "6A", room: "Lab 2", students: 28, status: "DONE" },
  { time: "10:15", name: "Cell structure", section: "6B", room: "Room 304", students: 30, status: "LIVE NOW" },
  { time: "12:30", name: "Force & motion", section: "7A", room: "Lab 1", students: 32, status: "NEXT" },
  { time: "14:00", name: "Lab safety", section: "7B", room: "Lab 1", students: 28, status: "3:00", warning: "slides pending" },
];

const aiActivity = [
  { msg: 'Mudir drafted the **Cell structure** lesson — review when you’re ready.', time: "12m" },
  { msg: 'Quiz "**Photosynthesis basics**" auto-graded. 26/28 passed.', time: "1h" },
  { msg: "Suggested differentiation for **6B** — 4 students may need extra scaffolding.", time: "2h" },
  { msg: "Generated homework for **Force & motion**. Push to Google Classroom?", time: "3h" },
];

const pendingReview = [
  { title: "Cell structure · 6B", note: "Awaiting your review", time: "12m" },
  { title: "Force & motion homework", note: "Ready to push to Classroom", time: "3h" },
];

const statusStyles = {
  "DONE": "bg-paper-warm text-muted border-line",
  "LIVE NOW": "bg-accent text-paper-cool border-accent",
  "NEXT": "bg-paper-cool text-ink border-line",
  "3:00": "bg-paper-warm text-ink-soft border-line",
};

function HighlightedText({ text }) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 0 ? part : (
          <span key={i} className="text-accent">{part}</span>
        )
      )}
    </>
  );
}

export default function Dashboard() {
  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h1 className="font-serif text-5xl font-medium text-ink leading-tight">
            Good morning, <em className="italic text-accent">Sara</em>.
          </h1>
          <p className="text-muted mt-2">Tuesday · 4 classes today · 2 still need slides</p>
        </div>
        <div className="bg-paper-cool border border-line rounded-full px-4 py-2.5 flex items-center gap-2 w-full md:w-72">
          <Search size={15} className="text-muted" />
          <input
            placeholder="Search lessons, students…"
            className="bg-transparent outline-none text-sm w-full text-ink placeholder:text-muted"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardContent className="p-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-3">
                {k.label}
              </p>
              <p className="font-serif text-5xl font-medium text-accent leading-none mb-3">
                {k.value}
              </p>
              <p className="text-sm text-ink-soft">{k.caption}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-serif text-2xl font-medium text-ink">Today’s schedule</h2>
              <button className="text-accent hover:text-ink font-serif italic text-sm border-b border-accent hover:border-ink transition">
                View calendar →
              </button>
            </div>
            <div className="space-y-0">
              {todaySchedule.map((s, i) => (
                <div
                  key={s.time}
                  className={`flex items-start gap-4 py-4 ${
                    i < todaySchedule.length - 1 ? "border-b border-dashed border-line" : ""
                  }`}
                >
                  <span className="font-mono text-[11px] text-muted w-12 mt-1 flex-shrink-0">
                    {s.time}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-serif text-lg text-ink leading-tight">
                      {s.name} · {s.section}
                    </p>
                    <p className="text-xs text-muted mt-1">
                      {s.room} · {s.students} students
                      {s.warning && (
                        <span className="text-accent"> · {s.warning}</span>
                      )}
                    </p>
                  </div>
                  <span
                    className={`font-mono text-[10px] uppercase tracking-wider px-3 py-1 rounded-full border whitespace-nowrap flex-shrink-0 ${
                      statusStyles[s.status] || "bg-paper-cool text-ink border-line"
                    }`}
                  >
                    {s.status}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-serif text-2xl font-medium text-ink">Recent AI activity</h2>
              <button className="text-accent hover:text-ink font-serif italic text-sm border-b border-accent hover:border-ink transition">
                View all →
              </button>
            </div>
            <ul className="space-y-0">
              {aiActivity.map((a, i) => (
                <li
                  key={i}
                  className={`flex gap-3 py-4 text-sm ${
                    i < aiActivity.length - 1 ? "border-b border-dashed border-line" : ""
                  }`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-accent flex-shrink-0 mt-2" />
                  <div className="flex-1 flex items-start justify-between gap-3">
                    <p className="text-ink-soft leading-relaxed">
                      <HighlightedText text={a.msg} />
                    </p>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-muted flex-shrink-0 mt-0.5">
                      {a.time}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-6">
          <h2 className="font-serif text-2xl font-medium text-ink mb-5">Pending review</h2>
          <div className="space-y-0">
            {pendingReview.map((p, i) => (
              <div
                key={i}
                className={`flex items-center justify-between py-4 ${
                  i < pendingReview.length - 1 ? "border-b border-dashed border-line" : ""
                }`}
              >
                <div>
                  <p className="font-serif text-lg text-ink">{p.title}</p>
                  <p className="text-xs text-muted mt-0.5">{p.note}</p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
                    {p.time}
                  </span>
                  <button className="text-accent hover:text-ink font-serif italic text-sm border-b border-accent hover:border-ink transition">
                    Review →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

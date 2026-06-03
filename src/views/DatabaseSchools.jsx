import React, { useEffect, useMemo, useState } from "react";
import { MapPin, Search, Star, Trash2, Plus, Check, Building2, Pencil, GraduationCap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EMIRATES } from "../lib/schools";
import { GRADE_LEVELS, QUIZ_SECTIONS } from "../lib/enums";
import { Field, Modal, ConfirmDelete, inputClasses, selectClasses, api } from "./_shared";
import BrandLoader from "../components/BrandLoader";

// Settings → My schools tab. The full CRUD surface for a teacher's school
// list:
//   - read   : list current schools, primary flag, emirate / city / curriculum
//   - add    : pick from the UAE catalog (search + emirate filter)
//   - add    : create a new catalog entry (school not listed?)
//   - update : flip primary
//   - delete : remove from teacher's list (catalog row stays for others)
//
// The page is its own surface (no surrounding Card) so the AccountProfile
// shell can render it directly under the Tabs strip.
export default function DatabaseSchools() {
  const [mine, setMine] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [picking, setPicking] = useState(false);
  const [creating, setCreating] = useState(false);
  const [removing, setRemoving] = useState(null);
  const [editingGrades, setEditingGrades] = useState(null); // the school being edited
  const [busy, setBusy] = useState(false);

  const reload = () => {
    setLoading(true);
    api("/api/schools/mine")
      .then((rows) => { setMine(rows || []); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  };
  useEffect(reload, []);

  const onPicked = async (school) => {
    setBusy(true);
    try {
      await api("/api/schools/mine", {
        method: "POST",
        body: { school_id: school.id, is_primary: mine.length === 0 },
      });
      setPicking(false);
      reload();
    } catch (e) {
      alert(`Could not add school: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };
  const onCreated = async (payload) => {
    setBusy(true);
    try {
      const created = await api("/api/schools", { method: "POST", body: payload });
      await api("/api/schools/mine", {
        method: "POST",
        body: { school_id: created.id, is_primary: mine.length === 0 },
      });
      setCreating(false);
      reload();
    } catch (e) {
      alert(`Could not add school: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };
  const makePrimary = async (school) => {
    try {
      await api(`/api/schools/mine/${school.id}`, {
        method: "PATCH",
        body: { is_primary: true },
      });
      reload();
    } catch (e) {
      alert(`Could not update: ${e.message}`);
    }
  };
  const saveGrades = async (school, gradeSections) => {
    setBusy(true);
    try {
      await api(`/api/schools/mine/${school.id}`, {
        method: "PATCH",
        body: { grade_sections: gradeSections },
      });
      setEditingGrades(null);
      reload();
    } catch (e) {
      alert(`Could not save grades: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };
  const confirmRemove = async () => {
    setBusy(true);
    try {
      await api(`/api/schools/mine/${removing.id}`, { method: "DELETE" });
      setMine((r) => r.filter((s) => s.id !== removing.id));
      setRemoving(null);
    } catch (e) {
      alert(`Could not remove: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="mb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-2 inline-flex items-center gap-2.5">
            <span className="w-6 h-px bg-accent" /> My schools
          </p>
          <h2 className="font-serif text-4xl font-medium text-ink">
            Where you <em className="italic font-light text-accent">teach</em>
          </h2>
          <p className="text-muted mt-2 max-w-xl">
            The UAE schools you work at. New students are filed under your primary school
            by default — flip the star to change. <span className="text-ink">Each school
            has its own grades &amp; sections</span> — tap <em className="not-italic font-medium text-ink">Edit</em> on
            a card to customise what you teach there.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => setCreating(true)}>
            <Plus size={14} className="mr-1.5" /> School not listed
          </Button>
          <Button onClick={() => setPicking(true)}>
            <Plus size={14} className="mr-1.5" /> Add school
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-paper border border-accent rounded-lg p-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-accent mb-1">
            Could not load your schools
          </p>
          <p className="text-sm text-ink-soft">{error}</p>
        </div>
      )}

      {loading && <BrandLoader compact fullscreen={false} />}

      {!loading && mine.length === 0 && (
        <Card>
          <CardContent className="p-10 text-center">
            <Building2 size={28} className="mx-auto mb-3 text-muted" />
            <p className="font-serif text-2xl text-ink mb-1">No schools yet</p>
            <p className="text-sm text-muted mb-5 max-w-md mx-auto">
              Add the UAE school(s) you teach at — you can pick from the directory or add a
              custom one if yours isn't listed.
            </p>
            <Button onClick={() => setPicking(true)}>
              <Plus size={14} className="mr-1.5" /> Add your first school
            </Button>
          </CardContent>
        </Card>
      )}

      {!loading && mine.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {mine.map((s) => (
            <SchoolCard
              key={s.id}
              school={s}
              onMakePrimary={() => makePrimary(s)}
              onRemove={() => setRemoving(s)}
              onEditGrades={() => setEditingGrades(s)}
            />
          ))}
        </div>
      )}

      {picking && (
        <PickSchoolModal
          existingIds={new Set(mine.map((s) => s.id))}
          onClose={() => setPicking(false)}
          onPicked={onPicked}
          busy={busy}
        />
      )}

      {creating && (
        <CreateSchoolModal
          onClose={() => setCreating(false)}
          onCreate={onCreated}
          busy={busy}
        />
      )}

      {editingGrades && (
        <EditGradesModal
          school={editingGrades}
          onClose={() => setEditingGrades(null)}
          onSave={(gs) => saveGrades(editingGrades, gs)}
          busy={busy}
        />
      )}

      <ConfirmDelete
        open={!!removing}
        onClose={() => setRemoving(null)}
        onConfirm={confirmRemove}
        title="Remove school?"
        message={removing ? `Remove ${removing.name} from your schools? Students you've already filed under this school keep their reference; you just won't see it in your list any more.` : ""}
        busy={busy}
      />
    </div>
  );
}

function SchoolCard({ school, onMakePrimary, onRemove, onEditGrades }) {
  const gs = school.grade_sections || {};
  const grades = Object.keys(gs).filter((g) => (gs[g] || []).length > 0);

  return (
    <div className={`rounded-2xl border p-5 ${
      school.is_primary ? "border-clay/50 bg-clay/[0.04]" : "border-line bg-paper-cool"
    }`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <p className="font-serif text-lg text-ink leading-tight truncate">{school.name}</p>
          {school.name_ar && (
            <p className="text-[13px] text-ink-soft mt-0.5 truncate" dir="rtl">
              {school.name_ar}
            </p>
          )}
        </div>
        {school.is_primary && (
          <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-clay/15 text-clay text-[10px] font-mono uppercase tracking-wider">
            <Star size={9} fill="currentColor" /> Primary
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-4">
        <Meta icon={<MapPin size={11} />} label="Emirate" value={school.emirate} />
        <Meta icon={<MapPin size={11} />} label="City" value={school.city || "—"} />
        <Meta label="Type" value={school.type || "—"} />
        <Meta label="Curriculum" value={school.curriculum || "—"} />
      </div>

      {/* Per-school grades & sections. Empty state nudges the teacher
          to set them via the Edit button so the studio's class
          dropdowns scope correctly later. */}
      <div className="rounded-xl border border-line/80 bg-paper p-3 mb-3">
        <div className="flex items-center justify-between gap-2 mb-2">
          <p className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-muted inline-flex items-center gap-1.5">
            <GraduationCap size={11} /> Grades & sections
          </p>
          <button
            type="button"
            onClick={onEditGrades}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11.5px] font-medium text-ink border border-line hover:border-clay hover:text-clay hover:bg-clay/[0.04] transition-colors"
          >
            <Pencil size={11} /> Edit grades
          </button>
        </div>
        {grades.length === 0 ? (
          <p className="text-[12px] italic text-muted">
            No grades set yet — click <span className="text-ink">Edit</span> to add what you teach here.
          </p>
        ) : (
          <ul className="space-y-1">
            {grades.map((g) => (
              <li key={g} className="flex items-baseline gap-2 text-[12.5px]">
                <span className="font-mono text-[10.5px] uppercase tracking-wider text-ink w-[3.75rem] shrink-0">{g}</span>
                <span className="text-ink-soft truncate">{(gs[g] || []).join(" · ")}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex items-center gap-2 pt-3 border-t border-line/80">
        {!school.is_primary && (
          <Button variant="secondary" onClick={onMakePrimary} className="!h-8 !px-3 !text-[12px]">
            <Star size={12} className="mr-1.5" /> Make primary
          </Button>
        )}
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove school"
          className="ml-auto h-8 w-8 inline-flex items-center justify-center rounded-md border border-line bg-paper hover:bg-accent hover:border-accent hover:text-paper-cool text-ink-soft transition-colors"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

// EditGradesModal
// ─────────────────────────────────────────────────────────────────────
// Per-school grades + sections editor. Same shape as the onboarding
// scope step but standalone — the teacher picks which grades they
// teach at THIS school, then for each grade picks the sections.
//
// Save sends a single PATCH /api/schools/mine/:id with the full
// grade_sections object. Backend zod (SchoolMinePatchSchema) rejects
// anything outside { string → string[] } shape; DB CHECK
// (jsonb_typeof = 'object') is the last line.
function EditGradesModal({ school, onClose, onSave, busy }) {
  // Local working copy — only commit on Save.
  const [gs, setGs] = useState(() => {
    const init = school.grade_sections || {};
    const clean = {};
    for (const k of Object.keys(init)) {
      if (Array.isArray(init[k]) && init[k].length > 0) clean[k] = init[k];
    }
    return clean;
  });
  const selectedGrades = Object.keys(gs);

  const toggleGrade = (g) => {
    setGs((cur) => {
      if (g in cur) { const next = { ...cur }; delete next[g]; return next; }
      return { ...cur, [g]: [] };
    });
  };
  const setSectionsForGrade = (g, sections) => {
    setGs((cur) => ({ ...cur, [g]: sections }));
  };

  // Every selected grade must have at least one section before Save.
  const allFilled = selectedGrades.length > 0 &&
    selectedGrades.every((g) => (gs[g] || []).length > 0);

  return (
    <Modal
      open
      onClose={onClose}
      eyebrow={school.name}
      title="Grades & sections you teach here"
      wide
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={() => onSave(gs)} disabled={busy || !allFilled}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </>
      }
    >
      <p className="text-sm text-muted mb-4">
        Pick the grades you teach at {school.name}, then which sections inside each grade.
      </p>

      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-2">
        Grades
      </p>
      <div className="flex flex-wrap gap-1.5 mb-5">
        {GRADE_LEVELS.map((g) => {
          const on = g in gs;
          return (
            <button
              key={g}
              type="button"
              onClick={() => toggleGrade(g)}
              className={`px-3 py-1.5 rounded-full text-[12.5px] font-medium border transition-colors ${
                on
                  ? "bg-ink text-paper-cool border-ink"
                  : "bg-paper-cool text-ink border-line hover:border-ink"
              }`}
            >
              {g}
            </button>
          );
        })}
      </div>

      {selectedGrades.length > 0 && (
        <>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-2">
            Sections per grade
          </p>
          <div className="space-y-3">
            {selectedGrades.map((g) => (
              <EditSectionsRow
                key={g}
                grade={g}
                sections={gs[g] || []}
                onChange={(next) => setSectionsForGrade(g, next)}
              />
            ))}
          </div>
        </>
      )}
    </Modal>
  );
}

function EditSectionsRow({ grade, sections, onChange }) {
  const [draft, setDraft] = useState("");
  const presets = QUIZ_SECTIONS.filter((s) => s !== "All sections");
  const allOptions = useMemo(() => {
    const seen = new Set(presets);
    const extras = sections.filter((s) => !seen.has(s));
    return [...presets, ...extras];
  }, [presets, sections]);

  const toggle = (s) =>
    onChange(sections.includes(s) ? sections.filter((x) => x !== s) : [...sections, s]);
  const add = () => {
    const v = draft.trim();
    if (!v) return;
    if (!sections.includes(v)) onChange([...sections, v]);
    setDraft("");
  };
  const empty = sections.length === 0;

  return (
    <div className={`rounded-xl border p-3 transition-colors ${
      empty ? "border-clay/40 bg-clay/[0.04]" : "border-line bg-paper-cool"
    }`}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink">{grade}</p>
        <span className={`text-[11px] ${empty ? "text-clay" : "text-muted"}`}>
          {empty ? "Pick at least one section" : `${sections.length} section${sections.length > 1 ? "s" : ""}`}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {allOptions.map((s) => {
          const on = sections.includes(s);
          return (
            <button
              key={s}
              type="button"
              onClick={() => toggle(s)}
              className={`px-3 py-1.5 rounded-full text-[12px] font-medium border transition-colors ${
                on
                  ? "bg-ink text-paper-cool border-ink"
                  : "bg-paper text-ink border-line hover:border-ink"
              }`}
            >
              {s}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-2 max-w-xs">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder="e.g. Honors, Maths Track"
          className={inputClasses + " !py-1.5 !text-[12.5px]"}
        />
        <Button variant="secondary" onClick={add} disabled={!draft.trim()} className="!h-8 !px-3 !text-[12px]">
          <Plus size={12} className="mr-1" /> Add
        </Button>
      </div>
    </div>
  );
}

function Meta({ label, value, icon }) {
  return (
    <div>
      <p className="font-mono text-[9.5px] uppercase tracking-[0.15em] text-muted mb-0.5 inline-flex items-center gap-1">
        {icon}
        {label}
      </p>
      <p className="text-[12.5px] text-ink truncate">{value}</p>
    </div>
  );
}

// ── Pick from catalog ──────────────────────────────────────────────────
function PickSchoolModal({ existingIds, onClose, onPicked, busy }) {
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [search, setSearch] = useState("");
  const [emirate, setEmirate] = useState("");

  useEffect(() => {
    api("/api/schools")
      .then((rows) => { setCatalog(rows || []); setLoading(false); })
      .catch((e) => { setErr(e.message); setLoading(false); });
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return catalog.filter((s) => {
      if (emirate && s.emirate !== emirate) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        (s.name_ar || "").includes(q) ||
        (s.city || "").toLowerCase().includes(q) ||
        s.emirate.toLowerCase().includes(q)
      );
    }).slice(0, 60);
  }, [catalog, search, emirate]);

  return (
    <Modal
      open
      onClose={onClose}
      eyebrow="Add school"
      title="Pick from the UAE directory"
      wide
      footer={<Button variant="secondary" onClick={onClose}>Done</Button>}
    >
      <div className="relative mb-3">
        <Search size={18} strokeWidth={2.25} className="absolute top-1/2 -translate-y-1/2 left-4 text-ink-soft pointer-events-none rtl:left-auto rtl:right-4" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by school name, emirate, or city…"
          className="w-full !pl-12 pr-4 py-3.5 rounded-xl border-2 border-line bg-paper text-ink text-[16px] font-medium outline-none transition-all placeholder:text-muted placeholder:font-normal focus:border-clay focus:shadow-[0_0_0_4px_rgba(200,71,43,0.10)] rtl:!pl-4 rtl:!pr-12"
          autoFocus
        />
      </div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        <button
          type="button"
          onClick={() => setEmirate("")}
          className={`px-3 py-1 rounded-full text-[11.5px] font-medium border transition-colors ${
            emirate === "" ? "bg-ink text-paper-cool border-ink" : "bg-paper-cool text-ink border-line hover:border-ink"
          }`}
        >
          All emirates
        </button>
        {EMIRATES.map((em) => {
          const on = emirate === em;
          return (
            <button
              key={em}
              type="button"
              onClick={() => setEmirate(on ? "" : em)}
              className={`px-3 py-1 rounded-full text-[11.5px] font-medium border transition-colors ${
                on ? "bg-ink text-paper-cool border-ink" : "bg-paper-cool text-ink border-line hover:border-ink"
              }`}
            >
              {em}
            </button>
          );
        })}
      </div>

      {loading ? (
        <BrandLoader compact fullscreen={false} />
      ) : err ? (
        <p className="text-sm text-accent">{err}</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted italic">No schools match your search.</p>
      ) : (
        <ul className="max-h-[360px] overflow-y-auto rounded-xl border border-line divide-y divide-line/70">
          {filtered.map((s) => {
            const on = existingIds.has(s.id);
            return (
              <li key={s.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] text-ink truncate">{s.name}</p>
                  <p className="text-[11px] text-muted truncate">
                    {s.emirate}{s.city ? ` · ${s.city}` : ""}
                    {s.curriculum ? ` · ${s.curriculum}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onPicked(s)}
                  disabled={on || busy}
                  className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11.5px] font-medium border transition-colors ${
                    on
                      ? "bg-sage/15 text-sage border-sage/40 cursor-default"
                      : "bg-paper-cool text-ink border-line hover:border-ink disabled:opacity-50"
                  }`}
                >
                  {on ? (<><Check size={11} /> Added</>) : (<><Plus size={11} /> Add</>)}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}

// ── Custom catalog entry ───────────────────────────────────────────────
function CreateSchoolModal({ onClose, onCreate, busy }) {
  const [form, setForm] = useState({
    name: "",
    name_ar: "",
    emirate: "Dubai",
    city: "",
    type: "",
    curriculum: "",
  });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const can = form.name.trim().length > 0 && !!form.emirate;
  return (
    <Modal
      open
      onClose={onClose}
      eyebrow="Add school"
      title="Add a school not in the directory"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={() => onCreate(form)} disabled={!can || busy}>
            {busy ? "Adding…" : "Add school"}
          </Button>
        </>
      }
    >
      <p className="text-sm text-muted mb-4">
        Type the school's details below. We'll add it to the directory so other teachers
        from the same school can find it too.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="School name (English)">
          <input className={inputClasses} value={form.name} onChange={(e) => set("name", e.target.value)} autoFocus />
        </Field>
        <Field label="School name (Arabic)" hint="optional">
          <input className={inputClasses} value={form.name_ar} onChange={(e) => set("name_ar", e.target.value)} dir="rtl" />
        </Field>
        <Field label="Emirate">
          <select className={selectClasses} value={form.emirate} onChange={(e) => set("emirate", e.target.value)}>
            {EMIRATES.map((em) => <option key={em} value={em}>{em}</option>)}
          </select>
        </Field>
        <Field label="City / area" hint="optional">
          <input className={inputClasses} value={form.city} onChange={(e) => set("city", e.target.value)} />
        </Field>
        <Field label="Type" hint="optional">
          <select className={selectClasses} value={form.type} onChange={(e) => set("type", e.target.value)}>
            <option value="">—</option>
            <option value="Public">Public</option>
            <option value="Private">Private</option>
          </select>
        </Field>
        <Field label="Curriculum" hint="optional">
          <select className={selectClasses} value={form.curriculum} onChange={(e) => set("curriculum", e.target.value)}>
            <option value="">—</option>
            {["MOE", "British", "American", "IB", "Indian", "French", "Other"].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </Field>
      </div>
    </Modal>
  );
}

import React, { useEffect, useMemo, useState } from "react";
import { MapPin, Search, Star, Trash2, Plus, Check, Building2, Pencil, GraduationCap, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EMIRATES } from "../lib/schools";
import { GRADE_LEVELS, QUIZ_SECTIONS } from "../lib/enums";
import { Field, Modal, ConfirmDelete, inputClasses, selectClasses, api } from "./_shared";
import BrandLoader from "../components/BrandLoader";
import { useT } from "../lib/i18n";

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
  const t = useT();
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
      // POST returns the full attached row (id, name, grade_sections…).
      const row = await api("/api/schools/mine", {
        method: "POST",
        body: { school_id: school.id, is_primary: mine.length === 0 },
      });
      setPicking(false);
      reload();
      // Flow like onboarding: instead of dropping a bare school card and
      // making the teacher hunt for "Edit grades", drop them straight
      // into the grades & sections chips for the school they just added.
      setEditingGrades(row && row.id ? row : { ...school, grade_sections: {} });
    } catch (e) {
      alert(t("sc2.err.add", { msg: e.message }));
    } finally {
      setBusy(false);
    }
  };
  const onCreated = async (payload) => {
    setBusy(true);
    try {
      const created = await api("/api/schools", { method: "POST", body: payload });
      const row = await api("/api/schools/mine", {
        method: "POST",
        body: { school_id: created.id, is_primary: mine.length === 0 },
      });
      setCreating(false);
      reload();
      // Same onboarding-style continuation: configure grades/sections now.
      setEditingGrades(row && row.id ? row : { ...created, grade_sections: {} });
    } catch (e) {
      alert(t("sc2.err.add", { msg: e.message }));
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
      alert(t("sc2.err.update", { msg: e.message }));
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
      alert(t("sc2.err.grades", { msg: e.message }));
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
      alert(t("sc2.err.remove", { msg: e.message }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="mb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-2 inline-flex items-center gap-2.5">
            <span className="w-6 h-px bg-accent" /> {t("sc2.eyebrow")}
          </p>
          <h2 className="font-serif text-4xl font-medium text-ink">
            {t("sc2.titleA")} <em className="italic font-light text-accent">{t("sc2.titleEm")}</em>
          </h2>
          <p className="text-muted mt-2 max-w-xl">
            {t("sc2.leadA")} <span className="text-ink">{t("sc2.leadB")}</span> {t("sc2.leadC")} <em className="not-italic font-medium text-ink">{t("common.edit")}</em> {t("sc2.leadD")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => setCreating(true)}>
            <Plus size={14} className="mr-1.5" /> {t("sc2.notListed")}
          </Button>
          <Button onClick={() => setPicking(true)}>
            <Plus size={14} className="mr-1.5" /> {t("sc2.add")}
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-paper border border-accent rounded-lg p-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-accent mb-1">
            {t("sc2.loadError")}
          </p>
          <p className="text-sm text-ink-soft">{error}</p>
        </div>
      )}

      {loading && <BrandLoader compact fullscreen={false} />}

      {!loading && mine.length === 0 && (
        <Card>
          <CardContent className="p-10 text-center">
            <Building2 size={28} className="mx-auto mb-3 text-muted" />
            <p className="font-serif text-2xl text-ink mb-1">{t("sc2.emptyTitle")}</p>
            <p className="text-sm text-muted mb-5 max-w-md mx-auto">
              {t("sc2.emptyBody")}
            </p>
            <Button onClick={() => setPicking(true)}>
              <Plus size={14} className="mr-1.5" /> {t("sc2.addFirst")}
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
        title={t("sc2.removeTitle")}
        message={removing ? t("sc2.removeMsg", { name: removing.name }) : ""}
        busy={busy}
      />
    </div>
  );
}

function SchoolCard({ school, onMakePrimary, onRemove, onEditGrades }) {
  const t = useT();
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
            <Star size={9} fill="currentColor" /> {t("sc2.primary")}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-4">
        <Meta icon={<MapPin size={11} />} label={t("sc2.m.emirate")} value={school.emirate} />
        <Meta icon={<MapPin size={11} />} label={t("sc2.m.city")} value={school.city || t("common.none")} />
        <Meta label={t("sc2.m.type")} value={school.type ? t(`sc2.type.${school.type.toLowerCase()}`) : t("common.none")} />
        <Meta label={t("sc2.m.curriculum")} value={school.curriculum || t("common.none")} />
      </div>

      {/* Per-school grades & sections. Empty state nudges the teacher
          to set them via the Edit button so the studio's class
          dropdowns scope correctly later. */}
      <div className="rounded-xl border border-line/80 bg-paper p-3 mb-3">
        <div className="flex items-center justify-between gap-2 mb-2">
          <p className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-muted inline-flex items-center gap-1.5">
            <GraduationCap size={11} /> {t("sc2.gradesTitle")}
          </p>
          <button
            type="button"
            onClick={onEditGrades}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11.5px] font-medium text-ink border border-line hover:border-clay hover:text-clay hover:bg-clay/[0.04] transition-colors"
          >
            <Pencil size={11} /> {t("sc2.editGrades")}
          </button>
        </div>
        {grades.length === 0 ? (
          <p className="text-[12px] italic text-muted">
            {t("sc2.noGrades")} <span className="text-ink">{t("common.edit")}</span> {t("sc2.noGradesB")}
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
            <Star size={12} className="mr-1.5" /> {t("sc2.makePrimary")}
          </Button>
        )}
        <button
          type="button"
          onClick={onRemove}
          aria-label={t("sc2.removeSchool")}
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
  const t = useT();
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
      title={t("sc2.gradesModal")}
      wide
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>{t("common.cancel")}</Button>
          <Button onClick={() => onSave(gs)} disabled={busy || !allFilled}>
            {busy ? t("sch.saving") : t("common.save")}
          </Button>
        </>
      }
    >
      <p className="text-sm text-muted mb-4">
        {t("sc2.gradesLead", { name: school.name })}
      </p>

      {/* Grade picker FIRST — tapping a grade reveals its section row
          directly BELOW (natural reading order), not above the picker.
          Unpicked grades hide behind this dashed "Add another grade" row
          so the teacher isn't staring at a wall of 14 grade chips. */}
      {(() => {
        const remaining = GRADE_LEVELS.filter((g) => !(g in gs));
        if (remaining.length === 0) return null;
        const allOn = selectedGrades.length === GRADE_LEVELS.length;
        const setAll = () => {
          if (allOn) {
            setGs({});
          } else {
            setGs((cur) => {
              const next = { ...cur };
              for (const g of GRADE_LEVELS) if (!(g in next)) next[g] = [];
              return next;
            });
          }
        };
        return (
          <div className="rounded-xl border border-dashed border-line bg-paper-cool/40 p-3.5">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-2.5 inline-flex items-center gap-1.5">
              <Plus size={11} strokeWidth={2.5} />
              {selectedGrades.length === 0 ? t("sc2.tapGrade") : t("sc2.addGrade")}
            </p>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={setAll}
                aria-pressed={allOn}
                className={`px-3 py-1.5 rounded-full text-[12.5px] font-semibold border transition-colors ${
                  allOn
                    ? "bg-accent text-paper-cool border-accent"
                    : "bg-paper-cool text-accent border-accent hover:bg-accent/10"
                }`}
              >
                {t("sc2.allGrades")}
              </button>
              {remaining.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => toggleGrade(g)}
                  className="px-3 py-1.5 rounded-full text-[12.5px] font-medium border bg-paper text-ink border-line hover:border-ink transition-colors"
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
        );
      })()}

      {selectedGrades.length > 0 && (
        <div className="space-y-3 mt-4">
          {selectedGrades.map((g) => (
            <EditSectionsRow
              key={g}
              grade={g}
              sections={gs[g] || []}
              onChange={(next) => setSectionsForGrade(g, next)}
              onRemove={() => toggleGrade(g)}
            />
          ))}
        </div>
      )}
    </Modal>
  );
}

function EditSectionsRow({ grade, sections, onChange, onRemove }) {
  const t = useT();
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
        <div className="inline-flex items-center gap-2 min-w-0">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink">{grade}</p>
          <span className={`text-[11px] ${empty ? "text-clay" : "text-muted"}`}>
            · {empty
              ? t("sc2.pickSection")
              : t(sections.length === 1 ? "sc2.sectionCount" : "sc2.sectionCountPlural", { n: sections.length })}
          </span>
        </div>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            title={t("sc2.removeGrade")}
            aria-label={`Remove ${grade}`}
            className="shrink-0 h-7 w-7 inline-flex items-center justify-center rounded-md text-ink-soft hover:bg-accent hover:text-paper-cool transition"
          >
            <X size={12} />
          </button>
        )}
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
          placeholder={t("sc2.customSection")}
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
  const t = useT();
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
      title={t("sc2.dirTitle")}
      wide
      footer={<Button variant="secondary" onClick={onClose}>{t("sc2.done")}</Button>}
    >
      <div className="relative mb-3">
        <Search size={18} strokeWidth={2.25} className="absolute top-1/2 -translate-y-1/2 left-4 text-ink-soft pointer-events-none rtl:left-auto rtl:right-4" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("sc2.dirSearch")}
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
          {t("sc2.allEmirates")}
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
        <p className="text-sm text-muted italic">{t("sc2.dirNoMatch")}</p>
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
                  {on ? (<><Check size={11} /> {t("sc2.added")}</>) : (<><Plus size={11} /> {t("sc2.addBtn")}</>)}
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
  const t = useT();
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
      title={t("sc2.customTitle")}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>{t("common.cancel")}</Button>
          <Button onClick={() => onCreate(form)} disabled={!can || busy}>
            {busy ? t("sc2.adding") : t("sc2.add")}
          </Button>
        </>
      }
    >
      <p className="text-sm text-muted mb-4">
        Type the school's details below. We'll add it to the directory so other teachers
        from the same school can find it too.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label={t("sc2.f.nameEn")}>
          <input className={inputClasses} value={form.name} onChange={(e) => set("name", e.target.value)} autoFocus />
        </Field>
        <Field label={t("sc2.f.nameAr")} hint={t("sc2.f.optional")}>
          <input className={inputClasses} value={form.name_ar} onChange={(e) => set("name_ar", e.target.value)} dir="rtl" />
        </Field>
        <Field label={t("sc2.f.emirate")}>
          <select className={selectClasses} value={form.emirate} onChange={(e) => set("emirate", e.target.value)}>
            {EMIRATES.map((em) => <option key={em} value={em}>{em}</option>)}
          </select>
        </Field>
        <Field label={t("sc2.f.city")} hint={t("sc2.f.optional")}>
          <input className={inputClasses} value={form.city} onChange={(e) => set("city", e.target.value)} />
        </Field>
        <Field label={t("sc2.f.type")} hint={t("sc2.f.optional")}>
          <select className={selectClasses} value={form.type} onChange={(e) => set("type", e.target.value)}>
            <option value="">—</option>
            <option value="Public">{t("sc2.type.public")}</option>
            <option value="Private">{t("sc2.type.private")}</option>
          </select>
        </Field>
        <Field label={t("sc2.f.curriculum")} hint={t("sc2.f.optional")}>
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

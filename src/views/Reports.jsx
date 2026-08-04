import React, { useEffect, useState } from "react";
import { FileDown, FileSpreadsheet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { api } from "./_shared";
import { useT } from "../lib/i18n";

export default function Reports() {
  const t = useT();
  const [summary, setSummary] = useState([]);
  const [counts, setCounts] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api("/api/grades/summary").then(setSummary).catch((e) => setError(e.message));
    api("/api/dashboard").then((d) => setCounts(d.counts)).catch(() => {});
  }, []);

  const exportCsv = () => {
    const rows = [
      [
        t("rep.csv.studentId"), t("rep.csv.firstName"), t("rep.csv.lastName"),
        t("rep.csv.grade"), t("rep.csv.section"), t("rep.csv.entries"), t("rep.csv.averagePct"),
      ].join(","),
      ...summary.map((s) => [
        s.student_id, s.first_name, s.last_name, s.grade, s.section, s.entries, s.average_pct,
      ].join(",")),
    ];
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `murchid-grades-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Open the browser print dialog. Combined with the @media print rules below,
  // this gives the user a clean PDF via "Save as PDF" without bundling a
  // PDF library.
  const exportPdf = () => window.print();

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-2 inline-flex items-center gap-2.5">
            <span className="w-6 h-px bg-accent" /> {t("rep.eyebrow")}
          </p>
          <h2 className="font-serif text-4xl font-medium text-ink">
            {t("rep.titleA")} <em className="italic font-light text-accent">{t("rep.titleEm")}</em>
          </h2>
          <p className="text-muted mt-2">{t("rep.lead")}</p>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={exportCsv} className="print:hidden">
            <FileSpreadsheet size={14} className="mr-2" /> {t("rep.exportCsv")}
          </Button>
          <Button variant="secondary" onClick={exportPdf} className="print:hidden">
            <FileDown size={14} className="mr-2" /> {t("rep.exportPdf")}
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-paper border border-accent rounded-lg p-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-accent">{error}</p>
        </div>
      )}

      {counts && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
          {[
            ["students", counts.students],
            ["lessons", counts.drafts],
            ["templates", counts.templates],
            ["quizzes", counts.quizzes],
            ["homework", counts.homework],
            ["slides", counts.presentations],
            ["activities", counts.activities],
          ].map(([key, value]) => (
            <Card key={key}>
              <CardContent className="p-4">
                <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted mb-1">{t(`rep.c.${key}`)}</p>
                <p className="font-serif text-3xl font-medium text-accent leading-none">{value ?? "—"}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardContent>
          <div className="px-5 pt-5 pb-3 border-b border-line">
            <h3 className="font-serif text-2xl font-medium text-ink">{t("rep.avgTitle")}</h3>
            <p className="text-sm text-muted mt-1">{t("rep.avgLead")}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted border-b border-line">
                  <th className="text-left py-3 px-5 font-medium">{t("rep.col.student")}</th>
                  <th className="text-left py-3 font-medium">{t("rep.col.class")}</th>
                  <th className="text-left py-3 font-medium">{t("rep.col.entries")}</th>
                  <th className="text-left py-3 px-5 font-medium">{t("rep.col.average")}</th>
                </tr>
              </thead>
              <tbody>
                {summary.map((s) => (
                  <tr key={s.student_id} className="border-b border-line/60 last:border-0 hover:bg-paper-warm transition">
                    <td className="py-3 px-5 text-ink">{s.first_name} {s.last_name}</td>
                    <td className="py-3 text-muted">{s.grade}{s.section ? ` · ${s.section}` : ""}</td>
                    <td className="py-3 text-ink-soft">{s.entries}</td>
                    <td className="py-3 px-5">
                      <div className="flex items-center gap-3">
                        <div className="w-32 h-1.5 bg-paper-warm rounded-full overflow-hidden border border-line">
                          <div
                            className={`h-full ${Number(s.average_pct) >= 70 ? "bg-sage" : Number(s.average_pct) >= 50 ? "bg-ink" : "bg-accent"}`}
                            style={{ width: `${Math.max(0, Math.min(100, Number(s.average_pct)))}%` }}
                          />
                        </div>
                        <span className="font-mono text-[11px] text-ink-soft w-12">{s.average_pct}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
                {summary.length === 0 && (
                  <tr><td colSpan={4} className="py-8 text-center text-muted">{t("rep.empty")}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

// Super-admin Organisations dashboard — the schools teaching happens at,
// with their teacher/student/content counts and the work they're producing.
// Reads the is_super_admin()-gated sa_orgs_* RPCs; no writes.

import React, { useEffect, useMemo, useState } from "react";
import { Building2, GraduationCap, Users, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { DonutChart, BarChart } from "../components/MiniCharts";
import { api } from "./_shared";
import { Skeleton } from "@/components/ui/skeleton";
import { Header, Kpi, ChartHeader, Empty, ErrorBox } from "./SuperAdminStudents";

export default function SuperAdminOrgs() {
  const [ov, setOv] = useState(null);
  const [rows, setRows] = useState([]);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([
      api("/api/superadmin/orgs-overview"),
      api("/api/superadmin/orgs?limit=100"),
      api("/api/superadmin/org-activity?limit=20"),
    ])
      .then(([o, r, a]) => { setOv(o); setRows(r); setActivity(a); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, []);

  const emirateSegs = useMemo(
    () => Object.entries(ov?.by_emirate || {}).map(([label, value]) => ({ label, value })),
    [ov]
  );
  const topBars = useMemo(
    () => rows.slice(0, 8).map((o) => ({ label: o.name, value: o.teachers + o.students })),
    [rows]
  );

  if (loading && !ov) return <OrgsSkeleton />;
  if (error) return <ErrorBox message={error} />;

  return (
    <div className="space-y-6 md:space-y-8">
      <Header
        eyebrow="Super admin"
        title="Organisations"
        lead="The schools teaching happens at — their teachers, students, and the work they produce."
      />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <Kpi icon={<Building2 size={14} />} label="Active orgs" value={ov.active_orgs} sub="with teachers/students" accent={ov.active_orgs > 0} />
        <Kpi icon={<GraduationCap size={14} />} label="Teachers" value={ov.teachers} sub="placed in a school" />
        <Kpi icon={<Users size={14} />} label="Students" value={ov.students} sub="placed in a school" />
        <Kpi icon={<Building2 size={14} />} label="Catalog" value={ov.catalog} sub="schools listed" />
        <Kpi icon={<GraduationCap size={14} />} label="Independent" value={ov.unaffiliated_teachers} sub="no school set" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardContent>
            <ChartHeader label="Organisations" sub="by emirate" />
            {emirateSegs.length ? <DonutChart segments={emirateSegs} centerLabel="Orgs" /> : <Empty>No organisations yet</Empty>}
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <ChartHeader label="Largest" sub="teachers + students, top 8" />
            {topBars.length ? <BarChart data={topBars} /> : <Empty>No organisations yet</Empty>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent>
          <ChartHeader label="Activity" sub="What organisations are producing — latest work" />
          <ul className="divide-y divide-line/60">
            {activity.length === 0 && <li className="py-4 text-sm text-muted">No work yet.</li>}
            {activity.map((a) => (
              <li key={a.id} className="py-3 flex items-center gap-3 text-sm">
                <span className="text-ink truncate flex-1 min-w-0">
                  <span className="text-muted">{a.org} · </span>
                  {a.first_name ? `${a.first_name} ${a.last_name || ""}`.trim() : "—"} made “{a.title}”
                </span>
                <span className="font-mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border border-line text-muted bg-paper whitespace-nowrap">
                  {a.type}
                </span>
                <time className="font-mono text-[10px] text-muted whitespace-nowrap">
                  {a.created_at ? new Date(a.created_at).toLocaleDateString() : ""}
                </time>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <ChartHeader label="All organisations" sub="Largest first" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted border-b border-line">
                  <th className="text-left py-3 px-2 font-medium">Organisation</th>
                  <th className="text-left py-3 font-medium">Emirate</th>
                  <th className="text-left py-3 font-medium">Curriculum</th>
                  <th className="text-left py-3 font-medium">Teachers</th>
                  <th className="text-left py-3 font-medium">Students</th>
                  <th className="text-left py-3 font-medium">Content</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((o) => (
                  <tr key={o.id} className="border-b border-line/60 last:border-0 hover:bg-paper-warm transition">
                    <td className="py-3 px-2 text-ink">{o.name}</td>
                    <td className="py-3 text-muted text-xs">{o.emirate || "—"}</td>
                    <td className="py-3 text-muted text-xs">{o.curriculum || "—"}</td>
                    <td className="py-3 text-ink">{o.teachers}</td>
                    <td className="py-3 text-ink">{o.students}</td>
                    <td className="py-3 text-ink">{o.content}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={6} className="py-12 text-center text-muted">No organisations yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function OrgsSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-64" />
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-56 w-full rounded-xl" />
        <Skeleton className="h-56 w-full rounded-xl" />
      </div>
    </div>
  );
}

"use client";

import Database from "@/views/Database";

// /database/:tab — students · scores · attendance · grades · profile ·
// schools. Database owns the tab chrome; the segment only supplies which
// tab is active. Defaults to students, matching the sidebar link.
export default function DatabaseRoute({ slug = [] }: { slug?: string[] }) {
  return <Database sub={slug[0] || "students"} />;
}

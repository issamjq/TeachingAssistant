import type { Metadata } from "next";
import SuperAdminProduct from "@/views/SuperAdminProduct";

// Role-gated surface. StudioShell bounces any section not in
// SECTIONS_BY_ROLE for the signed-in role, and every sa_product_* /
// sa_click_heatmap RPC is re-gated by sa_gate('admin.analytics') in the
// database — so this segment carries no authorisation logic of its own.
export const metadata: Metadata = {
  title: "Usage — Murchid",
  robots: { index: false, follow: false },
};

export default function SuperadminProductPage() {
  return <SuperAdminProduct />;
}

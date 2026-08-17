import type { Metadata } from "next";
import TemplateLibraryRoute from "@/features/template-library";

export const metadata: Metadata = { title: "Template library — Murchid" };

export default function LibraryPage() {
  return <TemplateLibraryRoute />;
}

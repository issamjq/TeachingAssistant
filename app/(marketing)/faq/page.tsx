import { redirect } from "next/navigation";

// See the note in ../pricing/page.tsx. Kept as a redirect onto the anchor.
export default function FaqPage() {
  redirect("/#questions");
}

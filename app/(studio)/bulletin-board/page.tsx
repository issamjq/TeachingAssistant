import type { Metadata } from "next";
import ComingSoon from "@/features/studio-shell/ComingSoon";

export const metadata: Metadata = { title: "Bulletin board — Murchid" };

export default function BulletinBoardPage() {
  return <ComingSoon section="bulletin-board" label="Bulletin board" />;
}

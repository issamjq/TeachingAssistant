import type { Metadata } from "next";
import { BulletinBoardRoute } from "@/features/bulletin-board";

export const metadata: Metadata = { title: "Bulletin board — Murchid" };

export default function BulletinBoardPage() {
  return <BulletinBoardRoute />;
}

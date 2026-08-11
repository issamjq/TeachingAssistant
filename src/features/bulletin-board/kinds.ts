import { BellRing, CalendarDays, Megaphone, PartyPopper } from "lucide-react";
import type { TranslationKey } from "@/shared/i18n";
import type { BulletinKind } from "./types";

// The four things a teacher pins up.
//
// Tints are literal, muted, and deliberately NOT the status tokens —
// same reasoning as the planner's: a reminder drawn in the danger red
// reads as a problem rather than as a reminder. Four fixed hues, far
// enough apart to tell at the size of a chip dot.
export const KINDS: {
  key: BulletinKind;
  labelKey: TranslationKey;
  icon: typeof Megaphone;
  tint: string;
}[] = [
  { key: "notice",      labelKey: "bb.kind.notice",      icon: Megaphone,    tint: "#16646c" },
  { key: "event",       labelKey: "bb.kind.event",       icon: CalendarDays, tint: "#8a6a2f" },
  { key: "reminder",    labelKey: "bb.kind.reminder",    icon: BellRing,     tint: "#5b5480" },
  { key: "celebration", labelKey: "bb.kind.celebration", icon: PartyPopper,  tint: "#8a4f6d" },
];

export const KIND_BY_KEY = Object.fromEntries(KINDS.map((k) => [k.key, k])) as Record<
  BulletinKind,
  (typeof KINDS)[number]
>;

export const tintOf = (kind: BulletinKind) => KIND_BY_KEY[kind]?.tint || "var(--p-muted)";

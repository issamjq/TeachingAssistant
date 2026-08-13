// Kind → icon, shared by all ten designs.
//
// Which icon stands for a quiz is a product fact, not a design decision:
// if two previews disagreed about it you would be comparing icon sets.

import {
  ClipboardCheck, FileText, GraduationCap, MonitorPlay, Puzzle,
  type LucideIcon,
} from "lucide-react";
import type { Kind } from "./fixture";

export const KIND_ICON: Record<Kind, LucideIcon> = {
  lesson_plan: FileText,
  quiz: GraduationCap,
  homework: ClipboardCheck,
  presentation: MonitorPlay,
  activity: Puzzle,
};

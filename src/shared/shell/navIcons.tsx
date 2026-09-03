// =====================================================================
// Nav icons, and the badge that draws one
//
// Lifted out of StudioShell for two reasons. It was 611 counted lines and
// the budget is 600 — but more usefully, studio-previews/StudioFrame.tsx
// carried its own copy of this map. The two never disagreed: StudioFrame's
// thirteen entries were a strict subset of the studio's twenty-nine, with
// identical icons. One map now, in shared/, because two features need it
// and features must not import each other.
// =====================================================================

import {
  Activity, BarChart3, BookOpen, Briefcase, Building2, CalendarClock,
  CalendarRange, ClipboardCheck, Coins, Cpu, FileText, GraduationCap,
  KeyRound, KeySquare, Landmark, Layers, LayoutDashboard, LibraryBig,
  MonitorPlay, PenLine, Pin, Puzzle, ShieldCheck, Sparkles, Tag, Target,
  Terminal, TriangleAlert, Users,
  type LucideIcon,
} from "lucide-react";

// Semantic key → icon. Letters were placeholders from before the nav
// had a design; an icon says what a place IS before the label is read,
// which a mono "H" never did.
export const NAV_ICON: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  studio: Sparkles,
  scheduler: CalendarRange,
  // The weekly teaching grid — the surface where work is delivered.
  timetable: CalendarClock,
  goals: Target,
  library: LibraryBig,
  materials: FileText,
  lessons: BookOpen,
  quizzes: ClipboardCheck,
  homework: PenLine,
  presentations: MonitorPlay,
  activities: Puzzle,
  bulletin: Pin,
  students: Users,
  subjects: Layers,
  skills: GraduationCap,
  reports: BarChart3,
  keys: KeyRound,
  coins: Coins,
  orgs: Building2,
  activity: Activity,
  friction: TriangleAlert,
  shield: ShieldCheck,
  ministry: Landmark,
  owner: Briefcase,
  terminal: Terminal,
  // Tokens and pricing both used to be `coins`, which made Revenue and
  // Credit costs indistinguishable in a rail read at a glance. One is
  // what the models burn, the other is the price list.
  tokens: Cpu,
  pricing: Tag,
  // Distinct from `keys` (Accounts) on purpose: two identical keys in a
  // rail read at a glance identify neither.
  keypool: KeySquare,
};

export function NavBadge({ letter, icon }: { letter?: string; icon?: string }) {
  const Icon = icon ? NAV_ICON[icon] : undefined;
  if (Icon) {
    return (
      <span className="murchid-nav-badge" aria-hidden>
        <Icon size={15} strokeWidth={1.9} />
      </span>
    );
  }
  // Anything unmapped keeps the letter rather than a blank square.
  return (
    <span className="murchid-nav-badge" aria-hidden>
      {letter || icon}
    </span>
  );
}

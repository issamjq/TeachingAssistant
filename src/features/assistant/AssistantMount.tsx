"use client";

// Client boundary for the assistant, so the route-group layouts can stay
// server components. In the studio it can also MOVE the teacher — the
// widget detects "open X" itself (no model needed for that), and this is
// the only place holding a router to act on it.
import { useRouter } from "next/navigation";
import AssistantWidget from "./AssistantWidget";

const ROUTES: Record<string, string> = {
  dashboard: "/dashboard",
  studio: "/studio",
  planner: "/planner",
  goals: "/goals",
  "lesson-plans": "/lesson-plans",
  quizzes: "/quizzes",
  homework: "/homework",
  presentations: "/presentations",
  activities: "/activities",
  "bulletin-board": "/bulletin-board",
  database: "/database/students",
  reports: "/reports",
  schedule: "/schedule",
  account: "/account",
};

export default function AssistantMount({ scope = "landing" }: { scope?: "landing" | "studio" }) {
  const router = useRouter();
  return (
    <AssistantWidget
      scope={scope}
      onNavigate={(section: string) => {
        const path = ROUTES[section];
        if (path) router.push(path);
      }}
    />
  );
}

"use client";

// Client boundary for the assistant, so the route-group layouts can stay
// server components. Its only job beyond mounting the widget is to give
// the assistant a way to move the teacher around the studio — the
// `navigate` tool returns a destination, and only a client component
// holding the router can act on it.
import { useRouter } from "next/navigation";
import AssistantWidget from "./AssistantWidget";

/** Tool destinations → real routes. Anything unknown is ignored. */
const ROUTES: Record<string, string> = {
  dashboard: "/dashboard",
  planner: "/planner",
  "lesson-plans": "/lesson-plans",
  quizzes: "/quizzes",
  homework: "/homework",
  presentations: "/presentations",
  activities: "/activities",
  students: "/students",
  schedule: "/schedule",
  settings: "/settings",
};

export default function AssistantMount({ scope = "landing" }: { scope?: "landing" | "studio" }) {
  const router = useRouter();
  return (
    <AssistantWidget
      scope={scope}
      onNavigate={(where: string) => {
        const path = ROUTES[where];
        if (path) router.push(path);
      }}
    />
  );
}

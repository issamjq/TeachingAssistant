"use client";

import { useEffect, useState } from "react";
import {
  RouterBridge,
  useRoute,
  navigate,
  replace,
  clearRoute,
  setNavGuard,
} from "@/lib/route";

// See page.tsx for why this harness exists. Non-production only.

export default function NavProbe() {
  const route = useRoute();
  const [guarded, setGuarded] = useState(false);
  const [held, setHeld] = useState<null | (() => void)>(null);

  // Mirrors how a view registers an unsaved-work guard: return
  // false to hold the transition, stash `proceed`, and run it later once the
  // user confirms.
  useEffect(() => {
    if (!guarded) return;
    return setNavGuard((proceed) => {
      setHeld(() => proceed);
      return false;
    });
  }, [guarded]);

  return (
    <div style={{ padding: 24, fontFamily: "monospace" }}>
      <RouterBridge />
      <h1>nav probe</h1>

      {/* Serialised so a test can assert useRoute() parsed the pathname
          into the same shape a cold load would produce. */}
      <pre data-testid="route">{JSON.stringify(route)}</pre>
      <pre data-testid="guard-held">{held ? "held" : "none"}</pre>

      <button data-testid="go-quizzes" onClick={() => navigate(["quizzes"])}>
        navigate /quizzes
      </button>
      <button
        data-testid="go-edit"
        onClick={() => navigate(["lesson-plans", "edit", 42])}
      >
        navigate /lesson-plans/edit/42
      </button>
      <button
        data-testid="replace-homework"
        onClick={() => replace(["homework"])}
      >
        replace /homework
      </button>
      <button data-testid="go-root" onClick={() => clearRoute()}>
        clearRoute
      </button>

      <hr />

      <button data-testid="arm-guard" onClick={() => setGuarded(true)}>
        arm guard
      </button>
      <button
        data-testid="release-guard"
        onClick={() => {
          held?.();
          setHeld(null);
        }}
      >
        release guard
      </button>
    </div>
  );
}

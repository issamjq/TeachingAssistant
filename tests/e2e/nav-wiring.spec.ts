import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { SECTIONS_BY_ROLE, DEFAULT_ROUTE } from "@/config/nav";

// Every destination a teacher can click must actually be reachable.
//
// This file exists because of a specific bug that reached a browser: a new
// section was added to the rail with a real route and a real page.tsx, and
// clicking it went to the dashboard. Nothing was broken in the route — the
// route was fine. StudioShell redirects any section the role does not hold:
//
//     if (!allowedSections.has(section)) replace([homeRoute]);
//
// ...and the new section was not in SECTIONS_BY_ROLE. Typecheck passed,
// lint passed, the build listed the route, and the click still went to the
// wrong page, because nothing anywhere asserts that these three lists agree.
//
// That is a whole class of bug: a destination is wired in three places —
// the nav, the filesystem, and the permission set — and any two of them
// agreeing is not enough. It is invisible to every check the repo had, and
// it is silent, because the redirect looks like a deliberate one.
//
// So this asserts the three agree, without a browser and without auth.

// ESM: no __dirname. The suite always runs from the repo root
// (playwright.config.ts sets testDir relative to it), so cwd is it.
const ROOT = process.cwd();

/** Does a route segment resolve to a page under app/? */
function pageExists(route: string): boolean {
  const seg = route.replace(/^\//, "");
  const groups = ["(studio)", "(portal)", "(marketing)", "(previews)", ""];
  return groups.some((g) => {
    const dir = path.join(ROOT, "app", g, seg);
    return (
      fs.existsSync(path.join(dir, "page.tsx")) ||
      fs.existsSync(path.join(dir, "page.jsx")) ||
      // Dynamic and catch-all children, e.g. /quizzes served by
      // quizzes/[[...slug]]/page.tsx.
      (fs.existsSync(dir) &&
        fs
          .readdirSync(dir)
          .some(
            (child) =>
              child.startsWith("[") &&
              fs.existsSync(path.join(dir, child, "page.tsx")),
          ))
    );
  });
}

/**
 * The routes the class rail offers under each class.
 *
 * Read from the source rather than imported: ClassNav is a client
 * component that pulls in lucide, next/navigation and the class-scope
 * store, none of which load under the test runner. The list is a literal,
 * so reading it is exact — and if someone changes its shape, this test
 * fails loudly rather than silently checking nothing.
 */
function classRailRoutes(): string[] {
  const src = fs.readFileSync(
    path.join(ROOT, "src/features/studio-shell/ClassNav.tsx"),
    "utf8",
  );
  const block = src.slice(src.indexOf("const KINDS: Kind[] = ["));
  const routes = [...block.slice(0, block.indexOf("];")).matchAll(/route:\s*"([^"]+)"/g)].map(
    (m) => m[1],
  );
  expect(routes.length, "KINDS in ClassNav.tsx should still be a literal list").toBeGreaterThan(3);
  return routes;
}

test.describe("every clickable destination is reachable", () => {
  test("the class rail's routes are all allowed for a teacher", () => {
    const allowed = SECTIONS_BY_ROLE.teacher;
    for (const route of classRailRoutes()) {
      expect(
        allowed.has(route),
        `ClassNav offers "${route}" but SECTIONS_BY_ROLE.teacher does not hold it, ` +
          `so StudioShell will redirect the click to the dashboard.`,
      ).toBe(true);
    }
  });

  test("the class rail's routes all have a page", () => {
    for (const route of classRailRoutes()) {
      expect(pageExists(route), `No page.tsx resolves "/${route}"`).toBe(true);
    }
  });

  test("every allowed section has a page behind it", () => {
    // The other direction: a section a role is granted but that resolves
    // to nothing lands on not-found, which silently bounces to the home
    // route — the same invisible failure, arrived at the other way.
    for (const [role, sections] of Object.entries(SECTIONS_BY_ROLE)) {
      for (const section of sections) {
        expect(
          pageExists(section),
          `SECTIONS_BY_ROLE.${role} allows "${section}" but no page resolves it`,
        ).toBe(true);
      }
    }
  });

  test("each role's home route is one it is allowed to be on", () => {
    for (const [role, home] of Object.entries(DEFAULT_ROUTE)) {
      const sections = SECTIONS_BY_ROLE[role as keyof typeof SECTIONS_BY_ROLE];
      if (!sections) continue;
      expect(
        sections.has(home),
        `DEFAULT_ROUTE.${role} is "${home}", which that role is not allowed on — ` +
          `the redirect would bounce forever.`,
      ).toBe(true);
    }
  });
});

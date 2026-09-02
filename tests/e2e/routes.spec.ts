import { test, expect, type Page } from "@playwright/test";

// Route reachability net.
//
// Every path below must resolve and mount the app. This is what catches the
// classic Phase 3 mistake: peeling a route into app/(studio)/* and getting
// the segment name or nesting subtly wrong, so the route 404s or silently
// falls back to the catch-all.
//
// Auth-gated routes redirect to sign-in without credentials — that still
// proves the route resolved and the bundle mounted, which is what's being
// tested here.

const PUBLIC_ROUTES = ["/"];

const PORTAL_ROUTES = ["/dev", "/superadmin", "/admin", "/owner", "/moe"];

const STUDIO_ROUTES = [
  "/planner",
  "/dashboard",
  "/lesson-plans",
  "/lesson-plans/templates",
  "/lesson-plans/new",
  "/lesson-plans/edit/42",
  "/quizzes",
  "/quizzes/new",
  "/homework",
  "/presentations",
  "/activities",
  "/bulletin-board",
  // The Timetable screen folded into the calendar; the URL 308s to
  // /planner (next.config.ts). Kept here so the move stays proven.
  "/schedule",
  "/goals",
  "/library",
  "/database",
  "/database/students",
  "/account",
];

// Noise that is expected without a backend or credentials present. Anything
// else failing the console is a real regression.
const IGNORED_CONSOLE = [
  /Failed to load resource/i,
  /net::ERR_/i,
  /\/api\//i,
  /firebase/i,
  /auth\//i,
  /Failed to fetch/i,
  /NetworkError/i,
  /favicon/i,
];

function collectPageErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (IGNORED_CONSOLE.some((re) => re.test(text))) return;
    errors.push(text);
  });
  page.on("pageerror", (err) => {
    if (IGNORED_CONSOLE.some((re) => re.test(err.message))) return;
    errors.push(err.message);
  });
  return errors;
}

// The app renders into <body>; assert real content arrived rather than an
// empty shell or an error boundary.
async function expectAppMounted(page: Page) {
  await expect(page.locator("body")).not.toBeEmpty();
  await expect(page.locator("body")).toContainText(/\S/, { timeout: 15_000 });
}

for (const path of [...PUBLIC_ROUTES, ...PORTAL_ROUTES, ...STUDIO_ROUTES]) {
  test(`route resolves and mounts: ${path}`, async ({ page }) => {
    const errors = collectPageErrors(page);

    const response = await page.goto(path, { waitUntil: "domcontentloaded" });
    expect(response?.status(), `HTTP status for ${path}`).toBeLessThan(400);

    await expectAppMounted(page);
    expect(errors, `console errors on ${path}`).toEqual([]);
  });
}

test("landing page renders its marketing content", async ({ page }) => {
  await page.goto("/");
  // The product name is the one string guaranteed present on the landing
  // page regardless of which section markup gets refactored.
  await expect(page.locator("body")).toContainText(/murchid/i, {
    timeout: 15_000,
  });
});

test("an unknown path 404s but recovers the visitor", async ({ page }) => {
  // Behaviour change from the pre-migration SPA, and a deliberate one.
  //
  // The old catch-all matched literally every path, so a nonsense URL
  // returned HTTP 200 and the client quietly bounced it. Now that routes
  // resolve natively the status is an honest 404 — correct for crawlers and
  // monitoring — while app/not-found.tsx preserves the recovery a user sees.
  const response = await page.goto("/this-section-does-not-exist");
  expect(response?.status(), "unknown paths report 404").toBe(404);

  // Signed out, recovery lands on the marketing page rather than the studio.
  await expect(page).toHaveURL(/localhost:\d+\/$/, { timeout: 15_000 });
  await expect(page.locator("body")).toContainText(/murchid/i);
});

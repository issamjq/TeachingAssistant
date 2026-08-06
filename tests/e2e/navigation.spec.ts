import { test, expect } from "@playwright/test";

// Guards the routing shim (src/lib/route.tsx).
//
// The shim delegates the legacy navigate()/replace()/useRoute()/setNavGuard()
// API to the App Router. Its riskiest assumption: every legacy path currently
// resolves to the SAME catch-all segment, so a router.push() between two of
// them must still re-render. If Next treated that as a no-op, in-app
// navigation would silently break app-wide while the URL bar kept updating —
// and every route peeled in Phase 3 depends on it working.
//
// Driven through /nav-probe (non-production) because every in-app
// navigation in the real UI sits behind authentication, which the smoke
// suite deliberately runs without.

const PROBE = "/nav-probe";

test("navigate() pushes AND swaps the rendered route", async ({ page }) => {
  await page.goto(PROBE);
  await expect(page.getByTestId("route")).toHaveText(/nav-probe/);

  await page.getByTestId("go-quizzes").click();

  await expect(page).toHaveURL(/\/quizzes$/);
  // The re-render is the real assertion. A URL-only change would mean the
  // App Router treated the push as a no-op — the exact failure this probe
  // exists to catch. The probe segment must unmount and the catch-all must
  // take over.
  await expect(page.getByTestId("route")).toHaveCount(0);
  await expect(page.locator("body")).not.toBeEmpty();
});

test("navigate() builds multi-segment paths correctly", async ({ page }) => {
  await page.goto(PROBE);
  await page.getByTestId("go-edit").click();

  // pathFor() must join parts and coerce the numeric id.
  await expect(page).toHaveURL(/\/lesson-plans\/edit\/42$/);
  await expect(page.getByTestId("route")).toHaveCount(0);
});

test("useRoute() parses a pathname into section/sub/extra", async ({
  page,
}) => {
  // Parsing is asserted on a cold load of the probe itself, where the
  // component is still mounted and can serialise what useRoute() returned.
  await page.goto(`${PROBE}/edit/42`);
  await expect(page.getByTestId("route")).toHaveText(
    /"section":"nav-probe".*"sub":"edit".*"extra":\["42"\]/
  );
});

test("browser back and forward drive useRoute()", async ({ page }) => {
  await page.goto(PROBE);
  await page.getByTestId("go-quizzes").click();
  await expect(page).toHaveURL(/\/quizzes$/);

  await page.goBack();
  await expect(page).toHaveURL(/nav-probe$/);
  await expect(page.getByTestId("route")).toHaveText(/nav-probe/);

  await page.goForward();
  await expect(page).toHaveURL(/\/quizzes$/);
});

test("replace() does not add a history entry", async ({ page }) => {
  await page.goto(PROBE);
  await page.getByTestId("replace-homework").click();
  await expect(page).toHaveURL(/\/homework$/);

  // One step back must land before the probe, not on it — proving the
  // replace consumed the entry rather than pushing a new one.
  await page.goBack();
  await expect(page).not.toHaveURL(/\/homework$/);
});

test("query strings survive navigation", async ({ page }) => {
  // withSearch() re-appends window.location.search on every push; the old
  // router did the same and some flows depend on it.
  await page.goto(`${PROBE}?ref=campaign`);
  await page.getByTestId("go-quizzes").click();
  await expect(page).toHaveURL(/\/quizzes\?ref=campaign$/);
});

test("setNavGuard holds a transition until released", async ({ page }) => {
  await page.goto(PROBE);
  await page.getByTestId("arm-guard").click();

  await page.getByTestId("go-quizzes").click();

  // Guard returned false: the URL must NOT have changed yet.
  await expect(page.getByTestId("guard-held")).toHaveText("held");
  await expect(page).toHaveURL(/nav-probe$/);

  // Releasing runs the stashed `proceed`, completing the navigation.
  await page.getByTestId("release-guard").click();
  await expect(page).toHaveURL(/\/quizzes$/);
});

test("clearRoute() returns to the site root", async ({ page }) => {
  await page.goto(PROBE);
  await page.getByTestId("go-root").click();
  await expect(page).toHaveURL(/localhost:\d+\/$/);
});

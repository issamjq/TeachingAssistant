import { test, expect, type Page } from "@playwright/test";

// Visual regression net.
//
// The migrated build was verified pixel-identical to production murchid.com
// (0.00% across ten viewport widths, Retina, mobile, Arabic and the marketing
// sub-pages). These snapshots lock that state in.
//
// Everything still ahead — splitting Landing.jsx, converting 2,639 lines of
// global CSS to Modules, decomposing Studio.jsx — is refactoring that must
// not change a single pixel. The route smoke tests prove a page still
// *resolves*; only these prove it still *looks right*. Two regressions have
// already reached this branch that every other gate passed: a dead
// backdrop-filter and a hero stuck at desktop scale on phones.
//
// `threshold` is set explicitly on every assertion. Playwright's default
// per-pixel threshold is 0.2 in YIQ space — permissive enough that an entire
// brand-palette swap passed unnoticed the first time it was tried. Anything
// looser than ~0.05 makes these snapshots decorative rather than protective.
//
// Baselines live in tests/e2e/visual.spec.ts-snapshots/ and are committed.
// If a change is intentional, re-record with:
//     npm run test:visual:update
// and eyeball the diff in the commit — never update blindly.

// Full-page snapshots at three viewports, each preceded by a scroll-through
// to trigger every reveal, take well over the 30s default.
test.describe.configure({ timeout: 120_000 });

// Animation must be frozen or every run differs: the testimonial marquee,
// the hero typewriter and the studio progress bar all run continuously and
// ignore prefers-reduced-motion.
async function freeze(page: Page) {
  await page.addStyleTag({
    content: `html { scroll-behavior: auto !important; }
    *, *::before, *::after {
      animation-play-state: paused !important;
      animation-delay: -1ms !important;
      animation-duration: 1ms !important;
      transition-duration: 1ms !important;
      caret-color: transparent !important;
    }`,
  });
}

// Wait until the brand loader is gone. Several surfaces (the portals, the
// studio shell) render <BrandLoader /> while an auth check is in flight, and
// a fixed timeout screenshots whichever state the machine happened to be in
// — the dev server's first-compile latency made this fail where the
// production build passed. Waiting on the condition makes the snapshot
// deterministic on both.
async function waitForContent(page: Page) {
  await page
    .locator("text=LOADING")
    .waitFor({ state: "hidden", timeout: 20_000 })
    .catch(() => {});
  await page.waitForTimeout(600);
}

// Scroll the full height so every reveal-on-scroll has fired, then return to
// the top. Without this the snapshot captures a half-revealed page whose
// state depends on machine speed.
async function settle(page: Page) {
  // Freeze FIRST — and the important half of freeze() here is
  // `scroll-behavior: auto`. landing.css sets `scroll-behavior: smooth` on
  // <html>, so every programmatic scrollTo animates for ~580ms. Measured on
  // a production build the cost was identical with animation paused, which
  // ruled out the scroll choreography and pointed at smooth scrolling
  // itself: fifteen steps meant ~9s per test before a single screenshot,
  // and the settling time varied enough to make the snapshots flaky.
  await freeze(page);
  const h = await page.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y < h; y += 1600) {
    await page.evaluate((v) => window.scrollTo(0, v), y);
    await page.waitForTimeout(90);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(900);
  // Re-apply: styles added before a navigation-free scroll can be dropped
  // when new nodes mount during the pass.
  await freeze(page);
  await page.waitForTimeout(250);
}

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "tablet", width: 820, height: 1000 },
  { name: "mobile", width: 390, height: 844 },
];

test.describe("landing page", () => {
  for (const vp of VIEWPORTS) {
    test(`renders unchanged @ ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/", { waitUntil: "networkidle" });
      await waitForContent(page);
      await settle(page);

      await expect(page).toHaveScreenshot(`landing-${vp.name}.png`, {
        fullPage: true,
        // The Next dev-tools badge is dev-only and absent in production.
        mask: [page.locator("nextjs-portal")],
        threshold: 0.04,
        maxDiffPixelRatio: 0.002,
        timeout: 30_000,
      });
    });
  }

  test("renders unchanged in Arabic (RTL)", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/", { waitUntil: "networkidle" });
    await waitForContent(page);
    await page
      .locator('[role="group"][aria-label="Language"] button')
      .last()
      .click();
    await page.waitForTimeout(2000);
    await settle(page);

    await expect(page).toHaveScreenshot("landing-arabic.png", {
      fullPage: true,
      mask: [page.locator("nextjs-portal")],
      threshold: 0.04,
        maxDiffPixelRatio: 0.002,
      timeout: 30_000,
    });
  });
});

// The sign-in funnel is the other surface still living inside Landing.jsx,
// so splitting that file has to leave it untouched too.
test("sign-in funnel renders unchanged", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/", { waitUntil: "networkidle" });
  await waitForContent(page);
  await page.getByRole("button", { name: /sign in/i }).first().click();
  // The funnel does its own silent session restore before painting.
  await waitForContent(page);
  await page.getByRole("button", { name: /continue with google/i }).waitFor({ timeout: 20_000 });
  await page.waitForTimeout(600);
  await freeze(page);

  await expect(page).toHaveScreenshot("funnel-signin.png", {
    fullPage: true,
    mask: [page.locator("nextjs-portal")],
    threshold: 0.04,
        maxDiffPixelRatio: 0.002,
    timeout: 30_000,
  });
});

// ── Studio: deliberately NOT snapshot-tested ────────────────────────
//
// The studio needs a signed-in session to reach a stable state, and the
// Firebase Admin credential this repo's API requires is not available here
// (GOOGLE_APPLICATION_CREDENTIALS points at another machine). Without it the
// screens either never settle — Playwright needs two identical consecutive
// frames, and the shell keeps a 20s auth heartbeat plus retries running — or,
// with the API stubbed, render a state no real user ever sees.
//
// A flaky snapshot is worse than no snapshot: it trains people to re-record
// baselines without looking, which is exactly how a real regression slips
// through. Studio routes stay covered by tests/e2e/routes.spec.ts, which
// asserts they resolve, mount and log no console errors.
//
// When credentials are available, add studio coverage here backed by a real
// authenticated session (storageState) rather than stubs.


// Scrolled state — NOT covered by the full-page snapshots above.
//
// The nav is position:fixed, so a fullPage screenshot renders it once at the
// top of the page, where it is in its un-scrolled state. Its frosted
// treatment (.nav-shade / .nav-blur) only applies past 20px of scroll, so a
// regression there is invisible to the snapshots above.
//
// This was proven, not assumed: re-introducing the dead-backdrop-filter bug
// that shipped on this branch left all six full-page snapshots green.
test.describe("scrolled chrome", () => {
  const POSITIONS = [
    { name: "over-drench", y: 2600 },
    { name: "over-cream", y: 3900 },
  ];

  for (const pos of POSITIONS) {
    test(`nav renders unchanged ${pos.name}`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.goto("/", { waitUntil: "networkidle" });
      await waitForContent(page);
      await page.evaluate((y) => window.scrollTo(0, y), pos.y);
      await page.waitForTimeout(1500);
      await freeze(page);
      await page.waitForTimeout(400);

      // A CLIPPED PAGE screenshot, not an element screenshot. An element
      // screenshot renders the node in isolation, so backdrop-filter — which
      // by definition needs whatever is painted behind it — does not
      // composite and the frosted nav looks identical with or without it.
      // Verified: re-introducing the dead-backdrop-filter bug left the
      // element-screenshot version green and fails this one.
      await expect(page).toHaveScreenshot(`nav-${pos.name}.png`, {
        clip: { x: 0, y: 0, width: 1440, height: 90 },
        threshold: 0.04,
        maxDiffPixelRatio: 0.002,
        timeout: 20_000,
      });
    });
  }
});

// Stub /api so the snapshot doesn't depend on whether a backend is running:
// the portal calls /api/auth/me on mount to short-circuit for admins who are
// already signed in. Same result on a laptop and in CI.
async function stubApi(page: Page) {
  await page.route("**/api/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "{}",
    })
  );
}

test("portal renders unchanged", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await stubApi(page);
  await page.goto("/dev", { waitUntil: "networkidle" });
  await waitForContent(page);
  await page.getByRole("button", { name: /continue with google/i }).waitFor({ timeout: 20_000 });
  await page.waitForTimeout(600);
  await freeze(page);

  await expect(page).toHaveScreenshot("portal-dev.png", {
    fullPage: true,
    mask: [page.locator("nextjs-portal")],
    threshold: 0.04,
        maxDiffPixelRatio: 0.002,
    timeout: 30_000,
  });
});

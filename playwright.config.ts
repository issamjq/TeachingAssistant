import { defineConfig, devices } from "@playwright/test";

// Smoke tests exist to protect the Next.js migration. There was no test of
// any kind before it, so these are the only mechanical check that peeling a
// route in Phase 3 didn't break it. See docs/11-nextjs-migration.md §7.
//
// Deliberately shallow: they assert routes resolve, the app mounts, and the
// console stays clean. They are a regression net, not a feature test suite.

const PORT = Number(process.env.E2E_PORT || 4321);
const BASE_URL = process.env.E2E_BASE_URL || `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",

  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],

  // Starts the frontend only. The Express API is NOT started here — these
  // tests must pass without DATABASE_URL or Firebase credentials, so they
  // assert on the shell rather than on data. Point E2E_BASE_URL at a full
  // environment to run them against real data.
  webServer: {
    command: `npx next dev -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});

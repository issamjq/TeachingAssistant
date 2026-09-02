import { chromium } from "@playwright/test";
import fs from "node:fs";

const env = Object.fromEntries(
  fs.readFileSync(".env", "utf8").split("\n").filter((l) => l && !l.startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, "")]; })
);
const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const ref = new global.URL(URL).hostname.split(".")[0];

const res = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { apikey: KEY, "content-type": "application/json" },
  body: JSON.stringify({ email: env.TEST_ACCOUNT_EMAIL, password: env.TEST_ACCOUNT_PASSWORD }),
});
const session = await res.json();
if (!session.access_token) { console.error("sign-in failed:", session); process.exit(1); }
console.log("signed in as", session.user?.email);

const out = process.argv[2] || "shots";
const shots = [
  ["home", "#/", 1440, 3000],
  ["subject", null, 1440, 3000],
  ["kind", null, 1440, 3000],
  ["library", "#/library", 1440, 3000],
  ["week", "#/week", 1440, 2400],
  ["student", "#/student", 1440, 2000],
];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 980 }, deviceScaleFactor: 2 });
await ctx.addInitScript(([k, s]) => {
  localStorage.setItem(k, JSON.stringify({
    access_token: s.access_token, refresh_token: s.refresh_token,
    expires_at: Math.floor(Date.now() / 1000) + s.expires_in, expires_in: s.expires_in,
    token_type: "bearer", user: s.user,
  }));
}, [`sb-${ref}-auth-token`, session]);

const page = await ctx.newPage();
const errs = [];
page.on("console", (m) => m.type() === "error" && errs.push(m.text().slice(0, 200)));
page.on("pageerror", (e) => errs.push("PAGEERROR " + String(e).slice(0, 200)));

async function shot(name, hash) {
  await page.goto("http://localhost:3000/preview" + (hash || ""), { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: true });
  console.log("shot", name);
}

await shot("home", "#/");
// Discover the first subject from the sidebar and drill in.
const firstSubject = await page.evaluate(() => {
  const h = [...document.querySelectorAll("button")].find((b) => b.getAttribute("aria-expanded") !== null);
  return h ? h.textContent : null;
});
console.log("first subject:", firstSubject);
const hash = await page.evaluate(() => {
  const h = [...document.querySelectorAll("button")].find((b) => b.getAttribute("aria-expanded") !== null);
  if (h) h.click();
  return location.hash;
});
await page.waitForTimeout(1200);
await page.screenshot({ path: `${out}/subject.png`, fullPage: true });
console.log("shot subject", hash);
const kindHash = await page.evaluate(() => location.hash);
await shot("kind", kindHash + "/lesson_plan");
await shot("library", "#/library");
await shot("week", "#/week");
await shot("student", "#/student");

// mobile
const m = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true });
await m.addInitScript(([k, s]) => {
  localStorage.setItem(k, JSON.stringify({
    access_token: s.access_token, refresh_token: s.refresh_token,
    expires_at: Math.floor(Date.now() / 1000) + s.expires_in, expires_in: s.expires_in,
    token_type: "bearer", user: s.user,
  }));
}, [`sb-${ref}-auth-token`, session]);
const mp = await m.newPage();
await mp.goto("http://localhost:3000/preview#/", { waitUntil: "networkidle", timeout: 90000 });
await mp.waitForTimeout(2500);
await mp.screenshot({ path: `${out}/mobile-home.png`, fullPage: true });
console.log("shot mobile-home");

console.log("\nconsole errors:", errs.length ? [...new Set(errs)].slice(0, 8) : "none");
await browser.close();

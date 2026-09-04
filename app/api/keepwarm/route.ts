// Keep the AI service warm.
//
// Render's free tier spins the separate backend service down, and a cold
// first byte on generation measured ~6.2s against ~175ms warm (see
// todo/backend-integration.md). GET /api/keepwarm pings the service through
// the same server-side env var the /api/* rewrite uses, so the target never
// reaches the browser. Point a free scheduled pinger at it — cron-job.org or
// UptimeRobot every ~10 minutes (Vercel's own crons run at most daily on the
// Hobby plan, too slow to keep anything warm).
export const dynamic = "force-dynamic";

export async function GET() {
  const target = process.env.API_PROXY_TARGET;
  if (!target) {
    return Response.json({ ok: false, reason: "API_PROXY_TARGET is not set" }, { status: 503 });
  }
  const t0 = Date.now();
  try {
    const res = await fetch(target, { cache: "no-store", signal: AbortSignal.timeout(30_000) });
    return Response.json({ ok: true, status: res.status, ms: Date.now() - t0 });
  } catch (e) {
    return Response.json(
      { ok: false, error: e instanceof Error ? e.message : String(e), ms: Date.now() - t0 },
      { status: 502 },
    );
  }
}

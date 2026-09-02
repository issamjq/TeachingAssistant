// Keep the AI service warm.
//
// This repo deliberately has no backend — but Render's free tier spins
// the SEPARATE API service down, and a cold first byte on generation
// measured ~6.2s against ~175ms warm (todo/backend-integration.md §6).
// The audit called a paid or keep-warm setup the single biggest
// perceived-speed win available.
//
// This route is the keep-warm half: GET /api/keepwarm pings the service
// through the same server-side env var the rewrites use, so the target
// never reaches the browser. Point any free scheduled pinger at it —
// cron-job.org or UptimeRobot every 10 minutes does it (Vercel's own
// crons run at most daily on the Hobby plan, which is too slow to keep
// anything warm). The studio shell also fires one ping on mount, so a
// working teacher keeps her own instance awake; this covers the first
// hit of the day. The paid half — a Render instance that never sleeps —
// is the owner's call and replaces all of this.
export const dynamic = "force-dynamic";

export async function GET() {
  const target = process.env.API_PROXY_TARGET;
  if (!target) {
    return Response.json({ ok: false, reason: "API_PROXY_TARGET is not set" }, { status: 503 });
  }
  const t0 = Date.now();
  try {
    // /healthz, with the z. The service has no /health — pinging the bare
    // origin woke it but answered 404, so a monitor pointed here reported
    // an outage on a service that was fine.
    const res = await fetch(`${target.replace(/\/$/, "")}/healthz`, {
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
    return Response.json({ ok: res.ok, status: res.status, ms: Date.now() - t0 });
  } catch (e) {
    return Response.json(
      { ok: false, error: e instanceof Error ? e.message : String(e), ms: Date.now() - t0 },
      { status: 502 },
    );
  }
}

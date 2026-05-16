import { Router } from "express";
import { pool } from "../lib/db.js";
import { handleErr } from "../lib/helpers.js";
import { loadCurrentTeacher } from "../lib/currentTeacher.js";

// Real-photo support for the slide builder.
//   GET  /api/images/search?q=…  → proxied Pexels search (key stays server-side)
//   POST /api/images/upload       → store a teacher's own image (base64)
//   GET  /api/images/:id          → serve a stored upload
//
// Pexels was chosen because it's free, returns real photos, and needs
// no per-image attribution. Set PEXELS_API_KEY in the environment.
const router = Router();

const PEXELS_ENDPOINT = "https://api.pexels.com/v1/search";

// GET /api/images/search?q=water+cycle&page=1
router.get("/search", async (req, res) => {
  try {
    const key = process.env.PEXELS_API_KEY;
    if (!key) {
      return res.status(503).json({
        error:
          "Photo search isn't configured. Add a free PEXELS_API_KEY to the server environment to enable it.",
      });
    }
    const q = String(req.query.q || "").trim();
    if (!q) return res.json({ photos: [] });
    const page = Math.max(1, Number(req.query.page) || 1);

    const url = `${PEXELS_ENDPOINT}?query=${encodeURIComponent(
      q
    )}&per_page=24&page=${page}&orientation=landscape`;
    const r = await fetch(url, { headers: { Authorization: key } });
    if (!r.ok) {
      const detail = await r.text().catch(() => "");
      return res.status(502).json({
        error: `Pexels request failed (${r.status}). ${detail.slice(0, 200)}`,
      });
    }
    const data = await r.json();
    const photos = (data.photos || []).map((p) => ({
      id: p.id,
      // medium is a good thumbnail; large2x looks crisp on a 16:9 slide.
      thumb: p.src?.medium || p.src?.small || p.src?.original,
      full: p.src?.large2x || p.src?.large || p.src?.original,
      alt: p.alt || q,
      credit: p.photographer || "Pexels",
    }));
    res.json({ photos, page, hasMore: Boolean(data.next_page) });
  } catch (err) {
    handleErr(res, "GET /api/images/search", err);
  }
});

// POST /api/images/upload  { dataUrl: "data:image/png;base64,…" }
router.post("/upload", async (req, res) => {
  try {
    const cur = await loadCurrentTeacher();
    if (!cur) return res.status(404).json({ error: "Current teacher not found" });

    const dataUrl = String(req.body?.dataUrl || "");
    const m = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/);
    if (!m) {
      return res
        .status(400)
        .json({ error: "Expected an image data URL (data:image/…;base64,…)." });
    }
    const mime = m[1];
    const base64 = m[2];
    // ~8MB decoded ceiling — base64 is ~1.33× the binary size.
    if (base64.length > 8 * 1024 * 1024 * 1.34) {
      return res
        .status(413)
        .json({ error: "Image is too large. Keep uploads under ~8MB." });
    }

    const ins = await pool.query(
      `INSERT INTO uploaded_images (teacher_id, mime, data)
       VALUES ($1, $2, $3) RETURNING id`,
      [cur.id, mime, base64]
    );
    res.status(201).json({ url: `/api/images/${ins.rows[0].id}` });
  } catch (err) {
    handleErr(res, "POST /api/images/upload", err);
  }
});

// GET /api/images/:id — serve a stored upload. /search and /upload are
// declared above so they win the match; this only sees other paths.
router.get("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(404).json({ error: "Not found" });
    }
    const r = await pool.query(
      "SELECT mime, data FROM uploaded_images WHERE id = $1",
      [id]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: "Not found" });
    const { mime, data } = r.rows[0];
    const buf = Buffer.from(data, "base64");
    res.setHeader("Content-Type", mime);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.send(buf);
  } catch (err) {
    handleErr(res, "GET /api/images/:id", err);
  }
});

export default router;

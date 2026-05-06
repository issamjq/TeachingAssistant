import { Router } from "express";
import { pool } from "../lib/db.js";
import { handleErr } from "../lib/helpers.js";
import { loadCurrentTeacher } from "../lib/currentTeacher.js";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const cur = await loadCurrentTeacher();
    const onlyUnread = req.query.unread === "true";
    const r = await pool.query(
      `SELECT id, kind, message, link, is_read, created_at
         FROM notifications
        WHERE teacher_id = $1 ${onlyUnread ? "AND is_read = FALSE" : ""}
        ORDER BY created_at DESC
        LIMIT 50`,
      [cur.id]
    );
    res.json(r.rows);
  } catch (err) {
    handleErr(res, "GET /api/notifications", err);
  }
});

router.post("/mark-read", async (req, res) => {
  try {
    const cur = await loadCurrentTeacher();
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : null;
    if (ids) {
      await pool.query(
        "UPDATE notifications SET is_read = TRUE WHERE teacher_id = $1 AND id = ANY($2::int[])",
        [cur.id, ids]
      );
    } else {
      await pool.query(
        "UPDATE notifications SET is_read = TRUE WHERE teacher_id = $1",
        [cur.id]
      );
    }
    res.json({ ok: true });
  } catch (err) {
    handleErr(res, "POST /api/notifications/mark-read", err);
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const cur = await loadCurrentTeacher();
    const r = await pool.query(
      "DELETE FROM notifications WHERE id = $1 AND teacher_id = $2",
      [req.params.id, cur.id]
    );
    if (r.rowCount === 0) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  } catch (err) {
    handleErr(res, "DELETE /api/notifications/:id", err);
  }
});

export default router;

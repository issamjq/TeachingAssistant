import { Router } from "express";
import { withTenant } from "../lib/db.js";
import { handleErr } from "../lib/helpers.js";
import { loadCurrentTeacher } from "../lib/currentTeacher.js";
import { crudRouter } from "../lib/crud.js";
import {
  validateBody, AnnouncementSchema, AnnouncementPatchSchema, AnnouncementPostSchema,
} from "../lib/validate.js";

// The class bulletin board.
//
// Built on crudRouter deliberately rather than hand-rolled: that is where
// cursor pagination, the tenant WHERE clause, the RLS transaction, soft delete
// and the 30-day trash already live, all of them tested. A bespoke router here
// would be a second implementation of five things we have already got right
// once, and the place a future scoping bug would hide.
//
// What this file adds on top is the one thing a board needs that a generic CRUD
// table does not: the difference between writing a note and putting it up.

const FIELDS = [
  "title", "body", "kind", "priority", "audience",
  "grade", "section", "pinned", "starts_on", "expires_on",
];

// published_at is absent from FIELDS on purpose — see POST /post below.
const SELECT = `id, title, body, kind, priority, audience, grade, section,
                pinned, starts_on, expires_on, published_at,
                created_at, updated_at`;

const router = Router();

// POST /api/announcements/post — { ids: [...], posted: true|false }
//
// Putting a note up and taking it down. A dedicated endpoint rather than a
// writable column, for the same reason grades publish through their own route:
// this is the moment a teacher's private draft becomes something a class — and
// later a parent — can read, so it should be an act, not a field that an
// ordinary PATCH could flip by accident or back-date.
//
// Registered before the crud subrouter so Express does not match "post" as an
// :id. Scoped twice over: `account_id = $2` in the UPDATE and RLS underneath
// it, so ids belonging to another teacher simply update nothing. The response
// reports how many of the requested ids actually moved, so a client can tell
// the difference between "done" and "those were not yours".
router.post("/post", validateBody(AnnouncementPostSchema), async (req, res) => {
  try {
    const cur = await loadCurrentTeacher(req);
    const { ids, posted } = req.body;
    const r = await withTenant(cur.id, (db) => db.query(
      `UPDATE announcements
          SET published_at = ${posted ? "NOW()" : "NULL"}, updated_at = NOW()
        WHERE id = ANY($1::int[]) AND account_id = $2 AND deleted_at IS NULL
        RETURNING id, published_at`,
      [ids, cur.id]
    ));
    res.json({ updated: r.rowCount, requested: ids.length, rows: r.rows });
  } catch (err) {
    handleErr(res, "POST /api/announcements/post", err);
  }
});

router.use("/", crudRouter({
  table: "announcements",
  fields: FIELDS,
  selectCols: SELECT,
  // The board's reading order, and the reason for announcements_board_idx:
  // pinned notes first, then newest. `pinned` is a NOT NULL boolean, so DESC
  // puts true above false.
  listOrderBy: "pinned DESC, created_at DESC, id DESC",
  timestampOnPatch: "updated_at",
  routeName: "/api/announcements",
  teacherScoped: true,
  softDelete: true,
  bodySchema: AnnouncementSchema,
  patchSchema: AnnouncementPatchSchema,
  listExtra: async (req) => {
    const clauses = [];
    const params = [];
    const add = (sql, value) => { params.push(value); clauses.push(sql.replace("$?", `$${params.length}`)); };

    if (req.query.kind)     add("kind = $?", req.query.kind);
    if (req.query.grade)    add("grade = $?", req.query.grade);
    if (req.query.section)  add("section = $?", req.query.section);
    if (req.query.audience) add("audience = $?", req.query.audience);

    // ?posted=true|false — what is on the board versus still a draft.
    if (req.query.posted === "true")  clauses.push("published_at IS NOT NULL");
    if (req.query.posted === "false") clauses.push("published_at IS NULL");

    // ?live=true — what a class would actually see right now: posted, already
    // started, not yet expired. This is the filter the student and parent
    // portals will use, so it lives here rather than being reimplemented
    // there against a slightly different definition of "current".
    if (req.query.live === "true") {
      clauses.push("published_at IS NOT NULL");
      clauses.push("(starts_on IS NULL OR starts_on <= CURRENT_DATE)");
      clauses.push("(expires_on IS NULL OR expires_on >= CURRENT_DATE)");
    }

    if (clauses.length === 0) return null;
    return { where: clauses.join(" AND "), params };
  },
}));

export default router;

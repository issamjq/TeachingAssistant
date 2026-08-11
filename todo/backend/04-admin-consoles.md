# 04 · Admin consoles — `/api/{admin,superadmin,owner,moe,dev,teachers}/*`

> **Status (2026-08-11): ✅ built and deployed** — every listed route
> appears in the API reference, with role gates, audit writes, and the
> self-lockout guard. Kept for the contract.

Five privileged dashboards. Server-only for two reasons: they read across
**all** teachers, which RLS forbids, and they write `audit_log`, which
RLS enabled-with-no-policy makes unreachable from any client.

Requires [00 · Setup](00-setup.md).

## Roles

| Prefix | Allowed | Frontend |
|---|---|---|
| `/api/admin/*` | admin, super_admin, dev | `AdminConsole.jsx`, `AdminDashboard.jsx` |
| `/api/superadmin/*` | super_admin, dev | `SuperAdminConsole.jsx`, `SuperAdminDashboard.jsx` |
| `/api/owner/*` | owner, super_admin, dev | `OwnerDashboard.jsx` |
| `/api/moe/*` | moe, super_admin, dev | `MoeDashboard.jsx` |
| `/api/dev/*` | dev | `DevConsole.jsx` |
| `/api/teachers/*` | admin, super_admin, dev | `AccountDrawer.jsx` |

`requireRole` from 00 does the gate. Put it on the **mount**, not inside
handlers — one place to read, and a new route cannot forget it.

## Endpoints the frontend calls

```
admin/stats · admin/dashboard · admin/teachers · admin/signups
admin/teachers/:id · admin/teachers/:id/role · admin/teachers/:id/status

superadmin/overview · superadmin/signups · superadmin/logins
superadmin/recent-activity · superadmin/account/:id
superadmin/account/:id/permissions

owner/overview · owner/signups · owner/activity
moe/overview · moe/schools · moe/content-trend
dev/feature-flags · dev/feature-flags/:id · dev/system-stats
dev/health-detail · dev/inspect/:id · dev/account/:id
```

---

## Reporting views already exist

`accounts`, `drafts`, `quizzes`, `homework`, `presentations`,
`activities`, `templates` and `account_schools` are **views** over the
real tables, presenting the old flat shape. Reads work unchanged:

```sql
SELECT COUNT(*)::int FROM accounts WHERE role = 'teacher' AND status = 'active';
SELECT COUNT(*)::int FROM drafts WHERE account_id = $1;
```

`accounts` is `users ⨝ faculty ⨝ subscriptions`, with `id` = faculty id
and `user_id` = identity. The content views are `ai_studio` filtered by
type, exposing `faculty_id` **and** `account_id` as aliases of each other.

**Writes fail.** A view over three tables is not auto-updatable, so an
UPDATE errors rather than silently doing nothing — which is the good
outcome. Write to the real tables.

---

## Reads

```js
router.get("/stats", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        (SELECT COUNT(*)::int FROM accounts WHERE role='teacher')                        AS total_teachers,
        (SELECT COUNT(*)::int FROM accounts WHERE role='teacher' AND status='active')    AS active_teachers,
        (SELECT COUNT(*)::int FROM accounts WHERE role='teacher' AND status='suspended') AS suspended_teachers,
        (SELECT COUNT(*)::int FROM ai_studio WHERE deleted_at IS NULL)                   AS artifacts,
        (SELECT COUNT(*)::int FROM students)                                             AS students`);
    res.json(rows[0]);
  } catch (err) { handleErr(res, "GET /api/admin/stats", err); }
});

// Sign-ups per week. date_trunc, not string formatting — ordering by a
// formatted date sorts "2026-1-9" after "2026-10-1".
router.get("/signups", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT date_trunc('week', created_at) AS week, COUNT(*)::int AS n
        FROM accounts WHERE created_at > now() - interval '12 weeks'
       GROUP BY 1 ORDER BY 1`);
    res.json(rows);
  } catch (err) { handleErr(res, "GET /api/admin/signups", err); }
});
```

---

## Writes — the real tables

### Status

```js
router.patch("/teachers/:id/status", async (req, res) => {
  try {
    const { status } = req.body || {};
    if (!["active","suspended","deleted"].includes(status)) throw bad("Invalid status.");
    // An admin locking themselves out is a support ticket, every time.
    if (req.params.id === req.account.id) throw bad("You can't change your own account status.");

    const { rows } = await pool.query(
      `UPDATE users u SET account_status = $1, updated_at = now()
         FROM faculty f
        WHERE f.id = $2::uuid AND u.id = f.user_id
        RETURNING f.id, u.account_status AS status`,
      [status, req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: "Not found" });

    await recordAudit({
      actorId: req.account.user_id, action: `admin.teacher.${status}`,
      entity: "faculty", entityId: req.params.id,
      ip: clientIp(req), userAgent: req.headers["user-agent"],
    });
    res.json(rows[0]);
  } catch (err) { handleErr(res, "PATCH /api/admin/teachers/:id/status", err); }
});
```

Note the audit actor is `user_id`, not `id`. An audit trail follows the
person; the faculty row is what they were acting as.

### Role

Guard escalation. Without this an admin promotes themselves to dev.

```js
const GRANTABLE = {
  admin:       ["teacher"],
  super_admin: ["teacher", "admin", "moe", "owner"],
  dev:         ["teacher", "admin", "moe", "owner", "super_admin", "dev"],
};

router.patch("/teachers/:id/role", async (req, res) => {
  try {
    const { role, sub_role } = req.body || {};
    if (!GRANTABLE[req.account.role]?.includes(role)) {
      return res.status(403).json({ error: "Forbidden", code: "role_grant_denied" });
    }
    const { rows } = await pool.query(
      `UPDATE users u SET role = $1, sub_role = $2, updated_at = now()
         FROM faculty f
        WHERE f.id = $3::uuid AND u.id = f.user_id
        RETURNING f.id, u.role, u.sub_role`,
      [role, sub_role || null, req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: "Not found" });
    await recordAudit({ actorId: req.account.user_id, action: "admin.teacher.role_update",
                        entity: "faculty", entityId: req.params.id, meta: { to: role } });
    res.json(rows[0]);
  } catch (err) { handleErr(res, "PATCH /api/admin/teachers/:id/role", err); }
});
```

### Creating a teacher — you cannot

`users.id` is FK'd to `auth.users`, so nothing can create a user row for
someone who has not signed up. Minting an auth user needs a service-role
key, and this service deliberately holds none.

What the endpoint actually does is **attach a role to someone who has
already registered**, and say so plainly when they have not:

```js
router.post("/teachers", async (req, res) => {
  const { email, first_name, last_name, staff_id, role = "teacher" } = req.body || {};
  const { rows } = await pool.query(`SELECT id FROM users WHERE lower(email) = lower($1)`, [email]);
  if (!rows[0]) {
    return res.status(404).json({
      error: "No account with that email has signed up yet. Ask them to register first, then set their role here.",
      code: "no_such_user",
    });
  }
  // …update users, upsert faculty, audit
});
```

### Feature flags

```js
router.patch("/feature-flags/:key", async (req, res) => {
  const { enabled } = req.body || {};
  const { rows } = await pool.query(
    `UPDATE feature_flags SET enabled = $2, updated_at = now() WHERE key = $1 RETURNING key, enabled`,
    [req.params.key, !!enabled]);
  if (!rows[0]) return res.status(404).json({ error: "Not found" });
  await recordAudit({ actorId: req.account.user_id, action: "dev.flag.toggle",
                      entity: "feature_flags", meta: { key: req.params.key, enabled: !!enabled } });
  res.json(rows[0]);
});
```

`feature_flags` is client-readable and **not** client-writable, which is
why this endpoint exists at all.

---

## Checklist

- [ ] `requireRole` on the mount, not in handlers
- [ ] Reads use the views; writes use `users` / `faculty` / `subscriptions`
- [ ] Role escalation guarded by a grant table
- [ ] Nobody can suspend or delete their own account
- [ ] Every mutation writes `audit_log`, actor = `user_id`
- [ ] `POST /teachers` explains that the person must register first
- [ ] Every query scoped by hand — **no RLS on this connection**

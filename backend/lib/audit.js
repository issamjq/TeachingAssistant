// Audit log — append-only record of sensitive actions. Schema:
//
//   id           SERIAL PK
//   account_id   the actor (NULL for failed auth attempts)
//   action       short, machine-readable verb. Suggested vocab:
//                  "auth.login.success" "auth.login.fail"
//                  "auth.signout"       "auth.renew"
//                  "subscription.expire"
//                  "admin.teacher.create" "admin.teacher.suspend"
//                  "dev.flag.toggle"
//                  "school.create" "school.attach" "school.remove"
//                  "student.create" "student.delete"
//   target_table optional — table the action touched
//   target_id    optional — pk of the row
//   ip           clientIp(req)
//   user_agent   first 500 chars
//   detail       JSONB — small structured payload (avoid PII)
//   created_at   TIMESTAMPTZ default now()
//
// IMPORTANT: don't write PII (full names, emails, addresses) into
// `detail`. It exists for security forensics, not analytics. Use
// account_id / target_id to link to the source rows.
import { pool } from "./db.js";

export async function recordAudit({
  accountId = null,
  action,
  targetTable = null,
  targetId = null,
  ip = null,
  userAgent = null,
  detail = null,
} = {}) {
  try {
    await pool.query(
      `INSERT INTO audit_log
         (account_id, action, target_table, target_id, ip, user_agent, detail)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        accountId,
        action,
        targetTable,
        targetId,
        ip,
        userAgent ? String(userAgent).slice(0, 500) : null,
        detail ? JSON.stringify(detail) : null,
      ]
    );
  } catch (err) {
    // Audit failures must never break the request — log and move on.
    console.error("[audit] insert failed", err.message);
  }
}

# 05 · Images — `/api/images/*`

Images pasted into a lesson plan or a slide deck.

Requires [00 · Setup](00-setup.md).

| Method | Path | Used by |
|---|---|---|
| POST | `/api/images/upload` | `SlideBuilder.jsx` |
| GET | `/api/images/:id` | the `<img src>` it returns |

## Do this the better way

The existing table stores base64 in a column and serves it back through
Node. That makes every image render a database read and a round trip, and
puts megabytes of binary in the same rows the planner queries.

Object storage already exists — five buckets, policies and all. So:

1. **The browser uploads** to the `imports` bucket at `<uid>/<name>`,
   under the teacher's own session. The bucket policy matches the first
   path segment against `auth.uid()`, so the folder is the access control.
2. **This service is not involved.**

`uploaded_images` keeps a `file_path` column for exactly this. The
`data` column stays only for images pasted before storage existed.

Frontend, roughly:

```js
const path = `${uid}/${Date.now()}-${safeName(file.name)}`;
await supabase.storage.from("imports").upload(path, file, { upsert: false });
const { data } = supabase.storage.from("imports").getPublicUrl(path);  // or a signed URL
```

`imports` is private, so use `createSignedUrl(path, 3600)` rather than a
public URL.

## If you implement the endpoints anyway

Compatibility, for images already in the table:

```js
router.get("/:id", async (req, res) => {
  const id = String(req.params.id);
  // uuid, not a serial. Number() on a uuid gives NaN, so an integer
  // guard here rejects every real id — that bug shipped once already.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return res.status(404).json({ error: "Not found" });
  }
  const { rows } = await pool.query(
    `SELECT mime, data, file_path FROM uploaded_images WHERE id = $1::uuid AND faculty_id = $2`,
    [id, req.account.id]);
  const row = rows[0];
  if (!row) return res.status(404).json({ error: "Not found" });

  if (row.file_path) return res.redirect(await signedUrl(row.file_path));

  res.setHeader("Content-Type", row.mime);
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  res.end(Buffer.from(row.data, "base64"));
});
```

Note the `faculty_id` in that WHERE clause. This connection is not
subject to RLS, so an id alone would serve any teacher's image to anyone
who guessed it.

## Checklist

- [ ] Prefer browser → storage; leave this service out of it
- [ ] uuid validation, not integer
- [ ] Every query scoped by `faculty_id` — there is no RLS here
- [ ] Signed URLs, not public ones — `imports` is private

# 10 · Phase 1 — material extraction

> **Status (2026-09-02): 🔴 NOT BUILT — this file is the request.** The
> frontend half shipped today and **degrades cleanly without this**: the
> shelf lists files, they can be re-attached, and generation reads them
> exactly the way it does now. What is missing until this exists is the
> saving: the same textbook is still downloaded and parsed on every
> request that attaches it, and charged for every time.

One endpoint, plus a change to how generation resolves an attachment.

Requires [09 · Phase 0](09-phase0-operational.md) — same auth, same
error envelope, same single-device gate.

---

## §1 · What changed on the frontend

`materials` is no longer write-only. It gained six columns
(`db/tune.sql` §96) and a screen at `/materials`:

| Column | Written by | Meaning |
|---|---|---|
| `title` | teacher | What she calls it. `file_name` is whatever it was called on her laptop. |
| `kind` | teacher | `textbook` \| `syllabus` \| `notes` \| `other`, nullable. |
| `grade` / `subject` / `section` | teacher, or stamped at upload from the studio's class picker | Which class it belongs to. Blank = offered for everything. |
| `pages` | **you** | Filled during extraction, so the shelf can say "48 pages" without opening the file. |

`status` keeps its existing vocabulary — `uploaded` → `processing` →
`ready` \| `failed` — and the shelf renders it as Stored / Reading… /
Read / Couldn't read. It is **yours to write**; the browser's PATCH
handler deliberately ignores `status`, `extracted_text` and `pages`, so
a client cannot claim a file was read when it never was.

Every upload path (studio composer, goal planner, the shelf itself) now
goes through one helper, which fires this call and ignores the result:

```
POST /api/materials/<id>/extract
```

A 404 today is harmless — extraction is an optimisation, and an upload
that already succeeded must not fail because this has not shipped.

---

## §2 · `POST /api/materials/:id/extract`

**Auth.** `Authorization: Bearer <supabase jwt>` as everywhere else.
Resolve `faculty_id` and **verify the row belongs to the caller** before
touching it — this endpoint reads a private file by id.

**Behaviour.**

1. Load `public.materials` by id. 404 with a `code` if it is missing or
   not the caller's (see the error rule in
   [09 §5](09-phase0-operational.md)).
2. If `status = 'ready'` and `extracted_text` is present, **return the
   existing result and charge nothing.** This must be idempotent: the
   frontend fires it on every upload and may retry.
3. Set `status = 'processing'`.
4. Download `file_path` from the private `imports` bucket using the
   service credential. The bucket is folder-per-uid, so an anon or
   publishable key cannot read it.
5. Extract text. PDF text layer, DOCX, TXT/CSV/MD at minimum. OCR only
   if you already have it — a scanned book that cannot be read is a
   normal outcome, not an error.
6. Write `extracted_text`, `pages`, and `status = 'ready'`, or
   `status = 'failed'` if nothing usable came out.

**Response.**

```json
{ "id": "<uuid>", "status": "ready", "chars": 48210, "pages": 48 }
```

**Cost.** Add an `extract` key to `ai_credit_costs` — 1 to 3 credits
feels right for a one-off read of a whole book. Charge it **once**, on
the first successful extraction, never on the idempotent return.

---

## §3 · Generation should prefer the stored text

This is the actual saving, and it is the reason §2 exists.

Today a request carrying `materials: [{id, name}]` downloads and parses
each file, and `ai_credit_costs.materials` (3) is charged per request
that has any attachment. A teacher working through one chapter across a
week of lessons pays that repeatedly for the same pages.

**Change:** when a referenced material has `status = 'ready'`, use
`extracted_text` and skip the download entirely. **Do not apply the
`materials` charge for a read you did not perform.** Keep charging it
for files you did have to open.

Everything else about the contract is unchanged:

- The browser still sends only `{ id, name }`.
- Files you genuinely cannot use still come back in `unread_materials`,
  echoing the **exact display names** you were sent, and the generation
  still succeeds without them.
- Note the names now come from `title` when the teacher has set one, so
  echo the string you received rather than re-deriving it from
  `file_name`.

---

## §4 · Worth knowing for what comes next

Phase 5 of the build plan puts a retrieval corpus over this same text
(`pgvector`, not yet enabled — only `pg_cron` is). Two things now make
that much cheaper later:

- **Chunk boundaries.** If extraction can preserve headings and page
  numbers rather than flattening to one string, the eventual chunker
  gets coherent passages instead of fixed windows. Storing the text with
  its structure intact costs nothing today.
- **`kind` and the class binding** are already on the row, so retrieval
  can filter by grade and subject *before* the vector search — which is
  what stops a Grade 4 lesson pulling a Grade 10 passage.

Neither is required now. Both are much harder to add after a few
thousand books have been flattened.

---

## Definition of done

- Uploading a textbook sets `status = 'ready'` and a page count without
  the teacher doing anything.
- Attaching that same file to five lessons downloads it once and charges
  the read once.
- A scanned PDF with no text layer ends as `failed`, the shelf says
  "Couldn't read", and a generation attaching it still succeeds and
  names it in `unread_materials`.
- Calling the endpoint twice on the same row charges once.

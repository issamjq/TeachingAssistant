import { test, expect, type Page } from "@playwright/test";

// The clicks, actually clicked.
//
// The rest of the suite proves routes resolve; this drives the §105/§106
// screens and asserts what each button DOES — which modal opens, which
// row is written, and with what. It exists because "typecheck, lint and
// build are green" was repeatedly not the same as "the button works", and
// finding that out by hand cost a round trip every time.
//
// No account and no network: the studio's guard reads localStorage, and the
// data layer talks to Supabase over PostgREST (and Storage, for §106's
// documents), so all three are stubbed here. That makes this a test of the
// FRONTEND — state, handlers, the request it forms — and deliberately not
// of RLS, which has no meaning without a real token and is the database's
// job to enforce anyway.

const DIVISION_A_ID = "11111111-1111-1111-1111-111111111111";
const DIVISION_B_ID = "33333333-3333-3333-3333-333333333333";
const CLASS_ID = "22222222-2222-2222-2222-222222222222";
const SUBJECT_ID = "44444444-4444-4444-4444-444444444444";
const DOC_ID = "55555555-5555-5555-5555-555555555555";

const DIVISIONS = [
  {
    id: DIVISION_A_ID,
    grade: "Grade 9",
    division: "A",
    academic_year: "2026-2027",
    is_archived: false,
    created_at: "2026-09-01T00:00:00Z",
    division_members: [{ student_id: "s1" }, { student_id: "s2" }],
    classes: [{ id: CLASS_ID, subject: "Physics" }],
  },
  {
    id: DIVISION_B_ID,
    grade: "Grade 9",
    division: "B",
    academic_year: "2026-2027",
    is_archived: false,
    created_at: "2026-09-01T00:00:00Z",
    division_members: [{ student_id: "s3" }],
    classes: [],
  },
];

const CLASSES = [
  {
    id: CLASS_ID,
    name: "Grade 9 A Physics",
    subject: "Physics",
    grade: "Grade 9",
    division: "A",
    class_code: "PHY-ABC123",
    academic_year: "2026-2027",
    division_id: DIVISION_A_ID,
    is_archived: false,
  },
];

const FACULTY_SUBJECTS = [
  { id: SUBJECT_ID, name: "Robotics", name_ar: null, is_archived: false },
];

const CLASS_DOCUMENTS = [
  {
    id: DOC_ID,
    class_id: CLASS_ID,
    name: "Syllabus.pdf",
    path: "00000000-0000-0000-0000-0000000000aa/22222222-2222-2222-2222-222222222222/1-Syllabus.pdf",
    mime_type: "application/pdf",
    size_bytes: 1024,
    created_at: "2026-09-01T00:00:00Z",
  },
];

const CURRICULA = [{ code: "cbse", name: "CBSE", name_ar: null, region: "IN" }];
const CURRICULUM_UNITS = [
  {
    id: "unit-1", curriculum_code: "cbse", grade: "Grade 9", subject: "Physics",
    seq: 1, title: "Forces and Motion", outcomes: ["Explain Newton's laws"],
    typical_weeks: 3, source: "starter",
  },
];

const STUDENTS = [
  { id: "s1", first_name: "Reem", last_name: "Al Dhaheri", student_code: "STU-00001", email: "r@x.com", grade: "Grade 9", division: "A" },
  { id: "s2", first_name: "Saif", last_name: "Al Nuaimi", student_code: "STU-00002", email: "s@x.com", grade: "Grade 9", division: "A" },
  // Not in either division's roll — the one the "add students" picker
  // has left to offer.
  { id: "s3", first_name: "Mariam", last_name: "Al Hashimi", student_code: "STU-00003", email: "m@x.com", grade: "Grade 9", division: "" },
];

/** Every write the page made, so a click can be asserted on its effect. */
type Written = { method: string; url: string; body: unknown };

async function studio(page: Page, opts: { scope?: boolean } = {}) {
  const written: Written[] = [];
  page.on("console", (m) => { if (m.type() === "error") console.log("CONSOLE ERROR:", m.text()); });
  page.on("pageerror", (e) => console.log("PAGE ERROR:", e.message));

  // The shell's guard is synchronous localStorage — no auth round trip.
  await page.addInitScript(
    ([scope]) => {
      localStorage.setItem(
        "murchid.account",
        JSON.stringify({ provider: "email", plan: "starter", email: "t@x.com" }),
      );
      localStorage.setItem("murchid_role", "teacher");
      if (scope) {
        localStorage.setItem(
          "murchid.studio.class-scope",
          JSON.stringify({ subject: "Physics", grade: "Grade 9", key: "physics|9" }),
        );
      }
    },
    [!!opts.scope],
  );

  // Supabase, stubbed. Matching on the table name in the path keeps this
  // readable and independent of the exact select= string, which changes
  // whenever a column is added.
  // A session supabase-js believes.
  //
  // Reads are happy without one; WRITES are not, and that asymmetry is
  // correct — every insert supplies its own owner id because RLS checks
  // it rather than filling it in, so the data layer resolves identity
  // first and throws NotSignedIn when it cannot. With auth stubbed to a
  // null user the app did the right thing and signed itself out, which
  // looked exactly like "the button does nothing".
  const USER = {
    id: "00000000-0000-0000-0000-0000000000aa",
    aud: "authenticated",
    role: "authenticated",
    email: "teacher@example.test",
    app_metadata: {},
    user_metadata: {},
    created_at: "2026-01-01T00:00:00Z",
  };
  await page.route("**/auth/v1/**", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(USER) }),
  );

  // Storage: uploads and removals for §106's required documents. Any
  // bucket, any path — the point here is the REQUEST got made with the
  // right method against the right bucket, not that a real file landed.
  //
  // Supabase's URL is a different origin from localhost, so a POST with
  // an Authorization header is CORS-preflighted: the browser sends an
  // OPTIONS first and refuses to even attempt the real request unless
  // that OPTIONS answers with the right Access-Control-Allow-* headers.
  // Without them here, `.upload()` fails as a plain network error and
  // the test saw nothing happen — the fetch never reached this stub's
  // logic at all, only its CORS-less response to the preflight.
  await page.route("**/storage/v1/object/**", (r) => {
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "*",
    };
    if (r.request().method() === "OPTIONS") {
      return r.fulfill({ status: 204, headers });
    }
    written.push({ method: r.request().method(), url: r.request().url(), body: null });
    return r.fulfill({
      status: 200,
      contentType: "application/json",
      headers,
      body: JSON.stringify({ Key: "ok" }),
    });
  });

  await page.route("**/rest/v1/**", async (route) => {
    const req = route.request();
    const url = req.url();
    const method = req.method();
    let body: unknown = null;
    try { body = req.postDataJSON(); } catch { /* GET, or not JSON */ }

    if (method !== "GET") written.push({ method, url, body });

    // PostgREST returns a single OBJECT, not a one-element array, when the
    // client asks for one — which is what .single() and .maybeSingle() do
    // via this Accept header. Returning an array to those was the stub
    // being unfaithful, and it surfaced as the save failing rather than
    // as anything naming the cause.
    const wantsObject = (req.headers()["accept"] || "").includes("vnd.pgrst.object");
    const json = (data: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify(
          wantsObject && Array.isArray(data) ? (data[0] ?? null) : data,
        ),
      });

    if (url.includes("/rest/v1/divisions")) return json(method === "GET" ? DIVISIONS : DIVISIONS[0]);
    if (url.includes("/rest/v1/classes")) return json(method === "GET" ? CLASSES : CLASSES[0]);
    if (url.includes("/rest/v1/faculty_subjects")) return json(method === "GET" ? FACULTY_SUBJECTS : FACULTY_SUBJECTS[0]);
    if (url.includes("/rest/v1/class_documents")) return json(method === "GET" ? CLASS_DOCUMENTS : (method === "DELETE" ? [] : CLASS_DOCUMENTS[0]));
    if (url.includes("/rest/v1/curricula")) return json(CURRICULA);
    if (url.includes("/rest/v1/curriculum_units")) return json(CURRICULUM_UNITS);
    if (url.includes("/rest/v1/division_members")) {
      if (method !== "GET") return json([]);
      // Division-aware, unlike the other stubs here: the "add students"
      // picker needs a real difference between "already in this
      // division" and "not yet" to be worth testing at all.
      const roll = url.includes(DIVISION_A_ID) ? [STUDENTS[0], STUDENTS[1]] : [];
      return json(roll.map((s) => ({ id: `m-${s.id}`, joined_at: null, students: s })));
    }
    if (url.includes("/rest/v1/class_members")) return json([]);
    if (url.includes("/rest/v1/faculty")) return json({ id: "00000000-0000-0000-0000-0000000000bb" });
    if (url.includes("/rest/v1/students")) return json(STUDENTS);
    if (url.includes("/rest/v1/rpc/class_roster")) return json(STUDENTS.map((s) => ({ student_id: s.id })));
    if (url.includes("/rest/v1/rpc/")) return json({});
    return json([]);
  });

  // The storage key is sb-<project-ref>-auth-token, and the ref comes
  // from NEXT_PUBLIC_SUPABASE_URL, which is inlined into the bundle and
  // not readable from here. So: load once to learn the host from the
  // first PostgREST call, then seed the session and let the caller
  // navigate again for real. Self-configuring beats a hardcoded ref that
  // silently stops matching the day the project moves.
  await page.goto("/subjects");
  const probe = await page.waitForRequest((r) => r.url().includes("/rest/v1/"), { timeout: 20_000 });
  const ref = new URL(probe.url()).hostname.split(".")[0];
  await page.addInitScript(
    ([key, user]) => {
      localStorage.setItem(
        key as string,
        JSON.stringify({
          access_token: "test-token",
          refresh_token: "test-refresh",
          token_type: "bearer",
          expires_in: 3600,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          user,
        }),
      );
    },
    [`sb-${ref}-auth-token`, USER],
  );
  written.length = 0; // the probe load is not part of any assertion
  return written;
}

test.describe("adding a class covers several divisions at once", () => {
  test("checking two existing divisions writes one class per division", async ({ page }) => {
    const written = await studio(page);
    await page.goto("/subjects");

    await expect(page).toHaveURL(/\/subjects$/);
    await expect(page.getByRole("heading", { name: /subjects and divisions/i })).toBeVisible();

    // Wait for the divisions to land before clicking. The header and the
    // button render before the fetch resolves, and clicking into that gap
    // catches the node mid-swap — Playwright reports it as "element was
    // detached", which is a real race a fast user could also lose.
    await expect(page.getByRole("heading", { name: /^Grade 9/ }).first()).toBeVisible();
    await page.waitForLoadState("networkidle");

    // The rail offers "Add a class" too — deliberately, since it is the
    // way in when there are no classes yet. Scope to the main landmark so
    // this drives the page's button rather than the sidebar's.
    await page.getByRole("main").getByRole("button", { name: /add a class/i }).click();
    const add = page.getByRole("button", { name: /^add class/i });

    // Validation is real: a subject alone is not a class, and neither is
    // a subject with nothing checked.
    await expect(add).toBeDisabled();
    await page.getByLabel(/^subject/i).fill("Chemistry");
    await expect(add).toBeDisabled();

    // Both Grade 9 divisions, checked — the multi-division case this
    // screen exists for.
    await page.getByLabel("A", { exact: true }).check();
    await expect(add).toHaveText(/add class$/i); // singular, one checked so far
    await page.getByLabel("B", { exact: true }).check();
    await expect(add).toHaveText(/add classes \(2\)/i);

    await add.dispatchEvent("click");
    await expect(
      page.getByRole("heading", { name: /add a class/i }),
      "the dialog should close only once the write has finished",
    ).toBeHidden({ timeout: 10_000 });

    const classWrites = written.filter((w) => w.url.includes("/rest/v1/classes") && w.method === "POST");
    expect(classWrites.length, "one class per checked division").toBe(2);
    const divisionIds = classWrites.map((w) => (w.body as Record<string, unknown>).division_id);
    expect(divisionIds.sort()).toEqual([DIVISION_A_ID, DIVISION_B_ID].sort());
    expect(classWrites.every((w) => (w.body as Record<string, unknown>).subject === "Chemistry")).toBe(true);

    // No division was typed as new, so none should be created.
    expect(written.filter((w) => w.url.includes("/rest/v1/divisions") && w.method === "POST").length).toBe(0);
  });

  test("a new grade typed in is created once and a class is written for it", async ({ page }) => {
    const written = await studio(page);
    await page.goto("/subjects");
    await expect(page.getByRole("heading", { name: /^Grade 9/ }).first()).toBeVisible();
    await page.waitForLoadState("networkidle");

    await page.getByRole("main").getByRole("button", { name: /add a class/i }).click();
    await page.getByLabel(/^subject/i).fill("Robotics"); // already a named subject in the fixture
    await page.getByPlaceholder(/new grade/i).fill("Grade 10");
    await page.getByRole("button", { name: "+ Add" }).click();

    // The pending chip appears, and the save button counts it even though
    // nothing checked above it yet.
    await expect(page.getByText("Grade 10", { exact: true })).toBeVisible();
    const add = page.getByRole("button", { name: /^add class/i });
    await expect(add).toBeEnabled();
    await add.dispatchEvent("click");
    await expect(page.getByRole("heading", { name: /add a class/i })).toBeHidden({ timeout: 10_000 });

    // Robotics is already a named subject, so it must not be re-created.
    expect(written.some((w) => w.url.includes("faculty_subjects") && w.method === "POST")).toBe(false);
    const divWrite = written.find((w) => w.url.includes("/rest/v1/divisions") && w.method === "POST");
    expect(divWrite, "the new grade must be created").toBeTruthy();
    expect((divWrite!.body as Record<string, unknown>).grade).toBe("Grade 10");
    expect(written.some((w) => w.url.includes("/rest/v1/classes") && w.method === "POST")).toBe(true);
  });

  test("required documents are attached to every class the save creates", async ({ page }) => {
    const written = await studio(page);
    await page.goto("/subjects");
    await expect(page.getByRole("heading", { name: /^Grade 9/ }).first()).toBeVisible();
    await page.waitForLoadState("networkidle");

    await page.getByRole("main").getByRole("button", { name: /add a class/i }).click();
    await page.getByLabel(/^subject/i).fill("Chemistry");
    await page.getByLabel("A", { exact: true }).check();
    await page.getByLabel("B", { exact: true }).check();

    await page.locator('input[type="file"]').first().setInputFiles({
      name: "syllabus.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 fake"),
    });
    await expect(page.getByText("syllabus.pdf")).toBeVisible();

    await page.getByRole("button", { name: /^add classes \(2\)/i }).dispatchEvent("click");
    await expect(page.getByRole("heading", { name: /add a class/i })).toBeHidden({ timeout: 10_000 });

    const uploads = written.filter((w) => w.url.includes("/storage/v1/object/"));
    const docRows = written.filter((w) => w.url.includes("/rest/v1/class_documents") && w.method === "POST");
    expect(uploads.length, "one upload per class created").toBe(2);
    expect(docRows.length, "one index row per class created").toBe(2);
  });
});

test.describe("subjects and divisions can be renamed and removed", () => {
  test("renaming a subject writes the new name", async ({ page }) => {
    const written = await studio(page);
    await page.goto("/subjects");
    await expect(page.getByRole("heading", { name: /subjects and divisions/i })).toBeVisible();

    await page.getByRole("button", { name: "Edit Robotics" }).click();
    await expect(page.getByRole("heading", { name: /rename subject/i })).toBeVisible();
    const input = page.getByLabel(/subject name/i);
    await input.fill("");
    await input.fill("Engineering");
    await page.getByRole("button", { name: /^save$/i }).click();
    await expect(page.getByRole("heading", { name: /rename subject/i })).toBeHidden({ timeout: 10_000 });

    const w = written.find((x) => x.url.includes("faculty_subjects") && x.method === "PATCH");
    expect(w, "a rename is a PATCH on the subject's own row").toBeTruthy();
    expect((w!.body as Record<string, unknown>).name).toBe("Engineering");
  });

  test("deleting a subject archives it rather than typing a DELETE verb at the row", async ({ page }) => {
    const written = await studio(page);
    await page.goto("/subjects");
    await expect(page.getByRole("button", { name: "Delete Robotics" })).toBeVisible();
    await page.getByRole("button", { name: "Delete Robotics" }).click();

    const w = written.find((x) => x.url.includes("faculty_subjects") && x.method === "PATCH");
    expect(w, "archived, not row-deleted — work already filed under it keeps its label").toBeTruthy();
    expect((w!.body as Record<string, unknown>).is_archived).toBe(true);
  });

  test("editing a division writes its new grade and division", async ({ page }) => {
    const written = await studio(page);
    await page.goto("/subjects");
    await expect(page.getByRole("button", { name: "Edit Grade 9 A" })).toBeVisible();
    await page.getByRole("button", { name: "Edit Grade 9 A" }).click();
    await expect(page.getByRole("heading", { name: /edit division/i })).toBeVisible();

    const divisionField = page.getByLabel(/^division/i);
    await divisionField.fill("");
    await divisionField.fill("C");
    await page.getByRole("button", { name: /^save$/i }).click();
    await expect(page.getByRole("heading", { name: /edit division/i })).toBeHidden({ timeout: 10_000 });

    const w = written.find((x) => x.url.includes("/rest/v1/divisions") && x.method === "PATCH");
    expect(w).toBeTruthy();
    expect((w!.body as Record<string, unknown>).division).toBe("C");
  });

  test("deleting a division archives it", async ({ page }) => {
    const written = await studio(page);
    await page.goto("/subjects");
    await page.getByRole("button", { name: "Delete Grade 9 A" }).click();

    const w = written.find((x) => x.url.includes("/rest/v1/divisions") && x.method === "PATCH");
    expect(w).toBeTruthy();
    expect((w!.body as Record<string, unknown>).is_archived).toBe(true);
  });

  test("stopping a taught subject archives the class, not the division", async ({ page }) => {
    const written = await studio(page);
    await page.goto("/subjects");
    await page.getByRole("button", { name: "Stop teaching Physics to Grade 9 A" }).click();

    const w = written.find((x) => x.url.includes("/rest/v1/classes") && x.method === "PATCH");
    expect(w).toBeTruthy();
    expect((w!.body as Record<string, unknown>).is_archived).toBe(true);
  });
});

test.describe("required documents on an existing class", () => {
  test("lists what is attached and can remove one", async ({ page }) => {
    const written = await studio(page);
    await page.goto("/subjects");
    await page.getByRole("button", { name: "Manage documents for Physics" }).click();

    await expect(page.getByRole("heading", { name: /required documents — physics/i })).toBeVisible();
    await expect(page.getByText("Syllabus.pdf")).toBeVisible();

    await page.getByRole("button", { name: "Remove" }).click();
    await expect(page.getByText("Syllabus.pdf")).toBeHidden();

    const w = written.find((x) => x.url.includes("/rest/v1/class_documents") && x.method === "DELETE");
    expect(w, "removing a document deletes its index row").toBeTruthy();
  });

  test("attaching a new file uploads it and writes its row", async ({ page }) => {
    const written = await studio(page);
    await page.goto("/subjects");
    await page.getByRole("button", { name: "Manage documents for Physics" }).click();
    await expect(page.getByText("Syllabus.pdf")).toBeVisible();

    await page.locator('input[type="file"]').setInputFiles({
      name: "rubric.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 fake rubric"),
    });

    await expect.poll(() =>
      written.some((w) => w.url.includes("/storage/v1/object/") && w.url.includes("class-documents"))
    ).toBe(true);
    const row = written.find((w) => w.url.includes("/rest/v1/class_documents") && w.method === "POST");
    expect(row).toBeTruthy();
    expect((row!.body as Record<string, unknown>).name).toBe("rubric.pdf");
    expect((row!.body as Record<string, unknown>).class_id).toBe(CLASS_ID);
  });
});

test.describe("a subject can exist before it has a class", () => {
  test("Add subject on /subjects only names it — no class is written", async ({ page }) => {
    const written = await studio(page);
    await page.goto("/subjects");
    await expect(page.getByRole("heading", { name: /^Grade 9/ }).first()).toBeVisible();

    await page.getByRole("button", { name: "Add subject" }).click();
    await expect(page.getByRole("heading", { name: "Add a subject" })).toBeVisible();
    await page.getByLabel(/subject name/i).fill("Debate");
    await page.getByRole("button", { name: "Add subject" }).last().click();
    await expect(page.getByRole("heading", { name: "Add a subject" })).toBeHidden({ timeout: 10_000 });

    const w = written.find((x) => x.url.includes("faculty_subjects") && x.method === "POST");
    expect(w, "the subject itself is created").toBeTruthy();
    expect((w!.body as Record<string, unknown>).name).toBe("Debate");
    expect(written.some((x) => x.url.includes("/rest/v1/classes")), "no class or division is touched").toBe(false);
  });

  test("Add a subject here, from class settings, teaches it to the same divisions", async ({ page }) => {
    const written = await studio(page, { scope: true });
    await page.goto("/class-settings");
    await expect(page.getByText("Reem Al Dhaheri")).toBeVisible();

    await page.getByRole("button", { name: "Add a subject here" }).click();
    await expect(page.getByRole("heading", { name: "Add a subject here" })).toBeVisible();
    await page.getByLabel(/subject name/i).fill("Chemistry");
    await page.getByRole("button", { name: "Add subject" }).click();
    await expect(page.getByRole("heading", { name: "Add a subject here" })).toBeHidden({ timeout: 10_000 });

    const classWrite = written.find((x) => x.url.includes("/rest/v1/classes") && x.method === "POST");
    expect(classWrite, "taught straight to the class's own division, no picker needed").toBeTruthy();
    expect((classWrite!.body as Record<string, unknown>).subject).toBe("Chemistry");
    expect((classWrite!.body as Record<string, unknown>).division_id).toBe(DIVISION_A_ID);
  });
});

test.describe("students can be enrolled straight into a division", () => {
  test("the picker on /subjects offers only students not already in it", async ({ page }) => {
    const written = await studio(page);
    await page.goto("/subjects");
    await expect(page.getByRole("heading", { name: /^Grade 9/ }).first()).toBeVisible();

    await page.getByRole("button", { name: "Add students to Grade 9 A" }).click();
    await expect(page.getByRole("heading", { name: "Add students to Grade 9 A" })).toBeVisible();

    // s1 and s2 are already on this division's roll (the fixture) — only
    // s3 is left to offer.
    await expect(page.getByText("Mariam Al Hashimi")).toBeVisible();
    await expect(page.getByText("Reem Al Dhaheri")).toBeHidden();

    await page.getByText("Mariam Al Hashimi").click();
    await page.getByRole("button", { name: "Add 1" }).click();
    await expect(page.getByRole("heading", { name: "Add students to Grade 9 A" })).toBeHidden({ timeout: 10_000 });

    const w = written.find((x) => x.url.includes("/rest/v1/division_members") && x.method === "POST");
    expect(w, "joins the division, not a class").toBeTruthy();
    expect((w!.body as { student_id: string }[])[0]?.student_id).toBe("s3");
  });
});

test.describe("class settings drives the roll", () => {
  test("shows the resolved roll and does not bounce to the dashboard", async ({ page }) => {
    await studio(page, { scope: true });
    await page.goto("/class-settings");

    await expect(page).toHaveURL(/\/class-settings$/);
    await expect(page.getByText("Reem Al Dhaheri")).toBeVisible();
    await expect(page.getByText("Saif Al Nuaimi")).toBeVisible();
  });

  test("removing a student writes an exclusion, not a deletion", async ({ page }) => {
    const written = await studio(page, { scope: true });
    await page.goto("/class-settings");
    await expect(page.getByText("Reem Al Dhaheri")).toBeVisible();

    const row = page.locator("li", { hasText: "Reem Al Dhaheri" }).first();
    await row.getByRole("button", { name: /this subject only/i }).click();
    await expect(page.getByText("Reem Al Dhaheri")).toBeHidden({ timeout: 10_000 });

    // The whole point of the override layer: the child stays in the
    // division and is excluded from THIS subject.
    const w = written.find((x) => x.url.includes("class_members"));
    expect(w, "an exception row must be written").toBeTruthy();
    expect(w!.method, "an exclusion is an upsert, never a DELETE on the division").not.toBe("DELETE");
    expect((w!.body as Record<string, unknown>).mode).toBe("exclude");
  });

  test("with no class picked it asks for one instead of showing an empty roll", async ({ page }) => {
    await studio(page); // no scope
    await page.goto("/class-settings");
    await expect(page.getByRole("heading", { name: /pick a class first/i })).toBeVisible();
  });

  test("the Curriculum link opens the standalone curriculum page, scoped to the class", async ({ page }) => {
    await studio(page, { scope: true });
    await page.goto("/class-settings");

    await page.getByText("Curriculum", { exact: true }).click();
    await expect(page).toHaveURL(/\/curriculum$/);
    // Not a detour through "+ New goal" — its own screen, with the
    // class already scoped so a teacher does not re-pick a grade and
    // subject she was just looking at.
    await expect(page.getByRole("heading", { name: /physics.*units and pacing/i })).toBeVisible();
    await expect(page.getByLabel("Grade")).toHaveValue("Grade 9");
    await expect(page.getByLabel("Subject")).toHaveValue("Physics");
  });

  test("picking a unit on the curriculum page hands it to the goal planner", async ({ page }) => {
    await studio(page, { scope: true });
    await page.goto("/curriculum");

    await page.getByLabel("Curriculum").selectOption("cbse");
    await expect(page.getByText("Forces and Motion")).toBeVisible();
    await page.getByText("Forces and Motion").click();

    await expect(page).toHaveURL(/\/goals\?curriculum=1$/);
    // The composer opens with the unit already filling the goal in —
    // picking it a second time inside goals would be asking the same
    // question twice.
    await expect(page.getByRole("heading", { name: /what should your students master/i })).toBeVisible();
    await expect(page.getByLabel(/^goal$/i)).toHaveValue("Forces and Motion");
  });
});

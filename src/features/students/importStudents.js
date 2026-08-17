// =====================================================================
// Turn an uploaded roster (CSV / Excel / PDF) into student rows
//
// Teachers keep their class lists in spreadsheets. Rather than retyping
// thirty names into a form, they drop the file here and we map its columns
// onto the student shape the app already understands.
//
// CSV and Excel are exact — a spreadsheet is a grid, and a grid maps
// cleanly onto columns. PDF is best-effort: a PDF has no columns, only
// positioned text, so we read its text layer and split each line on a
// detected delimiter. It works for a table exported to PDF; it will not
// work for a scanned photo of a register. The sample and the UI both push
// CSV for that reason.
// =====================================================================

// The canonical columns — what the sample file uses and what maps cleanly.
export const SAMPLE_HEADERS = [
  "first_name", "last_name", "student_id", "email", "grade", "section", "subject",
  "date_of_birth", "gender", "nationality",
  "guardian_name", "guardian_email", "guardian_phone",
];

// A downloadable example the teacher can fill in. Two rows so the shape of
// real data is obvious (dates, an email that later becomes their login).
export function sampleCsv() {
  const rows = [
    SAMPLE_HEADERS.join(","),
    "Aisha,Al Mansoori,S1001,aisha@example.com,Grade 6,A,Mathematics,2013-04-12,Female,Emirati,Mariam Al Mansoori,mariam@example.com,+971500000001",
    "Omar,Khan,S1002,omar@example.com,Grade 6,A,Mathematics,2013-09-01,Male,Pakistani,Bilal Khan,bilal@example.com,+971500000002",
  ];
  return rows.join("\n") + "\n";
}

// Trigger a browser download of the sample.
export function downloadSample() {
  const blob = new Blob([sampleCsv()], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "murchid-students-sample.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Header (any spelling) → the student field it fills. Keys are normalised:
// lowercased, non-alphanumerics stripped, so "Guardian Phone", "guardian_phone"
// and "guardianPhone" all collapse to "guardianphone".
const HEADER_MAP = {
  firstname: "first_name", first: "first_name", givenname: "first_name",
  lastname: "last_name", last: "last_name", surname: "last_name", familyname: "last_name",
  name: "__name", fullname: "__name", studentname: "__name",
  studentid: "student_id", id: "student_id", rollno: "student_id", roll: "student_id", admissionno: "student_id",
  email: "email", emailaddress: "email", studentemail: "email",
  grade: "grade", gradelevel: "grade", class: "grade", year: "grade",
  section: "section", division: "section",
  subject: "subject", subjects: "subject", course: "subject",
  dateofbirth: "date_of_birth", dob: "date_of_birth", birthdate: "date_of_birth",
  gender: "gender", sex: "gender",
  nationality: "nationality",
  phone: "phone", mobile: "phone", contact: "phone", studentphone: "phone",
  guardianname: "primary_guardian_name", guardian: "primary_guardian_name",
  parentname: "primary_guardian_name", parent: "primary_guardian_name", fathername: "primary_guardian_name", mothername: "primary_guardian_name",
  guardianemail: "primary_guardian_email", parentemail: "primary_guardian_email",
  guardianphone: "primary_guardian_phone", parentphone: "primary_guardian_phone", guardiancontact: "primary_guardian_phone",
  guardianrelationship: "primary_guardian_relationship", relationship: "primary_guardian_relationship", relation: "primary_guardian_relationship",
  notes: "notes", note: "notes", remarks: "notes", comment: "notes",
  address: "address",
};

const norm = (h) => String(h || "").toLowerCase().replace(/[^a-z0-9]/g, "");

// Normalise a date-ish string to YYYY-MM-DD, or null. A bad date must not
// sink the whole batch — a nulled birthday is recoverable, a failed insert
// of 200 rows is not. Assumes day-first for slashed dates (UAE norm).
function toISODate(v) {
  if (v == null || v === "") return null;
  const s = String(v).trim();
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/); // YYYY-MM-DD
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/); // DD-MM-YYYY (day first)
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

// One raw record (header→value) → a student payload in the screen's shape.
function mapRecord(raw) {
  const out = {};
  for (const [key, val] of Object.entries(raw)) {
    const field = HEADER_MAP[norm(key)];
    if (!field) continue;
    const value = typeof val === "string" ? val.trim() : val;
    if (value === "" || value == null) continue;
    if (field === "__name") {
      const parts = String(value).trim().split(/\s+/);
      out.first_name = out.first_name || parts[0];
      if (parts.length > 1) out.last_name = out.last_name || parts.slice(1).join(" ");
    } else if (field === "date_of_birth") {
      const iso = toISODate(value);
      if (iso) out.date_of_birth = iso;
    } else {
      out[field] = value;
    }
  }
  return out;
}

// ── CSV ────────────────────────────────────────────────────────────────
// A small state machine rather than split(",") — a guardian name like
// "Khan, Bilal" in quotes must stay one field, and "" is an escaped quote.
function parseCsvGrid(text) {
  const rows = [];
  let row = [], field = "", inQuotes = false;
  const t = text.replace(/\r\n?/g, "\n");
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (inQuotes) {
      if (c === '"') {
        if (t[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => String(c).trim() !== ""));
}

function gridToRecords(grid) {
  if (!grid.length) return [];
  const headers = grid[0].map((h) => String(h).trim());
  return grid.slice(1).map((cells) => {
    const rec = {};
    headers.forEach((h, i) => { rec[h] = cells[i] ?? ""; });
    return rec;
  });
}

// ── PDF (best-effort) ────────────────────────────────────────────────
// No columns in a PDF — only lines of positioned text. Detect the
// delimiter each line uses and split on it. Skip a line that doesn't split
// into at least two fields; that is prose, not a row.
function detectDelimiter(lines) {
  for (const d of [",", "\t", "|", ";"]) {
    if (lines.filter((l) => l.includes(d)).length >= Math.max(2, lines.length * 0.5)) return d;
  }
  // Fall back to runs of 2+ spaces, common in a monospaced table dump.
  return /\s{2,}/;
}

function pdfTextToRecords(text) {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const delim = detectDelimiter(lines);
  const split = (l) => (typeof delim === "string" ? l.split(delim) : l.split(delim)).map((c) => c.trim());
  const grid = lines.map(split).filter((r) => r.length >= 2);
  return gridToRecords(grid);
}

/**
 * Parse an uploaded roster file into student payloads.
 * @param {File} file
 * @returns {Promise<{ rows: object[], format: string, note?: string }>}
 */
export async function parseRosterFile(file) {
  const name = (file.name || "").toLowerCase();
  const isCsv = name.endsWith(".csv") || file.type === "text/csv";
  const isExcel = /\.xlsx?$/.test(name) || /spreadsheet|excel/.test(file.type);
  const isPdf = name.endsWith(".pdf") || file.type === "application/pdf";

  let records = [];
  let format = "csv";
  let note;

  if (isExcel) {
    format = "excel";
    const XLSX = await import("xlsx"); // lazy — the parser is only pulled on demand
    const wb = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: false });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    records = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });
  } else if (isPdf) {
    format = "pdf";
    const { extractPdfText } = await import("@/features/onboarding/extractText");
    const text = await extractPdfText(file);
    if (!text) {
      note = "Couldn’t read a table from this PDF. Export it as CSV or Excel for a reliable import.";
    } else {
      records = pdfTextToRecords(text);
      note = "Read from PDF text — please check the preview carefully before importing.";
    }
  } else if (isCsv) {
    records = gridToRecords(parseCsvGrid(await file.text()));
  } else {
    // Unknown extension — try CSV, it costs nothing.
    records = gridToRecords(parseCsvGrid(await file.text()));
  }

  const rows = records.map(mapRecord).filter((r) => (r.first_name || r.last_name));
  return { rows, format, note };
}

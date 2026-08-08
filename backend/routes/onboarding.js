// =====================================================================
// Onboarding — read a teacher's details off a CV or an institution ID
//
// POST /api/onboarding/parse
//   { documents: [{ name, mediaType, dataBase64, kind }] }
//   → { fields: {...}, found: [...], missing: [...] }
//
// The point is to save typing, not to be authoritative. Everything this
// returns is shown back to the teacher on a review screen before it is
// saved, because OCR of a laminated staff card photographed at an angle
// is exactly as reliable as that sounds. Nothing here writes to the
// database — that is /api/me's job, after a human has confirmed it.
//
// Documents are NOT persisted by this route. The browser uploads the
// original to Supabase Storage under the teacher's own session, so the
// file never passes through a process holding a privileged key. See
// docs and the storage policy SQL in todo/supabase-migration.md.
// =====================================================================
import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { handleErr } from "../lib/helpers.js";

const router = Router();

// Same gate as the studio's attachments: a CV is a PDF or a photo of
// one, and an ID card is a photo. Anything else is a mistake or an
// attack, and both are handled by refusing it.
const ALLOWED = new Set([
  "image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf",
]);
/** ~5.5MB decoded per file, ~13MB total — mirrors routes/studio.js. */
const MAX_ONE = 7_500_000;
const MAX_TOTAL = 18_000_000;

// The only fields worth extracting. Deliberately short: the sign-up form
// asks for four things, and everything beyond them is a bonus that saves
// the teacher a trip to Settings later. Asking the model for more than
// this measurably increases how often it invents things.
const EXTRACT_TOOL = {
  name: "teacher_details",
  description:
    "The teacher's details as they appear in the supplied documents. " +
    "Omit any field the documents do not state. Never guess.",
  input_schema: {
    type: "object",
    properties: {
      first_name: { type: "string", description: "Given name only." },
      last_name: { type: "string", description: "Family name only." },
      staff_id: { type: "string", description: "Employee or staff number, if printed." },
      email: { type: "string" },
      phone: { type: "string" },
      school: { type: "string", description: "School or institution name." },
      majors: {
        type: "array",
        items: { type: "string" },
        description: "Subjects taught, e.g. Physics, Mathematics.",
      },
      grade_levels: {
        type: "array",
        items: { type: "string" },
        description: 'Grades taught, e.g. "Grade 9", "KG2".',
      },
      languages: {
        type: "array",
        items: { type: "string" },
        description: "Languages the teacher can teach in.",
      },
      nationality: { type: "string" },
      bio: {
        type: "string",
        description:
          "One or two sentences of professional summary, in the teacher's own words if the CV has one.",
      },
    },
    required: [],
  },
};

const PROMPT =
  "These documents belong to a teacher signing up for a lesson-planning tool. " +
  "Extract only what is actually written in them. If a field is not stated, " +
  "leave it out rather than inferring it — a wrong staff number or a guessed " +
  "subject costs the teacher more time than a blank field does. " +
  "For grades, normalise to the form 'Grade 9' or 'KG2'. " +
  "For subjects, use the common English name.";

const buildContent = (documents) => {
  let total = 0;
  const blocks = documents.map((d) => {
    if (!ALLOWED.has(d.mediaType)) {
      throw Object.assign(new Error(`Files of type "${d.mediaType}" can't be read.`), {
        code: "DOC_TYPE",
      });
    }
    if (!d.dataBase64 || d.dataBase64.length > MAX_ONE) {
      throw Object.assign(new Error("That file is too large — keep each under about 5 MB."), {
        code: "DOC_SIZE",
      });
    }
    total += d.dataBase64.length;
    return d.mediaType === "application/pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: d.dataBase64 } }
      : { type: "image", source: { type: "base64", media_type: d.mediaType, data: d.dataBase64 } };
  });
  if (total > MAX_TOTAL) {
    throw Object.assign(new Error("Those files are too large together."), { code: "DOC_SIZE" });
  }
  return [...blocks, { type: "text", text: PROMPT }];
};

/** Drop empty strings and empty arrays so `found` means "actually there". */
const clean = (obj) => {
  const out = {};
  for (const [k, v] of Object.entries(obj || {})) {
    if (typeof v === "string" && v.trim()) out[k] = v.trim();
    else if (Array.isArray(v) && v.length) out[k] = v.filter((x) => typeof x === "string" && x.trim());
  }
  return out;
};

/** What the sign-up form cannot proceed without. */
const REQUIRED = ["first_name", "last_name", "majors", "grade_levels"];

router.post("/parse", async (req, res) => {
  try {
    const documents = Array.isArray(req.body?.documents) ? req.body.documents : [];
    if (documents.length === 0 || documents.length > 4) {
      return res.status(400).json({ error: "Send between one and four documents." });
    }

    // Fail with an explanation rather than a 500 from the SDK. Without a
    // key this is the one route in the app whose absence is invisible
    // until a teacher uploads a file and waits.
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(503).json({
        error: "Document reading isn't configured on this server.",
        code: "NO_AI_KEY",
      });
    }

    const client = new Anthropic();
    const out = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      tools: [EXTRACT_TOOL],
      // Forced tool use: the reply is the structured object or nothing.
      // Parsing prose for these fields is how you end up with a staff ID
      // of "Staff ID: 4417".
      tool_choice: { type: "tool", name: EXTRACT_TOOL.name },
      messages: [{ role: "user", content: buildContent(documents) }],
    });

    const block = out.content.find((c) => c.type === "tool_use");
    const fields = clean(block?.input);
    res.json({
      fields,
      found: Object.keys(fields),
      missing: REQUIRED.filter((k) => !fields[k]),
    });
  } catch (e) {
    if (e?.code === "DOC_TYPE" || e?.code === "DOC_SIZE") {
      return res.status(400).json({ error: e.message, code: e.code });
    }
    handleErr(res, e, "Couldn't read those documents.");
  }
});

export default router;

// =====================================================================
// Pull the text layer out of a CV, in the browser, before it is sent
//
// A CV exported from Word or LaTeX carries its text inside the PDF. There
// is no reason to base64 five megabytes of it up to the API and pay a
// model to look at pictures of words it could simply have been given —
// the same document goes from ~2MB of inline data to ~4KB of text, which
// is roughly two orders of magnitude fewer tokens and turns a slow
// request into a fast one.
//
// The catch, and the reason this returns null rather than throwing: a
// scanned CV and a photographed staff card have NO text layer. Extraction
// on those yields a handful of junk characters, and a handful of junk
// characters is worse than nothing because it looks like success. So
// anything that comes back too thin is treated as "this file has no text"
// and the caller falls back to uploading the bytes.
// =====================================================================

/**
 * Below this many characters, assume there is no real text layer. A CV
 * with a name, a school and one job runs to several hundred; scanned
 * pages typically yield page numbers and OCR artefacts, i.e. tens.
 */
const MIN_USEFUL = 220;

/** Beyond this we are into a thesis appended to a CV. Costs tokens, adds nothing. */
const MAX_CHARS = 40_000;

/**
 * pdf.js needs a worker, and it is a big one — so it is imported only
 * when a teacher actually picks a file, never as part of the page.
 */
let pdfjsPromise = null;
function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist").then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerPort = new Worker(
        new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url),
        { type: "module" }
      );
      return pdfjs;
    });
    // A failed import must not poison every later attempt.
    pdfjsPromise.catch(() => { pdfjsPromise = null; });
  }
  return pdfjsPromise;
}

/**
 * One page's items, joined back into lines.
 *
 * pdf.js hands back positioned fragments, not lines — a two-column CV
 * arrives as a stream of pieces whose reading order is the order they
 * were painted in. Grouping by baseline (`transform[5]`, the y) restores
 * the lines, which matters because "Physics" and "Grade 9" landing in one
 * run of text is how a model ends up reading a subject as a grade.
 */
function pageToText(items) {
  const lines = new Map();
  for (const it of items) {
    if (typeof it.str !== "string") continue;
    // Round the baseline: characters on one line differ by fractions of a
    // pixel, and an exact key would give every glyph its own line.
    const y = Math.round(it.transform[5]);
    const line = lines.get(y);
    if (line) line.push(it);
    else lines.set(y, [it]);
  }
  return [...lines.entries()]
    .sort((a, b) => b[0] - a[0]) // PDF y grows upward; the page reads downward
    .map(([, run]) =>
      run
        .sort((a, b) => a.transform[4] - b.transform[4])
        .map((it) => it.str)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim()
    )
    .filter(Boolean)
    .join("\n");
}

/**
 * The text of a PDF, or null if it hasn't got any worth sending.
 *
 * Never throws: a file this cannot read is not an error the teacher needs
 * to see, it is a file that gets uploaded the other way instead.
 *
 * @param {File} file
 * @returns {Promise<string|null>}
 */
export async function extractPdfText(file) {
  if (file.type !== "application/pdf") return null;
  try {
    const pdfjs = await loadPdfjs();
    const buf = await file.arrayBuffer();
    const doc = await pdfjs.getDocument({
      data: new Uint8Array(buf),
      // A CV is text and layout. Nothing here needs the fonts rendered or
      // the embedded JavaScript run, and not running it is the point.
      disableFontFace: true,
      isEvalSupported: false,
    }).promise;

    const parts = [];
    let chars = 0;
    // Six pages is already an unusually long CV; past that it is
    // publications, which the form has nowhere to put.
    const pages = Math.min(doc.numPages, 6);
    for (let i = 1; i <= pages && chars < MAX_CHARS; i++) {
      const page = await doc.getPage(i);
      const { items } = await page.getTextContent();
      const text = pageToText(items);
      if (text) {
        parts.push(text);
        chars += text.length;
      }
      page.cleanup();
    }
    await doc.destroy();

    const out = parts.join("\n\n").slice(0, MAX_CHARS).trim();
    return out.length >= MIN_USEFUL ? out : null;
  } catch {
    // Encrypted, corrupt, or a PDF pdf.js dislikes. Fall back.
    return null;
  }
}

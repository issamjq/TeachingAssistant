// Shared export for the teaching surfaces (lesson plans, quizzes, homework,
// presentations, activities). Two targets, one source model:
//
//   printDoc(doc)   → browser "Save as PDF" via a clean, chrome-free print
//                     layout (matches how the AI Studio + Reports export).
//   exportDocx(doc) → a real .docx (Word/Pages/Docs) via the `docx` dep,
//                     dynamic-imported so it only ships when used.
//
// Both consume the same normalized doc model so every surface formats the
// same way and we only maintain one renderer per target:
//
//   {
//     title:    string,
//     subtitle?: string,                 // e.g. "Quiz · Grade 5 · Math"
//     meta?:    [{ label, value }],       // key/value facts row
//     blocks:   [ Block ]
//   }
//
//   Block =
//     | { type:'heading',   text, level? }          // level 1–4 (default 2)
//     | { type:'paragraph', text }                  // newlines become breaks
//     | { type:'note',      text }                  // muted italic aside
//     | { type:'list',      items:[string], ordered? }
//     | { type:'qa',        n, prompt, choices?:[string], marks?, answer? }
//     | { type:'divider' }

const escapeHtml = (s) =>
  String(s ?? "").replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])
  );

// Plain text → HTML with newlines preserved as <br>.
const textHtml = (s) => escapeHtml(s).replace(/\r?\n/g, "<br>");

function blockToHtml(b) {
  switch (b?.type) {
    case "heading": {
      const lvl = Math.min(Math.max(b.level || 2, 1), 4);
      return `<h${lvl} class="pd-h pd-h${lvl}">${escapeHtml(b.text)}</h${lvl}>`;
    }
    case "paragraph":
      return `<p class="pd-p">${textHtml(b.text)}</p>`;
    case "note":
      return `<p class="pd-note">${textHtml(b.text)}</p>`;
    case "list": {
      const tag = b.ordered ? "ol" : "ul";
      const items = (b.items || [])
        .filter((it) => it != null && String(it).trim() !== "")
        .map((it) => `<li>${textHtml(it)}</li>`)
        .join("");
      return items ? `<${tag} class="pd-list">${items}</${tag}>` : "";
    }
    case "qa": {
      const marks =
        b.marks != null
          ? ` <span class="pd-marks">(${escapeHtml(b.marks)} ${b.marksLabel || (b.marks == 1 ? "mark" : "marks")})</span>`
          : "";
      const head = `<p class="pd-q"><span class="pd-qn">${escapeHtml(b.n)}.</span> ${textHtml(b.prompt)}${marks}</p>`;
      let body = "";
      if (b.choices && b.choices.length) {
        body =
          `<ol class="pd-choices" type="A">` +
          b.choices.map((c) => `<li>${textHtml(c)}</li>`).join("") +
          `</ol>`;
      } else {
        // Short-answer / written: leave ruled space to write on.
        body = `<div class="pd-lines"><span></span><span></span><span></span></div>`;
      }
      const ans = b.answer
        ? `<p class="pd-answer"><strong>${b.answerLabel || "Answer"}:</strong> ${textHtml(b.answer)}</p>`
        : "";
      return head + body + ans;
    }
    case "divider":
      return `<hr class="pd-hr"/>`;
    default:
      return "";
  }
}

export function docToHtml(doc) {
  const meta = (doc.meta || [])
    .filter((m) => m && m.value != null && String(m.value).trim() !== "")
    .map(
      (m) =>
        `<span class="pd-meta-item"><span class="pd-meta-label">${escapeHtml(m.label)}</span> ${escapeHtml(m.value)}</span>`
    )
    .join("");
  const blocks = (doc.blocks || []).map(blockToHtml).join("\n");
  return (
    `<article class="pd-doc">` +
    `<header class="pd-header">` +
    `<h1 class="pd-title">${escapeHtml(doc.title || "Untitled")}</h1>` +
    (doc.subtitle ? `<p class="pd-subtitle">${escapeHtml(doc.subtitle)}</p>` : "") +
    (meta ? `<div class="pd-meta">${meta}</div>` : "") +
    `</header>` +
    `<main class="pd-body">${blocks}</main>` +
    `<footer class="pd-footer">${escapeHtml(doc.footer || "Made with Murchid")}</footer>` +
    `</article>`
  );
}

// ── PDF (browser print) ────────────────────────────────────────────────
// Render the doc into a body-level host that only the print stylesheet
// reveals (see #murchid-print-root in index.css). `murchid-printing` on
// <body> scopes the "hide everything else" rule to our prints so it never
// interferes with the Studio's own print path.
let _printRoot = null;
export function printDoc(doc) {
  if (typeof window === "undefined") return;
  if (!_printRoot || !_printRoot.isConnected) {
    _printRoot = document.createElement("div");
    _printRoot.id = "murchid-print-root";
    document.body.appendChild(_printRoot);
  }
  _printRoot.innerHTML = docToHtml(doc);
  document.body.classList.add("murchid-printing");
  const cleanup = () => {
    document.body.classList.remove("murchid-printing");
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);
  // Let the host paint before the print dialog snapshots it.
  setTimeout(() => window.print(), 40);
}

// ── Word (.docx) ───────────────────────────────────────────────────────
const sanitizeFilename = (s) =>
  String(s || "Murchid document")
    .replace(/[\/\\:*?"<>|]/g, "")
    .trim()
    .slice(0, 100) || "Murchid document";

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Arabic / Hebrew / Persian / Urdu / Syriac / Thaana / N'Ko — anything Word
// treats as a complex (RTL) script. Per-paragraph detection means a mixed
// EN/AR doc keeps each paragraph aligned to its own dominant script.
const RTL_RE = /[֐-ࣿיִ-﷿ﹰ-ﻼ]/;
const isRtl = (s) => RTL_RE.test(String(s ?? ""));

export async function exportDocx(doc) {
  const docx = await import("docx");
  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = docx;
  const HEADINGS = [
    HeadingLevel.HEADING_1,
    HeadingLevel.HEADING_2,
    HeadingLevel.HEADING_3,
    HeadingLevel.HEADING_4,
  ];
  const MUTED = "6E5C4A";
  const CLAY = "B5754E";

  // Build a TextRun that knows whether it sits in an RTL paragraph. The
  // `rightToLeft` flag emits w:rtl so Word treats the run as complex script
  // and bidi-orders it correctly.
  const tr = (textOrOpts, rtl) => {
    const base = typeof textOrOpts === "string" ? { text: textOrOpts } : textOrOpts;
    return new TextRun({ ...base, ...(rtl ? { rightToLeft: true } : {}) });
  };
  // Paragraph with bidirectional set when its text contains RTL script.
  const para = (opts, refText) => {
    const probe = refText != null ? refText : opts.text;
    const rtl = isRtl(probe);
    return new Paragraph({ ...opts, ...(rtl ? { bidirectional: true } : {}) });
  };

  const kids = [];
  kids.push(para({ text: doc.title || "Untitled", heading: HeadingLevel.TITLE }));
  if (doc.subtitle)
    kids.push(
      para(
        { children: [tr({ text: doc.subtitle, italics: true, color: MUTED }, isRtl(doc.subtitle))] },
        doc.subtitle
      )
    );
  const metaItems = (doc.meta || []).filter((m) => m && m.value != null && String(m.value).trim() !== "");
  if (metaItems.length) {
    const metaText = metaItems.map((m) => `${m.label} ${m.value}`).join(" ");
    const metaRtl = isRtl(metaText);
    kids.push(
      para(
        {
          children: metaItems.flatMap((m, i) => [
            ...(i ? [tr({ text: "    •    ", color: CLAY }, metaRtl)] : []),
            tr({ text: `${m.label}: `, bold: true }, metaRtl),
            tr(String(m.value), metaRtl),
          ]),
        },
        metaText
      )
    );
  }
  kids.push(new Paragraph({ text: "" }));

  for (const b of doc.blocks || []) {
    switch (b?.type) {
      case "heading":
        kids.push(
          para({ text: b.text || "", heading: HEADINGS[Math.min((b.level || 2) - 1, 3)] })
        );
        break;
      case "paragraph":
        (String(b.text || "").split(/\r?\n/)).forEach((line) => {
          const rtl = isRtl(line);
          kids.push(para({ children: [tr(line, rtl)] }, line));
        });
        break;
      case "note": {
        const rtl = isRtl(b.text);
        kids.push(
          para(
            { children: [tr({ text: b.text || "", italics: true, color: MUTED }, rtl)] },
            b.text
          )
        );
        break;
      }
      case "list":
        (b.items || [])
          .filter((it) => it != null && String(it).trim() !== "")
          .forEach((it, i) => {
            const rtl = isRtl(it);
            if (b.ordered) {
              kids.push(
                para(
                  { children: [tr(`${i + 1}. ${it}`, rtl)], indent: { left: 360 } },
                  it
                )
              );
            } else {
              kids.push(para({ text: String(it), bullet: { level: 0 } }, it));
            }
          });
        break;
      case "qa": {
        const qText = `${b.prompt || ""} ${(b.choices || []).join(" ")} ${b.answer || ""}`;
        const qRtl = isRtl(qText);
        kids.push(
          para(
            {
              children: [
                tr({ text: `${b.n}. `, bold: true }, qRtl),
                tr(b.prompt || "", qRtl),
                ...(b.marks != null
                  ? [
                      tr(
                        {
                          text: `   (${b.marks} ${b.marksLabel || (b.marks == 1 ? "mark" : "marks")})`,
                          italics: true,
                          color: MUTED,
                        },
                        qRtl
                      ),
                    ]
                  : []),
              ],
            },
            qText
          )
        );
        (b.choices || []).forEach((c, i) => {
          const cRtl = isRtl(c) || qRtl;
          kids.push(
            para(
              {
                children: [tr(`${String.fromCharCode(65 + i)}. ${c}`, cRtl)],
                indent: { left: 480 },
              },
              c
            )
          );
        });
        if (b.answer) {
          const aRtl = isRtl(b.answer) || qRtl;
          kids.push(
            para(
              {
                children: [
                  tr({ text: `${b.answerLabel || "Answer"}: `, bold: true }, aRtl),
                  tr(b.answer, aRtl),
                ],
              },
              b.answer
            )
          );
        }
        kids.push(new Paragraph({ text: "" }));
        break;
      }
      case "divider":
        kids.push(new Paragraph({ text: "" }));
        break;
      default:
        break;
    }
  }

  const built = new Document({ sections: [{ children: kids }] });
  const blob = await Packer.toBlob(built);
  downloadBlob(blob, `${sanitizeFilename(doc.title)}.docx`);
}

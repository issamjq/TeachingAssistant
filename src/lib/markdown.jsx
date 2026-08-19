// Tiny markdown utilities for the AI Studio split-pane editor.
//
// We deliberately ship a minimal parser/renderer instead of pulling in
// react-markdown / remark. The model output is a constrained subset
// (## headings, * / - bullets, 1. numbered lists, **bold**, *italic*) and
// rolling our own keeps the bundle lean and the rendering style perfectly
// aligned with the Murchid design system.
import React from "react";

// --- parse ------------------------------------------------------------------

const slugify = (s) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40);

// Split the document into top-level "## section" blocks. Anything before the
// first ## becomes a "header" block so the title line + meta line aren't
// dropped on the floor.
const splitByH2 = (markdown) => {
  const lines = (markdown || "").split(/\r?\n/);
  const blocks = [];
  let current = null;
  let preambleSeen = false;

  for (const line of lines) {
    if (/^##\s+/.test(line) && !/^###/.test(line)) {
      if (current) blocks.push(current);
      const title = line.replace(/^##\s+/, "").trim();
      current = { id: slugify(title) || `section-${blocks.length}`, title, markdown: line + "\n" };
    } else if (current) {
      current.markdown += line + "\n";
    } else if (line.trim() && !preambleSeen) {
      preambleSeen = true;
      current = { id: "header", title: "Header", markdown: line + "\n" };
    }
    // A fourth `else if (current)` used to sit here, duplicating the second
    // branch. It was unreachable — anything with `current` set is caught
    // above — so removing it changes nothing.
  }
  if (current) blocks.push(current);
  return blocks.map((b) => ({ ...b, markdown: b.markdown.trim() }));
};

// Quizzes have an interesting shape: ## Questions wraps a numbered list of
// items. Split that list so each question becomes its own card.
const splitQuizQuestions = (sections) => {
  const out = [];
  for (const s of sections) {
    if (/^questions?$/i.test(s.title) || /questions?\b/i.test(s.title)) {
      // Strip the heading line — we'll keep it as a tiny header card so the
      // user can still edit "Questions" preamble if any.
      const body = s.markdown.replace(/^##.*\n?/, "").trim();
      // Split on lines that start with "<digit>. " — this is the standard
      // markdown numbered-list shape the system prompt asks for.
      const items = body.split(/\n(?=\d+\.\s)/).map((x) => x.trim()).filter(Boolean);
      if (items.length === 0) {
        out.push(s);
        continue;
      }
      items.forEach((item) => {
        const num = item.match(/^(\d+)\./)?.[1] || (out.length + 1);
        out.push({
          id: `q${num}`,
          title: `Question ${num}`,
          markdown: item,
          isQuestion: true,
        });
      });
    } else {
      out.push(s);
    }
  }
  return out;
};

export function parseSections(markdown, kind) {
  const blocks = splitByH2(markdown);
  if (kind === "quiz") return splitQuizQuestions(blocks);
  return blocks;
}

// --- join -------------------------------------------------------------------

export function joinSections(sections) {
  // Use streamingMarkdown if a section is mid-regeneration, so the live
  // preview reflects the in-progress replacement.
  return sections
    .map((s) => (s.streamingMarkdown != null ? s.streamingMarkdown : s.markdown))
    .filter(Boolean)
    .join("\n\n");
}

// --- render -----------------------------------------------------------------

// Render a tight subset of markdown to React. Designed for the constrained
// output the AI Studio system prompt asks for. No HTML / no scripts / no
// dangerouslySetInnerHTML — everything is built as React elements, so XSS
// is structurally impossible.
const renderInline = (text, baseKey) => {
  const parts = [];
  let remaining = text;
  let k = 0;
  // Process **bold**, *italic*, `code` — left-to-right, longest match first.
  while (remaining.length > 0) {
    const bold = remaining.match(/^([\s\S]*?)\*\*([\s\S]+?)\*\*([\s\S]*)$/);
    const code = remaining.match(/^([\s\S]*?)`([^`]+?)`([\s\S]*)$/);
    const italic = remaining.match(/^([\s\S]*?)\*([^\s*][^*]*?)\*([\s\S]*)$/);

    // Pick whichever match starts earliest in `remaining`.
    const candidates = [
      bold && { kind: "bold", m: bold, start: bold[1].length },
      code && { kind: "code", m: code, start: code[1].length },
      italic && { kind: "italic", m: italic, start: italic[1].length },
    ].filter(Boolean);
    candidates.sort((a, b) => a.start - b.start);
    const winner = candidates[0];
    if (!winner) {
      parts.push(remaining);
      break;
    }
    if (winner.m[1]) parts.push(winner.m[1]);
    if (winner.kind === "bold") {
      parts.push(<strong key={`${baseKey}-${k++}`} className="font-semibold text-ink">{winner.m[2]}</strong>);
    } else if (winner.kind === "italic") {
      parts.push(<em key={`${baseKey}-${k++}`} className="italic">{winner.m[2]}</em>);
    } else if (winner.kind === "code") {
      parts.push(<code key={`${baseKey}-${k++}`} className="font-mono text-[0.85em] bg-paper-warm border border-line/60 rounded px-1.5 py-0.5">{winner.m[2]}</code>);
    }
    remaining = winner.m[3];
  }
  return parts;
};

/**
 * GFM tables.
 *
 * Every lesson and every set of student notes carries a key-words table, so
 * this is not an edge case. Without it the rows fell through to the paragraph
 * collapser at the bottom of renderMarkdown, which joins consecutive lines
 * with a space — and a vocabulary table reached the teacher as one run of
 * prose with the pipes still in it.
 */
const isTableRow = (line) => typeof line === "string" && /^\s*\|.*\|\s*$/.test(line);
const isTableDivider = (line) =>
  typeof line === "string" && /^\s*\|(?:\s*:?-+:?\s*\|)+\s*$/.test(line);
const splitRow = (line) =>
  line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());

export function renderMarkdown(markdown) {
  if (!markdown) return null;
  const lines = markdown.split(/\r?\n/);
  const out = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Headings
    let m = line.match(/^(#{1,6})\s+(.*)$/);
    if (m) {
      const level = m[1].length;
      const text = m[2];
      // Studio uses Inter Tight body throughout — no serif headings, no
      // mono-uppercase eyebrows. Only weight + size differentiates levels.
      const headingClasses = {
        1: "text-xl font-semibold text-ink mt-5 mb-2 leading-tight",
        2: "text-lg font-semibold text-ink mt-4 mb-1.5 leading-tight",
        3: "text-base font-semibold text-ink mt-3 mb-1",
        4: "text-sm font-semibold text-ink-soft mt-3 mb-1",
        5: "text-sm font-medium text-muted mt-2 mb-0.5",
        6: "text-sm font-medium text-muted mt-2 mb-0.5",
      }[Math.min(level, 6)];
      const Tag = `h${Math.min(level + 1, 6)}`;
      out.push(React.createElement(Tag, { key: key++, className: headingClasses }, renderInline(text, `h${key}`)));
      i++;
      continue;
    }

    // Unordered list
    if (/^\s*[\*\-]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[\*\-]\s+/.test(lines[i])) {
        items.push(<li key={items.length} className="ml-1">{renderInline(lines[i].replace(/^\s*[\*\-]\s+/, ""), `li${i}`)}</li>);
        i++;
      }
      out.push(<ul key={key++} className="list-disc list-outside pl-5 space-y-1 my-2 text-sm text-ink-soft">{items}</ul>);
      continue;
    }

    // Ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(<li key={items.length} className="ml-1">{renderInline(lines[i].replace(/^\s*\d+\.\s+/, ""), `oli${i}`)}</li>);
        i++;
      }
      out.push(<ol key={key++} className="list-decimal list-outside pl-5 space-y-1 my-2 text-sm text-ink-soft">{items}</ol>);
      continue;
    }

    // Tables. Header row, divider, then body rows until the block ends.
    if (isTableRow(line) && isTableDivider(lines[i + 1])) {
      const header = splitRow(line);
      i += 2;
      const rows = [];
      while (i < lines.length && isTableRow(lines[i])) {
        rows.push(splitRow(lines[i]));
        i++;
      }
      const tk = key++;
      out.push(
        <div key={tk} className="my-3 overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                {header.map((cell, c) => (
                  <th
                    key={c}
                    className="border border-line/60 bg-paper-warm px-2.5 py-1.5 text-left font-semibold text-ink align-top"
                  >
                    {renderInline(cell, `th${tk}-${c}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, r) => (
                <tr key={r}>
                  {header.map((_, c) => (
                    <td
                      key={c}
                      className="border border-line/60 px-2.5 py-1.5 text-ink-soft align-top"
                    >
                      {renderInline(row[c] ?? "", `td${tk}-${r}-${c}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // Blank line — separator
    if (!line.trim()) {
      i++;
      continue;
    }

    // Plain paragraph (collapse consecutive non-empty lines)
    const para = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,6})\s+/.test(lines[i]) &&
      !/^\s*[\*\-]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i]) &&
      !isTableRow(lines[i])
    ) {
      para.push(lines[i]);
      i++;
    }
    out.push(<p key={key++} className="text-sm text-ink-soft leading-relaxed my-2">{renderInline(para.join(" "), `p${key}`)}</p>);
  }
  return out;
}

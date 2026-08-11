import { test, expect } from "@playwright/test";
import { splitAudience, joinAudience, audienceOverlaps } from "@/shared/lib/audience";
import { entriesClash } from "@/shared/lib/scheduleClash";
import { docToMarkdown } from "@/lib/export";

// Rules that decide what a teacher sees, checked without a browser.
//
// These three are pure by design precisely so they can be tested here:
// the audience fields hold a list in one text column, the clash warning
// decides whether a save is questioned, and the Markdown export is a
// third format over the shared doc model. All three are easy to get
// subtly wrong and impossible to notice by eye.

test.describe("audience fields hold one value or a list", () => {
  test("splits, trims, and drops the empties", () => {
    expect(splitAudience("Grade 9, Grade 11")).toEqual(["Grade 9", "Grade 11"]);
    expect(splitAudience("Grade 9")).toEqual(["Grade 9"]);
    expect(splitAudience("A,,  B ")).toEqual(["A", "B"]);
    expect(splitAudience("")).toEqual([]);
    expect(splitAudience(null)).toEqual([]);
    expect(splitAudience(undefined)).toEqual([]);
  });

  test("round-trips through storage unchanged", () => {
    const picked = ["Grade 9", "Grade 11"];
    expect(splitAudience(joinAudience(picked))).toEqual(picked);
    // A row written before multi-select reads as a list of one.
    expect(splitAudience("Grade 7")).toEqual(["Grade 7"]);
  });

  test("empty means everyone, so it overlaps with anything", () => {
    expect(audienceOverlaps("", "Grade 9")).toBe(true);
    expect(audienceOverlaps("Grade 9", "")).toBe(true);
    expect(audienceOverlaps(null, null)).toBe(true);
  });

  test("lists overlap when they share any one value", () => {
    expect(audienceOverlaps("Grade 9, Grade 11", "Grade 11")).toBe(true);
    expect(audienceOverlaps("Grade 9, Grade 11", "Grade 10, Grade 11")).toBe(true);
    expect(audienceOverlaps("Grade 9", "Grade 10")).toBe(false);
    expect(audienceOverlaps("Grade 9, Grade 11", "Grade 8, Grade 10")).toBe(false);
  });
});

test.describe("schedule clash warning", () => {
  const at = (start: string, end?: string, extra: Record<string, unknown> = {}) => ({
    id: "other",
    title: "Existing",
    start_time: start,
    end_time: end ?? null,
    ...extra,
  });

  test("back-to-back lessons do not warn", () => {
    expect(entriesClash({ start_time: "10:00", end_time: "11:00" }, at("09:00", "10:00"))).toBe(false);
    expect(entriesClash({ start_time: "09:00", end_time: "10:00" }, at("10:00", "11:00"))).toBe(false);
  });

  test("genuinely overlapping lessons warn", () => {
    expect(entriesClash({ start_time: "09:30", end_time: "10:30" }, at("09:00", "10:00"))).toBe(true);
    // One wholly inside the other.
    expect(entriesClash({ start_time: "09:15", end_time: "09:30" }, at("09:00", "11:00"))).toBe(true);
    // Identical slots.
    expect(entriesClash({ start_time: "09:00", end_time: "10:00" }, at("09:00", "10:00"))).toBe(true);
  });

  test("an entry with no end time holds the rest of the hour", () => {
    expect(entriesClash({ start_time: "09:30", end_time: "10:30" }, at("09:00"))).toBe(true);
    expect(entriesClash({ start_time: "10:00", end_time: "11:00" }, at("09:00"))).toBe(false);
    // Late in the day the +1h would clamp; it must not collapse to zero
    // length and silently stop warning.
    expect(entriesClash({ start_time: "23:40", end_time: "23:50" }, at("23:30"))).toBe(true);
  });

  test("an end time typed before the start still occupies its hour", () => {
    expect(entriesClash({ start_time: "09:00", end_time: "08:00" }, at("09:30", "10:30"))).toBe(true);
  });

  test("only the same audience clashes, and empty means everyone", () => {
    const nine = { start_time: "09:00", end_time: "10:00", grade: "Grade 9" };
    expect(entriesClash(nine, at("09:30", "10:30", { grade: "Grade 10" }))).toBe(false);
    expect(entriesClash(nine, at("09:30", "10:30", { grade: "Grade 9" }))).toBe(true);
    // A slot with no grade is the teacher's whole hour.
    expect(entriesClash(nine, at("09:30", "10:30", { grade: null }))).toBe(true);
    // Multi-grade entries clash on any shared grade.
    expect(
      entriesClash(
        { start_time: "09:00", end_time: "10:00", grade: "Grade 9, Grade 11" },
        at("09:30", "10:30", { grade: "Grade 11" }),
      ),
    ).toBe(true);
    // Sharing a grade but not a section is not a clash.
    expect(
      entriesClash(
        { start_time: "09:00", end_time: "10:00", grade: "Grade 9", section: "A" },
        at("09:30", "10:30", { grade: "Grade 9", section: "B" }),
      ),
    ).toBe(false);
  });

  test("cancelled entries and entries without a time occupy nothing", () => {
    const mine = { start_time: "09:00", end_time: "10:00" };
    expect(entriesClash(mine, at("09:30", "10:30", { status: "cancelled" }))).toBe(false);
    expect(entriesClash(mine, at(null as unknown as string))).toBe(false);
    expect(entriesClash({ start_time: null, end_time: null }, at("09:30", "10:30"))).toBe(false);
  });
});

test.describe("Markdown export", () => {
  const doc = {
    title: "Forces and motion",
    subtitle: "Quiz · Grade 9 · Physics",
    meta: [
      { label: "Grade", value: "Grade 9, Grade 11" },
      { label: "Empty", value: "" },
    ],
    blocks: [
      { type: "heading", text: "Section A", level: 2 },
      { type: "paragraph", text: "Answer every question." },
      { type: "note", text: "Calculators allowed." },
      { type: "list", items: ["First", "Second", ""], ordered: true },
      { type: "list", items: ["Bullet"] },
      {
        type: "qa",
        n: 1,
        prompt: "The resultant force is:",
        choices: ["Zero", "Forwards"],
        marks: 1,
        answer: "Zero",
      },
      { type: "divider" },
    ],
  };

  test("renders every block type", () => {
    const md = docToMarkdown(doc);
    expect(md).toContain("# Forces and motion");
    expect(md).toContain("*Quiz · Grade 9 · Physics*");
    expect(md).toContain("## Section A");
    expect(md).toContain("> *Calculators allowed.*");
    expect(md).toContain("1. First");
    expect(md).toContain("2. Second");
    expect(md).toContain("- Bullet");
    expect(md).toContain("**1.** The resultant force is: *(1 mark)*");
    expect(md).toContain("   A. Zero");
    expect(md).toContain("   B. Forwards");
    expect(md).toContain("   **Answer:** Zero");
    expect(md).toContain("---");
  });

  test("keeps a multi-grade audience intact and drops empty meta", () => {
    const md = docToMarkdown(doc);
    expect(md).toContain("**Grade:** Grade 9, Grade 11");
    expect(md).not.toContain("**Empty:**");
  });

  test("survives a doc with nothing in it", () => {
    const md = docToMarkdown({});
    expect(md).toContain("# Untitled");
    expect(md).toContain("Made with Murchid");
  });
});

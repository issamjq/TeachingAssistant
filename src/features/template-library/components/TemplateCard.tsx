import { ChevronRight, TrendingUp } from "lucide-react";
import type { TemplateSummary } from "../types";
import { subjectLabel } from "../labels";
import s from "../TemplateLibrary.module.css";

// One row in the shelf table. Bodyless by design — the title, summary
// and a document count are enough to decide whether to open it; the
// documents themselves load only when the drawer does.
export function TemplateCard({
  card,
  onOpen,
}: {
  card: TemplateSummary;
  onOpen: () => void;
}) {
  const docs = card.doc_kinds.length;
  return (
    <button type="button" className={s.row} onClick={onOpen}>
      <div className={s.cellTitle}>
        <span className={s.rowTitle}>{card.chapter_title}</span>
        {card.summary && <span className={s.rowSummary}>{card.summary}</span>}
      </div>

      <div className={s.cellGrade}>
        <span className={s.gradeTag}>{card.grade === 0 ? "KG" : `G${card.grade}`}</span>
      </div>

      <div className={s.cellMuted}>{subjectLabel(card.subject)}</div>

      <div className={s.cellMuted}>{docs === 1 ? "1 doc" : `${docs} docs`}</div>

      <div className={s.cellUsed}>
        <TrendingUp size={12} aria-hidden />
        {card.use_count}
      </div>

      <ChevronRight size={16} className={s.rowChevron} aria-hidden />
    </button>
  );
}

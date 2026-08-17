import { TrendingUp } from "lucide-react";
import type { TemplateSummary } from "../types";
import { KIND_LABEL, subjectLabel } from "../labels";
import s from "../TemplateLibrary.module.css";

// One card in the shelf. Bodyless by design — the summary and the kinds
// it carries are enough to decide whether to open it; the documents load
// only when the drawer does.
export function TemplateCard({
  card,
  onOpen,
}: {
  card: TemplateSummary;
  onOpen: () => void;
}) {
  return (
    <button type="button" className={s.card} onClick={onOpen}>
      <div className={s.cardMetaTop}>
        <span>Grade {card.grade}</span>
        <span className={s.dot} aria-hidden />
        <span>{subjectLabel(card.subject)}</span>
        {card.stream && (
          <>
            <span className={s.dot} aria-hidden />
            <span>{card.stream}</span>
          </>
        )}
      </div>

      <h3 className={s.cardTitle}>{card.chapter_title}</h3>
      {card.summary && <p className={s.cardSummary}>{card.summary}</p>}

      <div className={s.kindTags}>
        {card.doc_kinds.map((k) => (
          <span key={k} className={s.kindTag}>
            {KIND_LABEL[k] ?? k}
          </span>
        ))}
      </div>

      <div className={s.cardFoot}>
        <span className={s.useCount}>
          <TrendingUp size={12} aria-hidden />
          {card.use_count === 1 ? "Used once" : `Used ${card.use_count}×`}
        </span>
        {card.origin === "official" && <span className={s.originBadge}>Official</span>}
      </div>
    </button>
  );
}

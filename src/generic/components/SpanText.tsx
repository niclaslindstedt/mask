// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { ReactNode } from "react";

// A text rendered with typed spans marked up in place: plain runs stay plain,
// each span becomes a `<mark>` (or a button when it's clickable) carrying the
// caller's class and title for that span. Spans must be non-overlapping and
// are rendered in text order; whitespace is preserved (`whitespace-pre-wrap`).

export type HighlightSpan = {
  start: number;
  end: number;
  /** Utility classes for this span's mark (the caller keys them off its kind). */
  className?: string;
  /** Tooltip text. */
  title?: string;
  /** Anything to render after the span text (a placeholder badge, say). */
  suffix?: ReactNode;
};

type Props = {
  text: string;
  spans: readonly HighlightSpan[];
  /** Makes each span a button; receives the span's index in `spans`. */
  onSpanClick?: (index: number) => void;
  className?: string;
};

export function SpanText({ text, spans, onSpanClick, className = "" }: Props) {
  const parts: ReactNode[] = [];
  let cursor = 0;
  const ordered = [...spans]
    .map((s, i) => ({ ...s, i }))
    .sort((a, b) => a.start - b.start);
  for (const span of ordered) {
    if (span.start < cursor) continue;
    if (span.start > cursor) parts.push(text.slice(cursor, span.start));
    const slice = text.slice(span.start, span.end);
    const cls = `rounded-sm px-0.5 ${span.className ?? "bg-accent/30 text-fg-bright"}`;
    parts.push(
      onSpanClick ? (
        <button
          key={`s-${span.i}`}
          type="button"
          title={span.title}
          onClick={() => onSpanClick(span.i)}
          className={`${cls} cursor-pointer align-baseline hover:ring-1 hover:ring-accent`}
        >
          {slice}
          {span.suffix}
        </button>
      ) : (
        <mark key={`s-${span.i}`} title={span.title} className={cls}>
          {slice}
          {span.suffix}
        </mark>
      ),
    );
    cursor = span.end;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return (
    <div className={`whitespace-pre-wrap break-words ${className}`.trim()}>
      {parts}
    </div>
  );
}

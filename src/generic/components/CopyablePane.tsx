// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { ReactNode } from "react";

import { CopyButton } from "@niclaslindstedt/oss-framework/components";

// A read-only block of text with a copy button in its header and a character
// count in its footer — the "here is your result, take it" surface. The
// framework's `CopyButton` owns the clipboard write and the "Copied" flash.

export type CopyablePaneLabels = {
  copy: string;
  copied: string;
  /** Footer count, e.g. `(n) => \`${n} characters\``. */
  count: (chars: number) => string;
  /** Shown in place of the text when it is empty. */
  empty: string;
};

type Props = {
  title: string;
  value: string;
  labels: CopyablePaneLabels;
  /** Extra header controls, rendered before the copy button. */
  actions?: ReactNode;
  onCopied?: () => void;
  className?: string;
  /** Height cap for the scrolling body (a Tailwind `max-h-*` class). */
  bodyClassName?: string;
};

export function CopyablePane({
  title,
  value,
  labels,
  actions,
  onCopied,
  className = "",
  bodyClassName = "max-h-[60vh]",
}: Props) {
  return (
    <section
      className={`flex min-h-0 flex-col overflow-hidden rounded-lg border border-line bg-surface ${className}`.trim()}
    >
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-line bg-surface-2 px-3 py-2">
        <h3 className="truncate text-sm font-semibold text-fg-bright">
          {title}
        </h3>
        <div className="flex items-center gap-2">
          {actions}
          <CopyButton
            value={value}
            labels={{ copy: labels.copy, copied: labels.copied }}
            onCopied={onCopied}
          />
        </div>
      </header>
      <div
        className={`min-h-0 overflow-y-auto px-3 py-2 text-sm whitespace-pre-wrap break-words text-fg ${bodyClassName}`}
      >
        {value.length > 0 ? (
          value
        ) : (
          <span className="text-muted">{labels.empty}</span>
        )}
      </div>
      <footer className="shrink-0 border-t border-line px-3 py-1 text-right text-xs text-muted tabular-nums">
        {labels.count(value.length)}
      </footer>
    </section>
  );
}

// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useState, type ReactNode } from "react";

import { CopyButton } from "@niclaslindstedt/oss-framework/components";

import {
  FullscreenButton,
  FullscreenLayer,
  type FullscreenLabels,
} from "./Fullscreen.tsx";

// A read-only block of text with a copy button in its header and a character
// count in its footer — the "here is your result, take it" surface. The
// framework's `CopyButton` owns the clipboard write and the "Copied" flash.
//
// Given the labels for it, the header also offers to take the pane over the
// whole screen — a long document read on a phone is mostly the chrome around
// it otherwise.

export type CopyablePaneLabels = {
  copy: string;
  copied: string;
  /** Footer count, e.g. `(n) => \`${n} characters\``. */
  count: (chars: number) => string;
  /** Shown in place of the text when it is empty. */
  empty: string;
  /** Given, the header offers to take the pane over the whole screen. */
  fullscreen?: FullscreenLabels;
};

type Props = {
  title: string;
  value: string;
  labels: CopyablePaneLabels;
  /** Extra header controls, rendered before the copy button. */
  actions?: ReactNode;
  /** Drawn in place of the raw text. The copy button and the count still read
   *  `value`, so what leaves the pane is the source however it is shown. */
  body?: ReactNode;
  onCopied?: () => void;
  className?: string;
  /** Height cap for the scrolling body (a Tailwind `max-h-*` class). Ignored
   *  while the pane has the screen to itself. */
  bodyClassName?: string;
};

export function CopyablePane({
  title,
  value,
  labels,
  actions,
  body,
  onCopied,
  className = "",
  bodyClassName = "max-h-[60vh]",
}: Props) {
  const [full, setFull] = useState(false);

  return (
    <FullscreenLayer active={full} onExit={() => setFull(false)}>
      <section
        className={`flex min-h-0 flex-col overflow-hidden bg-surface ${
          full ? "flex-1" : "rounded-lg border border-line"
        } ${className}`.trim()}
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
            {labels.fullscreen && (
              <FullscreenButton
                active={full}
                labels={labels.fullscreen}
                onToggle={() => setFull((on) => !on)}
              />
            )}
          </div>
        </header>
        <div
          className={`min-h-0 overflow-y-auto px-3 py-2 text-sm break-words text-fg ${body === undefined ? "whitespace-pre-wrap" : ""} ${full ? "flex-1" : bodyClassName}`}
        >
          {value.length > 0 ? (
            (body ?? value)
          ) : (
            <span className="text-muted">{labels.empty}</span>
          )}
        </div>
        <footer className="shrink-0 border-t border-line px-3 py-1 text-right text-xs text-muted tabular-nums">
          {labels.count(value.length)}
        </footer>
      </section>
    </FullscreenLayer>
  );
}

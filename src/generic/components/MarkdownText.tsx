// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useMemo } from "react";

import {
  classifyLines,
  RenderedLine,
} from "@niclaslindstedt/oss-framework/markdown";

// A read-only block of Markdown, rendered formatted.
//
// The framework owns both halves of this — `classifyLines` assigns each source
// line a block kind, `RenderedLine` draws one — so all this adds is the
// read-only frame around them: no caret, no editing, no contenteditable. It is
// the "show me the document, not its syntax" counterpart to the live-preview
// editor, for text that was produced rather than typed.
//
// A blank line renders as a blank line rather than as an empty paragraph, so a
// document keeps the spacing it was written with.

export function MarkdownText({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) {
  const blocks = useMemo(() => classifyLines(text), [text]);
  return (
    <div className={`flex flex-col ${className}`.trim()}>
      {/* Source order is the only identity a line has — two lines of a
          document are routinely the same string. */}
      {blocks.map((block, index) => (
        <RenderedLine key={index} block={block} />
      ))}
    </div>
  );
}

// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  downloadBlob,
  downloadText,
} from "@niclaslindstedt/oss-framework/files";

// Getting a document out of the app. The masked text is the whole point of the
// app, so it has to leave it as a file and not only through the clipboard —
// a long judgment is not something anyone pastes into a chat box by hand.
//
// Two formats, because the masked text is Markdown: the `.md` file is the text
// exactly as the pane shows it, and the PDF is that text typeset, for handing
// on to someone who wants a document rather than a source file.
//
// The PDF writer is loaded on the press, never at mount — it is by far the
// heaviest thing the app can reach, and nobody who only copies should download
// it (see the "keep boot small" rule in AGENTS.md).

const MIME_MARKDOWN = "text/markdown;charset=utf-8";

/** A document's name with its extension taken off, so `beslut.pdf` downloads
 *  as `beslut-maskad.md` rather than `beslut.pdf-maskad.md`. */
export function baseName(name: string): string {
  const dot = name.lastIndexOf(".");
  const stem = dot > 0 ? name.slice(0, dot) : name;
  // Anything a file system would rather not see in a name — the separators and
  // the wildcards, plus a leading dot, which hides the file on every Unix.
  return (
    stem
      .replace(/[\\/:*?"<>|]+/g, "-")
      .replace(/^[.\s]+/, "")
      .trim() || "document"
  );
}

export function downloadMarkdown(name: string, text: string): void {
  downloadText(`${baseName(name)}.md`, text, MIME_MARKDOWN);
}

/** Typeset `text` and save it as a PDF. Rejects if the writer fails to load —
 *  the caller says so rather than leaving a press that did nothing. */
export async function downloadPdf(
  name: string,
  text: string,
  options: { title?: string; pageNumberOf?: string } = {},
): Promise<void> {
  const { renderPdf } = await import("../generic/pdf/write.ts");
  downloadBlob(
    `${baseName(name)}.pdf`,
    renderPdf({
      markdown: text,
      title: options.title,
      pageNumberOf: options.pageNumberOf,
    }),
  );
}

// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { loadSourceFile } from "./sourceFiles.ts";
import type { Doc } from "./types.ts";

// What the reader shows as *pages*, for each kind of document it holds.
//
// A PDF is already pages, and its own file is kept beside the text it gave up
// (`sourceFiles.ts`), so it opens as itself — the layout, the tables, the
// stamps, the signature.
//
// A Word file is not pages. It is a flow of paragraphs that only becomes pages
// when something paginates it, and nothing in a browser renders one without a
// word processor's worth of code. So it is typeset here instead: the same
// Markdown the extractor pulled out of it, run through the app's own PDF
// writer and handed to the same viewer. The layout is the typesetter's rather
// than Word's — the reader says so — but the reading is the point, and what
// the page shows is exactly what the detectors read.
//
// The writer is loaded on the open, never at mount: it is the heaviest thing
// the app can reach, and nobody who only reviews text should download it.

/** The little of a document this needs — its id to find a kept file by, and
 *  its text for a format that has to be typeset to have pages at all. */
export type PageSource = Pick<Doc, "id" | "format" | "text" | "name">;

/** The name with its extension off: `Beslut.docx` is titled `Beslut`. */
function titleOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return (dot > 0 ? name.slice(0, dot) : name).trim();
}

/** The PDF the reader paints `source`'s pages from, or null when it has none
 *  to show — a pasted document, or a file the vault never kept. */
export async function loadDocumentPages(
  source: PageSource,
  labels: { pageNumberOf?: string } = {},
): Promise<Blob | null> {
  if (source.format === "pdf") return loadSourceFile(source.id);
  if (source.format === "docx") {
    if (source.text.trim() === "") return null;
    const { renderPdf } = await import("../generic/pdf/write.ts");
    return renderPdf({
      markdown: source.text,
      title: titleOf(source.name),
      pageNumberOf: labels.pageNumberOf,
    });
  }
  return null;
}

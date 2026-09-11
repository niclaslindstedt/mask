// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The PDF half of `extractText`, split into its own chunk: `pdfjs-dist` is
// the one heavy dependency in the app and only a PDF upload needs it.
//
// Both imports point at pdf.js's `legacy/` build. The default build assumes a
// browser from the last few months — it reads the `Iterator` global at module
// scope, so it throws `Iterator is not defined` before a page is ever opened on
// anything older (Safari < 18.4, Chrome < 122, Firefox < 131). The legacy build
// carries the polyfills for that, and the ~60 KB it costs lands in a chunk
// nobody downloads until they upload a PDF.
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import type {
  PDFPageProxy,
  TextContent,
  TextItem,
} from "pdfjs-dist/types/src/display/api";
import workerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";

import { forEachChunk } from "./streamChunks.ts";
import {
  bodyTextHeight,
  groupRunsIntoLines,
  layoutDocumentParagraphs,
  type TextLine,
  type TextRun,
} from "./layout.ts";
import { paragraphsToMarkdown } from "./markup.ts";
import type { ExtractedText } from "./index.ts";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

/** A page's positioned text runs. pdf.js's own `page.getTextContent()` is a
 *  `for await` over this stream, which throws in WebKit — no browser there
 *  async-iterates a `ReadableStream` — so read the stream with a reader and
 *  keep the runs we care about. */
async function readTextItems(page: PDFPageProxy): Promise<TextItem[]> {
  const items: TextItem[] = [];
  await forEachChunk<TextContent>(page.streamTextContent(), (chunk) => {
    for (const item of chunk.items) {
      if ("str" in item) items.push(item);
    }
  });
  return items;
}

/** Whether a face is bold or italic, as its name gives it away. pdf.js sets
 *  `bold` / `italic` from the font descriptor when the producer filled one in,
 *  but a subsetted face routinely arrives with neither — and a PostScript name
 *  like `BCDEEE+TimesNewRomanPS-BoldMT` says it anyway. */
const BOLD_NAME = /bold|heavy|(?:^|[-_,.\s])black(?![a-z])/i;
const ITALIC_NAME = /italic|oblique/i;

/** The font object pdf.js registers for a face, as much of it as matters. */
type LoadedFont = {
  name?: string;
  bold?: boolean;
  italic?: boolean;
};

export function fontStyle(font: LoadedFont): {
  bold: boolean;
  italic: boolean;
} {
  // The six-character `ABCDEF+` prefix on a subsetted face is an arbitrary tag,
  // not part of the name — dropping it keeps it out of the name match.
  const name = (font.name ?? "").replace(/^[A-Z]{6}\+/, "");
  return {
    bold: font.bold === true || BOLD_NAME.test(name),
    italic: font.italic === true || ITALIC_NAME.test(name),
  };
}

/** Which of a page's faces are bold or italic, keyed by the `fontName` its
 *  text items carry.
 *
 *  The faces themselves only reach the main thread while the page's operator
 *  list is built — text extraction alone leaves them unresolved — so the list
 *  is built and thrown away for the font table it registers on the way. It
 *  costs roughly what laying the page out costs, and it is the whole of what
 *  tells a heading from a sentence. A producer that defeats it (an operator
 *  list that fails to parse) leaves the page unstyled rather than unread. */
async function readFontStyles(
  page: PDFPageProxy,
  fontNames: Iterable<string>,
): Promise<Map<string, { bold: boolean; italic: boolean }>> {
  const styles = new Map<string, { bold: boolean; italic: boolean }>();
  try {
    await page.getOperatorList();
  } catch {
    return styles;
  }
  for (const fontName of fontNames) {
    try {
      const font = page.commonObjs.get(fontName) as LoadedFont | null;
      if (font) styles.set(fontName, fontStyle(font));
    } catch {
      // An unresolved face is simply an unstyled one.
    }
  }
  return styles;
}

/** pdf.js's positioned items, in the shape the layout pass reads: its
 *  `transform` is a full matrix, of which only the translation is geometry a
 *  reflow cares about. */
export function toTextRuns(
  items: readonly TextItem[],
  styles?: ReadonlyMap<string, { bold: boolean; italic: boolean }>,
): TextRun[] {
  return items.map((item) => {
    const [, , , , x, y] = item.transform as number[];
    const style = styles?.get(item.fontName);
    return {
      text: item.str,
      x: x!,
      y: y!,
      width: item.width,
      height: item.height,
      hasEOL: item.hasEOL,
      bold: style?.bold,
      italic: style?.italic,
    };
  });
}

export async function extractPdfText(
  data: ArrayBuffer,
): Promise<ExtractedText> {
  const task = pdfjs.getDocument({ data });
  const doc = await task.promise;
  try {
    // Grouped into lines page by page, so only one page's runs are ever held.
    const pages: TextLine[][] = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const items = await readTextItems(page);
      const styles = await readFontStyles(
        page,
        new Set(items.map((item) => item.fontName)),
      );
      pages.push(groupRunsIntoLines(toTextRuns(items, styles)));
      page.cleanup();
    }
    // The body size is measured over the whole document, not page by page:
    // a cover page set large would otherwise make its own type the body and
    // leave the document without a heading anywhere.
    const paragraphs = layoutDocumentParagraphs(pages);
    return {
      text: paragraphsToMarkdown(paragraphs, {
        bodyHeight: bodyTextHeight(pages),
      }).trim(),
      kind: "pdf",
      markdown: true,
      pages: doc.numPages,
    };
  } finally {
    await task.destroy();
  }
}

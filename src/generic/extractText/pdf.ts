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
  groupRunsIntoLines,
  layoutDocumentLines,
  type TextLine,
  type TextRun,
} from "./layout.ts";
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

/** pdf.js's positioned items, in the shape the layout pass reads: its
 *  `transform` is a full matrix, of which only the translation is geometry a
 *  reflow cares about. */
export function toTextRuns(items: readonly TextItem[]): TextRun[] {
  return items.map((item) => {
    const [, , , , x, y] = item.transform as number[];
    return {
      text: item.str,
      x: x!,
      y: y!,
      width: item.width,
      height: item.height,
      hasEOL: item.hasEOL,
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
      const items = await readTextItems(await doc.getPage(p));
      pages.push(groupRunsIntoLines(toTextRuns(items)));
    }
    return {
      text: layoutDocumentLines(pages).trim(),
      kind: "pdf",
      pages: doc.numPages,
    };
  } finally {
    await task.destroy();
  }
}

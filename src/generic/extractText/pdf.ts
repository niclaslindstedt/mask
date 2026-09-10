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

/** Reassemble a page's positioned text runs into lines. pdf.js hands the runs
 *  back in content order with a transform each; a run whose baseline moved
 *  from the previous one starts a new line, and a run that begins clear of the
 *  previous run's end gets a space, so words don't fuse. */
export function joinTextItems(items: readonly TextItem[]): string {
  let out = "";
  let lastY: number | null = null;
  let lastEndX = 0;
  for (const item of items) {
    const [, , , , x, y] = item.transform as number[];
    if (lastY !== null && Math.abs(y! - lastY) > 2) {
      out = out.replace(/[ \t]+$/, "") + "\n";
      lastEndX = 0;
    } else if (out.length > 0 && !out.endsWith("\n") && x! - lastEndX > 1) {
      if (!out.endsWith(" ")) out += " ";
    }
    out += item.str;
    if (item.hasEOL) {
      out += "\n";
      lastEndX = 0;
    } else {
      lastEndX = x! + item.width;
    }
    lastY = y!;
  }
  return out;
}

export async function extractPdfText(
  data: ArrayBuffer,
): Promise<ExtractedText> {
  const task = pdfjs.getDocument({ data });
  const doc = await task.promise;
  try {
    const pages: string[] = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      pages.push(
        joinTextItems(await readTextItems(page))
          .replace(/\n{3,}/g, "\n\n")
          .trim(),
      );
    }
    return { text: pages.join("\n\n"), kind: "pdf", pages: doc.numPages };
  } finally {
    await task.destroy();
  }
}

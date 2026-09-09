// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The PDF half of `extractText`, split into its own chunk: `pdfjs-dist` is
// the one heavy dependency in the app and only a PDF upload needs it.
import * as pdfjs from "pdfjs-dist";
import type { TextItem } from "pdfjs-dist/types/src/display/api";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

import type { ExtractedText } from "./index.ts";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

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
      const content = await page.getTextContent();
      const items = content.items.filter((i): i is TextItem => "str" in i);
      pages.push(
        joinTextItems(items)
          .replace(/\n{3,}/g, "\n\n")
          .trim(),
      );
    }
    return { text: pages.join("\n\n"), kind: "pdf", pages: doc.numPages };
  } finally {
    await task.destroy();
  }
}

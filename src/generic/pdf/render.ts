// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A PDF's pages, painted onto canvases — the engine half, in its own chunk.
//
// The sibling half of this module writes a PDF (`write.ts`, over jsPDF); this
// one reads one back, over `pdfjs-dist` — the same engine, and so the same
// chunk, the text extraction uses. Both are reached through `import()`: the
// PDF engines are the heaviest thing the app can pull in, and neither belongs
// on the boot path.
//
// The `legacy/` build is deliberate, for the reason `extractText/pdf.ts`
// gives: the default build reads the `Iterator` global at module scope and
// throws on a browser more than a few months old.
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import workerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";

import type { OpenPdf } from "./pages.ts";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

/** Open `data` for reading. The bytes are handed to pdf.js, which keeps them:
 *  pass a copy if the caller needs its own. */
export async function openPdf(data: ArrayBuffer): Promise<OpenPdf> {
  const task = pdfjs.getDocument({ data });
  const doc = await task.promise;
  return {
    pageCount: doc.numPages,
    async page(number) {
      const page = await doc.getPage(number);
      const { width, height } = page.getViewport({ scale: 1 });
      return {
        number,
        width,
        height,
        paint(canvas, scale) {
          const viewport = page.getViewport({ scale });
          canvas.width = Math.max(1, Math.floor(viewport.width));
          canvas.height = Math.max(1, Math.floor(viewport.height));
          // pdf.js takes the canvas itself from v5 on and makes its own
          // context; the `canvasContext` parameter is only there for callers
          // that predate it.
          const task = page.render({ canvas, viewport });
          return {
            // A cancelled paint rejects; that is the caller asking for it, so
            // it is not an error to report.
            done: task.promise.catch(() => {}),
            cancel: () => task.cancel(),
          };
        },
        release: () => page.cleanup(),
      };
    },
    close: () => task.destroy(),
  };
}

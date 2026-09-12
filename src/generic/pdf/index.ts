// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// PDF, both directions, and never on the boot path.
//
// Writing: a pure typesetter that paginates a Markdown document into pages of
// drawing operations (`layout.ts`) and the writer that paints those with
// jsPDF (`write.ts`). Reading: the page shapes and the fit arithmetic a
// viewer needs (`pages.ts`) and the `pdfjs-dist` reader that paints an
// existing document's pages onto canvases (`render.ts`).
//
// Only the two engine-carrying halves — `write.ts` and `render.ts` — pull a
// PDF library in, and both are reached through `import()` at the point of
// use. Everything exported from here is pure.

export {
  fitWidthScale,
  paintRatio,
  type OpenPdf,
  type RenderablePage,
} from "./pages.ts";
export {
  layoutPdf,
  type DrawOp,
  type PdfFontStyle,
  type PdfLayout,
  type PdfLayoutInput,
  type PdfPage,
  type TextMeasurer,
} from "./layout.ts";

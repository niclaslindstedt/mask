// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Markdown → PDF, in two halves: a pure typesetter that paginates a document
// into pages of drawing operations (`layout.ts`), and the writer that paints
// those with jsPDF (`write.ts`). Only the writer pulls the PDF library in, so
// it is reached through `import()` at the point of use.

export {
  layoutPdf,
  type DrawOp,
  type PdfFontStyle,
  type PdfLayout,
  type PdfLayoutInput,
  type PdfPage,
  type TextMeasurer,
} from "./layout.ts";

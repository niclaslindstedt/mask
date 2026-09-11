// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Writes the PDF. Takes the pages the typesetter (`layout.ts`) produced and
// paints them with jsPDF, then hands back the bytes.
//
// This is the only module that knows jsPDF exists, and it is imported on the
// press rather than at mount — nobody who never exports should download a PDF
// writer (see the "keep boot small" rule).
//
// **Fonts.** A PDF names its fonts rather than carrying them, and every reader
// already has the standard three — Helvetica, Times, Courier — so an ordinary
// document costs the file nothing. Their limit is that they encode Latin-1
// only: text outside it (Cyrillic, Greek, CJK) would need an embedded face,
// which this writer does not carry.

import { jsPDF } from "jspdf";

import {
  layoutPdf,
  type PdfFontStyle,
  type PdfLayoutInput,
  type TextMeasurer,
} from "./layout.ts";

/** jsPDF's names for the two families the typesetter asks for. */
const FAMILY: Record<PdfFontStyle["family"], string> = {
  body: "helvetica",
  mono: "courier",
};

function styleName(font: PdfFontStyle): string {
  if (font.bold && font.italic) return "bolditalic";
  if (font.bold) return "bold";
  if (font.italic) return "italic";
  return "normal";
}

/** What the writer needs beyond the document itself. */
export type PdfWriteInput = Omit<PdfLayoutInput, "measure">;

/** Typeset `markdown` and return the PDF as a blob. */
export function renderPdf(input: PdfWriteInput): Blob {
  const doc = new jsPDF({
    unit: "pt",
    format: [input.pageWidthPt ?? 595.28, input.pageHeightPt ?? 841.89],
    compress: true,
  });

  const setFont = (font: PdfFontStyle, sizePt: number): void => {
    doc.setFont(FAMILY[font.family], styleName(font));
    doc.setFontSize(sizePt);
  };

  // The measurer and the painter set the font the same way, so the width the
  // typesetter wrapped against is the width the page actually gets.
  const measure: TextMeasurer = (text, font, sizePt) => {
    setFont(font, sizePt);
    return doc.getTextWidth(text);
  };

  const laid = layoutPdf({ ...input, measure });

  laid.pages.forEach((page, index) => {
    if (index > 0) doc.addPage();
    for (const op of page.ops) {
      if (op.kind === "rect") {
        doc.setFillColor(op.fill);
        doc.rect(op.x, op.y, op.width, op.height, "F");
        continue;
      }
      setFont(op.font, op.sizePt);
      doc.setTextColor(op.color);
      doc.text(op.text, op.x, op.y, { baseline: "alphabetic" });
      if (op.strike) {
        const width = doc.getTextWidth(op.text);
        const mid = op.y - op.sizePt * 0.25;
        doc.setDrawColor(op.color);
        doc.setLineWidth(Math.max(0.5, op.sizePt * 0.05));
        doc.line(op.x, mid, op.x + width, mid);
      }
    }
  });

  return doc.output("blob");
}

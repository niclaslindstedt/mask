import { fileURLToPath } from "node:url";

import { jsPDF } from "jspdf";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { beforeAll, describe, expect, it } from "vitest";

import { extractPdfText } from "../src/generic/extractText/pdf.ts";
import { fontStyle } from "../src/generic/extractText/pdf.ts";

// The whole loop, through a real PDF: type a document with headings, bold and
// italic runs, write it as a PDF, then read it back the way an upload does.
// It is the one check that the *face* the producer chose survives — the size
// heuristics can be exercised on positions alone, but nothing short of a real
// file proves a `Helvetica-Bold` in the font table reaches the text as `**`.

const BODY = 11;
const LEADING = 16;
const LEFT = 56;

/** Draw a line of runs at `y`, advancing by each run's own width so the parts
 *  sit side by side the way a typesetter would place them. */
function drawLine(
  doc: jsPDF,
  y: number,
  runs: { text: string; style?: string; size?: number }[],
): void {
  let x = LEFT;
  for (const run of runs) {
    doc.setFont("helvetica", run.style ?? "normal");
    doc.setFontSize(run.size ?? BODY);
    doc.text(run.text, x, y);
    x += doc.getTextWidth(run.text);
  }
}

function buildPdf(): ArrayBuffer {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  let y = 80;
  drawLine(doc, y, [{ text: "Stora rubriken", style: "bold", size: 24 }]);
  y += 40;
  drawLine(doc, y, [{ text: "Mindre rubrik", style: "bold", size: 16 }]);
  y += 30;
  drawLine(doc, y, [
    { text: "Beslutet gäller " },
    { text: "omedelbart", style: "bold" },
    { text: " enligt lagen." },
  ]);
  y += LEADING;
  drawLine(doc, y, [
    { text: "Se " },
    { text: "prop. 1987/88:98", style: "italic" },
    { text: " for mer information om detta." },
  ]);
  y += LEADING;
  drawLine(doc, y, [
    { text: "En rad vanlig brodtext utan nagon som helst utmarkning alls." },
  ]);
  y += LEADING;
  drawLine(doc, y, [
    { text: "Ytterligare en rad vanlig brodtext utan utmarkning alls." },
  ]);
  y += 30;
  drawLine(doc, y, [{ text: "Avsnittsrubrik", style: "bold" }]);
  return doc.output("arraybuffer");
}

describe("a PDF written and read back", () => {
  let text = "";

  beforeAll(async () => {
    pdfjs.GlobalWorkerOptions.workerSrc = fileURLToPath(
      new URL(
        "../node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs",
        import.meta.url,
      ),
    );
    const extracted = await extractPdfText(buildPdf());
    expect(extracted).toMatchObject({ kind: "pdf", markdown: true, pages: 1 });
    text = extracted.text;
  }, 60000);

  it("writes the two sized headings back out as Markdown", () => {
    expect(text).toContain("# Stora rubriken");
    expect(text).toContain("## Mindre rubrik");
  });

  it("writes a body-sized bold heading back out as one", () => {
    expect(text).toContain("### Avsnittsrubrik");
  });

  it("marks the bold and italic runs inside a sentence", () => {
    expect(text).toContain("**omedelbart**");
    expect(text).toContain("*prop. 1987/88:98*");
  });

  it("leaves unmarked text unmarked", () => {
    expect(text).toContain(
      "En rad vanlig brodtext utan nagon som helst utmarkning alls.",
    );
  });
});

describe("reading a face's name", () => {
  it("takes pdf.js's own flags when the producer filled them in", () => {
    expect(fontStyle({ name: "Whatever", bold: true })).toEqual({
      bold: true,
      italic: false,
    });
  });

  it("falls back to the PostScript name a subset font arrives with", () => {
    expect(fontStyle({ name: "BCDEEE+TimesNewRomanPS-BoldMT" })).toEqual({
      bold: true,
      italic: false,
    });
    expect(fontStyle({ name: "ABCDEF+Arial-BoldItalicMT" })).toEqual({
      bold: true,
      italic: true,
    });
    expect(fontStyle({ name: "Helvetica-Oblique" })).toEqual({
      bold: false,
      italic: true,
    });
  });

  it("does not read a face's ordinary name as a weight", () => {
    expect(fontStyle({ name: "BCDEEE+Garamond" })).toEqual({
      bold: false,
      italic: false,
    });
    expect(fontStyle({ name: "Blackadder ITC" })).toEqual({
      bold: false,
      italic: false,
    });
  });
});

import { describe, expect, it } from "vitest";

import {
  bodyTextHeight,
  groupRunsIntoLines,
  layoutDocumentParagraphs,
  type TextRun,
} from "../src/generic/extractText/layout.ts";
import {
  paragraphMarkdown,
  paragraphsToMarkdown,
} from "../src/generic/extractText/markup.ts";

// The style pass, over runs positioned the way a PDF producer positions them:
// y grows upward, one baseline per printed line.

const BODY = 12;
const PITCH = 16;

type Piece = { text: string; bold?: boolean; italic?: boolean };

/** One printed line at `y`, set at `height`, from left to right. */
function line(
  y: number,
  height: number,
  pieces: Piece[],
  left = 70,
): TextRun[] {
  let x = left;
  return pieces.map((piece) => {
    const run: TextRun = {
      text: piece.text,
      x,
      y,
      // Roughly a half-em per character, which is all the layout needs: it
      // compares widths, it never draws them.
      width: piece.text.length * height * 0.5,
      height,
      bold: piece.bold,
      italic: piece.italic,
    };
    x += run.width;
    return run;
  });
}

/** A page of printed lines, top to bottom, one entry per line. */
function page(lines: TextRun[][]): TextRun[] {
  return lines.flat();
}

function markdown(lines: TextRun[][]): string {
  const grouped = [groupRunsIntoLines(page(lines))];
  return paragraphsToMarkdown(layoutDocumentParagraphs(grouped), {
    bodyHeight: bodyTextHeight(grouped),
  });
}

describe("emphasis", () => {
  it("wraps a bold run in the Markdown that means the same thing", () => {
    const out = markdown([
      line(700, BODY, [
        { text: "Beslutet gäller " },
        { text: "omedelbart", bold: true },
        { text: " enligt lagen." },
      ]),
    ]);
    expect(out).toBe("Beslutet gäller **omedelbart** enligt lagen.");
  });

  it("wraps an italic run, and both when a run is set in both", () => {
    expect(
      markdown([
        line(700, BODY, [
          { text: "Se " },
          { text: "prop. 1987/88:98", italic: true },
          { text: " och " },
          { text: "NJA 2016 s. 30", bold: true, italic: true },
          { text: "." },
        ]),
      ]),
    ).toBe("Se *prop. 1987/88:98* och ***NJA 2016 s. 30***.");
  });

  it("keeps the space outside the markers", () => {
    // `** bold **` is not emphasis in any Markdown reader — the delimiter has
    // to bind to a non-space — so a run's own padding stays outside it.
    const out = markdown([
      line(700, BODY, [
        { text: "ett" },
        { text: " viktigt ", bold: true },
        { text: "ord" },
      ]),
    ]);
    expect(out).toBe("ett **viktigt** ord");
  });

  it("leaves a document set wholly in bold unmarked", () => {
    // Bold says nothing when everything is bold, and marking all of it up
    // would leave a page of asterisks and no emphasis.
    const out = markdown([
      line(700, BODY, [
        { text: "Hela sidan är satt i halvfet stil.", bold: true },
      ]),
      line(700 - PITCH * 3, BODY, [
        {
          text: "Även det andra stycket är satt i halvfet stil här.",
          bold: true,
        },
      ]),
    ]);
    expect(out).not.toContain("*");
  });
});

describe("headings", () => {
  it("reads a heading off the size it is set at", () => {
    const out = markdown([
      line(760, BODY * 2.2, [{ text: "HÖGSTA DOMSTOLENS" }]),
      line(720, BODY * 1.5, [{ text: "DOM" }]),
      line(680, BODY * 1.2, [{ text: "Bakgrund" }]),
      line(680 - PITCH, BODY, [{ text: "Ett vanligt stycke med brödtext i." }]),
      line(680 - PITCH * 2, BODY, [
        { text: "Ytterligare en rad brödtext så att storleken mäts rätt." },
      ]),
      line(680 - PITCH * 3, BODY, [
        { text: "Och en tredje rad brödtext för samma skäl." },
      ]),
    ]);
    expect(out).toContain("# HÖGSTA DOMSTOLENS");
    expect(out).toContain("## DOM");
    expect(out).toContain("### Bakgrund");
    expect(out).toContain("Ett vanligt stycke med brödtext i.");
    expect(out).not.toContain("# Ett vanligt");
  });

  it("reads a body-sized heading off the face it is set in", () => {
    const out = markdown([
      line(760, BODY, [{ text: "DOMSLUT", bold: true }]),
      line(760 - PITCH * 3, BODY, [
        { text: "Högsta domstolen ändrar hovrättens dom i denna del." },
      ]),
      line(760 - PITCH * 4, BODY, [
        { text: "Staten ska svara för kostnaden i målet." },
      ]),
    ]);
    expect(out.split("\n\n")[0]).toBe("### DOMSLUT");
  });

  it("leaves a bold sentence a sentence", () => {
    // Punctuation is what tells a bold sentence from a bold heading.
    const out = markdown([
      line(760, BODY, [{ text: "Detta är en mening som är satt i fetstil." }]),
      line(760 - PITCH * 3, BODY, [
        { text: "Denna mening är också satt i fetstil.", bold: true },
      ]),
      line(760 - PITCH * 4, BODY, [
        { text: "Och en tredje rad brödtext här." },
      ]),
    ]);
    expect(out).toContain("**Denna mening är också satt i fetstil.**");
    expect(out).not.toContain("###");
  });
});

describe("list items", () => {
  it("swaps the producer's bullet glyph for a Markdown one", () => {
    const out = markdown([
      line(700, BODY, [{ text: "• Första punkten i listan står här." }]),
      line(700 - PITCH * 2, BODY, [
        { text: "• Andra punkten i listan står här." },
      ]),
    ]);
    expect(out.split("\n\n")).toEqual([
      "- Första punkten i listan står här.",
      "- Andra punkten i listan står här.",
    ]);
  });

  it("leaves a numbered item spelling itself", () => {
    const out = markdown([
      line(700, BODY, [{ text: "1. Första punkten i listan står här." }]),
    ]);
    expect(out).toBe("1. Första punkten i listan står här.");
  });

  it("never takes a list item for a heading", () => {
    expect(
      paragraphMarkdown(
        {
          text: "• Kort punkt",
          segments: [{ text: "• Kort punkt", bold: true, italic: false }],
          height: BODY * 3,
          lines: 1,
        },
        { bodyHeight: BODY },
      ),
    ).toBe("- **Kort punkt**");
  });
});

describe("running furniture", () => {
  it("writes a header as a comment rather than as prose", () => {
    expect(
      paragraphMarkdown(
        {
          text: "HÖGSTA DOMSTOLEN T 4623-21 Sida 2",
          segments: [
            {
              text: "HÖGSTA DOMSTOLEN T 4623-21 Sida 2",
              bold: true,
              italic: false,
            },
          ],
          // Set large and wholly in bold — both ways a paragraph asks to be a
          // heading, and neither counts once it is furniture.
          height: BODY * 2,
          lines: 1,
          furniture: true,
        },
        { bodyHeight: BODY },
      ),
    ).toBe("<!-- HÖGSTA DOMSTOLEN T 4623-21 Sida 2 -->");
  });

  it("keeps a document set wholly in bold emphatic when only its furniture is", () => {
    // The furniture never votes on whether bold says anything in this
    // document: a footer in bold must not strip the emphasis from the prose.
    const out = paragraphsToMarkdown([
      {
        text: "Sidfot",
        segments: [{ text: "Sidfot", bold: true, italic: false }],
        height: BODY,
        lines: 1,
        furniture: true,
      },
      {
        text: "Ett stycke med fetstil i.",
        segments: [
          { text: "Ett stycke med ", bold: false, italic: false },
          { text: "fetstil", bold: true, italic: false },
          { text: " i.", bold: false, italic: false },
        ],
        height: BODY,
        lines: 1,
      },
    ]);
    expect(out).toBe("<!-- Sidfot -->\n\nEtt stycke med **fetstil** i.");
  });
});

describe("the body size", () => {
  it("is the size carrying the most text, not the largest on the page", () => {
    const lines = [
      groupRunsIntoLines(
        page([
          line(760, 30, [{ text: "RUBRIK" }]),
          line(700, BODY, [{ text: "En rad brödtext som är ganska lång." }]),
          line(700 - PITCH, BODY, [
            { text: "Ännu en rad brödtext som är ganska lång." },
          ]),
        ]),
      ),
    ];
    expect(bodyTextHeight(lines)).toBe(BODY);
  });
});

import { describe, expect, it } from "vitest";

import {
  layoutPdf,
  type DrawOp,
  type PdfLayout,
  type TextMeasurer,
} from "../src/generic/pdf/index.ts";

// The typesetter, measured with a monospace ruler: every glyph is half its
// point size wide. Nothing here needs real metrics — the layout only ever
// compares widths — and a ruler that is exact makes the wrap points arithmetic
// rather than guesswork.
const measure: TextMeasurer = (text, _font, sizePt) =>
  text.length * sizePt * 0.5;

function lay(markdown: string, extra: Record<string, unknown> = {}): PdfLayout {
  return layoutPdf({ markdown, measure, ...extra });
}

function texts(layout: PdfLayout, page = 0): string[] {
  return (layout.pages[page]?.ops ?? [])
    .filter((op): op is Extract<DrawOp, { kind: "text" }> => op.kind === "text")
    .map((op) => op.text);
}

function textOps(
  layout: PdfLayout,
  page = 0,
): Extract<DrawOp, { kind: "text" }>[] {
  return (layout.pages[page]?.ops ?? []).filter(
    (op): op is Extract<DrawOp, { kind: "text" }> => op.kind === "text",
  );
}

describe("laying Markdown out on paper", () => {
  it("never sets a comment line on the page", () => {
    // The furniture an extracted document carries as `<!-- … -->` is an aside
    // to whoever reads the source, not something to print.
    const layout = lay(
      "<!-- HÖGSTA DOMSTOLEN Sida 2 -->\n\nEn rad brödtext.\n\n<!-- Sidfot -->",
    );
    expect(texts(layout)).toEqual(["En rad brödtext."]);
  });

  it("sets a heading bigger and bolder than the body", () => {
    const layout = lay("# Rubrik\n\nEn rad brödtext.");
    const [heading, body] = textOps(layout);
    expect(heading?.text).toBe("Rubrik");
    expect(heading?.font.bold).toBe(true);
    expect(heading?.sizePt).toBeGreaterThan(body!.sizePt);
    expect(body?.font.bold).toBe(false);
  });

  it("carries emphasis down to the piece that carries the word", () => {
    const ops = textOps(lay("ett **viktigt** och *lutande* ord"));
    expect(ops.find((op) => op.text.includes("viktigt"))?.font.bold).toBe(true);
    expect(ops.find((op) => op.text.includes("lutande"))?.font.italic).toBe(
      true,
    );
    expect(ops.find((op) => op.text.startsWith("ett"))?.font.bold).toBe(false);
  });

  it("wraps a long paragraph inside the column", () => {
    const word = "ordet ";
    const layout = lay(word.repeat(120).trim());
    const ops = textOps(layout);
    expect(ops.length).toBeGreaterThan(1);
    const right = Math.max(
      ...ops.map((op) => op.x + measure(op.text, op.font, op.sizePt)),
    );
    expect(right).toBeLessThanOrEqual(layout.widthPt - 56 + 0.001);
  });

  it("starts a new page rather than running off the bottom of one", () => {
    const layout = lay("En rad text.\n\n".repeat(120));
    expect(layout.pages.length).toBeGreaterThan(1);
    for (const page of layout.pages) {
      for (const op of page.ops) {
        if (op.kind === "text") expect(op.y).toBeLessThan(layout.heightPt);
      }
    }
  });

  it("draws a list marker outside the text it labels", () => {
    const layout = lay("- första\n- andra");
    const ops = textOps(layout);
    const marker = ops.find((op) => op.text === "•");
    const item = ops.find((op) => op.text === "första");
    expect(marker).toBeDefined();
    expect(marker!.x).toBeLessThan(item!.x);
  });

  it("numbers an ordered list from its own sequence", () => {
    expect(texts(lay("1. ett\n1. två"))).toEqual(["1.", "ett", "2.", "två"]);
  });

  it("tints inline code and sets it in the mono face", () => {
    const layout = lay("kör `make test` nu");
    const code = textOps(layout).find((op) => op.text.includes("make test"));
    expect(code?.font.family).toBe("mono");
    expect(layout.pages[0]?.ops.some((op) => op.kind === "rect")).toBe(true);
  });

  it("draws a rule for a thematic break", () => {
    const rects = (lay("över\n\n---\n\nunder").pages[0]?.ops ?? []).filter(
      (op) => op.kind === "rect",
    );
    expect(rects).toHaveLength(1);
  });

  it("stamps a page number on every page when given the word for it", () => {
    const layout = lay("En rad text.\n\n".repeat(120), { pageNumberOf: "av" });
    layout.pages.forEach((page, index) => {
      expect(texts(layout, index)).toContain(
        `${index + 1} av ${layout.pages.length}`,
      );
    });
  });

  it("leaves the page unnumbered when it is not given one", () => {
    expect(texts(lay("text"))).toEqual(["text"]);
  });

  it("sets a title above the document when it is given one", () => {
    const ops = textOps(lay("brödtext", { title: "Beslut" }));
    expect(ops[0]?.text).toBe("Beslut");
    expect(ops[0]?.y).toBeLessThan(ops[1]!.y);
  });
});

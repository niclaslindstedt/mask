import { fileURLToPath } from "node:url";

import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { beforeAll, describe, expect, it } from "vitest";

import { baseName } from "../src/app/download.ts";
import { extractPdfText } from "../src/generic/extractText/pdf.ts";
import { renderPdf } from "../src/generic/pdf/write.ts";

// The download's own round trip: typeset a masked document, then read the file
// back with the same extractor an upload goes through. A PDF that opens and
// says what it was given is the whole contract — if the writer and the
// typesetter ever disagreed about a font, this is where it shows.

const SOURCE = [
  "# Beslut",
  "",
  "Ärendet gäller **NAMN1** som är folkbokförd på ADRESS1 i ORT1.",
  "",
  "- Första punkten i beslutet.",
  "- Andra punkten i beslutet.",
  "",
  "> Ett citat ur förarbetena.",
  "",
  "## Skäl",
  "",
  "Nämnden har prövat frågan och funnit att TELEFON1 inte behövs.",
].join("\n");

describe("writing the masked document as a PDF", () => {
  let text = "";

  beforeAll(async () => {
    pdfjs.GlobalWorkerOptions.workerSrc = fileURLToPath(
      new URL(
        "../node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs",
        import.meta.url,
      ),
    );
    const blob = renderPdf({ markdown: SOURCE, pageNumberOf: "av" });
    expect(blob.type).toBe("application/pdf");
    const extracted = await extractPdfText(await blob.arrayBuffer());
    text = extracted.text;
  }, 60000);

  it("keeps every word the masked text carried", () => {
    for (const needle of [
      "Beslut",
      "NAMN1",
      "ADRESS1",
      "ORT1",
      "TELEFON1",
      "Första punkten i beslutet.",
      "Ett citat ur förarbetena.",
      "Skäl",
    ]) {
      expect(text).toContain(needle);
    }
  });

  it("leaves the placeholder syntax behind — the page carries the marks", () => {
    // `**NAMN1**` went in; what comes out of the file is a bold run, which the
    // extractor writes back as `**NAMN1**` rather than as the literal source.
    expect(text).not.toContain("\\*\\*");
    expect(text).toContain("NAMN1");
  });

  it("numbers the page it was asked to number", () => {
    expect(text).toContain("1 av 1");
  });
});

describe("naming the downloaded file", () => {
  it("drops the source document's own extension", () => {
    expect(baseName("beslut.pdf")).toBe("beslut");
    expect(baseName("beslut")).toBe("beslut");
    expect(baseName("a.b.txt")).toBe("a.b");
  });

  it("takes out what a file system would rather not see", () => {
    expect(baseName("HD B 4808-23: dom.pdf")).toBe("HD B 4808-23- dom");
    expect(baseName(".")).toBe("document");
  });
});

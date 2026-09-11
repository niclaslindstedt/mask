import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { beforeAll, describe, expect, it } from "vitest";

import { extractPdfText } from "../src/generic/extractText/pdf.ts";

// The end-to-end check, over a real PDF: Högsta domstolen's judgment in
// B 4808-23 (a public document, five pages, running header, numbered
// paragraphs, hyphenated line breaks, a sentence carried across a page break).
// It is the shape of the documents this app is pointed at, and every way a
// naive extractor mangles one shows up in it.
const FIXTURE = new URL("./fixtures/hd-b-4808-23.pdf", import.meta.url);

function fixtureBytes(): ArrayBuffer {
  const file = readFileSync(FIXTURE);
  return file.buffer.slice(
    file.byteOffset,
    file.byteOffset + file.byteLength,
  ) as ArrayBuffer;
}

describe("extracting a real judgment", () => {
  let text = "";
  let paragraphs: string[] = [];

  beforeAll(async () => {
    // `pdf.ts` points the worker at a bundler URL, which only resolves in the
    // browser build; under vitest pdf.js falls back to a worker it imports by
    // path, so give it one that exists on disk.
    pdfjs.GlobalWorkerOptions.workerSrc = fileURLToPath(
      new URL(
        "../node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs",
        import.meta.url,
      ),
    );
    const extracted = await extractPdfText(fixtureBytes());
    expect(extracted).toMatchObject({ kind: "pdf", pages: 5 });
    text = extracted.text;
    paragraphs = text.split("\n\n");
  });

  it("keeps a paragraph on one line instead of one line per printed row", () => {
    expect(paragraphs).toContain(
      "1. På eftermiddagen den 14 mars 2023 körde RL, som då var 16 år, sin " +
        "A-traktor på Ekersvägen i Örebro tillsammans med två kamrater. De var " +
        "på väg hem från gymnasiet, där han går fordonslinjen. Sedan polisen " +
        "hade sett anledning att stoppa dem påträffades i A-traktorns " +
        "handskfack ett multiverktyg. Detta innehöll en kniv.",
    );
    expect(paragraphs).toContain(
      "11. Knivinnehavet ska därför bedömas som befogat. Som tingsrätten har " +
        "funnit ska RL alltså frikännas och förverkandeyrkandet ogillas. Det " +
        "innebär att beslaget hävs.",
    );
  });

  it("gives each numbered paragraph and heading its own paragraph", () => {
    expect(paragraphs).toContain("### Förbudet mot innehav av kniv");
    expect(paragraphs.filter((p) => /^\d+\. /.test(p))).toHaveLength(11);
  });

  it("writes the judgment's headings back out as Markdown", () => {
    // The court's name is set largest on the page, the document type below it,
    // and the section headings are body-sized but set in bold — three ways a
    // document says "heading", and all three have to survive as one.
    expect(paragraphs).toContain("# HÖGSTA DOMSTOLENS");
    expect(paragraphs).toContain("## DOM");
    for (const heading of ["PARTER", "SAKEN", "DOMSLUT", "DOMSKÄL"]) {
      expect(paragraphs).toContain(`### ${heading}`);
    }
    // A numbered paragraph of body text is never a heading, however short.
    expect(text).not.toMatch(/^#+ \d+\./m);
  });

  it("puts a word the line break split back together", () => {
    expect(text).toContain("ett multiverktyg. Detta innehöll en kniv.");
    expect(text).toContain("ogilla förverkandeyrkandet eller");
    expect(text).not.toContain("multi- verktyg");
    // A hyphen the writer typed survives.
    expect(text).toContain("sin A-traktor på Ekersvägen");
  });

  it("carries a sentence over the page break", () => {
    expect(paragraphs).toContain(
      "3. RL åtalades för brott mot lagen (1988:254) om förbud beträffande " +
        "knivar och andra farliga föremål. I tingsrätten frikändes han eftersom " +
        "innehavet av multiverktyget med kniven bedömdes ha varit befogat. " +
        "Hovrätten har däremot ansett innehavet som obefogat och dömt RL för " +
        "oaktsamt brott mot lagen. Påföljden har bestämts till dagsböter.",
    );
  });

  it("drops the running header that repeats on every page", () => {
    expect(text).not.toContain("HÖGSTA DOMSTOLEN B 4808-23");
    // The case number is still in the document where it was typed.
    expect(text).toContain(
      "meddelad i Stockholm den 21 december 2023 B 4808-23",
    );
  });

  it("reads the first page's footer after its body", () => {
    expect(text.indexOf("PARTER")).toBeLessThan(
      text.indexOf("hogsta.domstolen@dom.se"),
    );
    expect(text.indexOf("hogsta.domstolen@dom.se")).toBeLessThan(
      text.indexOf("DOMSLUT"),
    );
  });

  it("leaves the text with the personal data a detector has to find", () => {
    for (const needle of [
      "Ekersvägen",
      "Örebro",
      "Anders Eka",
      "Axel Johnsson",
    ]) {
      expect(text).toContain(needle);
    }
  });
});

import { describe, expect, it } from "vitest";

import { loadDocumentPages } from "../src/app/documentPages.ts";

// The reader's page source. A PDF's own file comes out of the blob vault,
// which needs a browser; what is checked here is the branch that doesn't —
// a Word document, which has no pages until they are typeset from its text.

async function header(blob: Blob): Promise<string> {
  return new TextDecoder().decode((await blob.arrayBuffer()).slice(0, 5));
}

describe("the pages a document opens as", () => {
  it("typesets a Word document's text into a PDF", async () => {
    const blob = await loadDocumentPages(
      {
        id: "d1",
        format: "docx",
        name: "Beslut.docx",
        text: "# Beslut\n\nAnna Andersson bor på Storgatan 1.\n\n| a | b |\n| --- | --- |\n| 1 | 2 |",
      },
      { pageNumberOf: "av" },
    );
    expect(blob).not.toBeNull();
    expect(await header(blob!)).toBe("%PDF-");
  });

  it("has no pages for a pasted document", async () => {
    await expect(
      loadDocumentPages({
        id: "d2",
        format: "text",
        name: "note",
        text: "hej",
      }),
    ).resolves.toBeNull();
  });

  it("has no pages for a Word document with no text", async () => {
    await expect(
      loadDocumentPages({
        id: "d3",
        format: "docx",
        name: "tom.docx",
        text: " ",
      }),
    ).resolves.toBeNull();
  });
});

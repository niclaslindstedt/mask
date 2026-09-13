import { beforeAll, describe, expect, it } from "vitest";

import { DocxError, extractDocxText } from "../src/generic/extractText/docx.ts";
import { makeZip } from "./fixtures/zip.ts";

// A Word document is a ZIP of XML parts, so the fixture is built the way Word
// builds one: localised style ids (`Rubrik1`) carrying their canonical English
// names, runs split at revision boundaries, a numbering part that says which
// list is bulleted, a table, tracked changes, a field code, and a running
// header in its own part.

const DECLARATION = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`;

const DOCUMENT = `${DECLARATION}
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    <w:p><w:pPr><w:pStyle w:val="Titel"/></w:pPr><w:r><w:t>Beslut om bistånd</w:t></w:r></w:p>
    <w:p><w:pPr><w:pStyle w:val="Rubrik1"/></w:pPr><w:r><w:t>Bakgrund</w:t></w:r></w:p>
    <w:p/>
    <w:p>
      <w:r><w:t xml:space="preserve">Sökanden </w:t></w:r>
      <w:r><w:rPr><w:b/></w:rPr><w:t>Anna</w:t></w:r>
      <w:r><w:rPr><w:b/><w:bCs/></w:rPr><w:t xml:space="preserve"> Andersson</w:t></w:r>
      <w:r><w:t xml:space="preserve"> bor på </w:t></w:r>
      <w:r><w:rPr><w:i/></w:rPr><w:t>Storgatan 1</w:t></w:r>
      <w:r><w:t>.</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:rPr><w:rStyle w:val="Stark"/></w:rPr><w:t>Viktigt</w:t></w:r>
      <w:r><w:t xml:space="preserve">: läs detta.</w:t></w:r>
    </w:p>
    <w:p><w:r><w:rPr><w:rStyle w:val="Stark"/><w:b w:val="0"/></w:rPr><w:t>Inte fet ändå.</w:t></w:r></w:p>
    <w:p><w:r><w:t>Telefon:</w:t><w:tab/><w:t>070-123 45 67</w:t><w:br/><w:t>Postnr: 123 45</w:t></w:r></w:p>
    <w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>Första punkten</w:t></w:r></w:p>
    <w:p><w:pPr><w:numPr><w:ilvl w:val="1"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>Underpunkt</w:t></w:r></w:p>
    <w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="2"/></w:numPr></w:pPr><w:r><w:t>Ett</w:t></w:r></w:p>
    <w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="2"/></w:numPr></w:pPr><w:r><w:t>Två</w:t></w:r></w:p>
    <w:p><w:pPr><w:pStyle w:val="Punktlista"/></w:pPr><w:r><w:t>Punkt från en liststil</w:t></w:r></w:p>
    <w:p><w:pPr><w:pStyle w:val="Rubrik1"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="0"/></w:numPr></w:pPr><w:r><w:t>Skäl för beslutet</w:t></w:r></w:p>
    <w:tbl>
      <w:tblPr><w:tblStyle w:val="Tabellrutnt"/></w:tblPr>
      <w:tblGrid><w:gridCol w:w="4675"/><w:gridCol w:w="4675"/></w:tblGrid>
      <w:tr>
        <w:tc><w:tcPr><w:tcW w:w="4675" w:type="dxa"/></w:tcPr><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Namn</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Personnummer</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:t>Anna | Andersson</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>19850101-1234</w:t></w:r></w:p></w:tc>
      </w:tr>
    </w:tbl>
    <w:p>
      <w:hyperlink r:id="rId4"><w:r><w:t>Kommunens webbplats</w:t></w:r></w:hyperlink>
      <w:ins w:id="1" w:author="A"><w:r><w:t xml:space="preserve"> och tillägget</w:t></w:r></w:ins>
      <w:del w:id="2" w:author="A"><w:r><w:delText xml:space="preserve"> och strykningen</w:delText></w:r></w:del>
      <w:r><w:fldChar w:fldCharType="begin"/></w:r>
      <w:r><w:instrText xml:space="preserve"> PAGE \\* MERGEFORMAT </w:instrText></w:r>
      <w:r><w:fldChar w:fldCharType="end"/></w:r>
    </w:p>
    <w:sdt>
      <w:sdtPr><w:alias w:val="Diarienummer"/><w:text/></w:sdtPr>
      <w:sdtContent><w:p><w:r><w:t>Dnr 2024-001</w:t></w:r></w:p></w:sdtContent>
    </w:sdt>
    <w:p><w:pPr><w:outlineLvl w:val="1"/></w:pPr><w:r><w:t>Bedömning</w:t></w:r></w:p>
    <w:p><w:r><w:t>Beslutet kan överklagas &lt;inom tre veckor&gt;.</w:t></w:r></w:p>
    <w:sectPr><w:headerReference w:type="default" r:id="rId6"/></w:sectPr>
  </w:body>
</w:document>`;

const STYLES = `${DECLARATION}
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
  <w:style w:type="paragraph" w:styleId="Titel"><w:name w:val="Title"/></w:style>
  <w:style w:type="paragraph" w:styleId="Rubrik1"><w:name w:val="heading 1"/></w:style>
  <w:style w:type="paragraph" w:styleId="Punktlista"><w:name w:val="List Bullet"/><w:basedOn w:val="Normal"/><w:pPr><w:numPr><w:numId w:val="1"/></w:numPr></w:pPr></w:style>
  <w:style w:type="character" w:styleId="Stark"><w:name w:val="Strong"/><w:rPr><w:b/><w:bCs/></w:rPr></w:style>
</w:styles>`;

const NUMBERING = `${DECLARATION}
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:abstractNum w:abstractNumId="0">
    <w:lvl w:ilvl="0"><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/></w:lvl>
    <w:lvl w:ilvl="1"><w:numFmt w:val="bullet"/><w:lvlText w:val="o"/></w:lvl>
  </w:abstractNum>
  <w:abstractNum w:abstractNumId="1">
    <w:lvl w:ilvl="0"><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/></w:lvl>
  </w:abstractNum>
  <w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
  <w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num>
</w:numbering>`;

const HEADER = `${DECLARATION}
<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:p><w:r><w:t>Socialförvaltningen — Nyköpings kommun</w:t></w:r></w:p>
  <w:p/>
</w:hdr>`;

const FOOTER = `${DECLARATION}
<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:p><w:r><w:t xml:space="preserve">Sida </w:t></w:r><w:r><w:instrText> PAGE </w:instrText></w:r></w:p>
</w:ftr>`;

function docx(parts: Record<string, string> = {}): ArrayBuffer {
  const bytes = makeZip({
    "[Content_Types].xml": `${DECLARATION}<Types/>`,
    "word/document.xml": DOCUMENT,
    "word/styles.xml": STYLES,
    "word/numbering.xml": NUMBERING,
    "word/header1.xml": HEADER,
    "word/footer1.xml": FOOTER,
    ...parts,
  });
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

describe("extracting a Word document", () => {
  let text = "";
  let blocks: string[] = [];

  beforeAll(async () => {
    const extracted = await extractDocxText(docx());
    expect(extracted).toMatchObject({ kind: "docx", markdown: true });
    text = extracted.text;
    blocks = text.split("\n\n");
  });

  it("takes headings from the paragraph's style, however it is named", () => {
    expect(blocks[1]).toBe("# Beslut om bistånd");
    expect(blocks[2]).toBe("# Bakgrund");
    expect(text).toContain("\n# Skäl för beslutet\n");
    // No style at all, only an outline level.
    expect(text).toContain("\n## Bedömning\n");
  });

  it("writes the face each run is set in as Markdown", () => {
    expect(blocks[3]).toBe("Sökanden **Anna Andersson** bor på *Storgatan 1*.");
  });

  it("reads bold from a character style, and direct formatting over it", () => {
    expect(text).toContain("**Viktigt**: läs detta.");
    expect(text).toContain("\nInte fet ändå.\n");
  });

  it("keeps a line break, and spaces a tab out", () => {
    expect(text).toContain("Telefon: 070-123 45 67\nPostnr: 123 45");
  });

  it("takes the list marker from the numbering part", () => {
    expect(text).toContain("- Första punkten");
    expect(text).toContain("  - Underpunkt");
    expect(text).toContain("1. Ett\n\n1. Två");
    // Word's own `List Bullet` style numbers the paragraph itself: the
    // paragraph using it carries no numbering of its own at all.
    expect(text).toContain("- Punkt från en liststil");
    // `w:numId="0"` opts out of numbering, so this one is still a heading.
    expect(text).not.toContain("- Skäl för beslutet");
  });

  it("writes a table as a table, its pipes escaped", () => {
    expect(text).toContain(
      [
        "| **Namn** | **Personnummer** |",
        "| --- | --- |",
        "| Anna \\| Andersson | 19850101-1234 |",
      ].join("\n"),
    );
  });

  it("accepts tracked changes and drops field codes", () => {
    expect(text).toContain("Kommunens webbplats och tillägget");
    expect(text).not.toContain("strykningen");
    expect(text).not.toContain("MERGEFORMAT");
  });

  it("reads content controls without their own labels", () => {
    expect(text).toContain("Dnr 2024-001");
    expect(text).not.toContain("Diarienummer");
  });

  it("writes the running header and footer as comments", () => {
    expect(blocks[0]).toBe("<!-- Socialförvaltningen — Nyköpings kommun -->");
    expect(blocks[blocks.length - 1]).toBe("<!-- Sida -->");
  });

  it("resolves character references and drops empty paragraphs", () => {
    expect(text).toContain("överklagas <inom tre veckor>.");
    expect(text).not.toContain("\n\n\n");
  });
});

describe("a Word document that isn't one", () => {
  it("refuses a file that is not a ZIP", async () => {
    const bytes = new TextEncoder().encode("not a Word file");
    await expect(
      extractDocxText(bytes.buffer as ArrayBuffer),
    ).rejects.toBeInstanceOf(DocxError);
  });

  it("refuses an archive with no main part", async () => {
    const bytes = makeZip({ "word/styles.xml": STYLES });
    await expect(
      extractDocxText(bytes.buffer.slice(0) as ArrayBuffer),
    ).rejects.toThrow(/word\/document\.xml/);
  });

  it("leaves a document set wholly in bold unmarked", async () => {
    const bold = `${DECLARATION}
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>
  <w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Allt är fetstilt här.</w:t></w:r></w:p>
  <w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Även detta.</w:t></w:r></w:p>
</w:body></w:document>`;
    const extracted = await extractDocxText(
      docx({
        "word/document.xml": bold,
        "word/header1.xml": `${DECLARATION}<w:hdr/>`,
        "word/footer1.xml": `${DECLARATION}<w:ftr/>`,
      }),
    );
    expect(extracted.text).toBe("Allt är fetstilt här.\n\nÄven detta.");
  });
});

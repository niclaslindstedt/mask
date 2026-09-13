import { describe, expect, it } from "vitest";

import {
  childElement,
  childElements,
  decodeXmlEntities,
  findElement,
  findElements,
  parseXml,
  textContent,
  XmlError,
} from "../src/generic/xml.ts";

describe("parsing XML", () => {
  it("reads elements, attributes and text", () => {
    const root = parseXml(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
        `<w:document xmlns:w="http://x"><w:body>` +
        `<w:p w:rsidR="00A"><w:t xml:space="preserve">hej </w:t></w:p>` +
        `</w:body></w:document>`,
    );
    expect(root.name).toBe("w:document");
    expect(root.attrs["xmlns:w"]).toBe("http://x");
    const paragraph = findElement(root, "w:p")!;
    expect(paragraph.attrs["w:rsidR"]).toBe("00A");
    expect(childElement(paragraph, "w:t")?.attrs["xml:space"]).toBe("preserve");
    // The space the paragraph asked to keep is still there.
    expect(textContent(paragraph)).toBe("hej ");
  });

  it("handles self-closing tags, single quotes and bare attributes", () => {
    const root = parseXml(`<r><b/><i w:val='0'/><x flag/></r>`);
    expect(childElements(root).map((child) => child.name)).toEqual([
      "b",
      "i",
      "x",
    ]);
    expect(childElement(root, "i")?.attrs["w:val"]).toBe("0");
    expect(childElement(root, "x")?.attrs["flag"]).toBe("");
  });

  it("skips comments, declarations and instructions, and keeps CDATA", () => {
    const root = parseXml(
      `<!DOCTYPE r><r><!-- a <b> comment --><?pi go?><![CDATA[ 1 < 2 & 3 ]]></r>`,
    );
    expect(textContent(root)).toBe(" 1 < 2 & 3 ");
  });

  it("resolves character references in text and in attributes", () => {
    const root = parseXml(`<r a="P&amp;G &#229;">1 &lt; 2 &#xE5; &apos;</r>`);
    expect(root.attrs["a"]).toBe("P&G å");
    expect(textContent(root)).toBe("1 < 2 å '");
    // An entity this doesn't know is left exactly as it was written.
    expect(decodeXmlEntities("&nbsp;&amp;")).toBe("&nbsp;&");
  });

  it("finds descendants by name, in document order", () => {
    const root = parseXml(`<a><b><c>1</c></b><c>2</c></a>`);
    expect(findElements(root, "c").map(textContent)).toEqual(["1", "2"]);
    expect(findElement(root, "missing")).toBeNull();
  });

  it("throws on malformed markup", () => {
    expect(() => parseXml(`<a><b></a>`)).toThrow(XmlError);
    expect(() => parseXml(`<a>`)).toThrow(/Unclosed/);
    expect(() => parseXml(`text only`)).toThrow(/No root element/);
    expect(() => parseXml(`<a x=1/>`)).toThrow(/Unquoted/);
    expect(() => parseXml(`<a><!-- open`)).toThrow(/Unterminated comment/);
  });
});

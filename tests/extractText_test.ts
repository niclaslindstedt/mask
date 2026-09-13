import { describe, expect, it } from "vitest";

import {
  EXTRACT_ACCEPT,
  LegacyFormatError,
  UnsupportedFileError,
  extractTextFromFile,
  fileExtension,
  isPdfFile,
  isTextFile,
  isWordFile,
  normalizeNewlines,
} from "../src/generic/extractText/index.ts";

describe("extractText routing", () => {
  it("classifies files by MIME type or extension", () => {
    expect(fileExtension("Letter.PDF")).toBe(".pdf");
    expect(fileExtension("noext")).toBe("");
    expect(isPdfFile({ name: "a.pdf", type: "" })).toBe(true);
    expect(isPdfFile({ name: "a", type: "application/pdf" })).toBe(true);
    expect(isTextFile({ name: "notes.md", type: "" })).toBe(true);
    expect(isTextFile({ name: "x", type: "text/plain" })).toBe(true);
    expect(isTextFile({ name: "x.exe", type: "" })).toBe(false);
    expect(isWordFile({ name: "Beslut.DOCX", type: "" })).toBe(true);
    expect(
      isWordFile({
        name: "no-extension",
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }),
    ).toBe(true);
    expect(isWordFile({ name: "gammalt.doc", type: "" })).toBe(false);
  });

  it("offers every format it reads to the file picker", () => {
    for (const extension of [".pdf", ".docx", ".txt", ".md"]) {
      expect(EXTRACT_ACCEPT.split(",")).toContain(extension);
    }
  });

  it("names the format to save a pre-2007 Word file as", async () => {
    const file = new File([new Uint8Array([0xd0, 0xcf])], "gammalt.doc", {
      type: "application/msword",
    });
    await expect(extractTextFromFile(file)).rejects.toBeInstanceOf(
      LegacyFormatError,
    );
    await expect(extractTextFromFile(file)).rejects.toMatchObject({
      instead: ".docx",
    });
  });

  it("reads a text file and normalises newlines", async () => {
    const file = new File(["hej\r\nvärlden\rslut"], "a.txt", {
      type: "text/plain",
    });
    await expect(extractTextFromFile(file)).resolves.toEqual({
      text: "hej\nvärlden\nslut",
      kind: "text",
      markdown: false,
    });
    expect(normalizeNewlines("a\r\nb")).toBe("a\nb");
  });

  it("marks a Markdown file as Markdown", async () => {
    const file = new File(["# Rubrik\n\ntext"], "a.md", { type: "" });
    await expect(extractTextFromFile(file)).resolves.toEqual({
      text: "# Rubrik\n\ntext",
      kind: "text",
      markdown: true,
    });
  });

  it("refuses an unsupported file", async () => {
    const file = new File([new Uint8Array([1, 2, 3])], "a.bin", {
      type: "application/octet-stream",
    });
    await expect(extractTextFromFile(file)).rejects.toBeInstanceOf(
      UnsupportedFileError,
    );
  });
});

import { describe, expect, it } from "vitest";

import {
  findZipEntry,
  readZipDirectory,
  readZipEntry,
  readZipText,
  ZipError,
} from "../src/generic/zip.ts";
import { makeZip } from "./fixtures/zip.ts";

const FILES = {
  mimetype: "application/zip",
  "word/document.xml": "<w:document>".padEnd(4000, "x") + "</w:document>",
  "docProps/core.xml": "räksmörgås",
};

describe("reading a ZIP archive", () => {
  it("lists every member of the central directory", () => {
    const entries = readZipDirectory(makeZip(FILES));
    expect(entries.map((entry) => entry.name)).toEqual(Object.keys(FILES));
    expect(findZipEntry(entries, "docProps/core.xml")?.uncompressedSize).toBe(
      new TextEncoder().encode(FILES["docProps/core.xml"]).length,
    );
    expect(findZipEntry(entries, "nothing")).toBeNull();
  });

  it("inflates a deflated member", async () => {
    const bytes = makeZip(FILES);
    const entries = readZipDirectory(bytes);
    const document = findZipEntry(entries, "word/document.xml")!;
    // The long, repetitive member is worth compressing, so this is the
    // deflate path rather than the stored one.
    expect(document.method).toBe(8);
    expect(document.compressedSize).toBeLessThan(document.uncompressedSize);
    expect(new TextDecoder().decode(await readZipEntry(bytes, document))).toBe(
      FILES["word/document.xml"],
    );
  });

  it("reads a stored member, and decodes UTF-8", async () => {
    const bytes = makeZip(FILES, { store: true });
    const entries = readZipDirectory(bytes);
    expect(findZipEntry(entries, "mimetype")?.method).toBe(0);
    await expect(
      readZipText(bytes, entries, "docProps/core.xml"),
    ).resolves.toBe("räksmörgås");
  });

  it("finds the end record behind an archive comment", () => {
    const bytes = makeZip(FILES, { comment: "z".repeat(3000) });
    expect(readZipDirectory(bytes)).toHaveLength(3);
  });

  it("answers null for a member that isn't there", async () => {
    const bytes = makeZip(FILES);
    const entries = readZipDirectory(bytes);
    await expect(readZipText(bytes, entries, "word/styles.xml")).resolves.toBe(
      null,
    );
  });

  it("refuses a file that is not an archive", () => {
    const bytes = new TextEncoder().encode("this is not a ZIP file at all");
    expect(() => readZipDirectory(bytes)).toThrow(ZipError);
    expect(() => readZipDirectory(new Uint8Array(4))).toThrow(ZipError);
  });

  it("refuses a damaged directory", () => {
    const bytes = makeZip(FILES);
    // Break the first central-directory signature, leaving the end record —
    // an archive that claims members it cannot produce.
    const start = new DataView(bytes.buffer).getUint32(bytes.length - 6, true);
    bytes[start] = 0;
    expect(() => readZipDirectory(bytes)).toThrow(/Damaged/);
  });
});

// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// File → plain text. Text-like files are read as UTF-8 straight away; a PDF
// goes through `pdfjs-dist` and a Word file through the ZIP-and-XML reader,
// both loaded on first use so neither chunk sits on the app's boot path.

export type ExtractedText = {
  text: string;
  kind: "text" | "pdf" | "docx";
  /** Whether `text` carries Markdown a reader should render rather than show
   *  verbatim. A PDF and a Word file always do — their headings and their bold
   *  are written back out as Markdown (see `markup.ts`, `docx.ts`) — and so
   *  does a `.md` file. */
  markdown?: boolean;
  /** Page count, for PDFs. */
  pages?: number;
};

/** Extensions whose text is already Markdown. */
const MARKDOWN_EXTENSIONS: readonly string[] = [".md", ".markdown"];

/** The word-processor formats read through `docx.ts` — all three are the same
 *  Office Open XML package, differing only in whether they carry macros
 *  (`.docm`) or are a template (`.dotx`). */
export const WORD_EXTENSIONS: readonly string[] = [".docx", ".docm", ".dotx"];

/** Word's own pre-2007 binary format, which is a different thing entirely: not
 *  XML, not a ZIP, and not read here. Worth naming rather than refusing as
 *  just another unknown file, since "save it as .docx" is the whole fix. */
export const LEGACY_WORD_EXTENSIONS: readonly string[] = [".doc", ".dot"];

/** Extensions read as plain text. Anything else that isn't a PDF or a Word
 *  document is refused. */
export const TEXT_EXTENSIONS: readonly string[] = [
  ".txt",
  ".md",
  ".markdown",
  ".csv",
  ".tsv",
  ".json",
  ".log",
  ".xml",
  ".html",
  ".htm",
  ".eml",
];

/** The `accept` attribute for a file picker that takes what this reads. */
export const EXTRACT_ACCEPT = [
  ...TEXT_EXTENSIONS,
  ...WORD_EXTENSIONS,
  ".pdf",
  "text/*",
].join(",");

export function fileExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot < 0 ? "" : name.slice(dot).toLowerCase();
}

export function isPdfFile(file: { name: string; type: string }): boolean {
  return file.type === "application/pdf" || fileExtension(file.name) === ".pdf";
}

/** The Office Open XML media type, which a browser sets on a `.docx` it knows
 *  and leaves off one it doesn't. */
const WORD_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export function isWordFile(file: { name: string; type: string }): boolean {
  return (
    file.type === WORD_MIME ||
    WORD_EXTENSIONS.includes(fileExtension(file.name))
  );
}

/** A Word file from before 2007 — refused, but by name. */
export function isLegacyWordFile(file: {
  name: string;
  type: string;
}): boolean {
  return (
    file.type === "application/msword" ||
    LEGACY_WORD_EXTENSIONS.includes(fileExtension(file.name))
  );
}

export function isTextFile(file: { name: string; type: string }): boolean {
  return (
    file.type.startsWith("text/") ||
    TEXT_EXTENSIONS.includes(fileExtension(file.name))
  );
}

export class UnsupportedFileError extends Error {
  constructor(name: string) {
    super(`Unsupported file: ${name}`);
    this.name = "UnsupportedFileError";
  }
}

/** A file in a format whose *successor* is read here — the caller can say what
 *  to save it as instead rather than only that it was refused. */
export class LegacyFormatError extends UnsupportedFileError {
  constructor(
    name: string,
    /** The extension to save it as, e.g. `.docx`. */
    readonly instead: string,
  ) {
    super(name);
    this.name = "LegacyFormatError";
  }
}

export async function extractTextFromFile(file: File): Promise<ExtractedText> {
  if (isPdfFile(file)) {
    const { extractPdfText } = await import("./pdf.ts");
    return extractPdfText(await file.arrayBuffer());
  }
  if (isWordFile(file)) {
    const { extractDocxText } = await import("./docx.ts");
    return extractDocxText(await file.arrayBuffer());
  }
  if (isLegacyWordFile(file)) throw new LegacyFormatError(file.name, ".docx");
  if (isTextFile(file)) {
    return {
      text: normalizeNewlines(await file.text()),
      kind: "text",
      markdown: MARKDOWN_EXTENSIONS.includes(fileExtension(file.name)),
    };
  }
  throw new UnsupportedFileError(file.name);
}

/** CRLF / CR → LF so offsets line up however the file was written. */
export function normalizeNewlines(text: string): string {
  return text.replace(/\r\n?/g, "\n");
}

// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// File → plain text. Text-like files are read as UTF-8 straight away; a PDF
// goes through `pdfjs-dist`, loaded on first use so the (large) PDF chunk
// never sits on the app's boot path.

export type ExtractedText = {
  text: string;
  kind: "text" | "pdf";
  /** Page count, for PDFs. */
  pages?: number;
};

/** Extensions read as plain text. Anything else that isn't a PDF is refused. */
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
export const EXTRACT_ACCEPT = [...TEXT_EXTENSIONS, ".pdf", "text/*"].join(",");

export function fileExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot < 0 ? "" : name.slice(dot).toLowerCase();
}

export function isPdfFile(file: { name: string; type: string }): boolean {
  return file.type === "application/pdf" || fileExtension(file.name) === ".pdf";
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

export async function extractTextFromFile(file: File): Promise<ExtractedText> {
  if (isPdfFile(file)) {
    const { extractPdfText } = await import("./pdf.ts");
    return extractPdfText(await file.arrayBuffer());
  }
  if (isTextFile(file)) {
    return { text: normalizeNewlines(await file.text()), kind: "text" };
  }
  throw new UnsupportedFileError(file.name);
}

/** CRLF / CR → LF so offsets line up however the file was written. */
export function normalizeNewlines(text: string): string {
  return text.replace(/\r\n?/g, "\n");
}

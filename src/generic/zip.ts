// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Reading a ZIP archive — the little of one that a container format needs.
//
// Half the document formats in the world are a ZIP with XML inside it: a Word
// file, a spreadsheet, a slide deck, an EPUB. Getting at one of those parts
// means reading the archive's own table of contents and inflating a single
// member, which is a hundred lines of arithmetic rather than a dependency.
//
// The inflating itself is the platform's: `DecompressionStream("deflate-raw")`
// is the browser's own zlib, so the only thing this module carries is the
// layout of the file around it. Reading is all it does — nothing here writes
// an archive.
//
// The archive is read from the **central directory** at the end of the file,
// not by walking the local headers from the front. That is what the format
// says is authoritative, and it is also the only place a member's compressed
// size is guaranteed to be filled in: a producer streaming its output writes
// zeroes in the local header and the real sizes in a trailing descriptor.

/** A member of the archive, as its central-directory entry describes it. */
export type ZipEntry = {
  /** The path inside the archive, e.g. `word/document.xml`. */
  name: string;
  /** 0 (stored) or 8 (deflate) — anything else this reader refuses. */
  method: number;
  /** Byte offset of the member's local header. */
  offset: number;
  compressedSize: number;
  uncompressedSize: number;
};

/** A file that isn't a ZIP, or is one this reader can't read. */
export class ZipError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ZipError";
  }
}

const SIGNATURE_EOCD = 0x06054b50;
const SIGNATURE_CENTRAL = 0x02014b50;
const SIGNATURE_LOCAL = 0x04034b50;

const METHOD_STORED = 0;
const METHOD_DEFLATE = 8;

/** The end-of-central-directory record is the last thing in the file, but it
 *  ends with a comment of up to 64 KB, so it is found by scanning back. */
const MAX_EOCD_SCAN = 0xffff + 22;

/** The marker a 32-bit size field carries when the real value is in a Zip64
 *  extra field — an archive far larger than a document, and not read here. */
const ZIP64_MARKER = 0xffffffff;

function view(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

/** Where the end-of-central-directory record starts. */
function findEndOfCentralDirectory(bytes: Uint8Array): number {
  const data = view(bytes);
  const first = Math.max(0, bytes.length - MAX_EOCD_SCAN);
  for (let at = bytes.length - 22; at >= first; at--) {
    if (data.getUint32(at, true) === SIGNATURE_EOCD) return at;
  }
  throw new ZipError("Not a ZIP archive");
}

/** Every member of `bytes`, in the order the archive lists them. */
export function readZipDirectory(bytes: Uint8Array): ZipEntry[] {
  if (bytes.length < 22) throw new ZipError("Not a ZIP archive");
  const data = view(bytes);
  const eocd = findEndOfCentralDirectory(bytes);
  const count = data.getUint16(eocd + 10, true);
  const start = data.getUint32(eocd + 16, true);
  if (start === ZIP64_MARKER || count === 0xffff) {
    throw new ZipError("Zip64 archives are not supported");
  }

  const entries: ZipEntry[] = [];
  let at = start;
  for (let i = 0; i < count; i++) {
    if (
      at + 46 > bytes.length ||
      data.getUint32(at, true) !== SIGNATURE_CENTRAL
    ) {
      throw new ZipError("Damaged ZIP directory");
    }
    const nameLength = data.getUint16(at + 28, true);
    const extraLength = data.getUint16(at + 30, true);
    const commentLength = data.getUint16(at + 32, true);
    const compressedSize = data.getUint32(at + 20, true);
    const uncompressedSize = data.getUint32(at + 24, true);
    const offset = data.getUint32(at + 42, true);
    if (
      compressedSize === ZIP64_MARKER ||
      uncompressedSize === ZIP64_MARKER ||
      offset === ZIP64_MARKER
    ) {
      throw new ZipError("Zip64 archives are not supported");
    }
    entries.push({
      name: new TextDecoder().decode(
        bytes.subarray(at + 46, at + 46 + nameLength),
      ),
      method: data.getUint16(at + 10, true),
      offset,
      compressedSize,
      uncompressedSize,
    });
    at += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

/** The entry named `name`, or null when the archive has no such member. */
export function findZipEntry(
  entries: readonly ZipEntry[],
  name: string,
): ZipEntry | null {
  return entries.find((entry) => entry.name === name) ?? null;
}

/** The bytes of one member, inflated. */
export async function readZipEntry(
  bytes: Uint8Array,
  entry: ZipEntry,
): Promise<Uint8Array> {
  const data = view(bytes);
  if (
    entry.offset + 30 > bytes.length ||
    data.getUint32(entry.offset, true) !== SIGNATURE_LOCAL
  ) {
    throw new ZipError(`Damaged ZIP member: ${entry.name}`);
  }
  // The local header repeats the name and carries its own extra field, which
  // is routinely a different length from the central directory's.
  const nameLength = data.getUint16(entry.offset + 26, true);
  const extraLength = data.getUint16(entry.offset + 28, true);
  const start = entry.offset + 30 + nameLength + extraLength;

  if (entry.method === METHOD_STORED) {
    return bytes.slice(start, start + entry.uncompressedSize);
  }
  if (entry.method === METHOD_DEFLATE) {
    return inflateRaw(bytes.subarray(start, start + entry.compressedSize));
  }
  throw new ZipError(
    `Unsupported compression in ${entry.name} (method ${entry.method})`,
  );
}

/** One member's bytes by name, or null when the archive has no such member. */
export function readZipFile(
  bytes: Uint8Array,
  entries: readonly ZipEntry[],
  name: string,
): Promise<Uint8Array | null> {
  const entry = findZipEntry(entries, name);
  return entry ? readZipEntry(bytes, entry) : Promise.resolve(null);
}

/** One member decoded as UTF-8 text, or null when it isn't in the archive. */
export async function readZipText(
  bytes: Uint8Array,
  entries: readonly ZipEntry[],
  name: string,
): Promise<string | null> {
  const member = await readZipFile(bytes, entries, name);
  return member === null ? null : new TextDecoder().decode(member);
}

/** Inflate a raw deflate stream with the platform's own zlib. */
async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === "undefined") {
    throw new ZipError("This browser cannot decompress ZIP archives");
  }
  const stream = new Blob([data as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

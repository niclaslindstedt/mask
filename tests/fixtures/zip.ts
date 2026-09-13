// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A ZIP *writer*, for the tests of the reader (`src/generic/zip.ts`) and of
// the Word extractor that sits on it. The app only ever reads archives, so
// this lives with the tests rather than in `src/`.

import { deflateRawSync } from "node:zlib";

const SIGNATURE_LOCAL = 0x04034b50;
const SIGNATURE_CENTRAL = 0x02014b50;
const SIGNATURE_EOCD = 0x06054b50;

/** CRC-32, as the format asks for it — no reader here checks it, but a fixture
 *  that a real unzip refuses is a fixture that proves nothing. */
function crc32(bytes: Uint8Array): number {
  let crc = ~0;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return ~crc >>> 0;
}

export type ZipOptions = {
  /** Store every member uncompressed rather than deflating it. */
  store?: boolean;
  /** A trailing archive comment, which pushes the end record off the end. */
  comment?: string;
};

/** `files` as a ZIP archive. */
export function makeZip(
  files: Record<string, string>,
  options: ZipOptions = {},
): Uint8Array {
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];
  const directory: Uint8Array[] = [];
  let offset = 0;

  for (const [name, content] of Object.entries(files)) {
    const nameBytes = encoder.encode(name);
    const raw = encoder.encode(content);
    const deflated = options.store ? raw : new Uint8Array(deflateRawSync(raw));
    const compressed = options.store ? raw : deflated;
    const method = options.store ? 0 : 8;
    const crc = crc32(raw);

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, SIGNATURE_LOCAL, true);
    local.setUint16(4, 20, true);
    local.setUint16(8, method, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, compressed.length, true);
    local.setUint32(22, raw.length, true);
    local.setUint16(26, nameBytes.length, true);
    parts.push(new Uint8Array(local.buffer), nameBytes, compressed);

    const central = new DataView(new ArrayBuffer(46));
    central.setUint32(0, SIGNATURE_CENTRAL, true);
    central.setUint16(4, 20, true);
    central.setUint16(6, 20, true);
    central.setUint16(10, method, true);
    central.setUint32(16, crc, true);
    central.setUint32(20, compressed.length, true);
    central.setUint32(24, raw.length, true);
    central.setUint16(28, nameBytes.length, true);
    central.setUint32(42, offset, true);
    directory.push(new Uint8Array(central.buffer), nameBytes);

    offset += 30 + nameBytes.length + compressed.length;
  }

  const directorySize = directory.reduce((sum, part) => sum + part.length, 0);
  const comment = encoder.encode(options.comment ?? "");
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, SIGNATURE_EOCD, true);
  end.setUint16(8, Object.keys(files).length, true);
  end.setUint16(10, Object.keys(files).length, true);
  end.setUint32(12, directorySize, true);
  end.setUint32(16, offset, true);
  end.setUint16(20, comment.length, true);

  return concat([...parts, ...directory, new Uint8Array(end.buffer), comment]);
}

function concat(parts: readonly Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

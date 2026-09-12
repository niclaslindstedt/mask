// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { openBlobVault } from "../generic/blobVault.ts";
import { parseDoc } from "./migrations.ts";
import { DOC_KEY_PREFIX } from "./useMaskStore.ts";
import * as output from "../output.ts";

// The file a document was made from, kept so it can be read as itself.
//
// A document is stored as the text pulled out of it — that text is what the
// detectors read and what the placeholders are woven into. A PDF, though, is
// laid out: columns, tables, stamps and signatures, none of which survive the
// pass into paragraphs. So the file is kept beside the text, and the reader
// shows the real page instead of an approximation of it.
//
// It stays on this device like everything else here: the bytes go into an
// IndexedDB vault in this browser, are never uploaded anywhere, and are
// erased by Settings → Developer → Erase all local data. The vault is
// best-effort — a browser that refuses it leaves the reader with the
// extracted text, which is what every document had before.

const vault = openBlobVault("mask:sources");

/** Keep the file `docId` was made from. Best effort: a vault that refuses the
 *  write (no IndexedDB, a full disk) only costs the document its page view. */
export async function keepSourceFile(docId: string, file: Blob): Promise<void> {
  await vault.put(docId, file);
}

/** The file `docId` was made from, or null when none is held — a pasted
 *  document, one added before the file was kept, or a vault that refused. */
export function loadSourceFile(docId: string): Promise<Blob | null> {
  return vault.get(docId);
}

/** Forget every file whose document is gone.
 *
 *  Deleting a document doesn't drop its file on the spot, because deleting is
 *  undoable and the file would not come back with it. The vault is swept at
 *  boot instead, by which point every undo is long spent. */
export async function sweepSourceFiles(): Promise<void> {
  const held = await vault.ids();
  if (held.length === 0) return;
  const live = storedDocumentIds();
  // Unreadable storage means an unknown set of live documents — keep
  // everything rather than delete a file whose document is simply out of
  // reach for now.
  if (!live) return;
  const orphans = held.filter((id) => !live.has(id));
  if (orphans.length === 0) return;
  await vault.remove(orphans);
  output.status(
    `Dropped ${orphans.length} source file(s) of deleted documents`,
  );
}

/** Forget every file held, whatever its document. */
export function clearSourceFiles(): Promise<void> {
  return vault.clear();
}

/** Every document id stored on this device, across all workspaces, or null
 *  when any of them couldn't be read. */
function storedDocumentIds(): Set<string> | null {
  const ids = new Set<string>();
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key !== DOC_KEY_PREFIX && !key?.startsWith(`${DOC_KEY_PREFIX}:`)) {
        continue;
      }
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      for (const project of parseDoc(raw).projects) {
        for (const doc of project.documents) ids.add(doc.id);
      }
    }
  } catch {
    return null;
  }
  return ids;
}

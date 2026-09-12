// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { DEFAULT_NAMESPACE_SLUG } from "@niclaslindstedt/oss-framework/namespaces";
import {
  createFolderAdapter,
  type StorageAdapter,
} from "@niclaslindstedt/oss-framework/storage";

import { logStore } from "./log.ts";
import { parseDoc, serializeDoc } from "./migrations.ts";
import type { AppData } from "./types.ts";
import {
  localDocBackend,
  type DocBackend,
  type LoadedDoc,
} from "./useMaskStore.ts";
import * as output from "../output.ts";

// The local-folder storage: a `DocBackend` (the store's persistence seam, see
// `useMaskStore.ts`) that keeps a workspace's document in a plain `.json` file
// inside a folder the user picked on this device, through the browser's File
// System Access API.
//
// It is still local-only — the folder is on the user's own disk, the bytes
// never touch a network, and the app has no backend to send them to. What it
// buys over the default `localStorage` backend is that the document becomes a
// real file: greppable, backed up with the rest of the folder, put under
// version control, or carried between browsers on the same machine. Clearing
// site data no longer takes the projects with it.
//
// The framework owns every generic piece — the picker permission probe, the
// handle's IndexedDB round trip, and the whole-document folder adapter — so
// what lives here is only the app's half: which file a workspace maps to, what
// to do when the picked folder already holds a document, and the write queue
// that keeps the on-device copy and the file in step.

const log = logStore.createLogger("folder");

/** The file a workspace's document lives in, relative to the picked folder.
 *  The default workspace gets the bare name so a single-workspace folder reads
 *  as one obvious file; every other workspace is suffixed with its slug. */
export function folderDocFileName(slug: string): string {
  // Slugs are already file-safe (the framework's `slugify` makes them so);
  // this only guarantees a stray one can never climb out of the folder.
  const safe = slug.replace(/[^a-zA-Z0-9_-]/g, "-");
  return safe === DEFAULT_NAMESPACE_SLUG ? "mask.json" : `mask-${safe}.json`;
}

/** The framework's whole-document folder adapter, pointed at a workspace's
 *  file. `onPermissionLost` fires when the OS grant is revoked mid-operation,
 *  so the app can fall back to the on-device copy and ask for a reconnect. */
export function docAdapter(
  handle: FileSystemDirectoryHandle,
  slug: string,
  onPermissionLost?: () => void,
): StorageAdapter {
  return createFolderAdapter(handle, {
    fileName: folderDocFileName(slug),
    onPermissionLost,
    logger: log,
  });
}

/** What adopting a picked folder should do with the document it already holds.
 *
 *  - `push` — the folder has nothing readable to lose; write this device's
 *    document into it.
 *  - `adopt` — take the folder's document as the working copy.
 *  - `ask` — both sides hold projects and they differ; only the user can say
 *    which one survives.
 *  - `unreadable` — the file exists but can't be parsed. Nothing is written
 *    over it and the folder is not adopted.
 */
export type FolderSetup =
  | { action: "push" }
  | { action: "adopt"; data: AppData }
  | { action: "ask"; data: AppData }
  | { action: "unreadable" };

/** Decide what to do when a folder is opened. `fresh` marks the user's own
 *  connect press, the only moment a collision is worth a question: on a later
 *  start the folder *is* the storage, so whatever it holds simply wins. */
export function planFolderSetup(
  folderText: string | null,
  device: AppData,
  fresh: boolean,
): FolderSetup {
  if (folderText === null || folderText.trim() === "")
    return { action: "push" };
  let data: AppData;
  try {
    data = parseDoc(folderText);
  } catch {
    return { action: "unreadable" };
  }
  if (data.projects.length === 0) return { action: "push" };
  if (sameProjects(data, device)) return { action: "adopt", data };
  if (fresh && device.projects.length > 0) return { action: "ask", data };
  return { action: "adopt", data };
}

/** Whether two documents carry the same projects — which project is open is a
 *  per-device pointer, so re-opening a folder that already matches this device
 *  never raises a question. */
function sameProjects(a: AppData, b: AppData): boolean {
  return JSON.stringify(a.projects) === JSON.stringify(b.projects);
}

/** The folder backend for one workspace. `loaded` is the document the opening
 *  read settled on, so the store gets it synchronously the way it does from
 *  `localStorage` — the async read happens once, before this is built. */
export function folderDocBackend(options: {
  handle: FileSystemDirectoryHandle;
  slug: string;
  loaded: LoadedDoc;
  onPermissionLost: () => void;
}): DocBackend {
  const { handle, slug, loaded, onPermissionLost } = options;
  const adapter = docAdapter(handle, slug, onPermissionLost);

  // Writes are serialised and coalesced: an edit made while a write is in
  // flight replaces whatever was waiting, so a burst of edits costs one more
  // write rather than one each, and two writes can never interleave in the
  // same file.
  let waiting: string | null = null;
  let writing = false;
  let reportedFailure = false;

  function flush(): void {
    if (writing || waiting === null) return;
    const text = waiting;
    waiting = null;
    writing = true;
    void adapter
      .save(text)
      .then(() => {
        if (reportedFailure) {
          reportedFailure = false;
          output.status("Saving to the folder works again.");
        }
      })
      .catch((err: unknown) => {
        if (!reportedFailure) {
          reportedFailure = true;
          output.error(
            `Couldn't write to the folder — ${
              err instanceof Error ? err.message : String(err)
            }. Your projects are still saved on this device.`,
          );
        }
      })
      .finally(() => {
        writing = false;
        flush();
      });
  }

  return {
    id: "folder",
    load(which) {
      // A workspace switch rebuilds this backend around the new slug's read;
      // until it does, the on-device copy answers.
      return which === slug ? loaded : localDocBackend.load(which);
    },
    save(which, data) {
      // The on-device copy is kept in step with every write, so the app still
      // opens instantly, survives a revoked folder grant, and has the same
      // projects waiting if the folder is disconnected.
      localDocBackend.save(which, data);
      if (which !== slug) return;
      waiting = serializeDoc(data);
      flush();
    },
  };
}

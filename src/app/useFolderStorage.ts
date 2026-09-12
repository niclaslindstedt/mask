// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useLocalStorageState } from "@niclaslindstedt/oss-framework/hooks";
import {
  clearDirectoryHandle,
  ensurePermission,
  isFolderBackendAvailable,
  loadDirectoryHandle,
  saveDirectoryHandle,
} from "@niclaslindstedt/oss-framework/storage";

import {
  docAdapter,
  folderDocBackend,
  planFolderSetup,
} from "./folderStorage.ts";
import { logStore } from "./log.ts";
import type { AppData } from "./types.ts";
import { localDocBackend, type DocBackend } from "./useMaskStore.ts";
import * as output from "../output.ts";

// Owns where the active workspace's document is stored: this device's
// `localStorage` (the default) or a folder the user picked on their disk.
//
// The picked folder is the storage while it is connected — the on-device copy
// trails it as a cache — so opening the app reads the folder's file and adopts
// whatever it holds. The one moment that isn't automatic is the connect press
// itself: if both the folder and this device hold projects, neither can
// silently win, so the hook raises `pending` and the Storage settings tab asks.
//
// Nothing here reaches the network. The File System Access API hands the app a
// handle to one directory the user chose; the framework persists that handle in
// IndexedDB so the grant survives a reload, and the OS can revoke it at any
// time — which surfaces as `reconnect`, working from the on-device copy until
// the user re-confirms.

const MODE_KEY = "mask:storage";

/** Where the document is kept. */
export type StorageMode = "device" | "folder";

/**
 * - `off` — the document lives on this device; no folder involved.
 * - `opening` — rehydrating the handle or reading the folder's file.
 * - `choosing` — the folder and this device disagree; waiting on the user.
 * - `connected` — the folder is the storage and writes are landing.
 * - `reconnect` — the OS grant has lapsed; running from the on-device copy.
 * - `unreadable` — the folder holds a file this build can't parse. It is left
 *   untouched and the on-device copy is used.
 */
export type FolderStatus =
  "off" | "opening" | "choosing" | "connected" | "reconnect" | "unreadable";

/** The two documents a connect-time collision is between. */
export type FolderChoice = { folder: AppData; device: AppData };

export type FolderStorage = ReturnType<typeof useFolderStorage>;

const log = logStore.createLogger("folder");

function parseMode(raw: string): StorageMode {
  const value = JSON.parse(raw) as unknown;
  return value === "folder" ? "folder" : "device";
}

/** The readable half of whatever was thrown, for a log line. */
function why(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function useFolderStorage(slug: string) {
  // Chromium-based browsers only; elsewhere the picker never appears.
  const available = useMemo(() => isFolderBackendAvailable(), []);
  const [mode, setMode] = useLocalStorageState<StorageMode>(
    MODE_KEY,
    "device",
    { parse: parseMode },
  );
  const [handle, setHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [status, setStatus] = useState<FolderStatus>(
    mode === "folder" && available ? "opening" : "off",
  );
  // The document the opening read settled on, and the slug it was read for —
  // a workspace switch invalidates it and reads again.
  const [opened, setOpened] = useState<{ slug: string; data: AppData } | null>(
    null,
  );
  const [pending, setPending] = useState<FolderChoice | null>(null);
  // True between the user's connect press and the read that follows it — the
  // only read allowed to raise a question rather than adopt the folder's copy.
  const fresh = useRef(false);
  // Set once the folder has dropped out from under us. It stops the boot probe
  // from picking the handle straight back up and failing again in a loop: only
  // the user's Reconnect press clears it.
  const lapsed = useRef(false);

  const folderMode = mode === "folder" && available;

  /** Give up on the folder and run from the on-device copy until the user
   *  reconnects. Covers both halves of the same symptom: a grant the OS
   *  revoked, and a folder that stopped answering (an unmounted drive, a
   *  renamed directory). */
  const fallBackToDevice = useCallback((reason?: string) => {
    lapsed.current = true;
    setHandle(null);
    setOpened(null);
    setStatus("reconnect");
    if (reason) log.warn(`folder: ${reason}`);
    output.warn(
      "The folder can't be reached — reconnect it in Settings → Storage. Your projects are still on this device.",
    );
  }, []);

  // Boot: the saved mode says "folder", so rehydrate the stored handle and ask
  // the OS whether the grant still stands. `requestIfPrompt: false` keeps this
  // silent — re-granting needs a user gesture, which the Reconnect button has.
  useEffect(() => {
    if (!folderMode || handle || lapsed.current) return;
    let cancelled = false;
    void (async () => {
      try {
        const stored = await loadDirectoryHandle();
        if (cancelled) return;
        if (!stored) {
          setStatus("reconnect");
          return;
        }
        const permission = await ensurePermission(stored, false);
        if (cancelled) return;
        if (permission === "granted") setHandle(stored);
        else setStatus("reconnect");
      } catch (err) {
        // A blocked IndexedDB or a picker-less engine: there is no folder to
        // open, and the app must still start on the on-device copy.
        if (cancelled) return;
        log.warn(
          `folder: the stored folder could not be reopened — ${why(err)}`,
        );
        setStatus("reconnect");
      }
    })();
    return () => {
      cancelled = true;
    };
    // `status` is set by this effect, so it is deliberately not a dependency.
  }, [folderMode, handle]);

  // Read the workspace's file and decide what to do with it. Re-runs on a
  // workspace switch, since each one is its own file in the folder.
  useEffect(() => {
    if (!handle) return;
    let cancelled = false;
    setStatus("opening");
    setPending(null);
    const wasFresh = fresh.current;
    fresh.current = false;
    void (async () => {
      const device = localDocBackend.load(slug).data;
      let text: string | null;
      try {
        const snapshot = await docAdapter(
          handle,
          slug,
          fallBackToDevice,
        ).load();
        text = snapshot?.text ?? null;
      } catch (err) {
        if (cancelled) return;
        fallBackToDevice(`reading the document failed — ${why(err)}`);
        return;
      }
      if (cancelled) return;
      const plan = planFolderSetup(text ?? null, device, wasFresh);
      if (plan.action === "unreadable") {
        setStatus("unreadable");
        output.error(
          "The folder holds a document this version can't read. It was left untouched — your projects on this device are unaffected.",
        );
        return;
      }
      if (plan.action === "ask") {
        setPending({ folder: plan.data, device });
        setStatus("choosing");
        return;
      }
      setOpened({ slug, data: plan.action === "adopt" ? plan.data : device });
      setStatus("connected");
      log.info(
        plan.action === "adopt"
          ? "folder: opened the document in the folder"
          : "folder: writing this device's document to the folder",
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [handle, slug, fallBackToDevice]);

  /** Pick a folder and make it the storage. No-op where the picker is
   *  unavailable or the user dismisses it. */
  const connect = useCallback(async () => {
    if (!available || !window.showDirectoryPicker) return;
    let picked: FileSystemDirectoryHandle;
    try {
      picked = await window.showDirectoryPicker({
        id: "mask-documents",
        mode: "readwrite",
      });
    } catch (err) {
      // AbortError is the user closing the picker — nothing to report.
      if (err instanceof DOMException && err.name === "AbortError") return;
      log.error(`folder: the picker failed — ${why(err)}`);
      return;
    }
    try {
      if ((await ensurePermission(picked, true)) !== "granted") {
        log.warn("folder: read-write permission was not granted");
        return;
      }
      // Remembering the handle is a convenience, not a precondition: a failure
      // here only costs the user a re-pick after the next reload.
      await saveDirectoryHandle(picked).catch((err: unknown) => {
        log.warn(`folder: the handle could not be remembered — ${why(err)}`);
      });
    } catch (err) {
      log.error(`folder: the folder could not be opened — ${why(err)}`);
      return;
    }
    lapsed.current = false;
    fresh.current = true;
    setStatus("opening");
    setMode("folder");
    setHandle(picked);
  }, [available, setMode]);

  /** Re-confirm a grant the OS dropped. Needs the user gesture this runs in;
   *  falls back to a fresh pick when the stored handle is gone. */
  const reconnect = useCallback(async () => {
    let stored: FileSystemDirectoryHandle | null;
    try {
      stored = await loadDirectoryHandle();
    } catch {
      stored = null;
    }
    if (!stored) {
      await connect();
      return;
    }
    try {
      if ((await ensurePermission(stored, true)) !== "granted") {
        log.warn("folder: the reconnect was declined");
        return;
      }
    } catch (err) {
      log.error(`folder: the reconnect failed — ${why(err)}`);
      return;
    }
    lapsed.current = false;
    setStatus("opening");
    setHandle(stored);
  }, [connect]);

  /** Go back to keeping the document on this device. The on-device copy has
   *  trailed every write, so nothing is lost and nothing is deleted from the
   *  folder — the file stays where it is. */
  const disconnect = useCallback(() => {
    lapsed.current = false;
    setMode("device");
    setHandle(null);
    setOpened(null);
    setPending(null);
    setStatus("off");
    void clearDirectoryHandle().catch(() => {
      // Nothing stored, or storage is blocked — there is no grant to forget.
    });
    log.info("folder: disconnected — the document is kept on this device");
  }, [setMode]);

  /** Settle a connect-time collision: keep the folder's projects, or replace
   *  them with this device's. */
  const resolve = useCallback(
    (keep: "folder" | "device") => {
      if (!pending) return;
      // The device side is re-read rather than taken from the snapshot the
      // question was raised on: the app stays usable while the dialog is open,
      // and keeping "this device's" must mean what is on it now.
      setOpened({
        slug,
        data:
          keep === "folder" ? pending.folder : localDocBackend.load(slug).data,
      });
      setPending(null);
      setStatus("connected");
      log.info(
        keep === "folder"
          ? "folder: kept the projects already in the folder"
          : "folder: replaced the folder's projects with this device's",
      );
    },
    [pending, slug],
  );

  /** Back out of a connect that raised a question — neither side is touched. */
  const cancel = useCallback(() => {
    disconnect();
    log.info("folder: the connection was cancelled");
  }, [disconnect]);

  const backend = useMemo<DocBackend | null>(() => {
    if (!handle || !opened || opened.slug !== slug) return null;
    return folderDocBackend({
      handle,
      slug,
      loaded: { data: opened.data, readable: true },
      onPermissionLost: fallBackToDevice,
    });
  }, [handle, opened, slug, fallBackToDevice]);

  return {
    /** Whether this browser exposes the directory picker at all. */
    available,
    mode,
    status,
    /** The picked folder's name, once one is open. */
    folderName: handle?.name ?? null,
    /** False only while a read is in flight or a question is open — the app
     *  holds its main surface until the working copy is settled. */
    ready: status !== "opening" && status !== "choosing",
    /** The store's backend while the folder is the storage; null means the
     *  document stays on this device. */
    backend,
    pending,
    connect,
    reconnect,
    disconnect,
    resolve,
    cancel,
  };
}

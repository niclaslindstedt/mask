// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  addCustomKind,
  mergeCustomKinds,
  parseCustomKinds,
  removeCustomKind,
  renameCustomKind,
  type CustomKind,
  type KindScope,
  type ScopedKind,
} from "./customKinds.ts";
import { freshId } from "./useMaskStore.ts";
import * as output from "../output.ts";

// Where the custom placeholder types live: one key for the global list and
// one per workspace. The workspace list travels *with* the slug in state
// (the `useMaskStore` pattern) rather than through the framework's
// `useLocalStorageState`, which keeps its value across a key change — that
// would carry one workspace's types over into the next one's storage, exactly
// what scoping them is meant to prevent.

const GLOBAL_KEY = "mask:kinds";

/** localStorage key for a workspace's own types. Always suffixed, so the
 *  default workspace's list can't collide with the global one. */
export function workspaceKindsKey(slug: string): string {
  return `mask:kinds:ws:${slug}`;
}

function readKinds(key: string): CustomKind[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? parseCustomKinds(raw) : [];
  } catch {
    return [];
  }
}

function writeKinds(key: string, list: readonly CustomKind[]): void {
  try {
    // An empty list leaves no key behind — a workspace that never named a type
    // of its own doesn't litter storage.
    if (list.length === 0) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(list));
  } catch {
    output.error(
      "Couldn't save the placeholder types to this device's storage. They stay in memory for this session.",
    );
  }
}

export type CustomKindsStore = ReturnType<typeof useCustomKinds>;

export function useCustomKinds(slug: string) {
  const [global, setGlobal] = useState<CustomKind[]>(() =>
    readKinds(GLOBAL_KEY),
  );
  const [ws, setWs] = useState(() => ({
    slug,
    kinds: readKinds(workspaceKindsKey(slug)),
  }));
  // A new workspace adopts its own list; the previous one stays where it is.
  if (ws.slug !== slug)
    setWs({ slug, kinds: readKinds(workspaceKindsKey(slug)) });

  useEffect(() => writeKinds(GLOBAL_KEY, global), [global]);
  useEffect(() => writeKinds(workspaceKindsKey(ws.slug), ws.kinds), [ws]);

  const patch = useCallback(
    (scope: KindScope, next: (list: readonly CustomKind[]) => CustomKind[]) => {
      if (scope === "global") setGlobal((list) => next(list));
      else setWs((cur) => ({ ...cur, kinds: next(cur.kinds) }));
    },
    [],
  );

  const add = useCallback(
    (label: string, scope: KindScope) =>
      patch(scope, (list) => addCustomKind(list, label, () => freshId("kind"))),
    [patch],
  );

  const remove = useCallback(
    (id: string, scope: KindScope) =>
      patch(scope, (list) => removeCustomKind(list, id)),
    [patch],
  );

  const rename = useCallback(
    (id: string, label: string, scope: KindScope) =>
      patch(scope, (list) => renameCustomKind(list, id, label)),
    [patch],
  );

  /** Move a type between the two lists, keeping its id and label. */
  const setScope = useCallback(
    (id: string, from: KindScope, to: KindScope) => {
      if (from === to) return;
      const source = from === "global" ? global : ws.kinds;
      const kind = source.find((k) => k.id === id);
      if (!kind) return;
      patch(from, (list) => removeCustomKind(list, id));
      patch(to, (list) =>
        list.some((k) => k.id === id) ? [...list] : [...list, kind],
      );
    },
    [global, patch, ws.kinds],
  );

  const all: ScopedKind[] = useMemo(
    () => mergeCustomKinds(global, ws.kinds),
    [global, ws.kinds],
  );

  return { global, workspace: ws.kinds, all, add, remove, rename, setScope };
}

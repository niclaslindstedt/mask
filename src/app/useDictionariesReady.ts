// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useEffect, useSyncExternalStore } from "react";

import {
  dictionariesLoaded,
  loadDictionaries,
  subscribeDictionaries,
} from "./detectors/index.ts";

/** Kick off the lazy dictionary load and report when it has landed, so a
 *  review re-runs detection once the name and locality lists are in. */
export function useDictionariesReady(): boolean {
  const ready = useSyncExternalStore(subscribeDictionaries, dictionariesLoaded);
  useEffect(() => {
    void loadDictionaries();
  }, []);
  return ready;
}

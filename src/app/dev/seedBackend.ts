// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The developer test-data storage backend. This is how the Developer tab's
// "Test data" toggle works: rather than a special case inside the store, an
// in-memory `DocBackend` *takes over* document storage while the toggle is on
// (the same seam the sibling contacts app uses for its fake / demo data).
//
// Every namespace is seeded from `buildTestData` on first load; edits made
// during the session round-trip through an in-memory `Map`, so undo / redo,
// the active-document pointer, and switching workspaces behave exactly as they
// do against the real backend — but localStorage is never written. The backend
// is discarded when the toggle flips off or the page reloads, at which point
// `App` feeds the real `localDocBackend` back and the untouched document on
// disk reloads.

import type { AppData } from "../types.ts";
import type { DocBackend } from "../useMaskStore.ts";
import { buildTestData } from "./testData.ts";

/** Build a fresh in-memory test-data backend. A new one is created each time
 *  the toggle is turned on, so every enable starts from a pristine copy. */
export function createTestDataBackend(): DocBackend {
  const docs = new Map<string, AppData>();
  return {
    id: "dev",
    load(slug) {
      let data = docs.get(slug);
      if (!data) {
        data = buildTestData();
        docs.set(slug, data);
      }
      return { data, readable: true };
    },
    save(slug, data) {
      // In-memory only — the whole point is that the real disk is untouched.
      docs.set(slug, data);
    },
  };
}

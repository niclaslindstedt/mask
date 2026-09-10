// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Hook backing the developer "Test data" toggle. While it is on, the mask
// store loads a throwaway in-memory document full of sample projects instead
// of the real localStorage one — see `App`'s backend swap and `seedBackend.ts`.
// Turning it off restores the real document; the user's own data is never
// touched, because seeded data is never written back.
//
// The mode is deliberately IN-MEMORY ONLY — module scope, no localStorage
// write — so a page reload always drops back to the real backend. That makes
// reload the guaranteed escape hatch: test data can never outlive the tab.
//
// State lives at module scope with a pub/sub layer so the toggle in the
// Developer tab and the store swap in `App` see the same value in the same
// render — flipping the toggle updates both immediately.

import { useEffect, useState } from "react";

// The backend and the sample projects behind it are a dev-only luxury, so they
// ride in their own chunk: nothing on the entry path imports `seedBackend.ts`
// statically, and the chunk is fetched only when the toggle turns on.
type SeedBackends = typeof import("./seedBackend.ts");
let backends: SeedBackends | null = null;

/** The loaded backend factory, or `null` while the toggle has never been on.
 *  `App` reads this synchronously — `setTestDataOn` guarantees the chunk has
 *  landed before it flips the flag. */
export function seedBackends(): SeedBackends | null {
  return backends;
}

let on = false;
const subscribers = new Set<() => void>();

function notify(): void {
  for (const cb of subscribers) {
    try {
      cb();
    } catch {
      // A subscriber throwing must not break the dispatch loop.
    }
  }
}

// Monotonic token so a slow chunk load can't overwrite a newer choice: each
// call claims the sequence, and a stale async flip aborts.
let seq = 0;

/** Switch the in-memory test-data mode. Nothing is persisted. Turning it on is
 *  asynchronous under the hood — the sample projects live in their own lazy
 *  chunk — so the flag flips once that chunk has landed and `App` can build
 *  the backend synchronously from that render on. */
export function setTestDataOn(next: boolean): void {
  const token = ++seq;
  if (on === next) return;
  if (!next) {
    on = false;
    notify();
    return;
  }
  void import("./seedBackend.ts").then((m) => {
    backends = m;
    // A later call (toggled away while loading) wins over this one.
    if (token !== seq) return;
    on = true;
    notify();
  });
}

export function useDevSeed(): {
  testData: boolean;
  setTestData: (next: boolean) => void;
} {
  const [, force] = useState(0);

  useEffect(() => {
    const cb = () => force((v) => v + 1);
    subscribers.add(cb);
    return () => {
      subscribers.delete(cb);
    };
  }, []);

  return { testData: on, setTestData: setTestDataOn };
}

// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The generated name and locality dictionaries (`./data/`, ~200 KB) load as
// one lazy chunk on first use, so they never sit on the app's boot path. The
// detectors read the module-level sets below and simply find nothing until
// `loadDictionaries()` has resolved; the review screen awaits it.

export type Dictionaries = {
  givenNames: ReadonlySet<string>;
  /** Given names that are also everyday words — trusted mid-sentence or with
   *  a surname after them. */
  givenNamesWordLike: ReadonlySet<string>;
  surnames: ReadonlySet<string>;
  /** Surnames that are also everyday words — trusted mid-sentence or with a
   *  given name before them. */
  surnamesWordLike: ReadonlySet<string>;
  localities: readonly string[];
  localitiesWordLike: readonly string[];
};

const EMPTY: Dictionaries = {
  givenNames: new Set(),
  givenNamesWordLike: new Set(),
  surnames: new Set(),
  surnamesWordLike: new Set(),
  localities: [],
  localitiesWordLike: [],
};

let current: Dictionaries = EMPTY;
let pending: Promise<Dictionaries> | null = null;
const listeners = new Set<() => void>();

/** The dictionaries as loaded so far (empty until `loadDictionaries`). */
export function dictionaries(): Dictionaries {
  return current;
}

export function dictionariesLoaded(): boolean {
  return current !== EMPTY;
}

export function loadDictionaries(): Promise<Dictionaries> {
  if (current !== EMPTY) return Promise.resolve(current);
  pending ??= Promise.all([
    import("./data/givenNames.ts"),
    import("./data/givenNamesWordLike.ts"),
    import("./data/surnames.ts"),
    import("./data/surnamesWordLike.ts"),
    import("./data/localities.ts"),
    import("./data/localitiesWordLike.ts"),
  ]).then(([g, gw, s, sw, l, lw]) => {
    current = {
      givenNames: new Set(g.default),
      givenNamesWordLike: new Set(gw.default),
      surnames: new Set(s.default),
      surnamesWordLike: new Set(sw.default),
      localities: l.default,
      localitiesWordLike: lw.default,
    };
    listeners.forEach((fn) => fn());
    return current;
  });
  return pending;
}

/** Subscribe to the load completing (for a `useSyncExternalStore` hook). */
export function subscribeDictionaries(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

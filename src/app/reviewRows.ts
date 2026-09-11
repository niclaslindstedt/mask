// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { Candidate } from "./masking.ts";

// The review's rows, as data. One row is one value the user is deciding about:
// what it is, whether it is masked, and whether they put it there themselves.
// The panel renders these; the two functions here are the whole of the logic
// that moves them, so both are pure and both are tested.

export type Row = {
  value: string;
  kind: string;
  include: boolean;
  /** The user put this value here — detection never offered it. */
  manual?: boolean;
};

/**
 * Fold a fresh round of detection into the rows the user already has.
 *
 * Every candidate becomes a row, ticked unless the user had already decided
 * otherwise. A row detection no longer offers is dropped — except one the user
 * typed in by hand and one they just whitelisted, which stay roughly where they
 * stood, because their own buttons are how the user takes either back.
 */
export function mergeRows(
  prev: Row[],
  candidates: Candidate[],
  isWhitelisted: (value: string) => boolean,
): Row[] {
  const byValue = new Map(prev.map((r) => [r.value, r]));
  const next: Row[] = candidates.map(
    (c) =>
      byValue.get(c.value) ?? { value: c.value, kind: c.kind, include: true },
  );
  prev.forEach((r, i) => {
    if (next.some((n) => n.value === r.value)) return;
    if (!r.manual && !isWhitelisted(r.value)) return;
    next.splice(Math.min(i, next.length), 0, r);
  });
  return next;
}

/**
 * Put `value` among the rows with the given tick, and answer the kind its row
 * carries — a row that already exists keeps the kind it had, so masking a
 * value the detectors already typed doesn't retype it.
 */
export function upsertRow(
  rows: Row[],
  value: string,
  kind: string,
  include: boolean,
): { rows: Row[]; kind: string } {
  const existing = rows.find((r) => r.value === value);
  if (!existing) {
    return {
      rows: [...rows, { value, kind, include, manual: true }],
      kind,
    };
  }
  return {
    rows: rows.map((r) => (r.value === value ? { ...r, include } : r)),
    kind: existing.kind,
  };
}

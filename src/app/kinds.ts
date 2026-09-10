// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { foldKindLabel } from "./customKinds.ts";
import type { TFn } from "./i18n/index.ts";
import { ENTITY_KINDS, type EntityKind } from "./types.ts";

// How a kind of sensitive value reads and paints. The built-in kinds have
// translated labels; a custom kind — a saved placeholder type, a pattern
// rule's kind, or a label typed once during a review — shows its own name.

const KIND_KEYS: Record<EntityKind, Parameters<TFn>[0]> = {
  name: "kinds.name",
  street: "kinds.street",
  city: "kinds.city",
  postal: "kinds.postal",
  phone: "kinds.phone",
  pin: "kinds.pin",
  email: "kinds.email",
  org: "kinds.org",
  custom: "kinds.custom",
};

export function isEntityKind(kind: string): kind is EntityKind {
  return (ENTITY_KINDS as readonly string[]).includes(kind);
}

export function kindLabel(kind: string, t: TFn): string {
  return isEntityKind(kind) ? t(KIND_KEYS[kind]) : kind;
}

/** Options for a kind picker: the built-ins, then `extra` custom kinds — the
 *  saved placeholder types first, then any label that only exists in the data
 *  (a one-off from a review, a pattern rule's kind), so a picker never loses
 *  the value it is showing. Case-insensitive duplicates collapse to the first
 *  spelling seen. */
export function kindOptions(
  t: TFn,
  extra: readonly string[] = [],
): { value: string; label: string }[] {
  const custom: string[] = [];
  const seen = new Set<string>();
  for (const kind of extra) {
    const folded = foldKindLabel(kind);
    if (!folded || isEntityKind(folded) || seen.has(folded)) continue;
    seen.add(folded);
    custom.push(kind);
  }
  return [
    ...ENTITY_KINDS.map((k) => ({ value: k, label: kindLabel(k, t) })),
    ...custom.map((k) => ({ value: k, label: k })),
  ];
}

/** Highlight classes per kind — the mark colour in the review preview. A
 *  custom kind paints like `custom`. */
const KIND_CLASS: Record<EntityKind, string> = {
  name: "bg-amber-400/30 text-fg-bright",
  street: "bg-sky-400/30 text-fg-bright",
  city: "bg-sky-400/20 text-fg-bright",
  postal: "bg-sky-400/20 text-fg-bright",
  phone: "bg-emerald-400/30 text-fg-bright",
  pin: "bg-rose-400/30 text-fg-bright",
  email: "bg-emerald-400/20 text-fg-bright",
  org: "bg-violet-400/30 text-fg-bright",
  custom: "bg-fuchsia-400/30 text-fg-bright",
};

export function kindClass(kind: string): string {
  return isEntityKind(kind) ? KIND_CLASS[kind] : KIND_CLASS.custom;
}

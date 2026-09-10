// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { ENTITY_KINDS } from "./types.ts";

// Custom placeholder types — the user's own kinds of sensitive value, on top
// of the eight the detectors know. A type is nothing but a label ("Judge",
// "Plaintiff", "Car"): the kind of a value is a free string everywhere in the
// model, so a saved type is just a label the pickers offer and the placeholder
// styles spell out — "Judge" masks to `JUDGE1` in the kind-based styles.
//
// A type carries a *scope*: `global` types are offered in every workspace,
// `workspace` types only in the one they were added to (a case load's own
// vocabulary doesn't follow you when you switch). This module is the pure
// half — the labels' rules and the list transforms; `useCustomKinds` owns
// where the two lists are stored.

export const KIND_SCOPES = ["global", "workspace"] as const;
export type KindScope = (typeof KIND_SCOPES)[number];

export type CustomKind = {
  id: string;
  label: string;
  createdAt: string;
};

/** A type paired with the list it came from. */
export type ScopedKind = CustomKind & { scope: KindScope };

/** Long enough for "Ställföreträdare", short enough to stay readable inside a
 *  placeholder. */
export const MAX_KIND_LABEL = 24;

/** What is wrong with a label the user typed, or null when it is usable. */
export type KindLabelProblem = "empty" | "unusable" | "reserved" | "duplicate";

/** Collapse the whitespace, trim, and cap the length. Applied before a label
 *  is stored, compared, or checked. */
export function normalizeKindLabel(raw: string): string {
  return raw.replace(/\s+/gu, " ").trim().slice(0, MAX_KIND_LABEL);
}

/** Labels are compared case- and accent-insensitively: "Judge" and "judge"
 *  are the same type. */
export function foldKindLabel(label: string): string {
  return normalizeKindLabel(label).toLocaleLowerCase();
}

function isReservedLabel(label: string): boolean {
  const folded = foldKindLabel(label);
  return (ENTITY_KINDS as readonly string[]).includes(folded);
}

/** Whether a label can be added to `existing` — every type in play, whatever
 *  its scope, so the same label can't sit in both. */
export function kindLabelProblem(
  raw: string,
  existing: readonly CustomKind[] = [],
): KindLabelProblem | null {
  const label = normalizeKindLabel(raw);
  if (!label) return "empty";
  // A label with no letters or digits would mint `X1` — every such type would
  // share one placeholder sequence, so it is no type at all.
  if (!/[\p{L}\p{N}]/u.test(label)) return "unusable";
  if (isReservedLabel(label)) return "reserved";
  const folded = foldKindLabel(label);
  if (existing.some((k) => foldKindLabel(k.label) === folded))
    return "duplicate";
  return null;
}

export function addCustomKind(
  list: readonly CustomKind[],
  raw: string,
  mintId: () => string,
  now: () => string = () => new Date().toISOString(),
): CustomKind[] {
  const label = normalizeKindLabel(raw);
  if (!label) return [...list];
  const folded = foldKindLabel(label);
  if (list.some((k) => foldKindLabel(k.label) === folded)) return [...list];
  return [...list, { id: mintId(), label, createdAt: now() }];
}

export function removeCustomKind(
  list: readonly CustomKind[],
  id: string,
): CustomKind[] {
  return list.filter((k) => k.id !== id);
}

export function renameCustomKind(
  list: readonly CustomKind[],
  id: string,
  raw: string,
): CustomKind[] {
  const label = normalizeKindLabel(raw);
  if (!label) return [...list];
  const folded = foldKindLabel(label);
  if (list.some((k) => k.id !== id && foldKindLabel(k.label) === folded)) {
    return [...list];
  }
  return list.map((k) => (k.id === id ? { ...k, label } : k));
}

/** The types on offer in one workspace: the global ones, then that
 *  workspace's own. A label that somehow ended up in both lists is shown
 *  once, as the global one. */
export function mergeCustomKinds(
  global: readonly CustomKind[],
  workspace: readonly CustomKind[],
): ScopedKind[] {
  const out: ScopedKind[] = [];
  const seen = new Set<string>();
  for (const [scope, list] of [
    ["global", global],
    ["workspace", workspace],
  ] as const) {
    for (const kind of list) {
      const folded = foldKindLabel(kind.label);
      if (seen.has(folded)) continue;
      seen.add(folded);
      out.push({ ...kind, scope });
    }
  }
  return out;
}

/** Parse a stored list, dropping anything that isn't a usable entry. */
export function parseCustomKinds(raw: string): CustomKind[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const out: CustomKind[] = [];
  const seen = new Set<string>();
  for (const entry of parsed) {
    if (!entry || typeof entry !== "object") continue;
    const { id, label, createdAt } = entry as Partial<CustomKind>;
    if (typeof id !== "string" || typeof label !== "string") continue;
    const clean = normalizeKindLabel(label);
    if (!clean) continue;
    const folded = foldKindLabel(clean);
    if (seen.has(folded)) continue;
    seen.add(folded);
    out.push({
      id,
      label: clean,
      createdAt:
        typeof createdAt === "string" ? createdAt : new Date(0).toISOString(),
    });
  }
  return out;
}

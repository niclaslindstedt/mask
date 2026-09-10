// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Placeholder naming schemes — how a value that has been lifted out of a text
// is named in its place. A scheme is a pure function of (index, kind): the
// letter schemes count in base 26 and ignore the kind; the kind-based schemes
// spell the kind out so the placeholder stays readable. `mintPlaceholder`
// picks the first index a caller hasn't used yet, so a scheme never hands out
// the same placeholder twice inside one document set.

export type PlaceholderStyle =
  | "upperLetters"
  | "lowerLetters"
  | "dollarNumber"
  | "kindNumber"
  | "bracketKind"
  | "mustache";

export const PLACEHOLDER_STYLES: readonly PlaceholderStyle[] = [
  "upperLetters",
  "lowerLetters",
  "dollarNumber",
  "kindNumber",
  "bracketKind",
  "mustache",
];

/** Whether a style spells the kind into the placeholder (so two kinds share
 *  no counter) or numbers every placeholder from one sequence. */
export function styleUsesKind(style: PlaceholderStyle): boolean {
  return (
    style === "kindNumber" || style === "bracketKind" || style === "mustache"
  );
}

// Base-26 letters, `width` wide minimum, zero-padded with `A`: 0 → AAA,
// 1 → AAB, 25 → AAZ, 26 → ABA, 17575 → ZZZ, 17576 → AAAA.
function letters(index: number, width = 3): string {
  let n = Math.max(0, Math.floor(index));
  let out = "";
  do {
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26);
  } while (n > 0);
  return out.padStart(width, "A");
}

/** A kind label reduced to something safe inside a placeholder: letters and
 *  digits only. An empty kind falls back to `X` so the placeholder is never
 *  just a number. Exported so a caller can tell, before it stores a label,
 *  what the placeholders made from it will read as. */
export function kindSlug(kind: string): string {
  const slug = kind.replace(/[^\p{L}\p{N}]+/gu, "");
  return slug.length > 0 ? slug : "X";
}

/** The placeholder for the `index`-th (1-based) value of `kind` in a style. */
export function formatPlaceholder(
  style: PlaceholderStyle,
  index: number,
  kind: string,
): string {
  const n = Math.max(1, Math.floor(index));
  switch (style) {
    case "upperLetters":
      return letters(n - 1);
    case "lowerLetters":
      return letters(n - 1).toLowerCase();
    case "dollarNumber":
      return `$${n}`;
    case "kindNumber":
      return `${kindSlug(kind).toUpperCase()}${n}`;
    case "bracketKind":
      return `[${kindSlug(kind).toUpperCase()} ${n}]`;
    case "mustache":
      return `{{${kindSlug(kind).toLowerCase()}${n}}}`;
  }
}

/** The first placeholder of a style (for `kind`) that isn't in `taken`. Gaps
 *  are refilled, so removing a placeholder frees its slot. */
export function mintPlaceholder(
  style: PlaceholderStyle,
  kind: string,
  taken: Iterable<string>,
): string {
  const used = taken instanceof Set ? taken : new Set(taken);
  for (let i = 1; ; i++) {
    const candidate = formatPlaceholder(style, i, kind);
    if (!used.has(candidate)) return candidate;
  }
}

/** A short "what this style looks like" sample for a settings row. */
export function placeholderExamples(
  style: PlaceholderStyle,
  kind = "name",
  count = 3,
): string {
  const out: string[] = [];
  for (let i = 1; i <= count; i++) out.push(formatPlaceholder(style, i, kind));
  return out.join(", ");
}

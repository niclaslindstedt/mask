// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Scanning a text for typed spans, and rewriting it span by span.
//
// Two ways to find spans — a regex rule (`scanRules`) and a literal lookup
// (`findLiterals`) — both produce the same `TextSpan` shape, so a caller can
// pool them, let `resolveOverlaps` settle which span wins where two cover the
// same characters, and hand the survivors to `applyReplacements`.
// `replaceLiterals` is the whole round trip for the plain "swap these strings
// for those" case, in both directions.
//
// Word boundaries are Unicode-aware (`\p{L}` / `\p{N}`), so "Åsa" and "Örebro"
// bound the way "Anna" does — the ASCII `\b` does not.

export type TextSpan = {
  start: number;
  end: number;
  /** The matched text, verbatim. */
  value: string;
  /** What the span is — a caller-defined label carried through untouched. */
  kind: string;
  /** Which rule or list produced it. */
  source: string;
  /** Tie-breaker when two spans of equal length overlap; higher wins. */
  priority?: number;
};

export type ScanRule = {
  id: string;
  kind: string;
  /** Compiled without the `g` flag is fine — the scanner clones it global. */
  pattern: RegExp;
  /** Veto a raw regex hit (a checksum, a range check) before it becomes a span.
   *  `match` is the full exec result so groups are available. */
  accept?: (value: string, match: RegExpExecArray, text: string) => boolean;
  priority?: number;
};

export type Replacement = { start: number; end: number; replacement: string };

const WORD_CHAR = /[\p{L}\p{N}_]/u;

/** Is the character at `index` part of a word (letter, digit, underscore)?
 *  Out-of-range indices are not. */
export function isWordCharAt(text: string, index: number): boolean {
  if (index < 0 || index >= text.length) return false;
  return WORD_CHAR.test(text[index]!);
}

/** Does the span [start, end) sit on word boundaries on both sides? A span
 *  whose own edge is not a word character (e.g. `$1`, `[NAME 1]`) is bounded
 *  by definition on that side. */
export function onWordBoundary(
  text: string,
  start: number,
  end: number,
): boolean {
  const leftOk = !isWordCharAt(text, start) || !isWordCharAt(text, start - 1);
  const rightOk = !isWordCharAt(text, end - 1) || !isWordCharAt(text, end);
  return leftOk && rightOk;
}

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function globalClone(re: RegExp): RegExp {
  const flags = re.flags.includes("g") ? re.flags : `${re.flags}g`;
  return new RegExp(re.source, flags);
}

/** Every hit of every rule, in text order per rule, unresolved. */
export function scanRules(
  text: string,
  rules: readonly ScanRule[],
): TextSpan[] {
  const out: TextSpan[] = [];
  for (const rule of rules) {
    const re = globalClone(rule.pattern);
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      if (m[0].length === 0) {
        re.lastIndex++;
        continue;
      }
      const value = m[0];
      if (rule.accept && !rule.accept(value, m, text)) continue;
      out.push({
        start: m.index,
        end: m.index + value.length,
        value,
        kind: rule.kind,
        source: rule.id,
        priority: rule.priority,
      });
    }
  }
  return out;
}

export type Literal = {
  value: string;
  kind: string;
  source: string;
  priority?: number;
};

export type LiteralOptions = {
  /** Match case exactly (default true). */
  caseSensitive?: boolean;
  /** Only match on word boundaries (default true) so "Ann" never hits "Anna". */
  wholeWord?: boolean;
  /** Endings a whole-word match may run straight into and still count — a
   *  possessive or plural marker ("s" lets "Anna" match inside "Annas"). The
   *  ending itself stays outside the span, so it survives a replacement. */
  suffixes?: readonly string[];
};

/** Every occurrence of every literal. An empty literal matches nothing. */
export function findLiterals(
  text: string,
  literals: readonly Literal[],
  {
    caseSensitive = true,
    wholeWord = true,
    suffixes = [],
  }: LiteralOptions = {},
): TextSpan[] {
  const out: TextSpan[] = [];
  const haystack = caseSensitive ? text : text.toLowerCase();
  // Bounded on the right either directly or across one allowed suffix.
  const boundedRight = (end: number): boolean => {
    if (!isWordCharAt(text, end - 1) || !isWordCharAt(text, end)) return true;
    return suffixes.some(
      (suf) =>
        suf.length > 0 &&
        haystack.startsWith(caseSensitive ? suf : suf.toLowerCase(), end) &&
        !isWordCharAt(text, end + suf.length),
    );
  };
  for (const lit of literals) {
    const needle = caseSensitive ? lit.value : lit.value.toLowerCase();
    if (needle.length === 0) continue;
    let from = 0;
    for (;;) {
      const at = haystack.indexOf(needle, from);
      if (at < 0) break;
      const end = at + needle.length;
      from = at + 1;
      if (wholeWord) {
        const leftOk = !isWordCharAt(text, at) || !isWordCharAt(text, at - 1);
        if (!leftOk || !boundedRight(end)) continue;
      }
      out.push({
        start: at,
        end,
        value: text.slice(at, end),
        kind: lit.kind,
        source: lit.source,
        priority: lit.priority,
      });
    }
  }
  return out;
}

/** Keep a non-overlapping subset: the longest span wins where two cross, then
 *  the higher priority, then the earlier one. Returned in text order. */
export function resolveOverlaps(spans: readonly TextSpan[]): TextSpan[] {
  const ranked = [...spans].sort(
    (a, b) =>
      b.end - b.start - (a.end - a.start) ||
      (b.priority ?? 0) - (a.priority ?? 0) ||
      a.start - b.start,
  );
  const kept: TextSpan[] = [];
  for (const span of ranked) {
    if (kept.some((k) => span.start < k.end && k.start < span.end)) continue;
    kept.push(span);
  }
  return kept.sort((a, b) => a.start - b.start);
}

/** Rewrite `text` with non-overlapping replacements (any order accepted). */
export function applyReplacements(
  text: string,
  edits: readonly Replacement[],
): string {
  const ordered = [...edits].sort((a, b) => a.start - b.start);
  let out = "";
  let cursor = 0;
  for (const e of ordered) {
    if (e.start < cursor) continue; // overlapping — skip, the earlier one won
    out += text.slice(cursor, e.start) + e.replacement;
    cursor = e.end;
  }
  return out + text.slice(cursor);
}

/** Swap every whole-word occurrence of each `from` for its `to`. Longer
 *  literals win over shorter ones that they contain, so "Anna Svensson"
 *  becomes one placeholder rather than "Anna" plus a stray "Svensson". */
export function replaceLiterals(
  text: string,
  pairs: readonly { from: string; to: string }[],
  options: LiteralOptions = {},
): string {
  const literals: Literal[] = pairs
    .filter((p) => p.from.length > 0)
    .map((p, i) => ({ value: p.from, kind: p.to, source: String(i) }));
  const spans = resolveOverlaps(findLiterals(text, literals, options));
  return applyReplacements(
    text,
    spans.map((s) => ({ start: s.start, end: s.end, replacement: s.kind })),
  );
}

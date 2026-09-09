// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  escapeRegExp,
  scanRules,
  type TextSpan,
} from "../../generic/textScan.ts";
import { dictionaries, type Dictionaries } from "./dictionaries.ts";
import {
  NOT_AFTER_WORD,
  NOT_BEFORE_WORD_GENITIVE,
  type Detector,
} from "./types.ts";

// Localities from the dictionary, as whole capitalised words. Longer names
// first so "Upplands Väsby" beats "Väsby"; a trailing genitive `s` is allowed
// outside the match ("Stockholms stad"). A locality whose name is also an
// everyday word ("Lund", "Bro") only counts after a lower-case word, a digit
// (a postal code), or a comma — mid-sentence, where a common word would not
// be capitalised.

function alternation(names: readonly string[]): string {
  return [...names]
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp)
    .join("|");
}

let built: {
  for: Dictionaries;
  safe: RegExp | null;
  weak: RegExp | null;
} | null = null;

function patterns(d: Dictionaries) {
  if (built && built.for === d) return built;
  built = {
    for: d,
    safe:
      d.localities.length > 0
        ? new RegExp(
            `${NOT_AFTER_WORD}(?:${alternation(d.localities)})${NOT_BEFORE_WORD_GENITIVE}`,
            "u",
          )
        : null,
    weak:
      d.localitiesWordLike.length > 0
        ? new RegExp(
            `(?<=[\\p{Ll}\\p{N},;]\\s{1,2})(?:${alternation(d.localitiesWordLike)})${NOT_BEFORE_WORD_GENITIVE}`,
            "u",
          )
        : null,
  };
  return built;
}

export function scanCities(text: string): TextSpan[] {
  const { safe, weak } = patterns(dictionaries());
  const rules = [];
  if (safe)
    rules.push({ id: "city", kind: "city", pattern: safe, priority: 3 });
  if (weak)
    rules.push({ id: "city", kind: "city", pattern: weak, priority: 3 });
  return scanRules(text, rules);
}

export const cityDetector: Detector = {
  id: "city",
  kind: "city",
  priority: 3,
  scan: scanCities,
};

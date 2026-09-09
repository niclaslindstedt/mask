// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { TextSpan } from "../../generic/textScan.ts";
import type { EntityKind } from "../types.ts";

// A built-in detector: one kind, one scanner. The pure scanning primitives
// come from `generic/textScan`; each detector here is the Swedish-context
// knowledge — which digit runs are personnummer, which words are streets.

export const DETECTOR_IDS = [
  "pin",
  "org",
  "phone",
  "email",
  "postal",
  "street",
  "city",
  "name",
] as const;
export type DetectorId = (typeof DETECTOR_IDS)[number];

export type Detector = {
  id: DetectorId;
  kind: EntityKind;
  /** Higher wins over a lower-priority span of the same length. */
  priority: number;
  scan: (text: string) => TextSpan[];
};

/** Boundary lookarounds shared by the regexes: not glued to a letter/digit. */
export const NOT_AFTER_WORD = "(?<![\\p{L}\\p{N}])";
export const NOT_BEFORE_WORD = "(?![\\p{L}\\p{N}])";
/** Like {@link NOT_BEFORE_WORD} but tolerating a Swedish genitive `s` first
 *  ("Stockholms" still counts as "Stockholm" + s). */
export const NOT_BEFORE_WORD_GENITIVE = "(?=s?(?![\\p{L}\\p{N}]))";

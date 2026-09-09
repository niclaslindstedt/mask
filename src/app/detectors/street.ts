// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { scanRules } from "../../generic/textScan.ts";
import { NOT_AFTER_WORD, NOT_BEFORE_WORD, type Detector } from "./types.ts";

// Swedish street addresses, recognised by the street-word ending
// (Storgatan, Kungsvägen, Norra Långgatan, Karl Johans gata) and an optional
// house number (`12`, `12 B`, `12–14`, `lgh 1102`). Endings that also name
// other things — a park, a bridge, a plan — count only with a number after.

const DIRECTION =
  "(?:Norra|Södra|Östra|Västra|Gamla|Nya|Stora|Lilla|Övre|Nedre|Sankt|Sankta|St\\.|S:t|S:ta)\\s";
const SAFE_ENDINGS =
  "gatan|gata|vägen|väg|gränd|gränden|torget|torg|stigen|stig|allén|allé|stråket|slingan|terrassen|promenaden|esplanaden|liden";
const NUMBERED_ENDINGS =
  "plan|parken|bron|hamnen|ringen|leden|led|dalen|hagen|kullen|holmen|gården|lunden|ängen|backen|stranden|vallen|höjden|udden|kajen|platsen|plats";
const COMPOUND = (endings: string) => `[\\p{Lu}][\\p{L}]{2,}(?:${endings})`;
const SPACED = (endings: string) =>
  `(?:[\\p{Lu}][\\p{L}]+\\s){1,2}(?:${endings})`;
const NUMBER =
  "\\s\\d{1,4}(?:\\s?[A-Za-z](?![\\p{L}]))?(?:\\s?[-–]\\s?\\d{1,4})?(?:,?\\s(?:lgh|lägenhet)\\.?\\s?\\d{3,4})?";

const SAFE = new RegExp(
  `${NOT_AFTER_WORD}(?:${DIRECTION})?(?:${COMPOUND(SAFE_ENDINGS)}|${SPACED("gata|gatan|väg|vägen|gränd|torg|allé|allén|stig|stigen")})(?:${NUMBER})?${NOT_BEFORE_WORD}`,
  "u",
);
const NUMBERED = new RegExp(
  `${NOT_AFTER_WORD}(?:${DIRECTION})?(?:${COMPOUND(NUMBERED_ENDINGS)}|${SPACED("plan|led|leden|plats|platsen")})${NUMBER}${NOT_BEFORE_WORD}`,
  "u",
);

/** Compound words that end like a street but never are one. */
const NOT_STREETS = new Set([
  "Motorvägen",
  "Järnvägen",
  "Halvvägen",
  "Utvägen",
  "Genvägen",
  "Omvägen",
  "Avvägen",
  "Avväg",
  "Genväg",
  "Utväg",
  "Omväg",
  "Halvväg",
  "Motorväg",
  "Järnväg",
  "Sjukvägen",
  "Vandringsled",
  "Vandringsleden",
  "Cykelled",
  "Cykelleden",
  "Ledningen",
  "Anledningen",
  "Avledningen",
  "Inledningen",
  "Utredningen",
  "Överledningen",
  "Underliden",
  "Ledningsgruppen",
]);

const DIRECTION_PREFIX = new RegExp(`^(?:${DIRECTION})+`, "u");

const accept = (value: string): boolean => {
  const word = value.replace(DIRECTION_PREFIX, "").split(/\s/)[0]!;
  return !NOT_STREETS.has(word);
};

export const streetDetector: Detector = {
  id: "street",
  kind: "street",
  priority: 4,
  scan: (text) =>
    scanRules(text, [
      { id: "street", kind: "street", pattern: SAFE, priority: 4, accept },
      { id: "street", kind: "street", pattern: NUMBERED, priority: 4, accept },
    ]),
};

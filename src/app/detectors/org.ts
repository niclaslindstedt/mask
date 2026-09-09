// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { luhnValid } from "../../generic/checkDigit.ts";
import { scanRules } from "../../generic/textScan.ts";
import { NOT_BEFORE_WORD, type Detector } from "./types.ts";

// Swedish organisation numbers: NNNNNN-NNNN with a Luhn check digit, told
// apart from a personnummer by the "month" pair being 20 or more (so no date
// can be read from it). A `16` prefix is the twelve-digit form.

const PATTERN = new RegExp(
  `(?<![\\p{N}-])(?:16)?\\d{6}[-\\s]?\\d{4}${NOT_BEFORE_WORD}`,
  "u",
);

export function isOrgNumber(raw: string): boolean {
  let digits = raw.replace(/\D/g, "");
  if (digits.length === 12) {
    if (!digits.startsWith("16")) return false;
    digits = digits.slice(2);
  }
  if (digits.length !== 10) return false;
  if (Number(digits.slice(2, 4)) < 20) return false;
  return luhnValid(digits);
}

export const orgDetector: Detector = {
  id: "org",
  kind: "org",
  priority: 7,
  scan: (text) =>
    scanRules(text, [
      {
        id: "org",
        kind: "org",
        pattern: PATTERN,
        priority: 7,
        accept: isOrgNumber,
      },
    ]),
};

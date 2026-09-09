// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { luhnValid } from "../../generic/checkDigit.ts";
import { scanRules } from "../../generic/textScan.ts";
import { NOT_BEFORE_WORD, type Detector } from "./types.ts";

// Swedish personal identity numbers (personnummer) and coordination numbers
// (samordningsnummer): YYMMDD-NNNN or YYYYMMDDNNNN, separator `-` or `+`
// (the latter marks a centenarian), the last digit a Luhn check over the
// ten-digit form. A coordination number adds 60 to the day.

const PATTERN = new RegExp(
  `(?<![\\p{N}])(?:\\d{2})?\\d{6}[-+]?\\d{4}${NOT_BEFORE_WORD}`,
  "u",
);

/** Ten digits (no century, no separator) of a plausible personnummer, or
 *  null when the shape is not one. */
export function normalizePin(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 10 && digits.length !== 12) return null;
  const ten = digits.slice(-10);
  const month = Number(ten.slice(2, 4));
  const day = Number(ten.slice(4, 6));
  if (month < 1 || month > 12) return null;
  const realDay = day > 60 ? day - 60 : day;
  if (realDay < 1 || realDay > 31) return null;
  if (digits.length === 12) {
    const century = Number(digits.slice(0, 2));
    if (century < 18 || century > 20) return null;
  }
  return luhnValid(ten) ? ten : null;
}

export const pinDetector: Detector = {
  id: "pin",
  kind: "pin",
  priority: 8,
  scan: (text) =>
    scanRules(text, [
      {
        id: "pin",
        kind: "pin",
        pattern: PATTERN,
        priority: 8,
        accept: (value) => normalizePin(value) !== null,
      },
    ]),
};

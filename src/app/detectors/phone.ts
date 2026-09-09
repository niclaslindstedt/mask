// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { scanRules } from "../../generic/textScan.ts";
import { NOT_BEFORE_WORD, type Detector } from "./types.ts";

// Swedish telephone numbers in the ways people write them: `070-123 45 67`,
// `08-123 456 78`, `+46 70 123 45 67`, `0046701234567`, `(0)70…`. Anchored on
// the trunk `0` or the `+46` / `0046` country code, with single spaces,
// hyphens, or parentheses between the digit groups.

const PATTERN = new RegExp(
  "(?<![\\p{L}\\p{N}+])" +
    "(?:\\+46|0046|0)" + // trunk prefix or country code
    "[\\s-]?\\(?0?\\)?[\\s-]?" + // optional (0) after +46
    "\\d(?:[\\s-]?\\d){5,10}" + // 6–11 more digits, loosely grouped
    NOT_BEFORE_WORD,
  "u",
);

/** The number's digits in national form (leading `0`), or null when it is
 *  not a plausible Swedish number. */
export function normalizePhone(raw: string): string | null {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("0046")) digits = `0${digits.slice(4)}`;
  else if (raw.trim().startsWith("+46")) digits = `0${digits.slice(2)}`;
  // `+46 (0)70…` keeps the trunk zero in parentheses: collapse the double 0.
  if (digits.startsWith("00")) digits = digits.slice(1);
  if (!/^0[1-9]\d{6,9}$/.test(digits)) return null;
  // A date written dd-mm-yyyy / ddmmyyyy is eight digits starting with 0 too;
  // real numbers never end in a 19xx/20xx year group after a separator.
  if (/^\d{2}[-\s]\d{2}[-\s](19|20)\d{2}$/.test(raw.trim())) return null;
  return digits;
}

export const phoneDetector: Detector = {
  id: "phone",
  kind: "phone",
  priority: 5,
  scan: (text) =>
    scanRules(text, [
      {
        id: "phone",
        kind: "phone",
        pattern: PATTERN,
        priority: 5,
        accept: (value) => normalizePhone(value) !== null,
      },
    ]),
};

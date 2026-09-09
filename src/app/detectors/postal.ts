// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { scanRules } from "../../generic/textScan.ts";
import { NOT_BEFORE_WORD, type Detector } from "./types.ts";

// Swedish postal codes: five digits, usually written `123 45`, first digit
// 1–9. Five digits alone are too common to trust, so a bare code counts only
// when a capitalised locality follows it (`123 45 Storstad`), when it is
// prefixed `SE-`, or when it is labelled as a postal code.

const PATTERN = new RegExp(
  "(?<![\\p{L}\\p{N}-])(?:" +
    "SE-\\s?[1-9]\\d{2}\\s?\\d{2}" +
    "|(?<=[Pp]ost(?:nummer|nr)\\.?:?\\s{0,3})[1-9]\\d{2}\\s?\\d{2}" +
    "|[1-9]\\d{2}\\s?\\d{2}(?=\\s{1,2}[\\p{Lu}][\\p{L}]+)" +
    `)${NOT_BEFORE_WORD}`,
  "u",
);

export const postalDetector: Detector = {
  id: "postal",
  kind: "postal",
  priority: 6,
  scan: (text) =>
    scanRules(text, [
      { id: "postal", kind: "postal", pattern: PATTERN, priority: 6 },
    ]),
};

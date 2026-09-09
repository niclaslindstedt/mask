// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { scanRules } from "../../generic/textScan.ts";
import type { Detector } from "./types.ts";

// E-mail addresses — the pragmatic shape, not RFC 5322: a local part of the
// usual characters, `@`, then dotted labels ending in a letters-only TLD.
const PATTERN =
  /(?<![\p{L}\p{N}._%+-])[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)*\.[\p{L}]{2,}(?![\p{L}\p{N}])/u;

export const emailDetector: Detector = {
  id: "email",
  kind: "email",
  priority: 9,
  scan: (text) =>
    scanRules(text, [
      { id: "email", kind: "email", pattern: PATTERN, priority: 9 },
    ]),
};

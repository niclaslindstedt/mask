// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The sample document the empty state offers — a fictional Swedish building-
// permit letter with every kind of value the detectors know. Lives in
// `examples/` (OSS_SPEC §13) and is inlined here so "Load sample" works
// offline.
import text from "../../examples/sample-letter.txt?raw";

export const SAMPLE_NAME = "sample-letter.txt";
export const SAMPLE_TEXT: string = text;

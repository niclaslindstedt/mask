// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  clipAround,
  compileQuery,
  type MatchRange,
} from "@niclaslindstedt/oss-framework/search";

import type { AppData } from "./types.ts";

// The search corpus: every project name, document name and text, and
// placeholder value / token in the active workspace. The framework's matcher
// ranks strings; this file says what to index and how a hit points back.

export type SearchHit = {
  key: string;
  kind: "project" | "document" | "variable";
  projectId: string;
  projectName: string;
  docId?: string;
  /** The line shown, clipped around the match for long texts. */
  text: string;
  ranges: MatchRange[];
};

export type SearchOutcome = { results: SearchHit[]; invalidRegex?: boolean };

const CLIP = 80;

export function runSearch(data: AppData, query: string): SearchOutcome {
  const trimmed = query.trim();
  if (!trimmed) return { results: [] };
  const compiled = compileQuery(trimmed);
  if (compiled.invalidRegex) return { results: [], invalidRegex: true };
  const hits: SearchHit[] = [];
  const consider = (
    text: string,
    make: (text: string, ranges: MatchRange[]) => SearchHit,
  ) => {
    const m = compiled.match(text);
    if (!m) return;
    const clipped = clipAround(text, m.ranges, CLIP);
    hits.push(make(clipped.text, clipped.ranges));
  };
  for (const p of data.projects) {
    consider(p.name, (text, ranges) => ({
      key: `p:${p.id}`,
      kind: "project",
      projectId: p.id,
      projectName: p.name,
      text,
      ranges,
    }));
    for (const d of p.documents) {
      consider(`${d.name}\n${d.text}`, (text, ranges) => ({
        key: `d:${d.id}`,
        kind: "document",
        projectId: p.id,
        projectName: p.name,
        docId: d.id,
        text,
        ranges,
      }));
    }
    for (const v of p.variables) {
      consider(`${v.token} = ${v.value}`, (text, ranges) => ({
        key: `v:${v.id}`,
        kind: "variable",
        projectId: p.id,
        projectName: p.name,
        text,
        ranges,
      }));
    }
  }
  return { results: hits };
}

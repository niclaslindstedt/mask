// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  formatPlaceholder,
  mintPlaceholder,
  type PlaceholderStyle,
} from "../generic/placeholders.ts";
import {
  findLiterals,
  replaceLiterals,
  resolveOverlaps,
  scanRules,
  type ScanRule,
  type TextSpan,
} from "../generic/textScan.ts";
import { DETECTOR_BY_ID, type DetectorId } from "./detectors/index.ts";
import type { GlobalRules, Project, Variable } from "./types.ts";

// The masking pipeline, as pure functions over the app's data:
//
//   detectCandidates  text + rules + the project's variables → what could be
//                     sensitive, grouped per distinct value, for the user to
//                     confirm or reject;
//   buildMaskPlan     the confirmed values → placeholders (reusing the
//                     project's variables, minting new ones) + the masked text;
//   maskText          re-apply a project's variables to any text;
//   unmaskText        the reverse — placeholders back to their values, for the
//                     answer pasted back from the LLM.
//
// The generic scanning and substitution live in `generic/textScan`; this file
// is the Swedish-context policy wired around them. A Swedish genitive `s`
// is allowed to trail a value ("Annas", "Stockholms"), so a masked text keeps
// its grammar and the reverse still finds the placeholder.

/** Endings a value may run into and still be that value. */
export const VALUE_SUFFIXES: readonly string[] = ["s"];

export type Candidate = {
  value: string;
  kind: string;
  /** What found it: `variable`, `always`, `pattern:<id>`, or a detector id. */
  source: string;
  /** Existing project variable for this value, when there is one. */
  variable?: Variable;
  spans: TextSpan[];
};

export type DetectContext = {
  variables: readonly Variable[];
  rules: GlobalRules;
  detectors: Record<DetectorId, boolean>;
  /** Values the project has already rejected. */
  ignored: readonly string[];
};

/** Compile a user pattern rule, or null when its regex is invalid. */
export function compilePattern(source: string, flags = ""): RegExp | null {
  try {
    const wanted = new Set(flags.replace(/[gu]/g, ""));
    return new RegExp(source, [...wanted].join("") + "u");
  } catch {
    return null;
  }
}

function patternRules(rules: GlobalRules): ScanRule[] {
  const out: ScanRule[] = [];
  for (const rule of rules.patterns) {
    if (!rule.enabled) continue;
    const pattern = compilePattern(rule.pattern, rule.flags);
    if (!pattern) continue;
    out.push({
      id: `pattern:${rule.id}`,
      kind: rule.kind,
      pattern,
      priority: 6,
    });
  }
  return out;
}

export function detectCandidates(
  text: string,
  ctx: DetectContext,
): Candidate[] {
  const spans: TextSpan[] = [];
  // Known variables and the always-list win over everything else.
  spans.push(
    ...findLiterals(
      text,
      ctx.variables.map((v) => ({
        value: v.value,
        kind: v.kind,
        source: "variable",
        priority: 20,
      })),
      { suffixes: VALUE_SUFFIXES },
    ),
  );
  spans.push(
    ...findLiterals(
      text,
      ctx.rules.always.map((e) => ({
        value: e.value,
        kind: e.kind,
        source: "always",
        priority: 15,
      })),
      { suffixes: VALUE_SUFFIXES },
    ),
  );
  spans.push(...scanRules(text, patternRules(ctx.rules)));
  for (const [id, detector] of DETECTOR_BY_ID) {
    if (ctx.detectors[id]) spans.push(...detector.scan(text));
  }

  const never = new Set(ctx.rules.never.map((v) => v.toLowerCase()));
  const ignored = new Set(ctx.ignored);
  const byValue = new Map<string, Candidate>();
  for (const span of resolveOverlaps(spans)) {
    const forced = span.source === "variable" || span.source === "always";
    if (
      !forced &&
      (never.has(span.value.toLowerCase()) || ignored.has(span.value))
    ) {
      continue;
    }
    const existing = byValue.get(span.value);
    if (existing) {
      existing.spans.push(span);
      continue;
    }
    byValue.set(span.value, {
      value: span.value,
      kind: span.kind,
      source: span.source,
      variable: ctx.variables.find((v) => v.value === span.value),
      spans: [span],
    });
  }
  return [...byValue.values()].sort(
    (a, b) => a.spans[0]!.start - b.spans[0]!.start,
  );
}

export type MaskDecision = {
  value: string;
  kind: string;
  include: boolean;
};

export type MaskPlan = {
  /** The project's variables after the plan: existing ones plus any minted. */
  variables: Variable[];
  /** Variables minted by this plan. */
  added: Variable[];
  masked: string;
};

export type MintId = () => string;

/** Turn the confirmed decisions into placeholders and the masked text. An
 *  included value that already has a project variable reuses its token; a new
 *  one is minted in the project's style. */
export function buildMaskPlan(
  text: string,
  decisions: readonly MaskDecision[],
  variables: readonly Variable[],
  style: PlaceholderStyle,
  mintId: MintId,
  now: () => string = () => new Date().toISOString(),
): MaskPlan {
  const all = [...variables];
  const added: Variable[] = [];
  const taken = new Set(all.map((v) => v.token));
  for (const d of decisions) {
    if (!d.include || !d.value) continue;
    if (all.some((v) => v.value === d.value)) continue;
    const token = mintPlaceholder(style, d.kind, taken);
    taken.add(token);
    const variable: Variable = {
      id: mintId(),
      token,
      value: d.value,
      kind: d.kind,
      createdAt: now(),
    };
    all.push(variable);
    added.push(variable);
  }
  const included = new Set(
    decisions.filter((d) => d.include).map((d) => d.value),
  );
  // Every variable of the project applies to this text — a value confirmed on
  // an earlier document is masked here too, whether or not it was listed.
  const applied = all.filter(
    (v) => included.has(v.value) || variables.some((x) => x.id === v.id),
  );
  return { variables: all, added, masked: maskText(text, applied) };
}

/** Replace every occurrence of every variable's value with its token. */
export function maskText(text: string, variables: readonly Variable[]): string {
  return replaceLiterals(
    text,
    variables.map((v) => ({ from: v.value, to: v.token })),
    { suffixes: VALUE_SUFFIXES },
  );
}

/** Replace every token with its value — the answer comes back readable. */
export function unmaskText(
  text: string,
  variables: readonly Variable[],
): string {
  return replaceLiterals(
    text,
    variables.map((v) => ({ from: v.token, to: v.value })),
    { suffixes: VALUE_SUFFIXES },
  );
}

/** Which placeholders of a project a text mentions — for the restore view's
 *  "n placeholders found" line. */
export function tokensPresent(
  text: string,
  variables: readonly Variable[],
): Variable[] {
  const hits = findLiterals(
    text,
    variables.map((v) => ({ value: v.token, kind: v.id, source: "token" })),
    { suffixes: VALUE_SUFFIXES },
  );
  const ids = new Set(hits.map((h) => h.kind));
  return variables.filter((v) => ids.has(v.id));
}

/** Whether a token is one this style would have minted for `kind` — i.e. the
 *  app named it, rather than the user typing a placeholder of their own. The
 *  search is bounded by how many placeholders could have been minted before
 *  it. */
function wasMintedFor(
  token: string,
  kind: string,
  style: PlaceholderStyle,
  bound: number,
): boolean {
  for (let i = 1; i <= bound; i++) {
    if (formatPlaceholder(style, i, kind) === token) return true;
  }
  return false;
}

/** A variable's kind changed: in a style that spells the kind into the
 *  placeholder, a placeholder the app minted follows the new kind (a value
 *  re-typed as "Judge" becomes `JUDGE1`), while one the user typed by hand
 *  stays exactly as they wrote it. */
export function retokenForKind(
  variables: readonly Variable[],
  id: string,
  kind: string,
  style: PlaceholderStyle,
): Variable[] {
  const current = variables.find((v) => v.id === id);
  if (!current || current.kind === kind) return [...variables];
  if (!wasMintedFor(current.token, current.kind, style, variables.length + 1)) {
    return variables.map((v) => (v.id === id ? { ...v, kind } : v));
  }
  const taken = new Set(
    variables.filter((v) => v.id !== id).map((v) => v.token),
  );
  const token = mintPlaceholder(style, kind, taken);
  return variables.map((v) => (v.id === id ? { ...v, kind, token } : v));
}

/** The placeholder style a project masks in. */
export function projectStyle(
  project: Pick<Project, "style">,
  fallback: PlaceholderStyle,
): PlaceholderStyle {
  return project.style ?? fallback;
}

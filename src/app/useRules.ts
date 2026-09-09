// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useCallback } from "react";

import { useLocalStorageState } from "@niclaslindstedt/oss-framework/hooks";

import { freshId } from "./useMaskStore.ts";
import { EMPTY_RULES, type GlobalRules, type PatternRule } from "./types.ts";

// The global rule sets — always mask / never mask / custom patterns. They
// live in one localStorage key outside the namespace documents on purpose:
// "this is always sensitive" carries across every namespace and project.

const STORAGE_KEY = "mask:rules";

function parseRules(raw: string): GlobalRules {
  const parsed = JSON.parse(raw) as Partial<GlobalRules> | null;
  if (!parsed || typeof parsed !== "object") return EMPTY_RULES;
  return {
    always: Array.isArray(parsed.always) ? parsed.always : [],
    never: Array.isArray(parsed.never) ? parsed.never : [],
    patterns: Array.isArray(parsed.patterns) ? parsed.patterns : [],
  };
}

export type RulesStore = ReturnType<typeof useRules>;

export function useRules() {
  const [rules, setRules] = useLocalStorageState<GlobalRules>(
    STORAGE_KEY,
    EMPTY_RULES,
    { parse: parseRules },
  );

  const addAlways = useCallback(
    (value: string, kind: string) =>
      setRules((r) =>
        r.always.some((e) => e.value === value)
          ? r
          : {
              ...r,
              always: [...r.always, { value, kind }],
              never: r.never.filter((n) => n !== value),
            },
      ),
    [setRules],
  );
  const removeAlways = useCallback(
    (value: string) =>
      setRules((r) => ({
        ...r,
        always: r.always.filter((e) => e.value !== value),
      })),
    [setRules],
  );
  const addNever = useCallback(
    (value: string) =>
      setRules((r) =>
        r.never.includes(value)
          ? r
          : {
              ...r,
              never: [...r.never, value],
              always: r.always.filter((e) => e.value !== value),
            },
      ),
    [setRules],
  );
  const removeNever = useCallback(
    (value: string) =>
      setRules((r) => ({ ...r, never: r.never.filter((n) => n !== value) })),
    [setRules],
  );
  const addPattern = useCallback(
    (rule: Omit<PatternRule, "id">) =>
      setRules((r) => ({
        ...r,
        patterns: [...r.patterns, { ...rule, id: freshId("rule") }],
      })),
    [setRules],
  );
  const updatePattern = useCallback(
    (id: string, patch: Partial<Omit<PatternRule, "id">>) =>
      setRules((r) => ({
        ...r,
        patterns: r.patterns.map((p) => (p.id === id ? { ...p, ...patch } : p)),
      })),
    [setRules],
  );
  const removePattern = useCallback(
    (id: string) =>
      setRules((r) => ({
        ...r,
        patterns: r.patterns.filter((p) => p.id !== id),
      })),
    [setRules],
  );

  return {
    rules,
    addAlways,
    removeAlways,
    addNever,
    removeNever,
    addPattern,
    updatePattern,
    removePattern,
  };
}

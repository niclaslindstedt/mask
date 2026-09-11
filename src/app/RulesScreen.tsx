// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useMemo, useState } from "react";

import {
  Button,
  CodeIcon,
  Section,
  ToggleRow,
  TrashIcon,
} from "@niclaslindstedt/oss-framework/components";

import {
  SelectOrCreate,
  StringListEditor,
} from "../generic/components/index.ts";
import { scanRules } from "../generic/textScan.ts";
import { kindLabelProblem, normalizeKindLabel } from "./customKinds.ts";
import { BlacklistIcon, WhitelistIcon } from "./icons.tsx";
import { kindLabel, kindOptions } from "./kinds.ts";
import { useT } from "./i18n/index.ts";
import { compilePattern } from "./masking.ts";
import type { CustomKindsStore } from "./useCustomKinds.ts";
import type { RulesStore } from "./useRules.ts";

// The global rules: the always-mask and never-mask lists and the custom
// regex patterns. These carry across every workspace and project.

export function RulesScreen({
  rules,
  kinds,
}: {
  rules: RulesStore;
  kinds: CustomKindsStore;
}) {
  const t = useT();
  const [alwaysKind, setAlwaysKind] = useState("name");
  const [label, setLabel] = useState("");
  const [pattern, setPattern] = useState("");
  const [flags, setFlags] = useState("");
  const [patternKind, setPatternKind] = useState("custom");
  const [sample, setSample] = useState("");
  const kindChoices = kindOptions(t, [
    ...kinds.all.map((k) => k.label),
    ...rules.rules.always.map((e) => e.kind),
    ...rules.rules.patterns.map((p) => p.kind),
  ]);
  const createLabels = {
    create: t("kinds.createOption"),
    createPlaceholder: t("kinds.createPlaceholder"),
    createLabel: t("kinds.createLabel"),
    confirm: t("kinds.createConfirm"),
    cancel: t("common.cancel"),
  };
  const acceptKind = (value: string) => kindLabelProblem(value) === null;
  const compiled = useMemo(
    () => (pattern ? compilePattern(pattern, flags) : null),
    [pattern, flags],
  );
  const invalid = pattern.length > 0 && compiled === null;
  const sampleHits = useMemo(
    () =>
      compiled && sample
        ? scanRules(sample, [
            { id: "try", kind: patternKind, pattern: compiled },
          ]).length
        : 0,
    [compiled, sample, patternKind],
  );
  const field =
    "min-w-0 rounded-md border border-line bg-surface px-3 py-1.5 text-sm text-fg-bright placeholder:text-muted focus:border-accent focus:outline-none";

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4 pt-[calc(1rem+env(safe-area-inset-top))]">
        <header>
          <h1 className="text-base font-bold text-fg-bright">
            {t("rules.heading")}
          </h1>
          <p className="mt-1 text-xs text-muted">{t("rules.intro")}</p>
        </header>

        <Section
          title={t("rules.alwaysTitle")}
          icon={<BlacklistIcon className="h-3.5 w-3.5" />}
        >
          <p className="text-xs text-muted">{t("rules.alwaysHint")}</p>
          <StringListEditor
            items={rules.rules.always.map((e) => e.value)}
            onAdd={(v) => rules.addAlways(v, alwaysKind)}
            onRemove={rules.removeAlways}
            labels={{
              placeholder: t("rules.alwaysPlaceholder"),
              add: t("common.add"),
              remove: (v) => t("rules.alwaysRemove", { value: v }),
              empty: t("rules.alwaysEmpty"),
            }}
            aside={
              <SelectOrCreate
                value={alwaysKind}
                options={kindChoices}
                onChange={setAlwaysKind}
                labels={createLabels}
                accept={acceptKind}
                normalize={normalizeKindLabel}
                ariaLabel={t("review.kindPickerLabel")}
              />
            }
            renderItem={(v) => {
              const kind =
                rules.rules.always.find((e) => e.value === v)?.kind ?? "custom";
              return (
                <>
                  <span className="text-fg-bright">{v}</span>
                  <span className="ml-2 text-xs text-muted">
                    {kindLabel(kind, t)}
                  </span>
                </>
              );
            }}
          />
        </Section>

        <Section
          title={t("rules.neverTitle")}
          icon={<WhitelistIcon className="h-3.5 w-3.5" />}
        >
          <p className="text-xs text-muted">{t("rules.neverHint")}</p>
          <StringListEditor
            items={rules.rules.never}
            onAdd={rules.addNever}
            onRemove={rules.removeNever}
            labels={{
              placeholder: t("rules.neverPlaceholder"),
              add: t("common.add"),
              remove: (v) => t("rules.neverRemove", { value: v }),
              empty: t("rules.neverEmpty"),
            }}
          />
        </Section>

        <Section
          title={t("rules.patternsTitle")}
          icon={<CodeIcon className="h-3.5 w-3.5" />}
        >
          <p className="text-xs text-muted">{t("rules.patternsHint")}</p>
          {rules.rules.patterns.length === 0 ? (
            <p className="text-xs text-muted">{t("rules.patternsEmpty")}</p>
          ) : (
            <ul className="divide-y divide-line overflow-hidden rounded-md border border-line">
              {rules.rules.patterns.map((p) => (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm"
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium text-fg-bright">
                      {p.label}
                    </span>
                    <code className="truncate text-xs text-muted">
                      /{p.pattern}/{p.flags ?? ""} · {kindLabel(p.kind, t)}
                    </code>
                  </span>
                  <ToggleRow
                    label={t("rules.patternEnabled")}
                    checked={p.enabled}
                    onChange={(next) =>
                      rules.updatePattern(p.id, { enabled: next })
                    }
                  />
                  <button
                    type="button"
                    aria-label={t("rules.patternRemove", { label: p.label })}
                    onClick={() => rules.removePattern(p.id)}
                    className="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded text-muted hover:bg-surface-2 hover:text-danger"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="grid gap-2 sm:grid-cols-[1fr_2fr_5rem]">
            <input
              type="text"
              value={label}
              placeholder={t("rules.patternLabelPlaceholder")}
              aria-label={t("rules.patternLabel")}
              onInput={(e) => setLabel(e.currentTarget.value)}
              className={field}
            />
            <input
              type="text"
              value={pattern}
              placeholder={t("rules.patternRegexPlaceholder")}
              aria-label={t("rules.patternRegex")}
              onInput={(e) => setPattern(e.currentTarget.value)}
              className={`${field} font-mono ${invalid ? "border-danger" : ""}`}
            />
            <input
              type="text"
              value={flags}
              placeholder="i"
              aria-label={t("rules.patternFlags")}
              onInput={(e) =>
                setFlags(e.currentTarget.value.replace(/[^dimsy]/g, ""))
              }
              className={`${field} font-mono`}
            />
          </div>
          {invalid && (
            <p className="text-xs text-danger">{t("rules.patternInvalid")}</p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <SelectOrCreate
              value={patternKind}
              options={kindChoices}
              onChange={setPatternKind}
              labels={createLabels}
              accept={acceptKind}
              normalize={normalizeKindLabel}
              ariaLabel={t("rules.patternKind")}
            />
            <Button
              variant="primary"
              disabled={!label.trim() || !compiled}
              onClick={() => {
                rules.addPattern({
                  label: label.trim(),
                  pattern,
                  flags: flags || undefined,
                  kind: patternKind,
                  enabled: true,
                });
                setLabel("");
                setPattern("");
                setFlags("");
              }}
            >
              {t("rules.patternAdd")}
            </Button>
          </div>
          <label className="flex flex-col gap-1 text-xs text-muted">
            {t("rules.patternTest")}
            <textarea
              value={sample}
              placeholder={t("rules.patternTestPlaceholder")}
              onInput={(e) => setSample(e.currentTarget.value)}
              rows={3}
              className={`${field} resize-y`}
            />
            {compiled && sample && (
              <span className="tabular-nums">
                {t("rules.patternMatches", { n: String(sampleHits) })}
              </span>
            )}
          </label>
        </Section>
      </div>
    </div>
  );
}

// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useEffect, useMemo, useRef, useState } from "react";

import { Button, Checkbox } from "@niclaslindstedt/oss-framework/components";
import { defaultToastStore } from "@niclaslindstedt/oss-framework/components";

import {
  CopyablePane,
  SelectOrCreate,
  SpanText,
  type HighlightSpan,
} from "../generic/components/index.ts";
import { kindLabelProblem, normalizeKindLabel } from "./customKinds.ts";
import { kindClass, kindLabel, kindOptions } from "./kinds.ts";
import { useT } from "./i18n/index.ts";
import { buildMaskPlan, detectCandidates, projectStyle } from "./masking.ts";
import type { Doc, Project } from "./types.ts";
import type { AppSettings } from "./useAppSettings.ts";
import { useDictionariesReady } from "./useDictionariesReady.ts";
import type { CustomKindsStore } from "./useCustomKinds.ts";
import { freshId, type MaskStore } from "./useMaskStore.ts";
import type { RulesStore } from "./useRules.ts";
import * as output from "../output.ts";

// The review of one document: the candidates the detectors, the rules, and
// the project's known placeholders found — each with a checkbox, a kind
// picker, and the placeholder it will get — over the original text with
// every candidate marked, and the masked output once confirmed. A value the
// detectors missed can be added by hand or by selecting it in the preview.
//
// Every kind picker here ends in "Custom type…", which takes a label typed on
// the spot: a value masked as "Judge" becomes `JUDGE1` rather than `NAME1`,
// so the LLM reads the role and not just the slot. The label lives on that
// value alone — the reusable ones are added in Settings → Masking.

type Props = {
  project: Project;
  doc: Doc;
  store: MaskStore;
  rules: RulesStore;
  settings: AppSettings;
  kinds: CustomKindsStore;
};

type Row = { value: string; kind: string; include: boolean; manual?: boolean };

export function ReviewPanel({
  project,
  doc,
  store,
  rules,
  settings,
  kinds,
}: Props) {
  const t = useT();
  const ready = useDictionariesReady();
  const style = projectStyle(project, settings.placeholderStyle);

  const candidates = useMemo(
    () =>
      detectCandidates(doc.text, {
        variables: project.variables,
        rules: rules.rules,
        detectors: settings.detectors,
        ignored: project.ignored,
      }),
    // `ready` re-runs detection once the name / locality lists have loaded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      doc.text,
      project.variables,
      project.ignored,
      rules.rules,
      settings.detectors,
      ready,
    ],
  );

  // The user's decisions, keyed by value. Re-detection keeps what the user
  // already decided and adds any newcomer ticked.
  const [rows, setRows] = useState<Row[]>([]);
  useEffect(() => {
    setRows((prev) => {
      const byValue = new Map(prev.map((r) => [r.value, r]));
      const next: Row[] = candidates.map((c) => {
        const old = byValue.get(c.value);
        return old ?? { value: c.value, kind: c.kind, include: true };
      });
      for (const r of prev)
        if (r.manual && !next.some((n) => n.value === r.value)) next.push(r);
      return next;
    });
  }, [candidates]);

  const [manual, setManual] = useState("");
  const [manualKind, setManualKind] = useState("name");
  const [selection, setSelection] = useState("");
  const previewRef = useRef<HTMLDivElement>(null);

  const byValue = useMemo(
    () => new Map(candidates.map((c) => [c.value, c])),
    [candidates],
  );

  // Preview marks: every occurrence of every row's value, tinted by kind and
  // dimmed when unticked.
  const spans: HighlightSpan[] = useMemo(() => {
    const out: HighlightSpan[] = [];
    const seen = new Set<string>();
    for (const row of rows) {
      const cand = byValue.get(row.value);
      const occurrences = cand?.spans ?? findOccurrences(doc.text, row.value);
      for (const s of occurrences) {
        const key = `${s.start}-${s.end}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({
          start: s.start,
          end: s.end,
          className: row.include
            ? kindClass(row.kind)
            : "bg-surface-3 text-muted line-through",
          title: `${kindLabel(row.kind, t)}${cand?.variable ? ` → ${cand.variable.token}` : ""}`,
        });
      }
    }
    return out;
  }, [rows, byValue, doc.text, t]);
  const spanRows = useMemo(() => {
    // Map each span back to its row so a click toggles the right one.
    const map: string[] = [];
    const seen = new Set<string>();
    for (const row of rows) {
      const cand = byValue.get(row.value);
      const occurrences = cand?.spans ?? findOccurrences(doc.text, row.value);
      for (const s of occurrences) {
        const key = `${s.start}-${s.end}`;
        if (seen.has(key)) continue;
        seen.add(key);
        map.push(row.value);
      }
    }
    return map;
  }, [rows, byValue, doc.text]);

  function toggle(value: string) {
    setRows((prev) =>
      prev.map((r) => (r.value === value ? { ...r, include: !r.include } : r)),
    );
  }
  function setKind(value: string, kind: string) {
    setRows((prev) =>
      prev.map((r) => (r.value === value ? { ...r, kind } : r)),
    );
  }
  function addManual(value: string, kind: string) {
    const v = value.trim();
    if (!v || rows.some((r) => r.value === v)) return;
    setRows((prev) => [
      ...prev,
      { value: v, kind, include: true, manual: true },
    ]);
  }

  function confirm() {
    const plan = buildMaskPlan(
      doc.text,
      rows.map((r) => ({ value: r.value, kind: r.kind, include: r.include })),
      project.variables,
      style,
      () => freshId("var"),
    );
    const rejected = rows
      .filter((r) => !r.include && !byValue.get(r.value)?.variable)
      .map((r) => r.value);
    store.confirmMask(project.id, doc.id, {
      variables: plan.variables,
      masked: plan.masked,
      rejected,
    });
    output.status(`Masked ${doc.name}: ${plan.added.length} new placeholders`);
    defaultToastStore.push({
      message: t("review.confirmed"),
      kind: "success",
      durationMs: 2500,
    });
  }

  // The saved placeholder types first, then any label that only exists in
  // this project's data — a one-off typed in an earlier review, a pattern
  // rule's kind — so a picker never drops the value it is showing.
  const kindChoices = kindOptions(t, [
    ...kinds.all.map((k) => k.label),
    ...rows.map((r) => r.kind),
    ...project.variables.map((v) => v.kind),
  ]);
  const createLabels = {
    create: t("kinds.createOption"),
    createPlaceholder: t("kinds.createPlaceholder"),
    createLabel: t("kinds.createLabel"),
    confirm: t("kinds.createConfirm"),
    cancel: t("common.cancel"),
  };
  // A one-off label follows the same rules as a saved type, except that it is
  // never compared against the saved ones: typing a label a saved type already
  // has just picks that type.
  const acceptKind = (value: string) => kindLabelProblem(value) === null;
  const allOn = rows.every((r) => r.include);
  const existingTokens = new Set(project.variables.map((v) => v.token));
  void existingTokens;

  return (
    <div className="flex flex-col gap-4 p-4">
      <section>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-fg-bright">
            {t("review.heading")}
          </h2>
          {rows.length > 0 && (
            <button
              type="button"
              onClick={() =>
                setRows((prev) => prev.map((r) => ({ ...r, include: !allOn })))
              }
              className="cursor-pointer text-xs text-accent underline-offset-2 hover:underline"
            >
              {allOn ? t("review.selectNone") : t("review.selectAll")}
            </button>
          )}
        </div>
        <p className="mb-3 text-xs text-muted">{t("review.hint")}</p>
        {rows.length === 0 ? (
          <p className="text-sm text-muted">{t("review.noCandidates")}</p>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-md border border-line">
            {rows.map((row) => {
              const cand = byValue.get(row.value);
              return (
                <li
                  key={row.value}
                  className="flex flex-wrap items-center gap-x-2 gap-y-1 px-2 py-1.5 text-sm"
                >
                  <Checkbox
                    checked={row.include}
                    onChange={() => toggle(row.value)}
                    ariaLabel={t("review.include", { value: row.value })}
                    className="p-1"
                  />
                  <span
                    className={`min-w-0 flex-1 basis-40 truncate rounded-sm px-1 font-medium ${
                      row.include ? kindClass(row.kind) : "text-muted"
                    }`}
                  >
                    {row.value}
                  </span>
                  {cand && cand.spans.length > 1 && (
                    <span className="text-xs text-muted tabular-nums">
                      {t("review.occurrences", {
                        n: String(cand.spans.length),
                      })}
                    </span>
                  )}
                  {/* Kind + placeholder: beside the value on a wide row, on
                      their own line under it on a phone. */}
                  <span className="flex w-full items-center justify-between gap-2 pl-8 sm:w-auto sm:pl-0">
                    <span className="w-44 shrink-0">
                      {cand?.variable ? (
                        <span className="text-xs text-muted">
                          {kindLabel(cand.variable.kind, t)}
                        </span>
                      ) : (
                        <SelectOrCreate
                          value={row.kind}
                          options={kindChoices}
                          onChange={(k) => setKind(row.value, k)}
                          labels={createLabels}
                          accept={acceptKind}
                          normalize={normalizeKindLabel}
                          ariaLabel={t("review.kindPickerLabel")}
                          triggerClassName="w-full rounded border border-line bg-surface px-2 py-1 text-left text-xs text-fg"
                        />
                      )}
                    </span>
                    <span className="w-24 shrink-0 truncate text-right text-xs text-fg-bright tabular-nums">
                      {cand?.variable ? (
                        cand.variable.token
                      ) : (
                        <span className="text-muted">
                          {t("review.newPlaceholder")}
                        </span>
                      )}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        <div className="mt-3 flex flex-wrap items-stretch gap-2">
          <input
            type="text"
            value={manual}
            placeholder={t("review.addManualPlaceholder")}
            aria-label={t("review.addManualTitle")}
            onInput={(e) => setManual(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addManual(manual, manualKind);
                setManual("");
              }
            }}
            className="min-w-0 flex-1 rounded-md border border-line bg-surface px-3 py-1.5 text-sm text-fg-bright placeholder:text-muted focus:border-accent focus:outline-none"
          />
          <SelectOrCreate
            value={manualKind}
            options={kindChoices}
            onChange={setManualKind}
            labels={createLabels}
            accept={acceptKind}
            normalize={normalizeKindLabel}
            ariaLabel={t("review.kindPickerLabel")}
          />
          <Button
            onClick={() => {
              addManual(manual, manualKind);
              setManual("");
            }}
            disabled={!manual.trim()}
          >
            {t("review.addManualButton")}
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            variant="primary"
            onClick={confirm}
            disabled={rows.length === 0 && !doc.masked}
          >
            {doc.masked ? t("review.reconfirm") : t("review.confirm")}
          </Button>
          {selection && (
            <Button
              onClick={() => {
                addManual(selection, manualKind);
                setSelection("");
              }}
            >
              {t("review.maskSelection", {
                value:
                  selection.length > 24
                    ? `${selection.slice(0, 24)}…`
                    : selection,
              })}
            </Button>
          )}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-line bg-surface">
          <header className="flex shrink-0 items-center justify-between gap-2 border-b border-line bg-surface-2 px-3 py-2">
            <h3 className="text-sm font-semibold text-fg-bright">
              {t("review.preview")}
            </h3>
            <span className="text-xs text-muted">
              {t("review.selectionHint")}
            </span>
          </header>
          <div
            ref={previewRef}
            onMouseUp={() => setSelection(currentSelection(previewRef.current))}
            onTouchEnd={() =>
              setSelection(currentSelection(previewRef.current))
            }
            className="prose-pane max-h-[60vh] min-h-0 overflow-y-auto px-3 py-2 text-sm"
          >
            <SpanText
              text={doc.text}
              spans={spans}
              onSpanClick={(i) => {
                const value = spanRows[i];
                if (value) toggle(value);
              }}
            />
          </div>
        </section>
        <CopyablePane
          title={t("review.output")}
          value={doc.masked ?? ""}
          labels={{
            copy: t("common.copy"),
            copied: t("common.copied"),
            count: (n) => t("common.characters", { n: String(n) }),
            empty: t("review.outputEmpty"),
          }}
          onCopied={() =>
            defaultToastStore.push({
              message: t("toast.copied"),
              kind: "success",
              durationMs: 2000,
            })
          }
        />
      </div>
    </div>
  );
}

function findOccurrences(
  text: string,
  value: string,
): { start: number; end: number }[] {
  const out: { start: number; end: number }[] = [];
  if (!value) return out;
  let from = 0;
  for (;;) {
    const at = text.indexOf(value, from);
    if (at < 0) break;
    out.push({ start: at, end: at + value.length });
    from = at + value.length;
  }
  return out;
}

function currentSelection(container: HTMLElement | null): string {
  const sel = typeof window !== "undefined" ? window.getSelection() : null;
  if (!sel || sel.isCollapsed || !container) return "";
  if (!container.contains(sel.anchorNode) || !container.contains(sel.focusNode))
    return "";
  const text = sel.toString().trim();
  return text.length > 0 && text.length <= 200 && !text.includes("\n")
    ? text
    : "";
}

// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useEffect, useMemo, useRef, useState } from "react";

import {
  Button,
  Checkbox,
  CloseIcon,
  ScrollTextIcon,
} from "@niclaslindstedt/oss-framework/components";
import { defaultToastStore } from "@niclaslindstedt/oss-framework/components";

import { DownloadIcon } from "@niclaslindstedt/oss-framework/components";

import {
  CopyablePane,
  DownloadMenu,
  GlyphButton,
  MarkdownText,
  SelectOrCreate,
  SpanText,
  type DownloadFormat,
  type HighlightSpan,
} from "../generic/components/index.ts";
import { kindLabelProblem, normalizeKindLabel } from "./customKinds.ts";
import { downloadMarkdown, downloadPdf } from "./download.ts";
import {
  BlacklistIcon,
  FileMarkdownIcon,
  FilePdfIcon,
  WhitelistIcon,
} from "./icons.tsx";
import { kindClass, kindLabel, kindOptions } from "./kinds.ts";
import { useT } from "./i18n/index.ts";
import {
  buildMaskPlan,
  detectCandidates,
  projectStyle,
  ruleListing,
  type RuleListing,
} from "./masking.ts";
import { mergeRows, upsertRow, type Row } from "./reviewRows.ts";
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
//
// Beside each picker sit the two global-list buttons, so a decision made once
// here carries to every project: blacklist a value and it is masked wherever
// it turns up, whitelist one and no detector flags it again. A value is on at
// most one list, so listing it leaves only the button that takes it back.
//
// Marking text in the preview offers the same three decisions in one step —
// **Mask** adds it to this document's rows, **Always mask** does that and
// blacklists it, **Never mask** whitelists it — so settling a value the
// detectors missed, or one they keep getting wrong, is one press rather than
// an add followed by a hunt for its row.

type Props = {
  project: Project;
  doc: Doc;
  store: MaskStore;
  rules: RulesStore;
  settings: AppSettings;
  kinds: CustomKindsStore;
  /** Open the document's source text for reading, unmarked. */
  onReadSource?: () => void;
};

export function ReviewPanel({
  project,
  doc,
  store,
  rules,
  settings,
  kinds,
  onReadSource,
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

  const listingOf = (value: string) => ruleListing(rules.rules, value);

  // The user's decisions, keyed by value. Re-detection keeps what the user
  // already decided and adds any newcomer ticked.
  const [rows, setRows] = useState<Row[]>([]);
  useEffect(() => {
    setRows((prev) =>
      mergeRows(
        prev,
        candidates,
        (value) => ruleListing(rules.rules, value) === "whitelist",
      ),
    );
  }, [candidates, rules.rules]);

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
    // A blacklisted value carries its kind in the rule, so retyping it here
    // retypes the rule rather than leaving the two disagreeing.
    if (listingOf(value) === "blacklist") rules.setAlwaysKind(value, kind);
  }
  /** Blacklist: mask this value in every project, ticked from now on. */
  function toggleBlacklist(value: string, kind: string) {
    if (listingOf(value) === "blacklist") {
      rules.removeAlways(value);
      return;
    }
    rules.addAlways(value, kind);
    setRows((prev) =>
      prev.map((r) => (r.value === value ? { ...r, include: true } : r)),
    );
  }
  /** Whitelist: never flag this value again, and untick it here. */
  function toggleWhitelist(value: string) {
    if (listingOf(value) === "whitelist") {
      rules.removeNever(value);
      return;
    }
    rules.addNever(value);
    setRows((prev) =>
      prev.map((r) => (r.value === value ? { ...r, include: false } : r)),
    );
  }
  function addManual(value: string, kind: string) {
    const v = value.trim();
    if (!v || rows.some((r) => r.value === v)) return;
    setRows((prev) => upsertRow(prev, v, kind, true).rows);
  }
  /** The three decisions a marked piece of text can be settled with in one
   *  press. Each puts the value among the rows; two of them also settle it
   *  globally, which is what the row's own list buttons would have done. */
  function actOnSelection(action: "mask" | "always" | "never") {
    const value = selection.trim();
    if (!value) return;
    const { rows: next, kind } = upsertRow(
      rows,
      value,
      manualKind,
      action !== "never",
    );
    setRows(next);
    if (action === "always") rules.addAlways(value, kind);
    if (action === "never") rules.addNever(value);
    setSelection("");
    dropSelection();
  }

  function confirm() {
    const plan = buildMaskPlan(
      doc.text,
      rows.map((r) => ({ value: r.value, kind: r.kind, include: r.include })),
      project.variables,
      style,
      () => freshId("var"),
    );
    // Unticked values the project should stop suggesting. A whitelisted one
    // is already settled globally, so it is not also rejected here — taking it
    // off the whitelist should bring it straight back.
    const rejected = rows
      .filter(
        (r) =>
          !r.include &&
          !byValue.get(r.value)?.variable &&
          listingOf(r.value) !== "whitelist",
      )
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
  // The masked text leaves the app as the Markdown the pane shows, or as that
  // Markdown typeset. The PDF writer is fetched on the press, so a failure
  // there is a chunk that didn't load — it has to say so rather than leave a
  // button that did nothing.
  const downloads: DownloadFormat[] = [
    {
      id: "pdf",
      label: t("review.downloadPdf"),
      icon: <FilePdfIcon className="h-4 w-4" />,
      onSelect: () => {
        void downloadPdf(doc.name, doc.masked ?? "", {
          pageNumberOf: t("review.pageNumberOf"),
        }).catch((err: unknown) => {
          output.error(
            `PDF download failed: ${err instanceof Error ? err.message : String(err)}`,
          );
          defaultToastStore.push({
            message: t("review.downloadFailed"),
            kind: "danger",
            durationMs: 6000,
          });
        });
      },
    },
    {
      id: "markdown",
      label: t("review.downloadMarkdown"),
      icon: <FileMarkdownIcon className="h-4 w-4" />,
      onSelect: () => downloadMarkdown(doc.name, doc.masked ?? ""),
    },
  ];

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
          <ul className="@container divide-y divide-line overflow-hidden rounded-md border border-line">
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
                  {/* Kind + lists + placeholder: beside the value on a wide
                      row, on their own line under it on a phone. */}
                  <span className="flex w-full max-w-full flex-wrap items-center gap-2 pl-8 sm:w-auto sm:pl-0">
                    <span className="min-w-28 flex-1 sm:w-44 sm:flex-initial">
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
                          triggerClassName="rounded border border-line bg-surface px-2 py-1 text-left text-xs text-fg"
                        />
                      )}
                    </span>
                    <ListButtons
                      value={row.value}
                      listing={listingOf(row.value)}
                      /* A value the project already has a placeholder for is
                         masked whatever the whitelist says, so only the
                         blacklist is offered on its row. */
                      whitelistable={!cand?.variable}
                      onBlacklist={() => toggleBlacklist(row.value, row.kind)}
                      onWhitelist={() => toggleWhitelist(row.value)}
                    />
                    <span className="w-16 shrink-0 truncate text-right text-xs text-fg-bright tabular-nums sm:w-24">
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
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-line bg-surface">
          <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-line bg-surface-2 px-3 py-2">
            <h3 className="text-sm font-semibold text-fg-bright">
              {t("review.preview")}
            </h3>
            <div className="flex min-w-0 items-center gap-2">
              <span className="min-w-0 truncate text-xs text-muted">
                {t("review.selectionHint")}
              </span>
              {onReadSource && (
                <button
                  type="button"
                  onClick={onReadSource}
                  title={t("reader.openTitle", { name: doc.name })}
                  className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded px-1.5 py-1 text-xs text-accent hover:bg-surface-3"
                >
                  <ScrollTextIcon className="h-4 w-4" />
                  {t("reader.open")}
                </button>
              )}
            </div>
          </header>
          {selection && (
            <SelectionActions
              value={selection}
              /* A value the project already has a placeholder for is masked
                 whatever the whitelist says, so it isn't offered here either. */
              whitelistable={!byValue.get(selection.trim())?.variable}
              onMask={() => actOnSelection("mask")}
              onAlways={() => actOnSelection("always")}
              onNever={() => actOnSelection("never")}
              onDismiss={() => {
                setSelection("");
                dropSelection();
              }}
            />
          )}
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
          className="@container"
          /* A document extracted from a PDF carries its headings and its bold
             as Markdown, so the pane shows it the way it was written rather
             than showing the syntax. The copy button and the download still
             take the source — what leaves the app is the text, marks and
             all. */
          body={
            doc.markdown && doc.masked ? (
              <MarkdownText text={doc.masked} className="prose-pane" />
            ) : undefined
          }
          actions={
            doc.masked ? (
              <DownloadMenu
                icon={<DownloadIcon className="h-4 w-4" />}
                formats={downloads}
                labels={{
                  download: t("review.download"),
                  menu: t("review.downloadMenu"),
                }}
              />
            ) : undefined
          }
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

/** What a marked piece of the preview can become, offered where it was
 *  marked: masked here, masked everywhere, or never masked again. The value is
 *  shown back so it is clear how far the selection actually reached. */
function SelectionActions({
  value,
  whitelistable,
  onMask,
  onAlways,
  onNever,
  onDismiss,
}: {
  value: string;
  whitelistable: boolean;
  onMask: () => void;
  onAlways: () => void;
  onNever: () => void;
  onDismiss: () => void;
}) {
  const t = useT();
  const shown = value.length > 40 ? `${value.slice(0, 40)}…` : value;
  return (
    <div className="flex shrink-0 flex-col gap-2 border-b border-line bg-surface-3 px-3 py-2">
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-xs text-fg-bright">
          {t("review.selectionValue", { value: shown })}
        </span>
        <button
          type="button"
          onClick={onDismiss}
          aria-label={t("common.cancel")}
          title={t("common.cancel")}
          className="inline-flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded text-muted hover:bg-surface-2 hover:text-fg"
        >
          <CloseIcon className="h-4 w-4" />
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" onClick={onMask}>
          {t("review.selectionMask")}
        </Button>
        <Button
          onClick={onAlways}
          title={t("review.selectionAlwaysTitle", { value: shown })}
        >
          <span className="flex items-center gap-1.5">
            <BlacklistIcon className="h-4 w-4" />
            {t("review.selectionAlways")}
          </span>
        </Button>
        {whitelistable && (
          <Button
            onClick={onNever}
            title={t("review.selectionNeverTitle", { value: shown })}
          >
            <span className="flex items-center gap-1.5">
              <WhitelistIcon className="h-4 w-4" />
              {t("review.selectionNever")}
            </span>
          </Button>
        )}
      </div>
    </div>
  );
}

/** The two global-list buttons for one reviewed value. A value is on at most
 *  one list, so the listed one stands alone — pressed, and the way back off.
 *  Glyphs on a phone, glyphs with their labels once there is room. */
function ListButtons({
  value,
  listing,
  whitelistable,
  onBlacklist,
  onWhitelist,
}: {
  value: string;
  listing: RuleListing;
  whitelistable: boolean;
  onBlacklist: () => void;
  onWhitelist: () => void;
}) {
  const t = useT();
  return (
    <span className="flex shrink-0 items-center gap-1">
      {listing !== "whitelist" && (
        <GlyphButton
          icon={<BlacklistIcon className="h-4 w-4" />}
          label={t("review.blacklist")}
          title={t(
            listing === "blacklist"
              ? "review.blacklistRemove"
              : "review.blacklistAdd",
            { value },
          )}
          pressed={listing === "blacklist"}
          onClick={onBlacklist}
        />
      )}
      {listing !== "blacklist" && whitelistable && (
        <GlyphButton
          icon={<WhitelistIcon className="h-4 w-4" />}
          label={t("review.whitelist")}
          title={t(
            listing === "whitelist"
              ? "review.whitelistRemove"
              : "review.whitelistAdd",
            { value },
          )}
          pressed={listing === "whitelist"}
          onClick={onWhitelist}
        />
      )}
    </span>
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

/** Let the marked text go once it has been decided about, so the decision
 *  bar doesn't linger over a selection that has already been settled. */
function dropSelection() {
  if (typeof window === "undefined") return;
  window.getSelection()?.removeAllRanges();
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

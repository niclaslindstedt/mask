// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useState } from "react";

import {
  Section,
  SegmentedControl,
  SelectPicker,
  TrashIcon,
} from "@niclaslindstedt/oss-framework/components";

import {
  placeholderExamples,
  type PlaceholderStyle,
} from "../../generic/placeholders.ts";
import {
  KIND_SCOPES,
  kindLabelProblem,
  normalizeKindLabel,
  type KindScope,
} from "../customKinds.ts";
import { useT } from "../i18n/index.ts";
import type { CustomKindsStore } from "../useCustomKinds.ts";

// The Masking tab's "Placeholder types" section: the user's own kinds of
// sensitive value ("Judge", "Plaintiff", "Car"), each on offer in every
// picker and spelled into the placeholders a kind-based style mints.
//
// Unlike the rest of the tab this section applies *live* rather than staging a
// draft — a type is a small piece of data with its own storage, not a setting,
// and the same list is edited from the review. Where a *new* type lands is a
// setting, and does stage with the others.

type Props = {
  kinds: CustomKindsStore;
  /** The scope a new type is added in — the staged setting. */
  scope: KindScope;
  onScopeChange: (next: KindScope) => void;
  /** The default placeholder style, for the "JUDGE1, JUDGE2" example. */
  style: PlaceholderStyle;
  workspaceName: string;
};

export function PlaceholderTypesSection({
  kinds,
  scope,
  onScopeChange,
  style,
  workspaceName,
}: Props) {
  const t = useT();
  const [draft, setDraft] = useState("");
  const problem = draft.trim() ? kindLabelProblem(draft, kinds.all) : null;
  const canAdd = draft.trim().length > 0 && problem === null;

  const scopeOptions = KIND_SCOPES.map((value) => ({
    value,
    label:
      value === "global"
        ? t("settings.masking.scopeGlobal")
        : t("settings.masking.scopeWorkspace"),
  }));

  function add() {
    if (!canAdd) return;
    kinds.add(draft, scope);
    setDraft("");
  }

  return (
    <Section title={t("settings.masking.typesTitle")}>
      <p className="text-xs text-muted">{t("settings.masking.typesHint")}</p>

      {kinds.all.length === 0 ? (
        <p className="text-xs text-muted">{t("settings.masking.typesEmpty")}</p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-md border border-line">
          {kinds.all.map((kind) => (
            <li
              key={kind.id}
              className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm"
            >
              <span className="flex min-w-0 flex-1 basis-32 flex-col">
                <span className="truncate font-medium text-fg-bright">
                  {kind.label}
                </span>
                <span className="truncate text-xs text-muted tabular-nums">
                  {placeholderExamples(style, kind.label, 2)}
                </span>
              </span>
              <span className="w-36 shrink-0">
                <SelectPicker<KindScope>
                  value={kind.scope}
                  options={scopeOptions}
                  onChange={(next) => kinds.setScope(kind.id, kind.scope, next)}
                  ariaLabel={t("settings.masking.typeScope", {
                    label: kind.label,
                  })}
                  triggerClassName="w-full rounded border border-line bg-surface px-2 py-1 text-left text-xs text-fg"
                />
              </span>
              <button
                type="button"
                aria-label={t("settings.masking.typeRemove", {
                  label: kind.label,
                })}
                onClick={() => kinds.remove(kind.id, kind.scope)}
                className="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded text-muted hover:bg-surface-2 hover:text-danger"
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-stretch gap-2">
        <input
          type="text"
          value={draft}
          placeholder={t("settings.masking.typePlaceholder")}
          aria-label={t("settings.masking.typeLabel")}
          autoCapitalize="characters"
          autoCorrect="off"
          spellcheck={false}
          onInput={(e) => setDraft(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          className={`min-w-32 flex-1 rounded-md border bg-surface px-3 py-1.5 text-sm text-fg-bright placeholder:text-muted focus:outline-none ${
            problem ? "border-danger" : "border-line focus:border-accent"
          }`}
        />
        <button
          type="button"
          onClick={add}
          disabled={!canAdd}
          className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-line px-3 py-1.5 text-sm text-fg hover:bg-surface-2 hover:text-fg-bright disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t("settings.masking.typeAdd")}
        </button>
      </div>
      {problem ? (
        <p className="text-xs text-danger">
          {t(`settings.masking.typeProblem.${problem}`)}
        </p>
      ) : (
        draft.trim().length > 0 && (
          <p className="text-xs text-muted tabular-nums">
            {t("settings.masking.typePreview", {
              examples: placeholderExamples(
                style,
                normalizeKindLabel(draft),
                3,
              ),
            })}
          </p>
        )
      )}

      <div className="flex flex-col gap-1">
        <span className="text-sm text-fg-bright">
          {t("settings.masking.scopeLabel")}
        </span>
        <SegmentedControl<KindScope>
          value={scope}
          options={scopeOptions}
          onChange={onScopeChange}
          ariaLabel={t("settings.masking.scopeLabel")}
        />
        <p className="text-xs text-muted">
          {t("settings.masking.scopeHint", { name: workspaceName })}
        </p>
      </div>
    </Section>
  );
}

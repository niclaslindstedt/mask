// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useState } from "react";

import {
  Button,
  CopyButton,
  TrashIcon,
} from "@niclaslindstedt/oss-framework/components";

import { SafeSelect, SelectOrCreate } from "../generic/components/index.ts";
import {
  mintPlaceholder,
  type PlaceholderStyle,
} from "../generic/placeholders.ts";
import { kindLabelProblem, normalizeKindLabel } from "./customKinds.ts";
import { kindClass, kindLabel, kindOptions } from "./kinds.ts";
import { useT } from "./i18n/index.ts";
import { projectStyle } from "./masking.ts";
import { styleOptions } from "./settings/tabs.tsx";
import type { Project } from "./types.ts";
import type { AppSettings } from "./useAppSettings.ts";
import type { CustomKindsStore } from "./useCustomKinds.ts";
import type { MaskStore } from "./useMaskStore.ts";

// The Placeholders tab: the project's variables (placeholder ↔ value ↔ kind),
// the placeholder style for this project, a form to add one by hand, and the
// values rejected during review.
//
// Re-typing a placeholder renames it when the app was the one that named it —
// see `retokenForKind`; a placeholder typed by hand keeps the name it was
// given.

type Props = {
  project: Project;
  store: MaskStore;
  settings: AppSettings;
  kinds: CustomKindsStore;
};

export function VariablesTab({ project, store, settings, kinds }: Props) {
  const t = useT();
  const style = projectStyle(project, settings.placeholderStyle);
  const [value, setValue] = useState("");
  const [token, setToken] = useState("");
  const [kind, setKind] = useState("name");
  const kindChoices = kindOptions(t, [
    ...kinds.all.map((k) => k.label),
    ...project.variables.map((v) => v.kind),
  ]);
  const createLabels = {
    create: t("kinds.createOption"),
    createPlaceholder: t("kinds.createPlaceholder"),
    createLabel: t("kinds.createLabel"),
    confirm: t("kinds.createConfirm"),
    cancel: t("common.cancel"),
  };
  const acceptKind = (v: string) => kindLabelProblem(v) === null;

  function add() {
    const v = value.trim();
    if (!v) return;
    const taken = new Set(project.variables.map((x) => x.token));
    const tok = token.trim() || mintPlaceholder(style, kind, taken);
    store.addVariable(project.id, { value: v, token: tok, kind });
    setValue("");
    setToken("");
  }

  const table = project.variables
    .map((v) => `${v.token}\t${v.value}\t${kindLabel(v.kind, t)}`)
    .join("\n");
  const styleChoices = [
    {
      value: "default" as const,
      label: t("project.styleDefault", {
        style: t(`styles.${settings.placeholderStyle}`),
      }),
    },
    ...styleOptions(t),
  ];

  return (
    <div className="flex flex-col gap-4 p-4">
      <section>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-fg-bright">
            {t("variables.heading")}
          </h2>
          {project.variables.length > 0 && (
            <CopyButton
              value={table}
              labels={{
                copy: t("variables.copyTable"),
                copied: t("common.copied"),
              }}
            />
          )}
        </div>
        <p className="mb-3 text-xs text-muted">{t("variables.hint")}</p>
        {project.variables.length === 0 ? (
          <p className="text-sm text-muted">{t("variables.empty")}</p>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-md border border-line">
            {project.variables.map((v) => (
              <li
                key={v.id}
                className="flex flex-wrap items-center gap-2 px-2 py-1.5 text-sm"
              >
                <span className="w-28 shrink-0 font-semibold text-fg-bright tabular-nums">
                  {v.token}
                </span>
                <span
                  className={`min-w-0 flex-1 truncate rounded-sm px-1 ${kindClass(v.kind)}`}
                >
                  {v.value}
                </span>
                <span className="w-40 shrink-0">
                  <SelectOrCreate
                    value={v.kind}
                    options={kindChoices}
                    onChange={(k) =>
                      store.setVariableKind(project.id, v.id, k, style)
                    }
                    labels={createLabels}
                    accept={acceptKind}
                    normalize={normalizeKindLabel}
                    ariaLabel={t("variables.kind")}
                    triggerClassName="w-full rounded border border-line bg-surface px-2 py-1 text-left text-xs text-fg"
                  />
                </span>
                <button
                  type="button"
                  aria-label={t("variables.remove", { value: v.value })}
                  onClick={() => store.removeVariable(project.id, v.id)}
                  className="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded text-muted hover:bg-surface-2 hover:text-danger"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-md border border-line bg-surface-3 p-3">
        <h3 className="mb-2 text-xs font-bold tracking-wide text-muted uppercase">
          {t("project.styleLabel")}
        </h3>
        <SafeSelect<PlaceholderStyle | "default">
          value={project.style ?? "default"}
          options={styleChoices}
          onChange={(next) =>
            store.setProjectStyle(
              project.id,
              next === "default" ? undefined : next,
            )
          }
          ariaLabel={t("project.styleLabel")}
        />
      </section>

      <section className="rounded-md border border-line bg-surface-3 p-3">
        <h3 className="mb-2 text-xs font-bold tracking-wide text-muted uppercase">
          {t("variables.addTitle")}
        </h3>
        <div className="flex flex-wrap items-stretch gap-2">
          <input
            type="text"
            value={value}
            placeholder={t("variables.addValuePlaceholder")}
            aria-label={t("variables.addValue")}
            onInput={(e) => setValue(e.currentTarget.value)}
            className="min-w-40 flex-1 rounded-md border border-line bg-surface px-3 py-1.5 text-sm text-fg-bright placeholder:text-muted focus:border-accent focus:outline-none"
          />
          <input
            type="text"
            value={token}
            placeholder={t("variables.addTokenPlaceholder")}
            aria-label={t("variables.addToken")}
            onInput={(e) => setToken(e.currentTarget.value)}
            className="w-40 rounded-md border border-line bg-surface px-3 py-1.5 text-sm text-fg-bright placeholder:text-muted focus:border-accent focus:outline-none"
          />
          <SelectOrCreate
            value={kind}
            options={kindChoices}
            onChange={setKind}
            labels={createLabels}
            accept={acceptKind}
            normalize={normalizeKindLabel}
            ariaLabel={t("variables.kind")}
          />
          <Button onClick={add} disabled={!value.trim()}>
            {t("variables.addButton")}
          </Button>
        </div>
      </section>

      <section>
        <h3 className="mb-1 text-sm font-bold text-fg-bright">
          {t("variables.ignoredTitle")}
        </h3>
        <p className="mb-2 text-xs text-muted">{t("variables.ignoredHint")}</p>
        {project.ignored.length === 0 ? (
          <p className="text-xs text-muted">{t("variables.ignoredEmpty")}</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {project.ignored.map((v) => (
              <li
                key={v}
                className="flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs"
              >
                <span className="text-fg">{v}</span>
                <button
                  type="button"
                  onClick={() => store.unignore(project.id, v)}
                  className="cursor-pointer text-accent underline-offset-2 hover:underline"
                >
                  {t("variables.unignore")}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

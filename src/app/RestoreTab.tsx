// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useMemo, useState } from "react";

import { defaultToastStore } from "@niclaslindstedt/oss-framework/components";

import { CopyablePane } from "../generic/components/index.ts";
import { useT } from "./i18n/index.ts";
import { tokensPresent, unmaskText } from "./masking.ts";
import type { Project } from "./types.ts";

// The Restore tab: paste the LLM's answer, get it back with every placeholder
// of this project swapped for the real value. Nothing is stored.

export function RestoreTab({ project }: { project: Project }) {
  const t = useT();
  const [input, setInput] = useState("");
  const restored = useMemo(
    () => unmaskText(input, project.variables),
    [input, project.variables],
  );
  const found = useMemo(
    () => tokensPresent(input, project.variables),
    [input, project.variables],
  );

  return (
    <div className="flex flex-col gap-4 p-4">
      <section>
        <h2 className="mb-1 text-sm font-bold text-fg-bright">
          {t("restore.heading")}
        </h2>
        <p className="text-xs text-muted">{t("restore.hint")}</p>
      </section>
      <div className="grid gap-4 lg:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs text-muted">
          {t("restore.inputLabel")}
          <textarea
            value={input}
            placeholder={t("restore.inputPlaceholder")}
            onInput={(e) => setInput(e.currentTarget.value)}
            rows={14}
            className="prose-pane min-h-56 resize-y rounded-lg border border-line bg-surface px-3 py-2 text-sm text-fg-bright placeholder:text-muted focus:border-accent focus:outline-none"
          />
          <span className="tabular-nums">
            {input
              ? found.length > 0
                ? t("restore.found", { n: String(found.length) })
                : t("restore.foundNone")
              : ""}
          </span>
        </label>
        <CopyablePane
          title={t("restore.output")}
          value={input ? restored : ""}
          labels={{
            copy: t("common.copy"),
            copied: t("common.copied"),
            count: (n) => t("common.characters", { n: String(n) }),
            empty: t("restore.outputEmpty"),
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

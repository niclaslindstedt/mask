// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useState } from "react";

import { SegmentedControl } from "@niclaslindstedt/oss-framework/components";

import { DocumentsTab } from "./DocumentsTab.tsx";
import { RestoreTab } from "./RestoreTab.tsx";
import { VariablesTab } from "./VariablesTab.tsx";
import { useT } from "./i18n/index.ts";
import type { Project } from "./types.ts";
import type { AppSettings } from "./useAppSettings.ts";
import type { MaskStore } from "./useMaskStore.ts";
import type { RulesStore } from "./useRules.ts";

// A project's main screen: a header with the project name and the three
// tabs — Documents (upload, review, mask), Placeholders (what the project
// has learned), and Restore (the LLM's answer back to real values).

type Tab = "documents" | "variables" | "restore";

type Props = {
  project: Project;
  store: MaskStore;
  rules: RulesStore;
  settings: AppSettings;
};

export function ProjectScreen({ project, store, rules, settings }: Props) {
  const t = useT();
  const [tab, setTab] = useState<Tab>("documents");

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* `data-floating-edge` marks pinned top chrome: dropdowns that flip
          above their trigger stop below it instead of covering it. */}
      <header
        data-floating-edge="top"
        className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-line bg-surface px-4 py-3 pt-[calc(0.75rem+env(safe-area-inset-top))]"
      >
        <h1 className="min-w-0 flex-1 truncate text-base font-bold text-fg-bright">
          {project.name}
        </h1>
        <SegmentedControl<Tab>
          value={tab}
          onChange={setTab}
          ariaLabel={project.name}
          options={[
            { value: "documents", label: t("project.tabDocuments") },
            {
              value: "variables",
              label: `${t("project.tabVariables")}${
                project.variables.length > 0
                  ? ` (${project.variables.length})`
                  : ""
              }`,
            },
            { value: "restore", label: t("project.tabRestore") },
          ]}
        />
      </header>
      <div className="min-h-0 flex-1">
        {tab === "documents" && (
          <DocumentsTab
            project={project}
            store={store}
            rules={rules}
            settings={settings}
          />
        )}
        {tab === "variables" && (
          <VariablesTab project={project} store={store} settings={settings} />
        )}
        {tab === "restore" && <RestoreTab project={project} />}
      </div>
    </div>
  );
}

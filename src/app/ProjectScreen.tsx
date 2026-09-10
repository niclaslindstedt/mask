// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useState, type ReactNode } from "react";

import {
  Badge,
  FileIcon,
  SegmentedControl,
  type IconProps,
} from "@niclaslindstedt/oss-framework/components";

import { DocumentsTab } from "./DocumentsTab.tsx";
import { RestoreTab } from "./RestoreTab.tsx";
import { VariablesTab } from "./VariablesTab.tsx";
import { SwapIcon, TagIcon } from "./icons.tsx";
import { useT } from "./i18n/index.ts";
import type { Project } from "./types.ts";
import type { AppSettings } from "./useAppSettings.ts";
import type { MaskStore } from "./useMaskStore.ts";
import type { RulesStore } from "./useRules.ts";

// A project's main screen: a header with the project name and the three
// tabs — Documents (upload, review, mask), Placeholders (what the project
// has learned), and Restore (the LLM's answer back to real values).
//
// Each tab leads with a glyph so the header still reads at phone width, where
// three word labels crowded the project name down to an ellipsis. The words
// come back from `sm` up; below it they stay for screen readers only.

type Tab = "documents" | "variables" | "restore";

type TKey = Parameters<ReturnType<typeof useT>>[0];
type TabDef = {
  value: Tab;
  labelKey: TKey;
  icon: (p: IconProps) => ReactNode;
};

const TABS: TabDef[] = [
  { value: "documents", labelKey: "project.tabDocuments", icon: FileIcon },
  { value: "variables", labelKey: "project.tabVariables", icon: TagIcon },
  { value: "restore", labelKey: "project.tabRestore", icon: SwapIcon },
];

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
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-line bg-surface px-4 py-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <h1 className="min-w-0 flex-1 truncate text-base font-bold text-fg-bright">
          {project.name}
        </h1>
        <SegmentedControl<Tab>
          value={tab}
          onChange={setTab}
          ariaLabel={project.name}
          options={TABS.map(({ value, labelKey, icon: Icon }) => ({
            value,
            label: (
              <>
                <Icon className="h-4 w-4 shrink-0" />
                <span className="sr-only sm:not-sr-only">{t(labelKey)}</span>
                {value === "variables" && project.variables.length > 0 && (
                  <Badge tone="accent">{project.variables.length}</Badge>
                )}
              </>
            ),
          }))}
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

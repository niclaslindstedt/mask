// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useState } from "react";

import {
  Button,
  InlineEditRow,
  FolderIcon,
} from "@niclaslindstedt/oss-framework/components";

import {
  PLAIN_TEXT_KEYBOARD_PROPS,
  primeSoftKeyboard,
} from "../generic/softKeyboard.ts";

import { MaskIcon } from "./icons.tsx";
import { useT } from "./i18n/index.ts";

// The main area when the workspace has no project — or none is selected.
export function EmptyScreen({
  hasProjects,
  onCreate,
}: {
  hasProjects: boolean;
  onCreate: (name: string) => void;
}) {
  const t = useT();
  const [creating, setCreating] = useState(false);
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <span className="text-accent">
          <MaskIcon className="h-12 w-12" />
        </span>
        <h1 className="text-lg font-bold text-fg-bright">{t("empty.title")}</h1>
        <p className="text-sm text-muted">
          {hasProjects ? t("empty.noProjectSelected") : t("empty.body")}
        </p>
        {creating ? (
          <div className="w-72 rounded-md border border-line bg-surface">
            <InlineEditRow
              initial=""
              placeholder={t("menu.projectName")}
              onCommit={(name) => {
                onCreate(name);
                setCreating(false);
              }}
              onCancel={() => setCreating(false)}
              className="gap-3 px-3"
              icon={<FolderIcon className="h-5 w-5" />}
              iconClassName="text-muted"
              inputProps={PLAIN_TEXT_KEYBOARD_PROPS}
            />
          </div>
        ) : (
          <Button
            variant="primary"
            onClick={() => {
              primeSoftKeyboard();
              setCreating(true);
            }}
          >
            {t("empty.createProject")}
          </Button>
        )}
      </div>
    </div>
  );
}

// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useCallback } from "react";

import {
  ChevronRightIcon,
  FileIcon,
  FolderIcon,
} from "@niclaslindstedt/oss-framework/components";
import {
  Highlighted,
  SearchModal,
} from "@niclaslindstedt/oss-framework/search";

import { TagIcon } from "./icons.tsx";
import { useT } from "./i18n/index.ts";
import { runSearch, type SearchHit } from "./search.ts";
import type { MaskStore } from "./useMaskStore.ts";

// The search feature over the framework's `SearchModal` + matcher. The
// framework owns the field and the states; the app owns the corpus
// (`runSearch`) and the result rows. Picking a result opens its project.

type Props = {
  open: boolean;
  onClose: () => void;
  initialQuery?: string;
  store: MaskStore;
  onNavigate: () => void;
};

export function SearchOverlay({
  open,
  onClose,
  initialQuery,
  store,
  onNavigate,
}: Props) {
  const t = useT();
  const data = store.data;
  const search = useCallback((query: string) => runSearch(data, query), [data]);

  return (
    <SearchModal<SearchHit>
      open={open}
      onClose={onClose}
      initialQuery={initialQuery}
      search={search}
      labels={{
        title: t("search.title"),
        placeholder: t("search.placeholder"),
        clear: t("search.clear"),
        close: t("common.close"),
        prompt: t("search.prompt"),
        hint: t("search.hint"),
        invalidRegex: t("search.invalidRegex"),
        noResults: (query) => t("search.noResults", { query }),
        matches: (n) =>
          n === 1
            ? t("search.matchesOne")
            : t("search.matchesOther", { n: String(n) }),
      }}
    >
      {(results, close) =>
        results.map((hit) => (
          <li key={hit.key} className="border-b border-line">
            <button
              type="button"
              onClick={() => {
                store.setActiveProject(hit.projectId);
                if (hit.docId)
                  store.setActiveDocument(hit.projectId, hit.docId);
                onNavigate();
                close();
              }}
              className="flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-2"
            >
              <span className="text-accent">
                {hit.kind === "project" ? (
                  <FolderIcon className="h-5 w-5" />
                ) : hit.kind === "document" ? (
                  <FileIcon className="h-5 w-5" />
                ) : (
                  <TagIcon className="h-5 w-5" />
                )}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="line-clamp-2 text-sm text-fg-bright">
                  <Highlighted text={hit.text} ranges={hit.ranges} />
                </span>
                <span className="truncate text-xs text-muted">
                  {t(
                    hit.kind === "project"
                      ? "search.kindProject"
                      : hit.kind === "document"
                        ? "search.kindDocument"
                        : "search.kindVariable",
                  )}
                  {hit.kind !== "project" ? ` · ${hit.projectName}` : ""}
                </span>
              </span>
              <ChevronRightIcon className="h-4 w-4 shrink-0 text-muted" />
            </button>
          </li>
        ))
      }
    </SearchModal>
  );
}

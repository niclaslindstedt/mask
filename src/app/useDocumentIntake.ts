// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useCallback, useState } from "react";

import {
  UnsupportedFileError,
  extractTextFromFile,
} from "../generic/extractText/index.ts";
import { useT } from "./i18n/index.ts";
import type { Doc } from "./types.ts";
import type { MaskStore } from "./useMaskStore.ts";
import * as output from "../output.ts";

// Turns picked / dropped files into project documents: extract the text
// (PDFs through the lazily-loaded pdf.js chunk), refuse what isn't text, and
// file each one into the project. Reports through the output module and the
// returned `busy` / `error` state the screen renders.

export function useDocumentIntake(store: MaskStore, projectId: string | null) {
  const t = useT();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const addText = useCallback(
    (doc: Omit<Doc, "id" | "addedAt">): string | null => {
      if (!projectId) return null;
      return store.addDocument(projectId, doc);
    },
    [store, projectId],
  );

  const addFiles = useCallback(
    async (files: File[]) => {
      if (!projectId) return;
      setError(null);
      for (const file of files) {
        setBusy(t("documents.extracting", { name: file.name }));
        try {
          const extracted = await extractTextFromFile(file);
          if (!extracted.text.trim()) {
            setError(t("documents.emptyText", { name: file.name }));
            output.warn(`No text in ${file.name}`);
            continue;
          }
          store.addDocument(projectId, {
            name: file.name,
            text: extracted.text,
            source: "file",
            format: extracted.kind,
            markdown: extracted.markdown,
            pages: extracted.pages,
          });
        } catch (err) {
          const message =
            err instanceof UnsupportedFileError
              ? t("documents.unsupported", { name: file.name })
              : t("documents.extractFailed", {
                  name: file.name,
                  reason: err instanceof Error ? err.message : String(err),
                });
          setError(message);
          output.error(message);
        }
      }
      setBusy(null);
    },
    [store, projectId, t],
  );

  return { addFiles, addText, busy, error, clearError: () => setError(null) };
}

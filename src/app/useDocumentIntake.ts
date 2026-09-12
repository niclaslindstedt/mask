// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useCallback, useState } from "react";

import {
  UnsupportedFileError,
  extractTextFromFile,
  isPdfFile,
} from "../generic/extractText/index.ts";
import { useT } from "./i18n/index.ts";
import { keepSourceFile } from "./sourceFiles.ts";
import type { Doc } from "./types.ts";
import type { MaskStore } from "./useMaskStore.ts";
import * as output from "../output.ts";

// Turns picked / dropped files into project documents: extract the text
// (PDFs through the lazily-loaded pdf.js chunk), refuse what isn't text, and
// file each one into the project. Reports through the output module and the
// returned `busy` / `error` state the screen renders.
//
// A PDF's own bytes are kept beside the text it gave up (`sourceFiles.ts`),
// so the reader can show the page as it was typeset rather than the
// paragraphs pulled out of it. A vault that refuses the file costs the
// document its page view and nothing else, so the failure is logged rather
// than shown.

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
          const id = store.addDocument(projectId, {
            name: file.name,
            text: extracted.text,
            source: "file",
            format: extracted.kind,
            markdown: extracted.markdown,
            pages: extracted.pages,
          });
          if (isPdfFile(file)) {
            keepSourceFile(id, file).catch((err: unknown) => {
              output.warn(
                `Couldn't keep ${file.name} for viewing — ${
                  err instanceof Error ? err.message : String(err)
                }`,
              );
            });
          }
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

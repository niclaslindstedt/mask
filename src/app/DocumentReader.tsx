// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  Badge,
  CloseIcon,
  Modal,
} from "@niclaslindstedt/oss-framework/components";
import { defaultToastStore } from "@niclaslindstedt/oss-framework/components";

import { CopyablePane } from "../generic/components/index.ts";
import { useT } from "./i18n/index.ts";
import type { Doc } from "./types.ts";

// Read one document as it came in: the whole extracted text, unmarked and
// unmasked. The review beside it is about deciding, and its preview is tinted
// and clipped to say so — this is the plain read of the source, for checking
// what a document actually says before masking it.
//
// The text *is* the source: a PDF is kept as the text pulled out of it, never
// as the file, because nothing a user uploads is stored anywhere.

type Props = {
  doc: Doc | null;
  onClose: () => void;
};

export function DocumentReader({ doc, onClose }: Props) {
  const t = useT();
  const sourceLabel = {
    file: t("reader.sourceFile"),
    paste: t("reader.sourcePaste"),
    sample: t("reader.sourceSample"),
  };

  return (
    <Modal
      open={doc !== null}
      onClose={onClose}
      labelledBy="reader-title"
      closeLabel={t("common.close")}
      size="52rem"
    >
      {doc && (
        <div className="flex flex-col gap-3 p-4">
          <div className="flex items-center gap-2">
            <h2
              id="reader-title"
              className="min-w-0 flex-1 truncate text-sm font-bold text-fg-bright"
            >
              {doc.name}
            </h2>
            <Badge tone={doc.masked ? "accent" : "muted"}>
              {doc.masked
                ? t("documents.statusMasked")
                : t("documents.statusPending")}
            </Badge>
            <button
              type="button"
              onClick={onClose}
              aria-label={t("common.close")}
              className="-mr-1 inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded text-muted hover:bg-surface-2 hover:text-fg"
            >
              <CloseIcon className="h-5 w-5" />
            </button>
          </div>
          <p className="text-xs text-muted">
            {[
              sourceLabel[doc.source],
              doc.format === "pdf" ? t("reader.formatPdf") : null,
              doc.pages ? t("documents.pages", { n: String(doc.pages) }) : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <CopyablePane
            title={t("reader.title")}
            value={doc.text}
            bodyClassName="max-h-[60vh]"
            labels={{
              copy: t("common.copy"),
              copied: t("common.copied"),
              count: (n) => t("common.characters", { n: String(n) }),
              empty: t("reader.empty"),
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
      )}
    </Modal>
  );
}

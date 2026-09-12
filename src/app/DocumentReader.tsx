// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useEffect, useState } from "react";

import {
  Badge,
  CloseIcon,
  Modal,
  SegmentedControl,
} from "@niclaslindstedt/oss-framework/components";
import { defaultToastStore } from "@niclaslindstedt/oss-framework/components";

import {
  CopyablePane,
  MarkdownText,
  PdfView,
} from "../generic/components/index.ts";
import { useT } from "./i18n/index.ts";
import { loadSourceFile } from "./sourceFiles.ts";
import type { Doc } from "./types.ts";

// Read one document as it came in. The review beside it is about deciding,
// and its preview is tinted and clipped to say so — this is the plain read of
// the source, for checking what a document actually says before masking it.
//
// A PDF opens as the PDF: its own pages, painted by the same engine that read
// the text out of them, because a page is a layout — columns, tables, stamps,
// a signature — and the text pulled out of it is only what that layout said.
// The extracted text is a press away behind it, since that text is what the
// detectors actually read and what the copy button hands over.
//
// A document whose file isn't held — one pasted in, one added before files
// were kept, or a browser that refuses the vault — opens as that text alone.

type Props = {
  doc: Doc | null;
  onClose: () => void;
};

type Face = "pages" | "text";

export function DocumentReader({ doc, onClose }: Props) {
  const t = useT();
  const [file, setFile] = useState<Blob | null>(null);
  const [face, setFace] = useState<Face>("pages");
  const sourceLabel = {
    file: t("reader.sourceFile"),
    paste: t("reader.sourcePaste"),
    sample: t("reader.sourceSample"),
  };

  // The document's own file, if one is kept for it. Cleared first, so the
  // previous document's pages are never shown under this one's name.
  const docId = doc?.id ?? null;
  useEffect(() => {
    setFile(null);
    setFace("pages");
    if (!docId) return;
    let live = true;
    void loadSourceFile(docId).then((blob) => {
      if (live) setFile(blob);
    });
    return () => {
      live = false;
    };
  }, [docId]);

  const showPages = file !== null && face === "pages";

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
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted">
              {[
                sourceLabel[doc.source],
                doc.format === "pdf" ? t("reader.formatPdf") : null,
                doc.pages
                  ? t("documents.pages", { n: String(doc.pages) })
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {file && (
              <SegmentedControl<Face>
                value={face}
                onChange={setFace}
                ariaLabel={t("reader.faceLabel")}
                options={[
                  { value: "pages", label: t("reader.facePages") },
                  { value: "text", label: t("reader.faceText") },
                ]}
              />
            )}
          </div>
          {showPages ? (
            <PdfView
              file={file}
              title={t("reader.pagesTitle")}
              /* Taller than the text pane: a page read as a page wants the
                 height, and there is nothing under it to keep in view. */
              bodyClassName="max-h-[70vh]"
              labels={{
                loading: t("reader.pagesLoading"),
                failed: t("reader.pagesFailed"),
                page: (n, total) =>
                  t("reader.pageNumber", {
                    n: String(n),
                    total: String(total),
                  }),
                zoomIn: t("reader.zoomIn"),
                zoomOut: t("reader.zoomOut"),
                zoomReset: t("reader.zoomReset"),
              }}
            />
          ) : (
            <CopyablePane
              title={t("reader.title")}
              value={doc.text}
              bodyClassName="max-h-[60vh]"
              body={
                doc.markdown ? (
                  <MarkdownText text={doc.text} className="prose-pane" />
                ) : undefined
              }
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
          )}
        </div>
      )}
    </Modal>
  );
}

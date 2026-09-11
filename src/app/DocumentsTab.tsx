// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useRef, useState } from "react";

import {
  Badge,
  Button,
  ConfirmDialog,
  FileIcon,
  Modal,
  NoteIcon,
  ScrollTextIcon,
  SpinnerIcon,
  TrashIcon,
} from "@niclaslindstedt/oss-framework/components";
import { useMediaQuery } from "@niclaslindstedt/oss-framework/hooks";

import { EXTRACT_ACCEPT } from "../generic/extractText/index.ts";
import { FileDropZone } from "../generic/components/index.ts";
import { useCollapseOnScroll } from "../generic/collapseOnScroll.ts";
import { DocumentReader } from "./DocumentReader.tsx";
import { ReviewPanel } from "./ReviewPanel.tsx";
import { useT } from "./i18n/index.ts";
import { activeDoc, type Doc, type Project } from "./types.ts";
import type { AppSettings } from "./useAppSettings.ts";
import type { CustomKindsStore } from "./useCustomKinds.ts";
import { useDocumentIntake } from "./useDocumentIntake.ts";
import type { MaskStore } from "./useMaskStore.ts";
import type { RulesStore } from "./useRules.ts";

// The Documents tab: the project's document list with the intake (drop a
// file, or paste text) beside the review of the selected one. Desktop lays the
// two out side by side, each column scrolling on its own; a phone stacks them
// into one scroll, so the list scrolls away as the review comes up
// (`md:contents` hands the two panes back to the row layout from `md` up).
//
// The intake is the one thing that doesn't scroll away on a phone: it sits
// above that scroll, and folds into a single row the moment the reader is past
// it. A phone has too little height to spend a fifth of it on a drop target
// nobody is aiming at, and too few ways back to hide the way in entirely.
//
// A document is more than a row to pick: pressing its glyph opens the source
// text as it came in, for reading rather than deciding.

type Props = {
  project: Project;
  store: MaskStore;
  rules: RulesStore;
  settings: AppSettings;
  kinds: CustomKindsStore;
};

export function DocumentsTab({
  project,
  store,
  rules,
  settings,
  kinds,
}: Props) {
  const t = useT();
  const intake = useDocumentIntake(store, project.id);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [deleting, setDeleting] = useState<Doc | null>(null);
  const [reading, setReading] = useState<Doc | null>(null);
  const doc = activeDoc(project);

  // One scroll for the list and the review on a phone, two columns from `md`
  // up — so the intake only folds where it is actually scrolled past.
  const stacked = !useMediaQuery("(min-width: 768px)");
  const scrollRef = useRef<HTMLDivElement>(null);
  const folded = useCollapseOnScroll(scrollRef, { enabled: stacked });

  const compact = stacked && folded;
  const intakePanel = (
    <>
      <FileDropZone
        onFiles={(files) => void intake.addFiles(files)}
        accept={EXTRACT_ACCEPT}
        disabled={intake.busy !== null}
        compact={compact}
        labels={{
          title: t("documents.dropTitle"),
          compactTitle: t("documents.dropCompact"),
          hint: t("documents.dropHint"),
          active: t("documents.dropActive"),
        }}
      >
        <Button variant="secondary" onClick={() => setPasteOpen(true)}>
          <span className="flex items-center gap-1.5">
            <NoteIcon className="h-4 w-4" />
            <span className={compact ? "sr-only" : ""}>
              {t("documents.pasteText")}
            </span>
          </span>
        </Button>
      </FileDropZone>
      {intake.busy && (
        <p className="flex items-center gap-2 text-xs text-muted">
          <SpinnerIcon className="h-4 w-4 animate-spin text-accent" />
          {intake.busy}
        </p>
      )}
      {intake.error && (
        <p
          role="alert"
          className="rounded-md border border-danger/50 bg-danger/10 px-3 py-2 text-xs text-danger"
        >
          {intake.error}
        </p>
      )}
    </>
  );

  return (
    <div className="flex h-full min-h-0 flex-col md:flex-row">
      {/* Stacked: above the scroll rather than in it, so folding it leaves it
          in reach instead of taking it away. */}
      {stacked && (
        <div className="flex shrink-0 flex-col gap-2 border-b border-line bg-surface px-3 py-2">
          {intakePanel}
        </div>
      )}
      <div
        ref={scrollRef}
        className="flex min-h-0 flex-1 flex-col overflow-y-auto md:contents"
      >
        <aside className="flex shrink-0 flex-col gap-3 border-b border-line bg-surface p-3 md:w-72 md:overflow-y-auto md:border-r md:border-b-0">
          {!stacked && intakePanel}
          <ul className="flex flex-col gap-1">
            {project.documents.map((d) => {
              const active = d.id === project.activeDocumentId;
              return (
                <li key={d.id} className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => store.setActiveDocument(project.id, d.id)}
                    aria-current={active ? "true" : undefined}
                    className={`flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm ${
                      active
                        ? "bg-accent/20 text-fg-bright"
                        : "text-fg hover:bg-surface-2"
                    }`}
                  >
                    <FileIcon
                      className={`h-4 w-4 shrink-0 ${active ? "text-accent" : "text-muted"}`}
                    />
                    <span className="min-w-0 flex-1 truncate">{d.name}</span>
                    <Badge tone={d.masked ? "accent" : "muted"}>
                      {d.masked
                        ? t("documents.statusMasked")
                        : t("documents.statusPending")}
                    </Badge>
                  </button>
                  <button
                    type="button"
                    aria-label={t("reader.openTitle", { name: d.name })}
                    title={t("reader.openTitle", { name: d.name })}
                    onClick={() => setReading(d)}
                    className="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded text-muted hover:bg-surface-2 hover:text-accent"
                  >
                    <ScrollTextIcon className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label={t("common.delete")}
                    onClick={() => setDeleting(d)}
                    className="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded text-muted hover:bg-surface-2 hover:text-danger"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        <section className="min-h-0 shrink-0 md:flex-1 md:shrink md:overflow-y-auto">
          {doc ? (
            <ReviewPanel
              key={doc.id}
              project={project}
              doc={doc}
              store={store}
              rules={rules}
              settings={settings}
              kinds={kinds}
              onReadSource={() => setReading(doc)}
            />
          ) : (
            <p className="p-6 text-sm text-muted">
              {project.documents.length === 0
                ? t("documents.empty")
                : t("documents.selectOne")}
            </p>
          )}
        </section>
      </div>

      <DocumentReader doc={reading} onClose={() => setReading(null)} />

      <PasteModal
        open={pasteOpen}
        onClose={() => setPasteOpen(false)}
        onAdd={(name, text) => {
          intake.addText({ name, text, source: "paste", format: "text" });
          setPasteOpen(false);
        }}
      />
      <ConfirmDialog
        open={deleting !== null}
        title={t("documents.deleteTitle")}
        description={t("documents.deleteBody", { name: deleting?.name ?? "" })}
        confirmLabel={t("common.delete")}
        tone="danger"
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) store.removeDocument(project.id, deleting.id);
          setDeleting(null);
        }}
        labels={{ close: t("common.close"), cancel: t("common.cancel") }}
      />
    </div>
  );
}

function PasteModal({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (name: string, text: string) => void;
}) {
  const t = useT();
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const canAdd = text.trim().length > 0;
  const submit = () => {
    if (!canAdd) return;
    onAdd(name.trim() || t("documents.pasteTitle"), text);
    setName("");
    setText("");
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      labelledBy="paste-title"
      closeLabel={t("common.close")}
      centered
      footer={
        <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-line bg-surface-3 px-4 py-3">
          <Button variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button variant="primary" disabled={!canAdd} onClick={submit}>
            {t("documents.pasteAdd")}
          </Button>
        </footer>
      }
    >
      <div className="flex flex-col gap-3 p-4">
        <h2 id="paste-title" className="text-sm font-bold text-fg-bright">
          {t("documents.pasteTitle")}
        </h2>
        <label className="flex flex-col gap-1 text-xs text-muted">
          {t("documents.pasteName")}
          <input
            type="text"
            value={name}
            placeholder={t("documents.pasteNamePlaceholder")}
            onInput={(e) => setName(e.currentTarget.value)}
            className="rounded-md border border-line bg-surface px-3 py-1.5 text-sm text-fg-bright placeholder:text-muted focus:border-accent focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          {t("documents.pasteBody")}
          <textarea
            value={text}
            placeholder={t("documents.pastePlaceholder")}
            onInput={(e) => setText(e.currentTarget.value)}
            rows={10}
            className="min-h-40 resize-y rounded-md border border-line bg-surface px-3 py-2 text-sm text-fg-bright placeholder:text-muted focus:border-accent focus:outline-none"
          />
        </label>
      </div>
    </Modal>
  );
}

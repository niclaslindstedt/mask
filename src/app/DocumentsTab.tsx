// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useState } from "react";

import {
  Badge,
  Button,
  ConfirmDialog,
  FileIcon,
  Modal,
  SpinnerIcon,
  TrashIcon,
} from "@niclaslindstedt/oss-framework/components";

import { EXTRACT_ACCEPT } from "../generic/extractText/index.ts";
import { FileDropZone } from "../generic/components/index.ts";
import { ReviewPanel } from "./ReviewPanel.tsx";
import { useT } from "./i18n/index.ts";
import { SAMPLE_NAME, SAMPLE_TEXT } from "./sample.ts";
import { activeDoc, type Doc, type Project } from "./types.ts";
import type { AppSettings } from "./useAppSettings.ts";
import { useDocumentIntake } from "./useDocumentIntake.ts";
import type { MaskStore } from "./useMaskStore.ts";
import type { RulesStore } from "./useRules.ts";

// The Documents tab: the project's document list with the intake (drop a
// file, paste text, load the sample) beside the review of the selected one.
// Desktop lays the two out side by side; a phone stacks them.

type Props = {
  project: Project;
  store: MaskStore;
  rules: RulesStore;
  settings: AppSettings;
};

export function DocumentsTab({ project, store, rules, settings }: Props) {
  const t = useT();
  const intake = useDocumentIntake(store, project.id);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [deleting, setDeleting] = useState<Doc | null>(null);
  const doc = activeDoc(project);

  return (
    <div className="flex h-full min-h-0 flex-col md:flex-row">
      <aside className="flex shrink-0 flex-col gap-3 overflow-y-auto border-b border-line bg-surface p-3 md:w-72 md:border-r md:border-b-0">
        <FileDropZone
          onFiles={(files) => void intake.addFiles(files)}
          accept={EXTRACT_ACCEPT}
          disabled={intake.busy !== null}
          labels={{
            title: t("documents.dropTitle"),
            hint: t("documents.dropHint"),
            active: t("documents.dropActive"),
          }}
        >
          <div className="flex flex-wrap justify-center gap-x-3 gap-y-1">
            <button
              type="button"
              onClick={() => setPasteOpen(true)}
              className="cursor-pointer text-accent underline-offset-2 hover:underline"
            >
              {t("documents.pasteText")}
            </button>
            <button
              type="button"
              onClick={() =>
                intake.addText({
                  name: SAMPLE_NAME,
                  text: SAMPLE_TEXT,
                  source: "sample",
                  format: "text",
                })
              }
              className="cursor-pointer text-accent underline-offset-2 hover:underline"
            >
              {t("documents.loadSample")}
            </button>
          </div>
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
        {project.documents.length === 0 && (
          <p className="text-xs text-muted">{t("documents.empty")}</p>
        )}
      </aside>

      <section className="min-h-0 flex-1 overflow-y-auto">
        {doc ? (
          <ReviewPanel
            key={doc.id}
            project={project}
            doc={doc}
            store={store}
            rules={rules}
            settings={settings}
          />
        ) : (
          <p className="p-6 text-sm text-muted">
            {project.documents.length === 0
              ? t("documents.empty")
              : t("documents.selectOne")}
          </p>
        )}
      </section>

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

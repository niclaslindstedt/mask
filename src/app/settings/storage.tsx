// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useState } from "react";

import {
  Button,
  FolderIcon,
  Modal,
  Section,
  SegmentedControl,
  SpinnerIcon,
} from "@niclaslindstedt/oss-framework/components";

import { useT } from "../i18n/index.ts";
import type { StorageMode, FolderStorage } from "../useFolderStorage.ts";

// Settings → Storage: where this workspace's projects are kept. Two choices —
// this device's browser storage (the default) or a folder the user picks on
// their own disk. Both are local; neither sends anything anywhere.
//
// Unlike the other tabs this one applies immediately rather than staging a
// draft for Save: picking a folder opens the OS picker, which has to happen in
// the click that asked for it, and the connection is a live state the rest of
// the app is already running on by the time the dialog closes.

export function StorageTab({ folder }: { folder: FolderStorage }) {
  const t = useT();
  // The picker shows the target; the folder only becomes the storage once a
  // pick lands, so switching to it leaves the Connect affordance showing.
  const [picked, setPicked] = useState<StorageMode>(folder.mode);
  const [busy, setBusy] = useState(false);

  const run = (fn: () => Promise<void>) => {
    setBusy(true);
    void fn().finally(() => setBusy(false));
  };

  const options = [
    { value: "device" as const, label: t("settings.storage.device") },
    ...(folder.available
      ? [{ value: "folder" as const, label: t("settings.storage.folder") }]
      : []),
  ];

  return (
    <div>
      <p className="mb-3 text-xs text-muted">{t("settings.storage.intro")}</p>

      <Section title={t("settings.storage.whereTitle")}>
        <SegmentedControl<StorageMode>
          value={picked}
          options={options}
          ariaLabel={t("settings.storage.whereTitle")}
          onChange={(next) => {
            setPicked(next);
            if (next === "device" && folder.mode === "folder") {
              folder.disconnect();
            }
          }}
        />
        {picked === "device" ? (
          <p className="text-xs text-muted">
            {t("settings.storage.deviceHint")}
          </p>
        ) : (
          <FolderPanel folder={folder} busy={busy} run={run} />
        )}
        {!folder.available && (
          <p className="text-xs text-warning">
            {t("settings.storage.unsupported")}
          </p>
        )}
      </Section>

      <ChoiceDialog folder={folder} />
    </div>
  );
}

function FolderPanel({
  folder,
  busy,
  run,
}: {
  folder: FolderStorage;
  busy: boolean;
  run: (fn: () => Promise<void>) => void;
}) {
  const t = useT();
  const connected = folder.mode === "folder" && folder.status === "connected";
  const needsReconnect =
    folder.mode === "folder" &&
    (folder.status === "reconnect" || folder.status === "unreadable");

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted">{t("settings.storage.folderHint")}</p>
      {connected ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex min-w-0 items-center gap-1.5 text-sm text-success">
            <FolderIcon className="h-4 w-4 shrink-0" />
            <span className="truncate">
              {t("settings.storage.connectedTo", {
                name: folder.folderName ?? "",
              })}
            </span>
          </span>
          <Button variant="secondary" onClick={() => folder.disconnect()}>
            {t("settings.storage.disconnect")}
          </Button>
        </div>
      ) : needsReconnect ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-warning">
            {folder.status === "unreadable"
              ? t("settings.storage.unreadable")
              : t("settings.storage.reconnectNeeded")}
          </span>
          <Button
            variant="primary"
            disabled={busy}
            onClick={() => run(() => folder.reconnect())}
          >
            <span className="flex items-center gap-1.5">
              {busy && <SpinnerIcon className="h-4 w-4 animate-spin" />}
              {t("settings.storage.reconnect")}
            </span>
          </Button>
        </div>
      ) : (
        <Button
          variant="primary"
          className="self-start"
          disabled={busy}
          onClick={() => run(() => folder.connect())}
        >
          <span className="flex items-center gap-1.5">
            {busy && <SpinnerIcon className="h-4 w-4 animate-spin" />}
            {t("settings.storage.choose")}
          </span>
        </Button>
      )}
      {folder.mode === "folder" && folder.folderName && (
        <p className="text-xs text-muted">
          {t("settings.storage.fileHint", { name: folder.folderName })}
        </p>
      )}
    </div>
  );
}

/** The one question the connection can raise: the picked folder already holds
 *  projects, and so does this device. Closing the dialog backs the connection
 *  out entirely rather than guessing which side to keep. */
function ChoiceDialog({ folder }: { folder: FolderStorage }) {
  const t = useT();
  const choice = folder.pending;
  const projects = (n: number) =>
    n === 1
      ? t("settings.storage.oneProject")
      : t("settings.storage.nProjects", { n });

  return (
    <Modal
      open={choice !== null}
      onClose={() => folder.cancel()}
      labelledBy="storage-choice-title"
      closeLabel={t("common.cancel")}
      footer={
        <footer className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-line bg-surface-3 px-4 py-3">
          <Button variant="secondary" onClick={() => folder.cancel()}>
            {t("common.cancel")}
          </Button>
          <Button variant="secondary" onClick={() => folder.resolve("device")}>
            {t("settings.storage.keepDevice")}
          </Button>
          <Button variant="primary" onClick={() => folder.resolve("folder")}>
            {t("settings.storage.keepFolder")}
          </Button>
        </footer>
      }
    >
      <div className="flex flex-col gap-3 px-4 py-4">
        <h2
          id="storage-choice-title"
          className="text-sm font-bold tracking-wide text-fg-bright"
        >
          {t("settings.storage.choiceTitle")}
        </h2>
        <p className="text-sm text-fg">
          {t("settings.storage.choiceBody", {
            name: folder.folderName ?? "",
          })}
        </p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted">{t("settings.storage.thisDevice")}</dt>
          <dd className="text-fg-bright">
            {projects(choice?.device.projects.length ?? 0)}
          </dd>
          <dt className="text-muted">{t("settings.storage.theFolder")}</dt>
          <dd className="text-fg-bright">
            {projects(choice?.folder.projects.length ?? 0)}
          </dd>
        </dl>
        <p className="text-xs text-muted">{t("settings.storage.choiceHint")}</p>
      </div>
    </Modal>
  );
}

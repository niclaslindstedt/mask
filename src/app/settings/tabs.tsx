// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useState } from "react";

import {
  Button,
  ConfirmDialog,
  SegmentedControl,
  Section,
  SelectPicker,
  ToggleRow,
} from "@niclaslindstedt/oss-framework/components";
import { LogViewer } from "@niclaslindstedt/oss-framework/logging";
import { clearDirectoryHandle } from "@niclaslindstedt/oss-framework/storage";
import {
  CheckForUpdatesItem,
  type PwaUpdate,
} from "@niclaslindstedt/oss-framework/pwa";

import {
  PLACEHOLDER_STYLES,
  placeholderExamples,
  type PlaceholderStyle,
} from "../../generic/placeholders.ts";
import { DETECTOR_IDS, type DetectorId } from "../detectors/index.ts";
import { useDevSeed } from "../dev/useDevSeed.ts";
import { clearSourceFiles } from "../sourceFiles.ts";
import type { CustomKindsStore } from "../useCustomKinds.ts";
import { PlaceholderTypesSection } from "./kinds.tsx";
import { descendingLogStore } from "../log.ts";
import { useT, type TFn } from "../i18n/index.ts";
import type { AppSettings } from "../useAppSettings.ts";
import { LanguagePicker } from "./shared.tsx";

type Update = <K extends keyof AppSettings>(
  key: K,
  value: AppSettings[K],
) => void;

// --- General ---------------------------------------------------------------

export function GeneralTab({
  settings,
  update,
}: {
  settings: AppSettings;
  update: Update;
}) {
  const t = useT();
  return (
    <div>
      <p className="mb-3 text-xs text-muted">{t("settings.general.intro")}</p>
      <Section title={t("settings.general.languageTitle")}>
        <div className="flex flex-col gap-1">
          <span className="text-sm text-fg-bright">
            {t("settings.general.chooseLanguage")}
          </span>
          <LanguagePicker />
          <p className="text-xs text-muted">
            {t("settings.general.languageHint")}
          </p>
        </div>
      </Section>
      <Section title={t("settings.general.sidebarTitle")}>
        <div className="flex flex-col gap-1">
          <span className="text-sm text-fg-bright">
            {t("settings.general.openSidebarWith")}
          </span>
          <SegmentedControl
            value={settings.menuMode}
            options={[
              {
                value: "swipe" as const,
                label: t("settings.general.optionSwipe"),
              },
              {
                value: "button" as const,
                label: t("settings.general.optionButton"),
              },
            ]}
            onChange={(next) => update("menuMode", next)}
            ariaLabel={t("settings.general.openSidebarWith")}
          />
          <p className="text-xs text-muted">
            {t("settings.general.sidebarHint")}
          </p>
        </div>
      </Section>
      <Section title={t("settings.general.developerTitle")}>
        <ToggleRow
          label={t("settings.general.developerMode")}
          hint={t("settings.general.developerModeHint")}
          checked={settings.devMode}
          onChange={(next) => update("devMode", next)}
        />
        <ToggleRow
          label={t("settings.general.captureLogs")}
          hint={t("settings.general.captureLogsHint")}
          checked={settings.captureLogs}
          onChange={(next) => update("captureLogs", next)}
        />
      </Section>
    </div>
  );
}

// --- Masking ---------------------------------------------------------------

export function styleOptions(t: TFn) {
  return PLACEHOLDER_STYLES.map((style) => ({
    value: style,
    label: t(`styles.${style}`),
    hint: placeholderExamples(style),
  }));
}

export function MaskingTab({
  settings,
  update,
  kinds,
  workspaceName,
}: {
  settings: AppSettings;
  update: Update;
  kinds: CustomKindsStore;
  workspaceName: string;
}) {
  const t = useT();
  return (
    <div>
      <p className="mb-3 text-xs text-muted">{t("settings.masking.intro")}</p>
      <Section title={t("settings.masking.styleTitle")}>
        <div className="flex flex-col gap-1">
          <span className="text-sm text-fg-bright">
            {t("settings.masking.styleLabel")}
          </span>
          <SelectPicker<PlaceholderStyle>
            value={settings.placeholderStyle}
            options={styleOptions(t)}
            onChange={(next) => update("placeholderStyle", next)}
            ariaLabel={t("settings.masking.styleLabel")}
          />
          <p className="text-xs text-muted">
            {t("settings.masking.styleHint")}
          </p>
        </div>
      </Section>
      <PlaceholderTypesSection
        kinds={kinds}
        scope={settings.kindScope}
        onScopeChange={(next) => update("kindScope", next)}
        style={settings.placeholderStyle}
        workspaceName={workspaceName}
      />
      <Section title={t("settings.masking.detectorsTitle")}>
        <p className="text-xs text-muted">
          {t("settings.masking.detectorsHint")}
        </p>
        {DETECTOR_IDS.map((id: DetectorId) => (
          <ToggleRow
            key={id}
            label={t(`settings.masking.detector.${id}`)}
            hint={t(`settings.masking.detector.${id}Hint`)}
            checked={settings.detectors[id]}
            onChange={(next) =>
              update("detectors", { ...settings.detectors, [id]: next })
            }
          />
        ))}
      </Section>
    </div>
  );
}

// --- Developer -------------------------------------------------------------

export function DeveloperTab({ pwa }: { pwa: PwaUpdate }) {
  const t = useT();
  const [confirmClear, setConfirmClear] = useState(false);
  // The "Test data" toggle applies live and is in-memory only (not a staged
  // draft setting): flipping it swaps the store's storage backend for the
  // ephemeral one full of sample projects. See `useDevSeed`.
  const { testData, setTestData } = useDevSeed();
  return (
    <div>
      <p className="mb-3 text-xs text-muted">{t("settings.developer.intro")}</p>
      <Section title={t("settings.developer.testDataTitle")}>
        <ToggleRow
          label={t("settings.developer.testData")}
          hint={t("settings.developer.testDataHint")}
          checked={testData}
          onChange={setTestData}
        />
      </Section>
      <Section title={t("settings.developer.buildTitle")}>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted">{t("settings.developer.version")}</dt>
          <dd className="text-fg-bright tabular-nums">{__BUILD_LABEL__}</dd>
          <dt className="text-muted">{t("settings.developer.commit")}</dt>
          <dd className="text-fg-bright">{__BUILD_COMMIT__}</dd>
          <dt className="text-muted">{t("settings.developer.build")}</dt>
          <dd className="text-fg-bright">{__BUILD_NUMBER__}</dd>
        </dl>
      </Section>
      <Section title={t("settings.developer.updatesTitle")}>
        <div className="-mx-3">
          <CheckForUpdatesItem
            checking={pwa.checking}
            updateAvailable={pwa.needRefresh}
            onCheck={pwa.checkForUpdate}
            labels={{
              idle: t("menu.checkUpdates"),
              checking: t("menu.checkingUpdates"),
              upToDate: t("menu.upToDate"),
              updateAvailable: t("menu.updateAvailable"),
              unavailable: t("menu.updatesUnavailable"),
            }}
          />
        </div>
      </Section>
      <Section title={t("settings.developer.storageTitle")}>
        <p className="text-xs text-muted">
          {t("settings.developer.storageHint")}
        </p>
        <div>
          <Button variant="danger" onClick={() => setConfirmClear(true)}>
            {t("settings.developer.clearStorage")}
          </Button>
        </div>
      </Section>
      <ConfirmDialog
        open={confirmClear}
        title={t("settings.developer.clearTitle")}
        description={t("settings.developer.clearBody")}
        confirmLabel={t("settings.developer.clearConfirm")}
        tone="danger"
        onCancel={() => setConfirmClear(false)}
        onConfirm={() => {
          try {
            localStorage.clear();
          } catch {
            // Storage unavailable — nothing to erase.
          }
          // The kept source files and a picked folder's permission grant live
          // in IndexedDB rather than in localStorage, so they are erased on
          // their own — and the reload waits for both, so nothing survives the
          // press. The folder's own files are never touched: they are the
          // user's, on their disk, outside anything this button owns.
          void Promise.all([clearSourceFiles(), clearDirectoryHandle()])
            .catch(() => {
              // Nothing readable to erase — the reload below still stands.
            })
            .finally(() => location.reload());
        }}
        labels={{ close: t("common.close"), cancel: t("common.cancel") }}
      />
    </div>
  );
}

// --- Logs ------------------------------------------------------------------

export function LogsTab() {
  const t = useT();
  return (
    <div>
      <p className="mb-3 text-xs text-muted">{t("settings.logs.intro")}</p>
      <LogViewer store={descendingLogStore} />
    </div>
  );
}

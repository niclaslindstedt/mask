// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";

import {
  Button,
  CloseIcon,
  CodeIcon,
  CogIcon,
  MenuIcon,
  Modal,
  PaletteIcon,
  ScrollTextIcon,
  ShieldIcon,
  SlidersIcon,
  type IconProps,
} from "@niclaslindstedt/oss-framework/components";
import {
  AppearancePicker,
  type ThemeAppearance,
} from "@niclaslindstedt/oss-framework/theme";
import type { PwaUpdate } from "@niclaslindstedt/oss-framework/pwa";

import { SafeFloatingPanel } from "../generic/components/index.ts";
import { useT } from "./i18n/index.ts";
import { APP_LOOK } from "./look.ts";
import { DEFAULT_SETTINGS, type AppSettings } from "./useAppSettings.ts";
import {
  DeveloperTab,
  GeneralTab,
  LogsTab,
  MaskingTab,
} from "./settings/tabs.tsx";

// The app's tabbed Settings modal over the framework's `Modal` and the
// safe-area-aware `SafeFloatingPanel`. On desktop a vertical tab rail owns
// section selection; on
// mobile a header burger opens the same sections as a menu. Appearance edits
// preview live; the other tabs stage a draft committed on Save.

type TabId = "general" | "appearance" | "masking" | "developer" | "logs";
type TKey = Parameters<ReturnType<typeof useT>>[0];
type TabDef = { id: TabId; labelKey: TKey; icon: (p: IconProps) => ReactNode };

const TABS: TabDef[] = [
  { id: "general", labelKey: "settings.tabs.general", icon: SlidersIcon },
  { id: "appearance", labelKey: "settings.tabs.appearance", icon: PaletteIcon },
  { id: "masking", labelKey: "settings.tabs.masking", icon: ShieldIcon },
  { id: "developer", labelKey: "settings.tabs.developer", icon: CodeIcon },
  { id: "logs", labelKey: "settings.tabs.logs", icon: ScrollTextIcon },
];

type Props = {
  open: boolean;
  onClose: () => void;
  appearance: ThemeAppearance;
  setAppearance: (next: ThemeAppearance) => void;
  settings: AppSettings;
  commitSettings: (next: AppSettings) => void;
  pwa: PwaUpdate;
};

export function SettingsModal({
  open,
  onClose,
  appearance,
  setAppearance,
  settings,
  commitSettings,
  pwa,
}: Props) {
  const t = useT();
  const [tab, setTab] = useState<TabId>("general");
  const [menuOpen, setMenuOpen] = useState(false);
  const [draft, setDraft] = useState<AppSettings>(settings);
  const menuRef = useRef<HTMLButtonElement>(null);
  const snapshot = useRef<ThemeAppearance>(appearance);

  useEffect(() => {
    if (!open) return;
    snapshot.current = appearance;
    setDraft(settings);
    setTab("general");
    setMenuOpen(false);
    // Only re-run when the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function update<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  const visible = TABS.filter(
    (d) =>
      (d.id !== "developer" || draft.devMode) &&
      (d.id !== "logs" || draft.captureLogs || draft.devMode),
  );
  const activeTab = visible.some((d) => d.id === tab) ? tab : "general";
  const activeDef = visible.find((d) => d.id === activeTab) ?? visible[0]!;
  const ActiveIcon = activeDef.icon;

  function save() {
    commitSettings(draft);
    onClose();
  }
  function cancel() {
    setAppearance(snapshot.current);
    onClose();
  }
  function reset() {
    setAppearance(APP_LOOK);
    setDraft(DEFAULT_SETTINGS);
  }

  return (
    <Modal
      open={open}
      onClose={cancel}
      labelledBy="settings-title"
      closeLabel={t("common.cancel")}
      footer={
        <footer className="flex shrink-0 items-center justify-between gap-2 border-t border-line bg-surface-3 px-4 py-3">
          <Button variant="secondary" onClick={reset}>
            {t("common.resetToDefaults")}
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={cancel}>
              {t("common.cancel")}
            </Button>
            <Button variant="primary" onClick={save}>
              {t("common.save")}
            </Button>
          </div>
        </footer>
      }
    >
      <header
        data-floating-edge="top"
        className="relative flex shrink-0 items-center justify-between gap-2 border-b border-line bg-surface-3 px-4 py-3"
      >
        <div className="flex min-w-0 items-center gap-2">
          <div className="relative sm:hidden">
            <button
              ref={menuRef}
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label={t("settings.chooseSection")}
              className={`-ml-1 inline-flex cursor-pointer items-center gap-2 rounded border px-2 py-1 text-sm font-bold tracking-wide text-fg-bright ${
                menuOpen
                  ? "border-accent bg-accent/15"
                  : "border-transparent hover:border-line hover:bg-surface-2"
              }`}
            >
              <MenuIcon className="h-[18px] w-[18px] text-muted" />
              <span className="inline-flex shrink-0 text-accent">
                <ActiveIcon className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0">{t(activeDef.labelKey)}</span>
            </button>
            <SafeFloatingPanel
              open={menuOpen}
              onClose={() => setMenuOpen(false)}
              triggerRef={menuRef}
              placement={{
                width: { kind: "min", minPx: 192 },
                anchor: "left",
                coordinateSpace: "viewport",
              }}
            >
              <div role="menu" className="flex w-full flex-col gap-0.5 p-2">
                {visible.map((d) => {
                  const Icon = d.icon;
                  const isActive = d.id === activeTab;
                  return (
                    <button
                      key={d.id}
                      type="button"
                      role="menuitem"
                      aria-current={isActive ? "page" : undefined}
                      onClick={() => {
                        setTab(d.id);
                        setMenuOpen(false);
                      }}
                      className={`flex w-full cursor-pointer items-center gap-2 rounded px-2 py-2 text-left text-sm hover:bg-surface ${
                        isActive ? "font-bold text-accent" : "text-fg"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span>{t(d.labelKey)}</span>
                    </button>
                  );
                })}
              </div>
            </SafeFloatingPanel>
          </div>
          <h2
            id="settings-title"
            className="sr-only text-sm font-bold tracking-wide text-fg-bright sm:not-sr-only"
          >
            <span className="inline-flex items-center gap-2">
              <span className="inline-flex shrink-0 text-accent">
                <CogIcon className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0">{t("settings.title")}</span>
            </span>
          </h2>
        </div>
        <button
          type="button"
          onClick={cancel}
          aria-label={t("common.close")}
          className="-mr-1 inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded text-muted hover:bg-surface-2 hover:text-fg"
        >
          <CloseIcon className="h-5 w-5" />
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <TabSidebar
          tabs={visible}
          activeTab={activeTab}
          onSelect={setTab}
          label={t("settings.sections")}
        />
        <div
          role="tabpanel"
          id={`settings-tabpanel-${activeTab}`}
          aria-labelledby={`settings-tab-${activeTab}`}
          tabIndex={0}
          className="settings-body flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-4 py-4"
        >
          {activeTab === "general" && (
            <GeneralTab settings={draft} update={update} />
          )}
          {activeTab === "appearance" && (
            <AppearancePicker
              appearance={appearance}
              onChange={setAppearance}
            />
          )}
          {activeTab === "masking" && (
            <MaskingTab settings={draft} update={update} />
          )}
          {activeTab === "developer" && <DeveloperTab pwa={pwa} />}
          {activeTab === "logs" && <LogsTab />}
        </div>
      </div>
    </Modal>
  );
}

function TabSidebar({
  tabs,
  activeTab,
  onSelect,
  label,
}: {
  tabs: TabDef[];
  activeTab: TabId;
  onSelect: (id: TabId) => void;
  label: string;
}) {
  const t = useT();
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  function handleKeyDown(
    e: ReactKeyboardEvent<HTMLButtonElement>,
    idx: number,
  ) {
    if (!["ArrowUp", "ArrowDown", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    let next = idx;
    if (e.key === "ArrowUp") next = idx - 1;
    else if (e.key === "ArrowDown") next = idx + 1;
    else if (e.key === "Home") next = 0;
    else next = tabs.length - 1;
    const def = tabs[(next + tabs.length) % tabs.length];
    if (!def) return;
    onSelect(def.id);
    buttonRefs.current[def.id]?.focus();
  }

  return (
    <div
      role="tablist"
      aria-orientation="vertical"
      aria-label={label}
      className="hidden w-44 shrink-0 flex-col gap-0.5 overflow-y-auto overscroll-contain border-r border-line bg-surface-3 p-2 sm:flex"
    >
      {tabs.map((d, idx) => {
        const Icon = d.icon;
        const active = d.id === activeTab;
        return (
          <button
            key={d.id}
            ref={(el) => {
              buttonRefs.current[d.id] = el;
            }}
            type="button"
            role="tab"
            id={`settings-tab-${d.id}`}
            aria-controls={`settings-tabpanel-${d.id}`}
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onSelect(d.id)}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            className={`flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-sm ${
              active
                ? "bg-accent/15 font-bold text-accent"
                : "text-fg hover:bg-surface-2"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            <span>{t(d.labelKey)}</span>
          </button>
        );
      })}
    </div>
  );
}

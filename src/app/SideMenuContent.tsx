// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useRef, useState, type ReactNode } from "react";

import {
  CogIcon,
  ConfirmDialog,
  ExternalLinkIcon,
  FolderIcon,
  HeartIcon,
  FloatingPanel,
  HelpCircleIcon,
  InlineEditRow,
  PencilIcon,
  PlusIcon,
  RedoIcon,
  RowActionMenu,
  SearchIcon,
  SparklesIcon,
  SwipeableRow,
  TrashIcon,
  UndoIcon,
  type FloatingPlacement,
} from "@niclaslindstedt/oss-framework/components";
import { useLocalStorageState } from "@niclaslindstedt/oss-framework/hooks";
import {
  NamespaceSwitcher,
  type Namespace,
} from "@niclaslindstedt/oss-framework/namespaces";
import { CollapseRail } from "@niclaslindstedt/oss-framework/sidebar";
import {
  CheckForUpdatesItem,
  type PwaUpdateCheckResult,
} from "@niclaslindstedt/oss-framework/pwa";

import {
  PLAIN_TEXT_KEYBOARD_PROPS,
  primeSoftKeyboard,
} from "../generic/softKeyboard.ts";
import { RulesIcon } from "./icons.tsx";
import { useT } from "./i18n/index.ts";
import type { Project } from "./types.ts";
import type { MaskStore } from "./useMaskStore.ts";

// The navigation drawer's content — what the framework `Sidebar` shell
// frames: the workspace switcher, the project list, the action grid, and the
// footer. The app owns this; the framework owns only the docked / drawer
// framing around it.

const ABOUT_PLACEMENT: FloatingPlacement = {
  width: { kind: "min", minPx: 200 },
  anchor: "left",
  coordinateSpace: "viewport",
};

const SOURCE_URL = "https://github.com/niclaslindstedt/mask";
const DONATE_URL = import.meta.env.VITE_DONATE_URL ?? "";
const BUILD_LABEL = `v${__BUILD_LABEL__}`;

export type View = "project" | "rules";

type Props = {
  store: MaskStore;
  activeNamespace: Namespace;
  namespaces: Namespace[];
  onSwitchNamespace: (slug: string) => void;
  onOpenNamespaces: () => void;
  onOpenSettings: () => void;
  onOpenSearch: () => void;
  onOpenChangelog: () => void;
  /** After a project pick / creation: show the project view, close the drawer. */
  onNavigate: () => void;
  view: View;
  onShowRules: () => void;
  checkingUpdate: boolean;
  updateAvailable: boolean;
  onCheckUpdate: () => Promise<PwaUpdateCheckResult>;
};

export function SideMenuContent({
  store,
  activeNamespace,
  namespaces,
  onSwitchNamespace,
  onOpenNamespaces,
  onOpenSettings,
  onOpenSearch,
  onOpenChangelog,
  onNavigate,
  view,
  onShowRules,
  checkingUpdate,
  updateAvailable,
  onCheckUpdate,
}: Props) {
  const t = useT();
  const {
    data,
    addProject,
    renameProject,
    deleteProject,
    setActiveProject,
    undo,
    redo,
    canUndo,
    canRedo,
  } = store;
  const [creating, setCreating] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Project | null>(null);
  const [aboutOpen, setAboutOpen] = useState(false);
  const aboutRef = useRef<HTMLButtonElement>(null);
  // The footer (Donate / About / update / Settings) can be folded away with
  // the thin chevron rail above it, freeing the space for the project list.
  // The choice is remembered across reloads and applies on every viewport —
  // the phone drawer offers the same collapse control.
  const [footerCollapsed, setFooterCollapsed] = useLocalStorageState(
    "mask:footer-collapsed",
    false,
  );

  function pick(id: string) {
    setActiveProject(id);
    onNavigate();
  }

  // The name row mounts focused, but that focus lands an effect later — too
  // late for a mobile keyboard, which only opens inside the tap itself.
  function startCreating() {
    primeSoftKeyboard();
    setCreating(true);
  }

  function startRenaming(id: string) {
    primeSoftKeyboard();
    setRenamingId(id);
  }

  function renderProject(project: Project) {
    const active = view === "project" && project.id === data.activeProjectId;
    if (renamingId === project.id) {
      return (
        <InlineEditRow
          key={project.id}
          initial={project.name}
          placeholder={t("menu.projectName")}
          onCommit={(name) => {
            renameProject(project.id, name);
            setRenamingId(null);
          }}
          onCancel={() => setRenamingId(null)}
          className="gap-3 pr-2 pl-5"
          icon={<FolderIcon className="h-5 w-5" />}
          iconClassName="text-muted"
          inputProps={PLAIN_TEXT_KEYBOARD_PROPS}
        />
      );
    }
    const renameAction = {
      label: t("menu.renameProject"),
      icon: <PencilIcon className="h-5 w-5" />,
      onSelect: () => startRenaming(project.id),
    };
    const deleteAction = {
      label: t("menu.deleteProject"),
      icon: <TrashIcon className="h-5 w-5" />,
      danger: true,
      onSelect: () => setDeleting(project),
    };
    return (
      <div key={project.id} data-drawer-swipe-ignore>
        <RowActionMenu
          ariaLabel={t("menu.projectActions")}
          actions={[renameAction, deleteAction]}
        >
          <SwipeableRow actions={[renameAction, deleteAction]}>
            <NavRow
              active={active}
              icon={<FolderIcon className="h-5 w-5" />}
              onClick={() => pick(project.id)}
            >
              <span className="flex-1 truncate">{project.name}</span>
              <RowBadge value={project.documents.length} />
            </NavRow>
          </SwipeableRow>
        </RowActionMenu>
      </div>
    );
  }

  return (
    // The framework panel reserves a bottom safe-area inset as padding so its
    // last child clears the home indicator — but this PWA is embedded above the
    // safe area, so that inset is just dead space below whatever sits last (the
    // collapse rail when folded, the footer when not). We grow past the panel's
    // content box to reclaim that inset and hand it to the scrolling list, then
    // let the footer / rail carry their own (inset-free) bottom breathing room.
    <div className="flex shrink-0 flex-col select-none [height:calc(100%+max(env(safe-area-inset-bottom),calc(1.25rem-var(--density-row-py))))]">
      <NamespaceSwitcher
        namespaces={namespaces}
        activeNamespace={activeNamespace.slug}
        onSwitch={(slug) => {
          onSwitchNamespace(slug);
          onNavigate();
        }}
        onManage={onOpenNamespaces}
        labels={{
          heading: t("menu.namespaces"),
          manage: t("namespaces.open"),
          switchTo: (name) => t("menu.switchToNamespace", { name }),
          expand: t("menu.showNamespaces"),
          collapse: t("menu.hideNamespaces"),
        }}
      />

      <div className="flex items-center justify-between gap-2 border-t border-line px-5 pt-3 pb-1">
        <span className="text-xs font-semibold tracking-wide text-muted uppercase">
          {t("menu.projects")}
        </span>
        <button
          type="button"
          onClick={startCreating}
          aria-label={t("menu.newProject")}
          className="-mr-1 flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded text-muted hover:bg-surface-2 hover:text-fg-bright"
        >
          <PlusIcon className="h-4 w-4" />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {creating && (
          <InlineEditRow
            initial=""
            placeholder={t("menu.projectName")}
            onCommit={(name) => {
              const id = addProject(name);
              setCreating(false);
              if (id) onNavigate();
            }}
            onCancel={() => setCreating(false)}
            className="gap-3 pr-2 pl-5"
            icon={<FolderIcon className="h-5 w-5" />}
            iconClassName="text-muted"
            inputProps={PLAIN_TEXT_KEYBOARD_PROPS}
          />
        )}
        {data.projects.map(renderProject)}
        {data.projects.length === 0 && !creating && (
          <p className="px-5 py-3 text-xs text-muted">{t("empty.title")}</p>
        )}
      </div>

      <div className="shrink-0 px-3 pt-2 pb-3">
        <div className="divide-y divide-line overflow-hidden rounded-md border border-line">
          <div className="flex divide-x divide-line">
            <BarButton label={t("menu.newProject")} onClick={startCreating}>
              <PlusIcon className="h-5 w-5" />
            </BarButton>
            <BarButton
              label={t("menu.rules")}
              onClick={onShowRules}
              current={view === "rules"}
            >
              <RulesIcon className="h-5 w-5" />
            </BarButton>
            <BarButton label={t("menu.search")} onClick={onOpenSearch}>
              <SearchIcon className="h-5 w-5" />
            </BarButton>
          </div>
          <div className="flex divide-x divide-line">
            <BarButton
              label={t("menu.undo")}
              disabled={!canUndo}
              onClick={undo}
            >
              <UndoIcon className="h-5 w-5" />
            </BarButton>
            <BarButton
              label={t("menu.redo")}
              disabled={!canRedo}
              onClick={redo}
            >
              <RedoIcon className="h-5 w-5" />
            </BarButton>
          </div>
        </div>
      </div>

      {/* Footer collapse rail. A thin, full-width chevron button seated just
          above the footer that folds it away (and back), so the project list
          can claim the freed vertical space. Offered on every viewport,
          including the phone drawer. */}
      <CollapseRail
        collapsed={footerCollapsed}
        label={
          footerCollapsed ? t("menu.expandFooter") : t("menu.collapseFooter")
        }
        onClick={() => setFooterCollapsed((v) => !v)}
      />

      {/* Footer — fixed, and foldable away via the rail above. The PWA paints
          fullscreen (no bottom safe-area inset lifting the panel), so Settings
          would otherwise sit right on the screen's edge: the bottom breathing
          room carries an extra 10px to keep the last row a comfortable reach
          for the thumb. */}
      {!footerCollapsed && (
        <div className="flex shrink-0 flex-col border-t border-line [padding-top:calc(1.25rem-var(--density-row-py))] [padding-bottom:calc(1.25rem-var(--density-row-py)+10px)]">
          {DONATE_URL && (
            <FooterLink
              icon={<HeartIcon className="h-5 w-5 text-danger" />}
              href={DONATE_URL}
              external
            >
              Donate
            </FooterLink>
          )}
          <button
            ref={aboutRef}
            type="button"
            aria-haspopup="menu"
            aria-expanded={aboutOpen}
            onClick={() => setAboutOpen((v) => !v)}
            className="flex w-full cursor-pointer items-center gap-3 px-5 py-[var(--density-row-py)] text-left text-sm text-fg hover:bg-surface-2 hover:text-fg-bright"
          >
            <span className="text-muted">
              <HelpCircleIcon className="h-5 w-5" />
            </span>
            <span className="flex-1">{t("menu.about")}</span>
          </button>
          <CheckForUpdatesItem
            checking={checkingUpdate}
            updateAvailable={updateAvailable}
            onCheck={onCheckUpdate}
            labels={{
              idle: t("menu.checkUpdates"),
              checking: t("menu.checkingUpdates"),
              upToDate: t("menu.upToDate"),
              updateAvailable: t("menu.updateAvailable"),
              unavailable: t("menu.updatesUnavailable"),
            }}
          />
          <FooterRow
            icon={<CogIcon className="h-5 w-5" />}
            onClick={onOpenSettings}
          >
            {t("menu.settings")}
          </FooterRow>
        </div>
      )}

      <FloatingPanel
        open={aboutOpen}
        onClose={() => setAboutOpen(false)}
        triggerRef={aboutRef}
        placement={ABOUT_PLACEMENT}
        className="py-1"
      >
        <FooterRow
          icon={<SparklesIcon className="h-5 w-5" />}
          onClick={() => {
            setAboutOpen(false);
            onOpenChangelog();
          }}
        >
          {t("menu.whatsNew")}
        </FooterRow>
        <FooterLink
          icon={<ExternalLinkIcon className="h-5 w-5" />}
          href={SOURCE_URL}
          sublabel={BUILD_LABEL}
          external
          onClick={() => setAboutOpen(false)}
        >
          {t("menu.source")}
        </FooterLink>
      </FloatingPanel>

      <ConfirmDialog
        open={deleting !== null}
        title={t("menu.deleteProjectTitle")}
        description={t("menu.deleteProjectBody", {
          name: deleting?.name ?? "",
        })}
        confirmLabel={t("common.delete")}
        tone="danger"
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) deleteProject(deleting.id);
          setDeleting(null);
        }}
        labels={{ close: t("common.close"), cancel: t("common.cancel") }}
      />
    </div>
  );
}

// --- rows ------------------------------------------------------------------

function NavRow({
  children,
  icon,
  active,
  onClick,
}: {
  children: ReactNode;
  icon: ReactNode;
  active?: boolean;
  onClick?: () => void;
}) {
  const state = active
    ? "bg-accent/20 font-semibold text-fg-bright shadow-[inset_3px_0_0_var(--color-accent)]"
    : "text-fg hover:bg-surface-2 hover:text-fg-bright";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full cursor-pointer items-center gap-3 py-[var(--density-row-py)] pr-5 pl-5 text-left text-sm ${state}`}
    >
      <span className={`shrink-0 ${active ? "text-accent" : "text-muted"}`}>
        {icon}
      </span>
      {children}
    </button>
  );
}

function RowBadge({ value }: { value: number }) {
  if (value <= 0) return null;
  return (
    <span className="shrink-0 rounded-full bg-surface-3 px-2 py-0.5 text-xs text-muted tabular-nums">
      {value}
    </span>
  );
}

function BarButton({
  children,
  label,
  disabled,
  onClick,
  current,
}: {
  children: ReactNode;
  label: string;
  disabled?: boolean;
  onClick?: () => void;
  current?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={current}
      disabled={disabled}
      onClick={onClick}
      className={`island-button relative flex flex-1 items-center justify-center py-2.5 transition-colors ${
        disabled
          ? "cursor-not-allowed text-muted opacity-40"
          : "cursor-pointer text-fg hover:bg-surface-2 hover:text-fg-bright"
      } ${current ? "bg-accent/20 text-fg-bright" : ""}`}
    >
      <span className={current ? "text-fg-bright" : "text-muted"}>
        {children}
      </span>
    </button>
  );
}

function FooterRow({
  children,
  icon,
  onClick,
}: {
  children: ReactNode;
  icon: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full cursor-pointer items-center gap-3 px-5 py-[var(--density-row-py)] text-left text-sm text-fg hover:bg-surface-2 hover:text-fg-bright"
    >
      <span className="text-muted">{icon}</span>
      <span className="flex-1">{children}</span>
    </button>
  );
}

function FooterLink({
  children,
  icon,
  href,
  sublabel,
  external,
  onClick,
}: {
  children: ReactNode;
  icon: ReactNode;
  href: string;
  sublabel?: string;
  external?: boolean;
  onClick?: () => void;
}) {
  return (
    <a
      href={href}
      onClick={onClick}
      {...(external ? { target: "_blank", rel: "noreferrer noopener" } : {})}
      className="flex w-full cursor-pointer items-center gap-3 px-5 py-[var(--density-row-py)] text-left text-sm text-fg hover:bg-surface-2 hover:text-fg-bright"
    >
      <span className="text-muted">{icon}</span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate">{children}</span>
        {sublabel && (
          <span className="truncate text-xs text-muted">{sublabel}</span>
        )}
      </span>
      {external && <ExternalLinkIcon className="h-4 w-4 shrink-0 text-muted" />}
    </a>
  );
}

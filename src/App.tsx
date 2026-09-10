// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { Suspense, lazy, useEffect, useMemo, useState } from "react";

import {
  useApplyTheme,
  type ThemeAppearance,
} from "@niclaslindstedt/oss-framework/theme";
import {
  Sidebar,
  useEdgeSwipeOpen,
  usePersistentMenuPosition,
  useSidebarInset,
} from "@niclaslindstedt/oss-framework/sidebar";
import {
  SpinnerIcon,
  ToastViewport,
  defaultToastStore,
} from "@niclaslindstedt/oss-framework/components";
import { UpdateToast, usePwaUpdate } from "@niclaslindstedt/oss-framework/pwa";
import {
  useMediaQuery,
  useSearchShortcuts,
  useUndoRedoShortcuts,
} from "@niclaslindstedt/oss-framework/hooks";
import {
  NamespacesModal,
  applyFaviconHref,
  namespaceFaviconHref,
} from "@niclaslindstedt/oss-framework/namespaces";

import { EmptyScreen } from "./app/EmptyScreen.tsx";
import { seedBackends, useDevSeed } from "./app/dev/useDevSeed.ts";
import { ProjectScreen } from "./app/ProjectScreen.tsx";
import { RulesScreen } from "./app/RulesScreen.tsx";
import { SearchOverlay } from "./app/SearchOverlay.tsx";
import { SideMenuContent, type View } from "./app/SideMenuContent.tsx";
import { useT } from "./app/i18n/index.ts";
import { APP_LOOK } from "./app/look.ts";
import { logStore } from "./app/log.ts";
import { cacheIdForBase } from "./app/pwa.ts";
import { useAppSettings } from "./app/useAppSettings.ts";
import { useCustomKinds } from "./app/useCustomKinds.ts";
import { localDocBackend, useMaskStore } from "./app/useMaskStore.ts";
import { useNamespaces } from "./app/useNamespaces.ts";
import { useRules } from "./app/useRules.ts";
import { status } from "./output.ts";

// The dialogs that aren't on the first paint load on demand.
const SettingsModal = lazy(() =>
  import("./app/SettingsModal.tsx").then((m) => ({ default: m.SettingsModal })),
);
const ChangelogModal = lazy(() =>
  Promise.all([
    import("@niclaslindstedt/oss-framework/changelog"),
    import("./app/changelog.ts"),
  ]).then(([fw, data]) => ({
    default: (props: {
      open: boolean;
      onClose: () => void;
      labels: { heading: string; empty: string; close: string; back: string };
    }) => (
      <fw.ChangelogModal
        {...props}
        releases={data.RELEASES}
        featureDocs={data.FEATURE_DOCS}
      />
    ),
  })),
);

// A local-first masking PWA built from the framework's shared surface. The
// framework `Sidebar` frames the navigation; the app owns the project store,
// the rules, the screens, and its tabbed Settings dialog.
export function App() {
  const t = useT();
  const [appearance, setAppearance] = useState<ThemeAppearance>(APP_LOOK);
  useApplyTheme(appearance);

  const ns = useNamespaces();
  // The Developer tab's "Test data" toggle: while it is on, an in-memory
  // backend full of sample projects replaces the real localStorage one, so a
  // developer can poke at a populated app without touching their own projects
  // (see `useDevSeed`).
  const devSeed = useDevSeed();
  const backend = useMemo(() => {
    const dev = seedBackends();
    if (dev && devSeed.testData) return dev.createTestDataBackend();
    return localDocBackend;
  }, [devSeed.testData]);
  const store = useMaskStore(ns.activeSlug, backend);
  const rules = useRules();
  // The user's own placeholder types: the global list plus this workspace's.
  const kinds = useCustomKinds(ns.activeSlug);
  const { settings, setSettings } = useAppSettings();
  const [view, setView] = useState<View>("project");
  const [namespacesOpen, setNamespacesOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchSeed, setSearchSeed] = useState("");
  const [changelogOpen, setChangelogOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [reloading, setReloading] = useState(false);

  const pinned = useMediaQuery("(min-width: 768px)");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [position, setPosition] =
    usePersistentMenuPosition("mask:menu-position");

  const pwa = usePwaUpdate({
    base: import.meta.env.BASE_URL,
    cacheId: cacheIdForBase(import.meta.env.BASE_URL),
    enabled: !import.meta.env.DEV,
  });

  const swipeToOpen = !pinned && settings.menuMode === "swipe";
  useEdgeSwipeOpen({
    side: position.side,
    enabled: swipeToOpen && !drawerOpen,
    onOpen: () => setDrawerOpen(true),
  });
  useSidebarInset(pinned, position.side);

  useUndoRedoShortcuts({
    canUndo: store.canUndo,
    canRedo: store.canRedo,
    onUndo: store.undo,
    onRedo: store.redo,
    enabled: pinned || !drawerOpen,
  });
  useSearchShortcuts({
    onOpen: (seed) => {
      setSearchSeed(seed);
      setSearchOpen(true);
    },
  });

  useEffect(() => {
    logStore.setCaptureEnabled(settings.captureLogs || settings.devMode);
  }, [settings.captureLogs, settings.devMode]);

  useEffect(() => {
    status("App started");
  }, []);

  // Re-badge the tab with the workspace's glyph; the app mark otherwise.
  const activeNamespace = ns.activeNamespace;
  useEffect(() => {
    applyFaviconHref(
      namespaceFaviconHref(
        activeNamespace,
        `${import.meta.env.BASE_URL}icons/icon.svg`,
        {
          defaultColor: "#fbbf24",
          badge: { background: "#0b0d10" },
        },
      ),
    );
  }, [activeNamespace]);

  const closeDrawer = () => {
    if (!pinned) setDrawerOpen(false);
  };
  const project = store.activeProject;

  return (
    <div className="flex h-[var(--app-height,100svh)] overflow-hidden bg-page-bg text-fg">
      <Sidebar
        pinned={pinned}
        open={drawerOpen}
        onToggle={() => setDrawerOpen((v) => !v)}
        onClose={() => setDrawerOpen(false)}
        position={position}
        onPositionChange={setPosition}
        showButton={!pinned && !swipeToOpen}
        swipeToClose
        panelScroll={false}
        labels={{
          nav: t("menu.projects"),
          open: "Open sidebar",
          close: "Close sidebar",
        }}
      >
        <SideMenuContent
          store={store}
          activeNamespace={ns.activeNamespace}
          namespaces={ns.list}
          onSwitchNamespace={(slug) => {
            ns.switchTo(slug);
            setView("project");
            closeDrawer();
          }}
          onOpenNamespaces={() => setNamespacesOpen(true)}
          onOpenSettings={() => {
            setDrawerOpen(false);
            setSettingsOpen(true);
          }}
          onOpenSearch={() => {
            setSearchSeed("");
            setSearchOpen(true);
          }}
          onOpenChangelog={() => {
            setDrawerOpen(false);
            setChangelogOpen(true);
          }}
          onNavigate={() => {
            setView("project");
            closeDrawer();
          }}
          view={view}
          onShowRules={() => {
            setView("rules");
            closeDrawer();
          }}
          checkingUpdate={pwa.checking}
          updateAvailable={pwa.needRefresh}
          onCheckUpdate={pwa.checkForUpdate}
        />
      </Sidebar>

      <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        {view === "rules" ? (
          <RulesScreen rules={rules} kinds={kinds} />
        ) : project ? (
          <ProjectScreen
            key={project.id}
            project={project}
            store={store}
            rules={rules}
            settings={settings}
            kinds={kinds}
          />
        ) : (
          <EmptyScreen
            hasProjects={store.data.projects.length > 0}
            onCreate={(name) => {
              store.addProject(name);
              setView("project");
            }}
          />
        )}
      </main>

      {settingsOpen && (
        <Suspense fallback={null}>
          <SettingsModal
            open={settingsOpen}
            onClose={() => setSettingsOpen(false)}
            appearance={appearance}
            setAppearance={setAppearance}
            settings={settings}
            commitSettings={setSettings}
            kinds={kinds}
            workspaceName={ns.activeNamespace.name}
            pwa={pwa}
          />
        </Suspense>
      )}

      <ToastViewport
        store={defaultToastStore}
        labels={{ dismiss: t("common.close") }}
        className="pointer-events-none fixed right-[var(--app-content-right,0px)] bottom-[max(1rem,env(safe-area-inset-bottom))] left-[var(--app-content-left,0px)] z-[60] flex flex-col items-center gap-2 px-4"
      />

      {pwa.needRefresh && reloading ? (
        <div
          role="status"
          aria-live="polite"
          className="fixed right-[calc(0.75rem+var(--app-content-right,0px))] bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-[calc(0.75rem+var(--app-content-left,0px))] z-[60] mx-auto flex max-w-md items-center gap-3 rounded-sm border border-line bg-surface px-3 py-2.5 text-fg shadow-md"
        >
          <SpinnerIcon className="h-5 w-5 animate-spin text-accent" />
          <span className="text-sm font-medium">{t("menu.updating")}</span>
        </div>
      ) : (
        <UpdateToast
          needRefresh={pwa.needRefresh}
          incomingVersion={pwa.incomingVersion}
          onReload={() => {
            setReloading(true);
            pwa.reload();
          }}
          onDismiss={() => pwa.dismiss()}
        />
      )}

      <NamespacesModal
        open={namespacesOpen}
        onClose={() => setNamespacesOpen(false)}
        namespaces={ns.list}
        activeNamespace={ns.activeSlug}
        onSwitch={ns.switchTo}
        onCreate={ns.create}
        onRename={ns.rename}
        onSetAppearance={ns.setAppearance}
        onRemove={ns.remove}
        labels={{
          heading: t("namespaces.heading"),
          blurb: t("namespaces.blurb"),
          newAction: t("namespaces.newAction"),
          namePlaceholder: t("namespaces.namePlaceholder"),
          nameLabel: t("namespaces.nameLabel"),
          create: t("namespaces.create"),
          nameRequired: t("namespaces.nameRequired"),
          colorLabel: t("namespaces.colorLabel"),
          glyphLabel: t("namespaces.glyphLabel"),
          glyphNone: t("namespaces.glyphNone"),
          save: t("namespaces.save"),
          cancel: t("namespaces.cancel"),
          renameAction: t("namespaces.renameAction"),
          deleteAction: t("namespaces.deleteAction"),
          delete: t("namespaces.delete"),
          deleteConfirm: (name) => t("namespaces.deleteConfirm", { name }),
          switchTo: (name) => t("namespaces.switchTo", { name }),
          defaultBadge: t("namespaces.defaultBadge"),
          close: t("common.close"),
        }}
      />

      <SearchOverlay
        open={searchOpen}
        initialQuery={searchSeed}
        onClose={() => setSearchOpen(false)}
        store={store}
        onNavigate={() => {
          setView("project");
          closeDrawer();
        }}
      />

      {changelogOpen && (
        <Suspense fallback={null}>
          <ChangelogModal
            open={changelogOpen}
            onClose={() => setChangelogOpen(false)}
            labels={{
              heading: t("changelog.heading"),
              empty: t("changelog.empty"),
              close: t("common.close"),
              back: t("changelog.back"),
            }}
          />
        </Suspense>
      )}
    </div>
  );
}

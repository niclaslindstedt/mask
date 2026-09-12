// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useCallback, useEffect, useRef, useState } from "react";

import { DEFAULT_NAMESPACE_SLUG } from "@niclaslindstedt/oss-framework/namespaces";

import type { PlaceholderStyle } from "../generic/placeholders.ts";
import { retokenForKind } from "./masking.ts";
import { emptyDoc, parseDoc, serializeDoc } from "./migrations.ts";
import type { AppData, Doc, Project, Variable } from "./types.ts";
import * as output from "../output.ts";

// The app's data store — the "store stays in the app" seam. Holds one
// namespace's document (its projects) in state, persists it through a
// `DocBackend`, and exposes the edit actions the screens drive over an undo /
// redo history. Switching namespaces hands this hook a new slug; it adopts
// that namespace's document and resets the history.
//
// Storage sits behind the backend rather than inside the store, so a different
// implementation can *take over* persistence without the store changing. Three
// exist: the default `localDocBackend` (a per-namespace localStorage key), the
// local-folder backend (`folderStorage.ts`, a `.json` file in a folder the user
// picked on this device), and the developer test-data backend (`src/app/dev/`),
// swapped in by the Developer tab's "Test data" toggle — the same seam the
// sibling contacts app uses.

/** The localStorage key prefix every namespace's document is stored under. */
export const DOC_KEY_PREFIX = "mask:doc";

/** localStorage key for a namespace's document. */
export function docKey(slug: string): string {
  return slug === DEFAULT_NAMESPACE_SLUG
    ? DOC_KEY_PREFIX
    : `${DOC_KEY_PREFIX}:${slug}`;
}

export function freshId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

/** A namespace's document as a backend handed it over. `readable` is false
 *  when stored bytes exist but couldn't be parsed — the store then keeps the
 *  blank document it was given in memory and never writes over the original. */
export type LoadedDoc = { data: AppData; readable: boolean };

/** Where a namespace's document is read from and written to. The store drives
 *  one of these; swapping it swaps storage wholesale. */
export type DocBackend = {
  readonly id: "local" | "dev" | "folder";
  /** The namespace's document, or an empty one when nothing is stored. */
  load(slug: string): LoadedDoc;
  /** Persist a namespace's document. Best effort — it must not throw. */
  save(slug: string, data: AppData): void;
};

/** The real backend: one localStorage key per namespace. */
export const localDocBackend: DocBackend = {
  id: "local",
  load(slug) {
    let raw: string | null;
    try {
      raw = localStorage.getItem(docKey(slug));
    } catch {
      return { data: emptyDoc(), readable: true };
    }
    if (!raw) return { data: emptyDoc(), readable: true };
    try {
      return { data: parseDoc(raw), readable: true };
    } catch (err) {
      // Bytes exist but can't be read (corrupt, or written by a newer build).
      // Leave them on disk — the store's persist guard never overwrites them.
      output.error(
        `Couldn't read the projects saved on this device — ${
          err instanceof Error ? err.message : String(err)
        }. The stored copy is left untouched.`,
      );
      return { data: emptyDoc(), readable: false };
    }
  },
  save(slug, data) {
    try {
      localStorage.setItem(docKey(slug), serializeDoc(data));
    } catch {
      output.error(
        "Couldn't save to this device's storage (it may be full). Your projects stay in memory for this session.",
      );
    }
  },
};

export type MaskStore = ReturnType<typeof useMaskStore>;

export function useMaskStore(
  slug: string,
  backend: DocBackend = localDocBackend,
) {
  // The slug and the backend travel *with* the document in state, so the
  // persist effect can never write one namespace's data under another's key —
  // and swapping the backend (the test-data takeover) re-adopts cleanly.
  const [state, setState] = useState(() => ({
    slug,
    backend,
    ...backend.load(slug),
  }));
  const past = useRef<AppData[]>([]);
  const future = useRef<AppData[]>([]);
  const [, bump] = useState(0);

  if (state.slug !== slug || state.backend !== backend) {
    past.current = [];
    future.current = [];
    setState({ slug, backend, ...backend.load(slug) });
  }

  const data = state.data;

  useEffect(() => {
    if (!state.readable) return;
    state.backend.save(state.slug, state.data);
  }, [state]);

  const commit = useCallback((next: (prev: AppData) => AppData) => {
    setState((prev) => {
      const nextData = next(prev.data);
      if (nextData === prev.data) return prev;
      past.current.push(prev.data);
      future.current = [];
      // Once the user edits, the document is theirs to persist.
      return { ...prev, data: nextData, readable: true };
    });
    bump((v) => v + 1);
  }, []);

  const undo = useCallback(() => {
    const prev = past.current.pop();
    if (!prev) return;
    setState((cur) => {
      future.current.push(cur.data);
      return { ...cur, data: prev };
    });
    bump((v) => v + 1);
  }, []);

  const redo = useCallback(() => {
    const next = future.current.pop();
    if (!next) return;
    setState((cur) => {
      past.current.push(cur.data);
      return { ...cur, data: next };
    });
    bump((v) => v + 1);
  }, []);

  // Navigation never enters the history.
  const setActiveProject = useCallback((id: string | null) => {
    setState((prev) =>
      prev.data.activeProjectId === id
        ? prev
        : { ...prev, data: { ...prev.data, activeProjectId: id } },
    );
  }, []);

  const patchProject = useCallback(
    (id: string, patch: (p: Project) => Project) =>
      commit((d) => ({
        ...d,
        projects: d.projects.map((p) => (p.id === id ? patch(p) : p)),
      })),
    [commit],
  );

  const addProject = useCallback(
    (name: string): string | null => {
      const title = name.trim();
      if (!title) return null;
      const id = freshId("project");
      commit((d) => ({
        activeProjectId: id,
        projects: [
          ...d.projects,
          {
            id,
            name: title,
            createdAt: new Date().toISOString(),
            documents: [],
            variables: [],
            activeDocumentId: null,
            ignored: [],
          },
        ],
      }));
      output.status(`Project created: ${title}`);
      return id;
    },
    [commit],
  );

  const renameProject = useCallback(
    (id: string, name: string) => {
      const title = name.trim();
      if (!title) return;
      patchProject(id, (p) => (p.name === title ? p : { ...p, name: title }));
    },
    [patchProject],
  );

  const deleteProject = useCallback(
    (id: string) =>
      commit((d) => {
        const projects = d.projects.filter((p) => p.id !== id);
        if (projects.length === d.projects.length) return d;
        return {
          projects,
          activeProjectId:
            d.activeProjectId === id
              ? (projects[0]?.id ?? null)
              : d.activeProjectId,
        };
      }),
    [commit],
  );

  const setProjectStyle = useCallback(
    (id: string, style: Project["style"]) =>
      patchProject(id, (p) => ({ ...p, style })),
    [patchProject],
  );

  const addDocument = useCallback(
    (projectId: string, doc: Omit<Doc, "id" | "addedAt">): string => {
      const id = freshId("doc");
      patchProject(projectId, (p) => ({
        ...p,
        documents: [
          ...p.documents,
          { ...doc, id, addedAt: new Date().toISOString() },
        ],
        activeDocumentId: id,
      }));
      output.status(`Document added: ${doc.name}`);
      return id;
    },
    [patchProject],
  );

  const removeDocument = useCallback(
    (projectId: string, docId: string) =>
      patchProject(projectId, (p) => {
        const documents = p.documents.filter((d) => d.id !== docId);
        return {
          ...p,
          documents,
          activeDocumentId:
            p.activeDocumentId === docId
              ? (documents[documents.length - 1]?.id ?? null)
              : p.activeDocumentId,
        };
      }),
    [patchProject],
  );

  const setActiveDocument = useCallback((projectId: string, docId: string) => {
    setState((prev) => ({
      ...prev,
      data: {
        ...prev.data,
        projects: prev.data.projects.map((p) =>
          p.id === projectId && p.activeDocumentId !== docId
            ? { ...p, activeDocumentId: docId }
            : p,
        ),
      },
    }));
  }, []);

  /** Record a confirmed review: the project's variables after the plan, the
   *  document's masked text, and the values the user rejected. */
  const confirmMask = useCallback(
    (
      projectId: string,
      docId: string,
      result: { variables: Variable[]; masked: string; rejected: string[] },
    ) =>
      patchProject(projectId, (p) => ({
        ...p,
        variables: result.variables,
        ignored: [...new Set([...p.ignored, ...result.rejected])],
        documents: p.documents.map((d) =>
          d.id === docId
            ? {
                ...d,
                masked: result.masked,
                confirmedAt: new Date().toISOString(),
              }
            : d,
        ),
      })),
    [patchProject],
  );

  const addVariable = useCallback(
    (projectId: string, v: Omit<Variable, "id" | "createdAt">) =>
      patchProject(projectId, (p) =>
        p.variables.some((x) => x.value === v.value || x.token === v.token)
          ? p
          : {
              ...p,
              variables: [
                ...p.variables,
                {
                  ...v,
                  id: freshId("var"),
                  createdAt: new Date().toISOString(),
                },
              ],
              ignored: p.ignored.filter((i) => i !== v.value),
            },
      ),
    [patchProject],
  );

  const updateVariable = useCallback(
    (
      projectId: string,
      id: string,
      patch: Partial<Pick<Variable, "kind" | "token" | "value">>,
    ) =>
      patchProject(projectId, (p) => ({
        ...p,
        variables: p.variables.map((v) =>
          v.id === id ? { ...v, ...patch } : v,
        ),
      })),
    [patchProject],
  );

  /** Re-type a placeholder. In a kind-based style a placeholder the app minted
   *  is renamed to match ("Anna" retyped from Name to Judge goes `NAME1` →
   *  `JUDGE1`); one the user typed keeps its name. */
  const setVariableKind = useCallback(
    (projectId: string, id: string, kind: string, style: PlaceholderStyle) =>
      patchProject(projectId, (p) => ({
        ...p,
        variables: retokenForKind(p.variables, id, kind, style),
      })),
    [patchProject],
  );

  const removeVariable = useCallback(
    (projectId: string, id: string) =>
      patchProject(projectId, (p) => ({
        ...p,
        variables: p.variables.filter((v) => v.id !== id),
      })),
    [patchProject],
  );

  const unignore = useCallback(
    (projectId: string, value: string) =>
      patchProject(projectId, (p) => ({
        ...p,
        ignored: p.ignored.filter((v) => v !== value),
      })),
    [patchProject],
  );

  return {
    data,
    activeProject:
      data.projects.find((p) => p.id === data.activeProjectId) ?? null,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
    undo,
    redo,
    setActiveProject,
    addProject,
    renameProject,
    deleteProject,
    setProjectStyle,
    addDocument,
    removeDocument,
    setActiveDocument,
    confirmMask,
    addVariable,
    updateVariable,
    setVariableKind,
    removeVariable,
    unignore,
  };
}

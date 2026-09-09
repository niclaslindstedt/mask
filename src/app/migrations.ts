// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  createMigrator,
  type Versioned,
} from "@niclaslindstedt/oss-framework/storage";

import { logStore } from "./log.ts";
import { emptyDoc, type AppData, type Project } from "./types.ts";

// The persisted-document migration chain over the framework's `createMigrator`.
// The version lives only on the bytes at rest: `AppData` stays version-free;
// the store stamps `LATEST_VERSION` when it writes and runs `migrator.migrate`
// when it reads. Bump the version and add a step whenever the on-disk shape
// changes — every shipped step stays forever.

export const LATEST_VERSION = 1;

const migrations = {
  // v0 (a document with no `version`) → v1: guarantee the two fields exist.
  0: (doc: Versioned): Versioned => ({
    ...doc,
    version: 1,
    projects: Array.isArray(doc.projects) ? doc.projects : [],
    activeProjectId:
      typeof doc.activeProjectId === "string" ? doc.activeProjectId : null,
  }),
} as const;

export const migrator = createMigrator({
  latestVersion: LATEST_VERSION,
  migrations,
  logger: logStore.createLogger("migrate"),
});

/** Narrow a migrated document back to the app's version-free model, filling
 *  any field an older project object might lack. */
export function toAppData(doc: Versioned): AppData {
  const projects = (
    Array.isArray(doc.projects) ? doc.projects : []
  ) as Project[];
  return {
    activeProjectId:
      typeof doc.activeProjectId === "string" ? doc.activeProjectId : null,
    projects: projects.map((p) => ({
      ...p,
      documents: Array.isArray(p.documents) ? p.documents : [],
      variables: Array.isArray(p.variables) ? p.variables : [],
      ignored: Array.isArray(p.ignored) ? p.ignored : [],
      activeDocumentId:
        typeof p.activeDocumentId === "string" ? p.activeDocumentId : null,
    })),
  };
}

/** Parse persisted bytes into the current model (throws on unreadable input). */
export function parseDoc(raw: string): AppData {
  return toAppData(migrator.migrate(JSON.parse(raw)).data);
}

export function serializeDoc(doc: AppData): string {
  return JSON.stringify({ version: LATEST_VERSION, ...doc });
}

export { emptyDoc };

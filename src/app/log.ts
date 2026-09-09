// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  createLogStore,
  type LogStore,
} from "@niclaslindstedt/oss-framework/logging";

// A single in-app log buffer, built on the framework's logging module. The
// Logs settings tab renders it live through the framework's `LogViewer`; the
// output module, the migrator, and the document store write into it.
export const logStore = createLogStore({ logsKey: "mask:logs" });
logStore.setEnabled(true);
logStore.setCaptureEnabled(true);

export const log = logStore.createLogger("app");

/** A read-only view over a store that hands its buffer back newest-first —
 *  the Logs tab reads it so the latest line is at the top. */
export function newestFirst(store: LogStore): LogStore {
  return {
    createLogger: (scope) => store.createLogger(scope),
    getLogs: () => store.getLogs().reverse(),
    clearLogs: () => store.clearLogs(),
    subscribeToLogs: (cb) => store.subscribeToLogs(cb),
    setCaptureEnabled: (enabled) => store.setCaptureEnabled(enabled),
    isCaptureEnabled: () => store.isCaptureEnabled(),
    setEnabled: (enabled) => store.setEnabled(enabled),
    isEnabled: () => store.isEnabled(),
  };
}

export const descendingLogStore = newestFirst(logStore);

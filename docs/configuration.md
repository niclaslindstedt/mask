# Configuration

Mask has no server and no accounts; everything it knows lives on your own
machine — in the browser's `localStorage` by default, or in a folder you pick
(see [Storage](#storage)). What can be configured splits into build-time
variables and in-app settings.

## Build-time environment

All optional. Set them as Vite env vars (`.env`, or the workflow's `env:`).

| Variable                | Purpose                                                                                                                               |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_BASE`             | Deploy base path — `/` (release), `/preview/` (main), `/branch/` (parked branch). Drives asset URLs, the PWA scope, and the cache id. |
| `VITE_PWA_IGNORE_PATHS` | Comma-separated sibling channel paths the root service worker must not claim (`/preview/,/branch/`). Only the `/` build sets it.      |
| `VITE_DONATE_URL`       | A donate link for the side-menu footer. Unset hides the row.                                                                          |

## In-app settings

Settings opens from the side-menu footer.

| Tab            | Setting                   | Effect                                                                                                                                                                     |
| -------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **General**    | Language                  | English or Swedish, applied immediately.                                                                                                                                   |
|                | Open the side menu with   | Floating button or edge swipe, on phones.                                                                                                                                  |
|                | Developer mode            | Shows the Developer tab (test data, build identity, update check, erase local data).                                                                                       |
|                | Capture logs              | Keeps the in-app log so the Logs tab shows something.                                                                                                                      |
| **Appearance** | Theme, font, density, …   | The framework's appearance picker; previews live.                                                                                                                          |
| **Masking**    | Default placeholder style | The style new projects mask in (a project can override it).                                                                                                                |
|                | Placeholder types         | Your own kinds of value (Judge, Plaintiff, Car…), offered in every kind picker. Applies immediately rather than on Save.                                                   |
|                | New types apply to        | Where the next placeholder type is saved: this workspace only (the default), or every workspace. The picker on a type's row moves it afterwards.                           |
|                | Detectors                 | Switch any of the eight built-in detectors off.                                                                                                                            |
| **Storage**    | Keep my projects          | On this device (the default) or in a folder you pick. Applies immediately rather than on Save — see [Storage](#storage).                                                   |
| **Developer**  | Test data                 | Swaps the workspace for sample projects built from `examples/`. In memory only — nothing is written, and your own projects come back when it goes off or the page reloads. |

## Storage

Settings → **Storage** decides where a workspace's projects are written. Both
choices are local; neither involves a network, an account, or a third party.

| Choice             | Where the document goes                                                                                |
| ------------------ | ------------------------------------------------------------------------------------------------------ |
| **On this device** | This browser's `localStorage` for the origin (the keys below). The default.                            |
| **In a folder**    | One JSON file per workspace inside a folder you pick on this disk, through the File System Access API. |

The folder option appears only in browsers that expose the directory picker —
Chromium-based ones (Chrome, Edge, Brave, Opera, Arc). Firefox and Safari show
only "On this device".

Inside the picked folder the default workspace is `mask.json` and every other
workspace is `mask-<slug>.json`. The files are the same JSON the
`localStorage` keys hold, so they can be read, diffed, backed up, or put under
version control.

While a folder is connected it is the storage, and the on-device copy trails
every write as a cache: the app opens instantly, keeps working when the folder
can't be reached, and has your projects waiting if you disconnect. Starting the
app re-reads the folder and adopts whatever it holds. The one moment that is
not automatic is the connect press itself — if both the folder and this device
hold projects, Mask asks which set to keep rather than choosing for you.

The browser's permission for the folder can lapse (a restart, or you revoking
it in site settings). Mask then falls back to the on-device copy and shows
**Reconnect the folder** in the Storage tab; one press re-grants it. Choosing
"On this device" again leaves the folder's files exactly where they are.

## Storage keys

For the curious (and for a manual backup via the browser's devtools):

| Key                                        | Holds                                              |
| ------------------------------------------ | -------------------------------------------------- |
| `mask:doc` / `mask:doc:<slug>`             | A workspace's projects, documents and placeholders |
| `mask:rules`                               | The global blacklist / whitelist / pattern rules   |
| `mask:kinds`                               | The placeholder types shared by every workspace    |
| `mask:kinds:ws:<slug>`                     | A workspace's own placeholder types                |
| `mask:settings`                            | The in-app settings above                          |
| `mask:storage`                             | Whether the document is kept here or in a folder   |
| `mask:namespaces`, `mask:namespace:active` | The workspace registry and the active one          |
| `mask:language`                            | The interface language                             |
| `mask:logs`                                | The captured log buffer                            |
| `mask:footer-collapsed`                    | Whether the side-menu footer is folded away        |

Two more stores sit outside `localStorage`: the IndexedDB database
`mask:sources` holds the PDFs you uploaded, keyed by document id, so the
reader can draw their pages (files whose document has been deleted are swept
at the next start), and `oss:folder-handles` holds the permission grant for a
picked folder so it survives a reload. A Word file is not kept: its pages are
typeset from the text that was read out of it, so there is nothing to store.

Settings → Developer → **Erase all local data** clears every one of them, the
IndexedDB databases included. A folder you picked is not touched — its files
stay on disk.

## The detector dictionaries

The name and locality detectors read dictionaries generated from public data
(SCB's name statistics, the Swedish tätort list) by `scripts/dictionaries/build.mjs`;
`make dictionaries` regenerates them. The thresholds — at least 100 bearers
for a name — and the word-likeness filter are documented at the top of that
script.

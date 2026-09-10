# Configuration

Mask has no server and no accounts; everything it knows lives in the browser's
`localStorage`. What can be configured splits into build-time variables and
in-app settings.

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
|                | Detectors                 | Switch any of the eight built-in detectors off.                                                                                                                            |
| **Developer**  | Test data                 | Swaps the workspace for sample projects built from `examples/`. In memory only — nothing is written, and your own projects come back when it goes off or the page reloads. |

## Storage keys

For the curious (and for a manual backup via the browser's devtools):

| Key                                        | Holds                                              |
| ------------------------------------------ | -------------------------------------------------- |
| `mask:doc` / `mask:doc:<slug>`             | A workspace's projects, documents and placeholders |
| `mask:rules`                               | The global always / never / pattern rules          |
| `mask:settings`                            | The in-app settings above                          |
| `mask:namespaces`, `mask:namespace:active` | The workspace registry and the active one          |
| `mask:language`                            | The interface language                             |
| `mask:logs`                                | The captured log buffer                            |
| `mask:footer-collapsed`                    | Whether the side-menu footer is folded away        |

Settings → Developer → **Erase all local data** clears every one of them.

## The detector dictionaries

The name and locality detectors read dictionaries generated from public data
(SCB's name statistics, the Swedish tätort list) by `scripts/dictionaries/build.mjs`;
`make dictionaries` regenerates them. The thresholds — at least 100 bearers
for a name — and the word-likeness filter are documented at the top of that
script.

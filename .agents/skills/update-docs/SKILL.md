---
name: update-docs
description: "Use when files under docs/ may be stale. Discovers commits since the last docs update, maps changed source files to affected conceptual documentation, and brings docs/*.md back into sync with the implementation."
---

# Updating the docs

**Governing spec sections:** §11.1 (`docs/` — getting started, configuration, architecture, troubleshooting), §21.5.

`docs/` is the conceptual documentation: how to use the app, what can be configured, how it is built, and what to do when it misbehaves. `docs/features/` is different — each file there is the read-more half of a changelog bullet, linked by a `doc:` slug in a `.changes/unreleased/` fragment; it is maintained with the feature, not by this skill.

## Tracking mechanism

`.agents/skills/update-docs/.last-updated` contains the git commit hash from the last successful run. Empty means "never run" — fall back to the repository's initial commit.

## Discovery process

1. Read the baseline:

   ```sh
   BASELINE=$(cat .agents/skills/update-docs/.last-updated)
   ```

2. List commits and changed files since the baseline:

   ```sh
   git log --oneline "$BASELINE"..HEAD
   git diff --name-only "$BASELINE"..HEAD -- src scripts pwa-plugin.ts vite.config.ts package.json
   ```

3. Categorize the changes with the mapping table below and read each affected doc in full before editing.

## Mapping table

| Changed files / scope                                                       | Doc(s) to update                                     |
| --------------------------------------------------------------------------- | ---------------------------------------------------- |
| `src/app/*Screen.tsx`, `*Tab.tsx`, `ReviewPanel.tsx`, `SideMenuContent.tsx` | `getting-started.md`                                 |
| `src/generic/placeholders.ts`                                               | `getting-started.md` (styles table)                  |
| `src/app/useAppSettings.ts`, `src/app/settings/tabs.tsx`                    | `configuration.md` (In-app settings)                 |
| `vite.config.ts`, `src/vite-env.d.ts`, `.github/workflows/pages.yml`        | `configuration.md` (Build-time environment)          |
| `src/app/use*.ts` storage keys, `src/app/i18n/index.ts`, `src/app/log.ts`   | `configuration.md` (Storage keys)                    |
| `scripts/dictionaries/build.mjs`, `src/app/detectors/dictionaries.ts`       | `configuration.md` (dictionaries), `architecture.md` |
| `src/app/masking.ts`, `src/app/detectors/**`, `src/generic/**`              | `architecture.md` (layers, pipeline)                 |
| `src/App.tsx` lazy imports, `pwa-plugin.ts`, `src/app/pwa.ts`               | `architecture.md` (What loads when, PWA)             |
| Anything that adds a failure mode a user can hit                            | `troubleshooting.md`                                 |

## Update checklist

- [ ] Read the baseline and diff
- [ ] Walk the mapping table; edit every affected doc
- [ ] Keep cross-links between docs and from `README.md` resolving
- [ ] `make fmt-check` (Prettier formats Markdown too)
- [ ] Write the new baseline:

      git rev-parse HEAD > .agents/skills/update-docs/.last-updated

## Verification

1. Every claim in an edited doc matches the code it describes (open the file named in the mapping table).
2. Every relative link in `docs/` resolves.
3. `.last-updated` was rewritten with the new `HEAD`.

## Skill self-improvement

1. **Grow the mapping table** whenever a source file turns out to feed a doc that is not listed.
2. **Record recurring edits** as patterns here.
3. **Commit the skill edit** with the docs edit.

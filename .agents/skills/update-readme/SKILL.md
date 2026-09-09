---
name: update-readme
description: "Use when README.md may be stale. Discovers commits since the last README update, identifies what user-facing surfaces changed, and brings README.md back into sync."
---

# Updating the README

**Governing spec sections:** §3 (`README.md` — required sections and content), §21.5 (this skill is mandated because `README.md` is a drift-prone artifact).

`README.md` is the primary user-facing documentation for mask. Per §3 of `OSS_SPEC.md` it must cover What / Why / Prerequisites / Install / Quick start / Usage / Configuration / Examples / Troubleshooting / Documentation / Contributing / License. It goes stale whenever a screen, a setting, a detector, a placeholder style, or a build variable changes without a matching edit.

## Tracking mechanism

`.agents/skills/update-readme/.last-updated` contains the git commit hash from the last successful run. Empty means "never run" — fall back to the initial commit of the repository.

## Discovery process

1. Read the baseline:

   ```sh
   BASELINE=$(cat .agents/skills/update-readme/.last-updated)
   ```

2. List commits since the baseline:

   ```sh
   git log --oneline "$BASELINE"..HEAD
   ```

3. List changed files:

   ```sh
   git diff --name-only "$BASELINE"..HEAD
   ```

4. Categorize the changes using the mapping table below.

5. Read the current `README.md` so you can preserve voice and unrelated sections while editing.

## Mapping table

| Changed files / scope                                              | README section(s) to update                                |
| ------------------------------------------------------------------ | ---------------------------------------------------------- |
| `src/app/*Screen.tsx`, `*Tab.tsx`, `ReviewPanel.tsx`               | **Usage**                                                  |
| `src/generic/placeholders.ts`                                      | **Usage → Placeholder styles**                             |
| `src/app/detectors/**`, `scripts/dictionaries/build.mjs`           | **Why?** (detector claims), **License** (data attribution) |
| `src/app/useAppSettings.ts`, `vite.config.ts`, `src/vite-env.d.ts` | **Configuration** table                                    |
| `examples/**`                                                      | **Examples**                                               |
| `docs/troubleshooting.md`                                          | **Troubleshooting** bullets                                |
| `package.json` scripts, `.nvmrc`, `.npmrc`                         | **Prerequisites**, **Install**, **Quick start**            |
| `.github/workflows/*.yml`                                          | Badge row                                                  |
| `LICENSE`                                                          | **License** section, badge                                 |

Extend this table every time you find a new source-of-truth file that feeds the README.

## Update checklist

- [ ] Read baseline from `.last-updated` and run `git log` / `git diff --name-only`
- [ ] Read the current `README.md`
- [ ] Walk the mapping table and update each affected section
- [ ] Verify every shell example is still syntactically valid
- [ ] Run `make test` and `bash scripts/validate.sh .` from the oss-spec repo (or `oss-spec validate .`)
- [ ] Write the new baseline:

      git rev-parse HEAD > .agents/skills/update-readme/.last-updated

## Verification

1. Re-read every edited section against the corresponding source of truth.
2. The twelve §3 sections are present, in order.
3. Confirm `.last-updated` was rewritten with the new `HEAD`.

## Skill self-improvement

After a run, improve this file in place:

1. **Grow the mapping table** with any new source → README relationship you discovered.
2. **Record patterns** for recurring edits.
3. **Commit the skill edit** together with the README edit so the knowledge compounds.

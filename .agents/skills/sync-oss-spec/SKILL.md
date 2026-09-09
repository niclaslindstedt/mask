---
name: sync-oss-spec
description: "Use when the repository may have drifted out of conformance with OSS_SPEC.md. Runs the conformance validator, walks the violations, and fixes each one until the repo is back in sync."
---

# Syncing the repo with OSS_SPEC.md

`OSS_SPEC.md` at the repository root is the specification this repo claims to conform to. This skill runs the validator against the repo, inspects each violation, and brings the contents back into conformance — missing files, broken symlinks, stale workflows, a skill without its tracking file.

## Tracking mechanism

`.agents/skills/sync-oss-spec/.last-updated` contains the git commit hash of the last successful run. Empty means "never run" — use the repo's initial commit (`git rev-list --max-parents=0 HEAD`) as the baseline.

## Discovery process

1. Read the baseline and check whether the spec copy changed since:

   ```sh
   BASELINE=$(cat .agents/skills/sync-oss-spec/.last-updated)
   git log --oneline "$BASELINE"..HEAD -- OSS_SPEC.md .github .agents
   ```

2. Run the validator. The `oss-spec` binary is preferred; where it (and cargo) is unavailable, the standalone bash mirror from the oss-spec repo runs the same deterministic checks and prints the qualitative checklist at the end:

   ```sh
   oss-spec validate .                                                                        # binary
   curl -fsSL https://raw.githubusercontent.com/niclaslindstedt/oss-spec/main/scripts/validate.sh | bash -s -- .   # fallback
   ```

   Each structural violation names the spec section (`§7.1`, `§10`, `§21.5`) and the file or directory at fault.

3. For each violation, read the relevant section of `OSS_SPEC.md` so the fix matches the spec's intent rather than just silencing the check.

## Mapping table

| Violation spec section                                      | Where to fix it                                                                                           |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| §2 / §4 / §5 / §6 missing governance file                   | Create `LICENSE` / `CONTRIBUTING.md` / `CODE_OF_CONDUCT.md` / `SECURITY.md` per the section               |
| §7.1 tool-specific guidance file is not a symlink           | `ln -sfn AGENTS.md <path>` (`ln -sfn ../AGENTS.md .github/copilot-instructions.md`)                       |
| §8.4 missing `CHANGELOG.md`                                 | Restore the Keep-a-Changelog header; never hand-author released sections                                  |
| §9 Makefile target missing                                  | Add the target to `Makefile`, mapping to the npm script                                                   |
| §10 / §11.3.10 missing workflow                             | Create `.github/workflows/<file>.yml`; mirror the sibling `contacts` repo's                               |
| §10.5 `.nvmrc` vs `ci.yml` node-version mismatch            | Pin both to the same major                                                                                |
| §11.3 SEO scaffolding incomplete                            | `index.html` head tags, `public/{robots.txt,sitemap.xml,llms.txt}`, `scripts/check-seo.mjs`               |
| §11.4 PWA shape incomplete                                  | `pwa-plugin.ts` (manifest fields, SW), `index.html`, `.github/lighthouse/lighthouserc.json`, `make icons` |
| §13.5 `prompts/<name>/` has no versioned file               | Add `prompts/<name>/1_0_0.md` with front matter and `## System` / `## User`                               |
| §15 missing issue / PR templates                            | `.github/ISSUE_TEMPLATE/*`, `.github/PULL_REQUEST_TEMPLATE.md`, `.github/dependabot.yml`                  |
| §19.4 missing central output module                         | `src/output.ts` with `status / info / warn / error / header`                                              |
| §20.2 test file stem does not end with `_test`              | Rename the file                                                                                           |
| §20.5 source file over 1000 lines                           | Split by concern; `src/app/detectors/data/*.ts` are generated and exempt via the marker comment           |
| §21.2 `.claude/skills` is not a symlink                     | `ln -sfn ../.agents/skills .claude/skills`                                                                |
| §21.3 / §21.4 SKILL.md structure or `.last-updated` missing | Fix the front matter / sections; `git rev-parse HEAD > .agents/skills/<skill>/.last-updated`              |
| §21.5 / §21.6 missing `update-*` skill or registry row      | Create the skill; add its row to `maintenance/SKILL.md`                                                   |

## Update checklist

- [ ] Read the baseline
- [ ] Run the validator and record every structural violation
- [ ] Walk the qualitative checklist the validator prints and record every finding worth acting on
- [ ] Fix each violation at its source using the mapping table
- [ ] Re-run the validator — it must report no structural violations
- [ ] Run `make fmt`, `make lint`, `make test`, `make build`
- [ ] Write the new baseline:

      git rev-parse HEAD > .agents/skills/sync-oss-spec/.last-updated

## Verification

1. The validator reports "Structural violations: none".
2. `make lint`, `make test`, and `make build` pass.
3. Every violation present before this run has a matching edit in the diff — none was silenced by loosening a check.
4. `.last-updated` was rewritten with the current `HEAD`.

## Skill self-improvement

1. **Grow the mapping table** whenever a new §X.Y section starts producing violations the table does not cover.
2. **Record fix recipes** for violations that took more than a one-line change.
3. **Flag recurring drift** — if the same violation keeps coming back, a CI check or another skill's mapping table is missing a row; fix the cause.
4. **Commit the skill edit** alongside the repo fixes.

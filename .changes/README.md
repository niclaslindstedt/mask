# `.changes/` — changeset fragments

Every user-visible change lands with a fragment in `unreleased/`, named
`<unix-timestamp>-<slug>.md`:

```
---
type: Added         # Added | Changed | Fixed | Removed | Security | Deprecated
title: Short title  # optional — bolded at the head of the bullet
doc: masking        # optional — the slug of a docs/features/<slug>.md feature doc
breaking: true      # optional — forces a major bump
---

One sentence users will read in the changelog.
```

CI's `changeset` job fails a PR that touches user-visible code without one
(pure refactors, CI, and docs-only edits pass via the skip-list in
`scripts/release/check-changeset.mjs`; or label the PR `no-changelog`). The
`version-bump` workflow derives the semver bump from the fragments'
front-matter, collates them into a dated `CHANGELOG.md` section, and deletes
them. `make bump` prints the implied bump; `make changelog VERSION=X.Y.Z`
previews the section.

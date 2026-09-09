// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The app's "What's new" data. The framework's `changelog` module owns the
// parsing and the dialog; pulling the markdown into the bundle is the one
// bundler-specific bit it leaves to the app: Vite's `?raw` for the CHANGELOG
// and an eager `import.meta.glob` for the feature docs `[Learn more]` opens.
import {
  buildFeatureDocs,
  parseChangelog,
} from "@niclaslindstedt/oss-framework/changelog";

import changelogMd from "../../CHANGELOG.md?raw";

export const RELEASES = parseChangelog(changelogMd);

export const FEATURE_DOCS = buildFeatureDocs(
  import.meta.glob("../../docs/features/*.md", {
    query: "?raw",
    import: "default",
    eager: true,
  }),
);

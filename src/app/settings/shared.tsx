// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { SegmentedControl } from "@niclaslindstedt/oss-framework/components";

import { log } from "../log.ts";
import { setLanguage, useLang } from "../i18n/index.ts";

// The language picker wraps the framework's `SegmentedControl`. Language is
// owned by the framework i18n runtime, not the settings store: `setLanguage`
// persists the preference and re-renders every `useT()` consumer at once.
export function LanguagePicker() {
  const lang = useLang();
  return (
    <SegmentedControl
      value={lang}
      onChange={(next) => {
        setLanguage(next);
        log.info(`Language set to ${next}`);
      }}
      ariaLabel="Language"
      options={[
        { value: "en", label: <span>🇬🇧 English</span> },
        { value: "sv", label: <span>🇸🇪 Svenska</span> },
      ]}
    />
  );
}

// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The standalone privacy policy, served at `/privacy/` (see the path switch in
// `main.tsx` and the `emit-privacy-alias` plugin in `vite.config.ts`) and
// linked from the side menu's About dropdown. The whole app is client-side —
// there is no backend, no account, and no cloud storage option — so the policy
// is mostly a plain account of what stays on the machine and why nothing
// leaves it. English-only by design: a legal page, not chrome.
import { type ReactNode } from "react";

import { ArrowLeftIcon } from "@niclaslindstedt/oss-framework/components";

// Last meaningful change to the policy text below. Bump it whenever the
// wording is edited — it renders verbatim at the top of the page and is the
// only line a reader has to look at to see how fresh the policy is.
const LAST_UPDATED = "2026-09-12";

const SOURCE_URL = "https://github.com/niclaslindstedt/mask";

// The shell sets `overflow: hidden` on html/body and leaves `#root` at its
// auto height, so a percentage height here would resolve to `auto`, make no
// scroll region, and leave everything below the fold clipped and unreachable —
// with no document scroll to fall back on, that means a phone can't read past
// the first screen. The page owns the viewport height outright, the way
// `App.tsx` does, and scrolls inside it.
export function PrivacyPage() {
  return (
    <div className="h-[var(--app-height,100svh)] overflow-y-auto bg-page-bg px-4 pt-[calc(2.5rem+env(safe-area-inset-top))] pb-[calc(2.5rem+env(safe-area-inset-bottom))] text-fg">
      <article className="mx-auto flex w-full max-w-2xl flex-col gap-6 text-sm leading-relaxed">
        <header className="flex flex-col gap-3">
          <a
            href={import.meta.env.BASE_URL}
            className="inline-flex items-center gap-1.5 self-start text-xs text-link hover:underline"
          >
            <ArrowLeftIcon className="h-3.5 w-3.5" />
            Back to Mask
          </a>
          <h1 className="text-lg font-bold text-fg-bright">Privacy policy</h1>
          <p className="text-xs text-muted">Last updated: {LAST_UPDATED}</p>
        </header>

        <Section title="Summary">
          <p>
            <span className="text-meta">Mask</span> finds personal data in a
            document — names, addresses, phone numbers, personal identity
            numbers — and replaces it with placeholders, so the text can be
            given to an LLM without the details, and restores the details in the
            answer. It is a static website that runs entirely in your browser.
          </p>
          <p>
            <strong className="text-fg-bright">
              No document you paste or upload ever leaves your browser.
            </strong>{" "}
            There is no server of ours, no account, no cloud storage, no
            cookies, no analytics, and no third-party service of any kind. The
            detection runs on your own machine, against dictionaries shipped
            inside the app. The authors never receive your documents, your
            placeholders, or anything else you put into the app — in any
            configuration, because there is no configuration in which anything
            is sent.
          </p>
        </Section>

        <Section title="What the app stores, and where">
          <p>
            Everything the app keeps is written to your own device. Under{" "}
            <strong className="text-fg-bright">Settings → Storage</strong> you
            choose which of two local places that is:
          </p>
          <ul className="ml-5 list-disc space-y-1">
            <li>
              <strong className="text-fg-bright">On this device</strong> (the
              default) — your projects live in this browser&apos;s{" "}
              <code className="text-meta">localStorage</code> for this site.
            </li>
            <li>
              <strong className="text-fg-bright">In a folder</strong> — your
              projects live as a plain JSON file per workspace inside a folder
              you pick on this machine, through the browser&apos;s File System
              Access API. The browser asks your permission for that one folder
              and nothing else; the permission grant is remembered in this
              browser&apos;s IndexedDB so the app can reopen the folder without
              asking again, and you can withdraw it at any time in the
              browser&apos;s site settings or by choosing{" "}
              <em>Stop using the folder</em>. A copy also stays in{" "}
              <code className="text-meta">localStorage</code> so the app still
              opens when the folder can&apos;t be reached.
            </li>
          </ul>
          <p>Either way, what is stored is:</p>
          <ul className="ml-5 list-disc space-y-1">
            <li>
              Your projects — the documents you added, their text, the masked
              text, the placeholders each project has minted, and the values you
              rejected during review.
            </li>
            <li>
              Your rules — the blacklist, the whitelist, and your custom
              patterns — and your own placeholder types.
            </li>
            <li>
              Your preferences — workspaces, theme, interface language, which
              detectors run, the placeholder style, and the in-app log buffer
              when you have switched log capture on.
            </li>
            <li>
              The PDFs you uploaded, in this browser&apos;s IndexedDB (database{" "}
              <code className="text-meta">mask:sources</code>), so the reader
              can draw their pages beside the review. Files belonging to a
              deleted document are swept at the next start.
            </li>
          </ul>
          <p>
            Clearing your browser&apos;s site data for this origin erases the{" "}
            <code className="text-meta">localStorage</code> and IndexedDB copies
            permanently. A folder you picked is not touched by that — the file
            stays where it is on your disk.{" "}
            <strong className="text-fg-bright">Settings → Developer →</strong>{" "}
            <em>Erase all local data</em> clears everything the browser holds,
            on purpose and in one press.
          </p>
        </Section>

        <Section title="Network requests">
          <p>
            The app makes no third-party network calls — none, in any
            configuration. The only requests your browser makes are for the
            app&apos;s own static files (HTML, JavaScript, CSS, fonts, icons)
            from this origin. Fonts are served from here rather than from a font
            CDN, and once the app has loaded it is installable and works fully
            offline as a PWA. There are no analytics scripts, no error-reporting
            services, no advertising networks, no trackers, and no cloud
            backends to connect.
          </p>
          <p>
            Masking itself is not a network operation: the detectors, the
            dictionaries, the PDF reader, and the restore pass all run inside
            your browser tab.
          </p>
        </Section>

        <Section title="Sending the masked text to an LLM">
          <p>
            The app never contacts an LLM. Masking produces text you copy or
            download and then take wherever you meant to take it. What happens
            to it there — which provider you paste it into, what that provider
            keeps, how long for — is between you and them, and is outside this
            app entirely.
          </p>
          <p>
            Read the masked text before you send it. Detection is a best effort
            over Swedish-language documents, not a guarantee: it can miss a name
            it does not know, and a document can carry identifying detail that
            no detector would flag. The review step exists so the decision is
            yours.
          </p>
        </Section>

        <Section title="Cookies">
          <p>
            The app sets no cookies at all. Persistence uses{" "}
            <code className="text-meta">localStorage</code>, IndexedDB, and — if
            you choose one — a folder on your disk.
          </p>
        </Section>

        <Section title="Web analytics">
          <p>
            None. The app loads no analytics or behavioural-tracking SDK, and
            the authors collect no usage statistics from it.
          </p>
        </Section>

        <Section title="Server logs">
          <p>
            The static bundle is served by{" "}
            <strong className="text-fg-bright">GitHub Pages</strong>. GitHub may
            record standard request metadata (IP address, user agent, requested
            path) in order to operate that service — the same metadata any web
            server sees, and it covers only the fetching of the app&apos;s
            files, never their contents. This is covered by{" "}
            <a
              href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement"
              className="text-link hover:underline"
            >
              GitHub&apos;s privacy statement
            </a>
            . The authors run no additional logging service.
          </p>
        </Section>

        <Section title="Open source">
          <p>
            Every claim on this page is checkable: the app is open source at{" "}
            <a href={SOURCE_URL} className="text-link hover:underline">
              github.com/niclaslindstedt/mask
            </a>
            , and the site you are reading is built from that repository by a
            public workflow. If you would rather not take our word for it, read
            the code, or build and host it yourself.
          </p>
        </Section>

        <Section title="Children">
          <p>
            The app is a general-purpose document tool and is not directed at
            children under 13.
          </p>
        </Section>

        <Section title="Changes to this policy">
          <p>
            Material changes are tracked in the public commit history of the
            source repository, and the <em>Last updated</em> date above reflects
            the most recent edit. Should a future version ever gain a feature
            that sends data anywhere, this policy will describe it before that
            feature ships — and it would be opt-in.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            For security reports, see{" "}
            <a
              href={`${SOURCE_URL}/security/advisories/new`}
              className="text-link hover:underline"
            >
              GitHub Security Advisories
            </a>
            . For everything else, open an issue at{" "}
            <a
              href={`${SOURCE_URL}/issues`}
              className="text-link hover:underline"
            >
              github.com/niclaslindstedt/mask
            </a>
            .
          </p>
        </Section>
      </article>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-bold tracking-wide text-fg-bright">
        {title}
      </h2>
      {children}
    </section>
  );
}

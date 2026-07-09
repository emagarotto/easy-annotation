# Easy Annotation — Privacy Policy

**Effective date:** July 9, 2026

Easy Annotation is a Chrome extension (and companion web tool) for annotating
webpages with numbered issue markers, comments, and severity ratings. It is
designed so that your data stays on your machine.

## What the extension stores, and where

- **Annotations** — marker positions, area outlines, comments, severity
  ratings, the page title, and the URL of the page they belong to — are stored
  **locally in your browser** using Chrome's extension storage
  (`chrome.storage.local`). The companion screenshot tool stores the same kind
  of data in your browser's `localStorage`.
- This data is never transmitted to the developer or to any third party. There
  is no server, no account, and no analytics or telemetry of any kind.
- Annotations are deleted when you clear them in the extension, clear the
  extension's storage, or uninstall the extension.

## Screenshots

When you click **Export**, the extension captures screenshots of the current
tab (one per screenful) and stitches them into a full-page image **on your
device**. The image is embedded in an HTML report file that is saved to your
computer. Screenshots are not uploaded anywhere; where the report file goes
after that is entirely under your control.

## Voice dictation

The optional **Dictate** button uses your browser's built-in speech
recognition ([Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)).
In Chrome, audio is processed by Google's speech recognition service to
produce the transcript. The extension itself never records, stores, or
transmits audio — only the resulting text is kept, locally, like any typed
comment. Chrome asks for microphone permission per site before dictation can
be used, and dictation only runs while the button shows "Listening".

## On-device AI cleanup

The optional **Tidy** button improves the grammar and clarity of a comment
using Chrome's **built-in on-device AI model**. The comment text is processed
entirely on your device and is never sent to any server.

## When the extension can access a page

The extension uses the `activeTab` and `scripting` permissions: it can only
read or modify a page **after you click its toolbar icon on that page**, and
that access ends when the tab navigates or closes. It does not run in the
background on pages you browse, and it has no blanket host permissions.

## What we collect

Nothing. The developer receives no data from this extension — no annotations,
no page content, no screenshots, no audio, no usage statistics, and no
personal information.

We do not sell or transfer user data to third parties. We do not use or
transfer user data for purposes unrelated to the extension's single purpose
(annotating webpages). We do not use or transfer user data to determine
creditworthiness or for lending purposes.

## Changes to this policy

If a future version of the extension changes how data is handled, this policy
will be updated in the same repository, and the extension's Chrome Web Store
listing disclosures will be updated to match before that version is published.

## Contact

Questions about this policy can be raised by opening an issue in this
repository.

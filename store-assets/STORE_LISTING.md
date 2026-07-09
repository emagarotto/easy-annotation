# Easy Annotation — Chrome Web Store submission kit

Everything to paste into the [developer dashboard](https://chrome.google.com/webstore/devconsole).
The uploadable package is the `extension/` folder, zipped (see checklist at the bottom).

---

## Store listing

**Name:** Easy Annotation

**Summary** (≤132 characters):

> Click anywhere on a live page to add numbered issue markers with comments and severity. Export a shareable annotated report.

**Category:** Developer Tools *(alternative: Productivity → Workflow & Planning)*

**Language:** English (United States)

**Detailed description:**

> Every bug report starts the same way: a cropped screenshot, three sentences of
> "it's the button near the top — no, the other one," and a developer left
> guessing. Easy Annotation ends the guessing. Click the toolbar icon and the
> page you're looking at becomes the bug report.
>
> MARK UP THE REAL PAGE
> • Click anywhere to drop a numbered circle, or drag to outline an area
> • Rate each issue Low, Medium, or High — markers, outlines, and cards are
>   color-coded so the severe stuff reads at a glance
> • Drag any number to reposition it; drag the comment editor out of the way
>   when it covers what you're describing
> • Numbers renumber automatically when you delete an issue — your list stays 1, 2, 3
>
> COMMENT AT THE SPEED OF SPEECH
> • Dictate comments by voice — the transcript streams in as you talk
> • One click on Tidy fixes grammar and clarity using Chrome's built-in
>   on-device AI, with instant undo. Rambling dictation in, crisp issue out.
>
> REVIEW WITHOUT LOSING YOUR PLACE
> • A side panel lists every issue with severity tallies; click a card to jump
>   to its marker on the page
> • Toggle marking off to browse, scroll, and click the page normally —
>   markers stay visible and editable
> • Annotations save automatically, per page. Close the tab, come back
>   tomorrow, and your review is where you left it.
>
> SHARE A REPORT ANYONE CAN OPEN
> • Export builds a single self-contained HTML file: a full-page screenshot
>   with your numbered badges in place, beside every comment. Name the file
>   what you like — recipients need nothing but a browser.
> • Share hands the report to Gmail or Slack: Gmail opens a pre-filled draft
>   with the issue summary; Slack copies the summary to paste. Attach the
>   downloaded report and send.
>
> PRIVATE BY ARCHITECTURE
> Annotations live in your browser. Screenshots are assembled on your machine.
> AI cleanup runs on-device. The extension touches a page only when you click
> its icon, and nothing you write is sent to any server. There's no account,
> no sign-up, and nothing to configure.

**Screenshots** (upload all three, in this order):

| File | Shows |
|---|---|
| `screenshot-1-annotate-1280x800.png` | Annotating a live page — markers, area outline, open editor, side panel |
| `screenshot-2-editor-1280x800.png` | Editor close-up — voice dictation (Listening state), AI Tidy, severity picker |
| `screenshot-3-report-1280x800.png` | The exported HTML report — annotated page beside the numbered comments |

**Promo tiles** (optional but recommended — used in store placements):

| File | Slot |
|---|---|
| `tile-small-440x280.png` | Small promo tile |
| `tile-marquee-1400x560.png` | Marquee promo tile |

All are regenerable: serve the project (`python3 -m http.server 8642`) and render
`promo-shot.html` / `store-assets/src/*.html` with headless Chrome at the sizes
encoded in the filenames (screenshot 2 renders at 640×400 with
`--force-device-scale-factor=2`).

---

## Privacy tab answers

**Single purpose description:**

> Lets the user annotate the current webpage with numbered issue markers, comments,
> and severity ratings, and export or print the annotated result.

**Permission justifications:**

| Permission | Justification to paste |
|---|---|
| `activeTab` | Grants access to the current page only when the user clicks the extension icon, and enables capturing that tab for the exported screenshot report. No pages are accessed without an explicit user click. |
| `scripting` | Injects the annotation interface into the active tab after the user clicks the toolbar icon. Used solely for that user-initiated injection. |
| `storage` | Saves the user's annotations locally (chrome.storage.local), keyed by page URL, so a review survives closing the tab. No data leaves the device. |

**Remote code:** Answer **"No, I am not using remote code."** All JavaScript
ships in the package — no eval, no fetched scripts, no CDN references. Chrome's
built-in AI (`LanguageModel`) and speech recognition are platform browser APIs,
not remote code. (If the dashboard demands a remote-code *justification*, the
Yes option is selected — switch it to No and the requirement disappears.)

**Data usage disclosures:** check **"Website content"** and **"User activity"** are
NOT collected — annotations are stored locally and never transmitted. Certify:
- ✅ I do not sell or transfer user data to third parties
- ✅ I do not use or transfer user data for purposes unrelated to the single purpose
- ✅ I do not use or transfer user data to determine creditworthiness or for lending

**Privacy policy:** the full policy lives at [`PRIVACY.md`](../PRIVACY.md) in the
repo root. Once the repo is pushed to GitHub, paste its public URL into the
dashboard's Privacy policy field, e.g.
`https://github.com/<org>/<repo>/blob/main/PRIVACY.md`.
The short-form paragraph below remains as a summary; the repo file is the
canonical version:

> Easy Annotation stores the annotations you create (marker positions, comments,
> severity ratings, and the page URL they belong to) locally in your browser using
> Chrome's extension storage. This data never leaves your device, is not transmitted
> to the developer or any third party, and is deleted when you remove the extension
> or clear its storage. The extension accesses a webpage only when you click its
> toolbar icon, and captures page screenshots only when you click Export, solely to
> embed them in the report file saved to your computer. If you use the optional
> Dictate button, your speech is transcribed by the browser's built-in speech
> recognition service (in Chrome, audio is processed by Google's speech service);
> the extension itself never records, stores, or transmits audio, and only the
> resulting text is kept — locally, like any typed comment. The optional Tidy
> button uses Chrome's built-in on-device AI model to improve grammar and clarity;
> the comment text is processed entirely on your device and is never sent to any
> server.

---

## Submission checklist

1. Upload `store-assets/easy-annotation.zip` (pre-built; rebuild with
   `cd extension && zip -r ../store-assets/easy-annotation.zip . -x '.*' -x '*/.*'`).
2. Pay the one-time $5 developer registration fee (if not already registered).
3. Paste the listing copy and privacy answers above.
4. Upload the three screenshots and, optionally, the two promo tiles.
5. **Visibility:** choose *Unlisted* if this is just for the Nextpoint team —
   installable by link, no public listing, same review process.
6. If publishing as an organization, verify the publisher domain in the dashboard
   to avoid the "unverified publisher" badge.
7. Expect first-time review to take a few days up to ~2 weeks.

**Pre-flight sanity test:** load the unpacked `extension/` folder fresh in a clean
Chrome profile and click through: inject → mark → comment → drag a marker →
toggle marking off → Export → Print, on at least one heavy production site
(strict security policies on sites like google.com are the likeliest breakage point).

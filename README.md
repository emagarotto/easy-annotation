# Easy Annotation

**Mark up any webpage — number, comment, share.**

Easy Annotation turns a webpage into its own bug report. Click to drop
numbered, severity-rated markers directly on the page, comment by keyboard or
voice, and export a single self-contained HTML report that pairs a full-page
screenshot with every comment. No accounts, no servers — everything is
processed and stored locally.

The project ships as two tools that share one UI:

| Tool | Where it runs | Use it for |
|---|---|---|
| **Chrome extension** ([`extension/`](extension/)) | Any live website | Reviewing real pages in place — markers pin to the actual DOM |
| **Screenshot tool** ([`index.html`](index.html)) | Any browser, no install | Marking up screenshots or mockups when you can't (or shouldn't) touch the live site |

---

## Features

- **Click to annotate** — click drops a numbered circle, drag outlines an area.
  Numbers start at 1 and renumber automatically when an issue is deleted.
- **Severity triage** — every issue is Low / Medium / High, color-coded
  (green / amber / red) on the markers, outlines, and comment cards, with
  running tallies in the panel.
- **Voice dictation** — comments can be spoken; the transcript streams in live
  via the browser's built-in speech recognition.
- **On-device AI cleanup** — the *Tidy* button fixes grammar and clarity using
  Chrome's built-in model (Gemini Nano). Text never leaves the machine, and
  one click undoes the rewrite.
- **Everything is movable** — drag markers to reposition them (outlines follow),
  and drag the comment editor by its header when it covers what you're
  describing.
- **Marking on/off toggle** *(extension)* — switch between annotating and
  using the page normally; markers stay visible and editable either way.
- **Export** — one self-contained HTML file with a stitched full-page
  screenshot (badges in place) beside every comment, with an optional custom
  filename. Opens in any browser; nothing to host.
- **Share** — hand the report to **Gmail** (opens a pre-filled draft with the
  issue summary; attach the just-downloaded file) or **Slack** (copies a text
  summary to paste alongside the file). No OAuth, no connected accounts.
- **Autosave** — annotations persist per-URL in local storage; a half-finished
  review survives the tab, the restart, and the weekend.

## Privacy

Annotations are stored locally (`chrome.storage.local` in the extension,
`localStorage` in the screenshot tool). Screenshots are captured and stitched
on your machine. AI cleanup runs on-device. The extension requests only
`activeTab`, `scripting`, and `storage` — it touches a page exclusively when
you click its icon, and nothing you write is transmitted anywhere. Voice
dictation uses the browser's built-in speech service (in Chrome, audio is
processed by Google's speech recognition); only the resulting text is kept,
locally. Full details in the [privacy policy](PRIVACY.md).

---

## Installing the extension

Until it's on the Chrome Web Store, load it unpacked:

1. Open `chrome://extensions` in Chrome
2. Enable **Developer mode** (top right)
3. Click **Load unpacked** and select the [`extension/`](extension/) folder
4. Pin **Easy Annotation** to the toolbar

Click the icon on any `http(s)` page to start annotating; click it again to
hide (annotations are saved). After pulling changes, hit the reload icon on
the extension's card in `chrome://extensions`.

### Requirements

- **Chrome** (Manifest V3). The screenshot-capture export and Tidy rely on
  Chrome APIs.
- **Dictate** needs microphone permission (Chrome prompts per site, once).
- **Tidy** needs Chrome's built-in AI model — a recent Chrome on hardware
  that supports it (roughly: a few GB of free disk and a capable GPU). The
  first use triggers a one-time model download; the button reports
  availability honestly and hides where the API doesn't exist.

## Using the screenshot tool

Open [`index.html`](index.html) in a browser (or serve the folder — see
below). Drop in a screenshot, paste one with <kbd>⌘V</kbd>, or use the
built-in sample page, then click/drag to annotate exactly as in the
extension. Export produces the same style of report with the annotated image
embedded.

---

## Development

There's no build step — the extension is three hand-written files
(`manifest.json`, `background.js`, `annotator.js`) and the screenshot tool is
a single HTML file.

```sh
# serve the project (the test pages load the annotator from /extension/)
python3 -m http.server 8642
```

| Page | Purpose |
|---|---|
| `http://localhost:8642/` | The screenshot tool |
| `http://localhost:8642/test-live.html` | A fake article page that loads `annotator.js` the way the extension injects it — for testing the live-site UI without reloading the extension |
| `http://localhost:8642/promo-shot.html` | Staged page with seeded annotations, used to render the store screenshots |

Outside a real extension context, the annotator degrades gracefully:
`chrome.storage` falls back to `localStorage`, screenshot capture falls back
to a text-only report, and extension-only buttons hide themselves. That makes
almost everything testable in a plain browser tab; the full capture and Tidy
paths need the loaded extension.

### Project layout

```
├── extension/              The Chrome extension (this folder is what ships)
│   ├── manifest.json       MV3 manifest — activeTab + scripting + storage
│   ├── background.js       Service worker: screenshot capture, on-device AI calls
│   ├── annotator.js        Everything else: injected UI in a shadow DOM
│   └── icons/
├── index.html              Standalone screenshot-annotation tool
├── test-live.html          Dev page for exercising annotator.js
├── promo-shot.html         Staged page for store screenshot 1
└── store-assets/
    ├── STORE_LISTING.md    Chrome Web Store listing copy, privacy answers, checklist
    ├── MARKETING.md        Taglines, pitches, announcement copy
    ├── easy-annotation.zip Pre-built upload package
    ├── screenshot-*.png    Store screenshots (1280×800)
    ├── tile-*.png          Store promo tiles
    └── src/                Staged HTML pages the screenshots/tiles render from
```

### Regenerating store assets

All screenshots and tiles are rendered from the staged pages with headless
Chrome; sizes are encoded in the filenames. With the dev server running:

```sh
chrome --headless=new --window-size=1280,800 --hide-scrollbars \
  --screenshot=store-assets/screenshot-1-annotate-1280x800.png \
  http://localhost:8642/promo-shot.html
```

(Screenshot 2 renders at `--window-size=640,400 --force-device-scale-factor=2`
for the close-up.) Rebuild the upload package with:

```sh
cd extension && zip -r ../store-assets/easy-annotation.zip . -x '.*' -x '*/.*'
```

### Architecture notes

- The injected UI lives entirely in a **shadow DOM** on a single host element,
  so host-page CSS can't break it and its styles can't leak out.
- Marker coordinates are **document pixels** in the extension (live pages) and
  **percentages** in the screenshot tool (responsive images).
- Full-page export capture is **scroll-and-stitch**: the background worker
  answers `captureVisibleTab` requests per viewport slice (~0.6s apart, the
  API's rate limit) while the content script assembles the canvas. Sticky
  headers repeat per slice — a known tradeoff to avoid the debugger API.
- Dictation and Tidy fail *visibly* (button-level status like "Mic blocked" or
  "Model downloading — retry soon"), never silently.

## Store submission

Everything needed for the Chrome Web Store — listing copy, per-permission
justifications, data-use answers, privacy policy text, screenshots, tiles,
and the upload zip — lives in [`store-assets/`](store-assets/STORE_LISTING.md).

## License

No license has been chosen yet. Until one is added, all rights reserved.

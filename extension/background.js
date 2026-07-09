// Inject (or toggle) the annotator on the active tab when the toolbar icon is clicked.
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id || !/^https?:/.test(tab.url || "")) return;
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["annotator.js"],
  });
});

// Grammar/clarity cleanup using Chrome's built-in on-device model (Gemini Nano
// via the Prompt API). Runs entirely on the user's machine — no network, no key.
const TIDY_SYSTEM_PROMPT =
  "You clean up QA review comments. Fix grammar, spelling, punctuation, and clarity " +
  "while preserving the original meaning and tone. Keep technical terms, element names, " +
  "selectors, and code snippets exactly as written. Reply with only the cleaned-up " +
  "comment text — no preamble, no surrounding quotes, no explanations. If the text is " +
  "already clean, reply with it unchanged.";

async function tidy(text) {
  if (typeof LanguageModel === "undefined") return { error: "unavailable" };
  const availability = await LanguageModel.availability();
  if (availability === "unavailable") return { error: "unavailable" };
  if (availability !== "available") {
    LanguageModel.create().catch(() => {}); // kick off the one-time model download
    return { error: "downloading" };
  }
  const session = await LanguageModel.create({
    initialPrompts: [{ role: "system", content: TIDY_SYSTEM_PROMPT }],
  });
  try {
    const cleaned = (await session.prompt(text)).trim();
    return cleaned ? { text: cleaned } : { error: "failed" };
  } finally {
    session.destroy();
  }
}

// The content script can't call captureVisibleTab itself; it asks us for each
// viewport slice while building the full-page export screenshot.
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === "redline-capture" && sender.tab) {
    chrome.tabs.captureVisibleTab(sender.tab.windowId, { format: "png" }, (dataUrl) => {
      sendResponse({ dataUrl: chrome.runtime.lastError ? null : dataUrl });
    });
    return true; // keep the channel open for the async response
  }
  if (msg && msg.type === "redline-tidy" && typeof msg.text === "string") {
    tidy(msg.text).then(sendResponse, () => sendResponse({ error: "failed" }));
    return true; // keep the channel open for the async response
  }
  // Open a share destination (Gmail compose / Slack) in a new tab. Done here
  // rather than window.open in the page: the user gesture has expired by the
  // time the screenshot capture finishes, and tabs.create needs no gesture.
  if (msg && msg.type === "redline-open" && typeof msg.url === "string" && /^https:\/\//.test(msg.url)) {
    chrome.tabs.create({ url: msg.url });
  }
});

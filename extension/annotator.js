/*
 * Easy Annotation - Features Dictate & AI Tidy.
 * Runs as a Chrome extension content script (or plain <script> for testing).
 * All UI lives in a shadow root so host-page CSS can't touch it.
 * Coordinates are stored in document pixels; annotations persist per-URL.
 */
(() => {
  "use strict";

  const HOST_ID = "__redline_host";

  // Second activation = toggle off. State is persisted, so nothing is lost.
  const existing = document.getElementById(HOST_ID);
  if (existing) { existing.remove(); return; }

  // ---------- storage (chrome.storage in the extension, localStorage otherwise) ----------
  const KEY = "redline::" + location.origin + location.pathname;
  const hasChromeStore =
    typeof chrome !== "undefined" && chrome.storage && chrome.storage.local;

  function persist(data) {
    if (hasChromeStore) {
      chrome.storage.local.set({ [KEY]: data });
    } else {
      try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* quota */ }
    }
  }
  function restore(cb) {
    if (hasChromeStore) {
      chrome.storage.local.get(KEY, (r) => cb(r[KEY] || null));
    } else {
      try { cb(JSON.parse(localStorage.getItem(KEY))); } catch (e) { cb(null); }
    }
  }

  // ---------- state ----------
  let items = [];      // {x, y, w, h, comment, severity} — document px
  let editing = -1;
  let marking = true;

  // ---------- host & shadow ----------
  const host = document.createElement("div");
  host.id = HOST_ID;
  host.style.cssText =
    "position:absolute;left:0;top:0;width:0;height:0;z-index:2147483646;";
  const shadow = host.attachShadow({ mode: "open" });
  document.documentElement.appendChild(host);

  const style = document.createElement("style");
  style.textContent = `
    :host { all: initial; }
    * { box-sizing: border-box; font-family: "Avenir Next","Segoe UI",system-ui,-apple-system,sans-serif; }
    button { font: inherit; cursor: pointer; }
    button:focus-visible, textarea:focus-visible { outline: 2px solid #2456e6; outline-offset: 2px; }

    .s-low    { --c: #2e9e5b; }
    .s-medium { --c: #d97e00; }
    .s-high   { --c: #d8372a; }

    /* ----- overlay over the whole document ----- */
    .overlay { position: absolute; left: 0; top: 0; }
    .overlay.marking { cursor: crosshair; }
    .overlay:not(.marking) { pointer-events: none; }
    .anno-area {
      position: absolute;
      border: 2px solid var(--c, #d97e00);
      background: color-mix(in srgb, var(--c, #d97e00) 12%, transparent);
      border-radius: 3px;
      pointer-events: none;
    }
    .anno-area.rubber { border-style: dashed; --c: #2456e6; }
    .marker {
      position: absolute;
      transform: translate(-50%, -50%);
      width: 26px; height: 26px;
      border-radius: 50%;
      border: 2px solid #fff;
      background: var(--c, #d97e00);
      color: #fff;
      font: 700 12px/1 ui-monospace, Menlo, monospace;
      display: grid; place-items: center;
      padding: 0;
      box-shadow: 0 1px 4px rgba(27,36,48,.45);
      pointer-events: auto;
      cursor: grab;
      transition: transform .12s ease;
    }
    .marker:active { cursor: grabbing; }
    .marker:hover { transform: translate(-50%, -50%) scale(1.15); }
    .marker.pulse { animation: rl-pulse .5s ease 2; }
    @keyframes rl-pulse {
      50% { transform: translate(-50%,-50%) scale(1.35);
            box-shadow: 0 0 0 6px color-mix(in srgb, var(--c) 30%, transparent); }
    }
    @media (prefers-reduced-motion: reduce) { .marker { transition: none; animation: none; } }

    /* ----- side panel ----- */
    .panel {
      position: fixed;
      top: 12px; right: 12px; bottom: 12px;
      width: 320px;
      display: flex; flex-direction: column;
      background: #fff;
      color: #1b2430;
      font-size: 14px; line-height: 1.45;
      border: 1px solid #dcdfd9;
      border-radius: 10px;
      box-shadow: 0 4px 12px rgba(27,36,48,.14), 0 18px 48px rgba(27,36,48,.22);
    }
    .p-head {
      display: flex; align-items: center; gap: 8px;
      padding: 10px 12px;
      background: #1b2430; color: #f4f6f9;
      border-radius: 9px 9px 0 0;
    }
    .brand { display: flex; align-items: center; gap: 8px; font-weight: 600; font-size: 14px; }
    .brand-mark {
      width: 20px; height: 20px; border-radius: 50%;
      background: #2456e6; color: #fff;
      font: 700 11px/20px ui-monospace, monospace; text-align: center;
    }
    .p-head .spacer { flex: 1; }
    .icon-btn {
      border: 0; background: none; color: #c9d2de;
      font-size: 14px; line-height: 1; padding: 4px 7px; border-radius: 4px;
    }
    .icon-btn:hover { background: rgba(255,255,255,.12); color: #fff; }
    .p-body { padding: 10px 12px 0; }
    .mode {
      width: 100%;
      padding: 8px 10px;
      border-radius: 6px;
      border: 1px solid #dcdfd9;
      background: #f1f2ef; color: #3a4656;
      font-weight: 600; font-size: 13px;
      text-align: left;
    }
    .mode.on { background: #2456e6; border-color: #2456e6; color: #fff; }
    .mode small { display: block; font-weight: 400; font-size: 11.5px; opacity: .8; }
    .p-actions { display: flex; gap: 6px; margin: 8px 0; }
    .p-actions button {
      flex: 1; padding: 6px 0;
      border: 1px solid #dcdfd9; border-radius: 6px;
      background: #fff; color: #1b2430; font-size: 12.5px;
    }
    .p-actions button:hover { background: #f1f2ef; }
    .export-name {
      margin: 0 0 8px;
      padding: 8px;
      border: 1px solid #dcdfd9;
      border-radius: 6px;
      background: #f1f2ef;
    }
    .export-name label {
      display: block;
      font: 600 10.5px ui-monospace, monospace;
      letter-spacing: .06em; text-transform: uppercase;
      color: #5a6472;
      margin-bottom: 5px;
    }
    .export-name .row { display: flex; align-items: center; gap: 6px; }
    .export-name input {
      flex: 1; min-width: 0;
      padding: 5px 8px; font-size: 12.5px;
      border: 1px solid #dcdfd9; border-radius: 5px;
      background: #fff; color: #1b2430;
    }
    .export-name .ext { font: 12px ui-monospace, monospace; color: #5a6472; }
    .export-name .btns { margin-top: 7px; justify-content: flex-end; }
    .export-name .btns button {
      padding: 4px 12px; font-size: 12px;
      border: 1px solid #dcdfd9; border-radius: 5px;
      background: #fff; color: #1b2430;
    }
    .export-name .btns .go { background: #2456e6; border-color: #2456e6; color: #fff; font-weight: 600; }
    .export-name .btns .go:hover { background: #1d49c7; }
    .counts { display: flex; gap: 6px; padding: 0 0 8px; }
    .count-chip {
      font: 600 11px ui-monospace, monospace;
      padding: 2px 8px; border-radius: 99px;
      color: var(--cc); background: var(--cs);
    }
    .count-chip.high { --cc: #d8372a; --cs: #fce9e6; }
    .count-chip.medium { --cc: #a35f00; --cs: #fbf0de; }
    .count-chip.low { --cc: #2e9e5b; --cs: #e5f4ea; }
    .count-chip.zero { opacity: .45; }
    .list {
      flex: 1; overflow-y: auto;
      padding: 4px 12px 14px;
      display: flex; flex-direction: column; gap: 8px;
      border-top: 1px solid #eceee9;
    }
    .rail-empty { margin: 26px 8px; text-align: center; color: #5a6472; font-size: 13px; }
    .card {
      position: relative;
      display: grid; grid-template-columns: 26px 1fr; gap: 10px;
      padding: 9px 26px 9px 11px; text-align: left;
      border: 1px solid #dcdfd9; border-left: 3px solid var(--c, #d97e00);
      border-radius: 6px; background: #fff;
      cursor: pointer;
    }
    .card:hover { background: #f1f2ef; }
    .card-del {
      position: absolute; top: 4px; right: 4px;
      border: 0; background: none;
      color: #9aa2ad; font-size: 12px; line-height: 1;
      padding: 4px 6px; border-radius: 4px;
    }
    .card-del:hover { background: #fce9e6; color: #d8372a; }
    .card .num {
      width: 24px; height: 24px; border-radius: 50%;
      background: var(--c); color: #fff;
      font: 700 11px/24px ui-monospace, monospace; text-align: center;
    }
    .card .sev-tag {
      font: 600 10.5px ui-monospace, monospace;
      letter-spacing: .06em; text-transform: uppercase; color: var(--c);
    }
    .card .comment { margin: 3px 0 0; color: #1b2430; overflow-wrap: anywhere; }
    .card .comment.empty { color: #9aa2ad; font-style: italic; }

    /* collapsed tab */
    .tab {
      position: fixed; top: 50%; right: 0;
      transform: translateY(-50%);
      width: 40px; height: 40px;
      border: 2px solid #fff; border-right: 0;
      border-radius: 20px 0 0 20px;
      background: #2456e6; color: #fff;
      font: 700 13px ui-monospace, monospace;
      box-shadow: 0 2px 10px rgba(27,36,48,.35);
    }
    .tab:hover { background: #1d49c7; }

    /* ----- editor popover ----- */
    .popover {
      position: fixed; z-index: 10;
      width: 290px;
      background: #fff; color: #1b2430;
      font-size: 14px;
      border: 1px solid #dcdfd9; border-radius: 8px;
      box-shadow: 0 4px 10px rgba(27,36,48,.12), 0 16px 40px rgba(27,36,48,.22);
      padding: 12px;
    }
    .pop-head {
      display: flex; align-items: center; gap: 8px; margin-bottom: 10px;
      cursor: grab; user-select: none;
    }
    .pop-head:active { cursor: grabbing; }
    .pop-head .num {
      width: 22px; height: 22px; border-radius: 50%;
      background: var(--c, #d97e00); color: #fff;
      font: 700 11px/22px ui-monospace, monospace; text-align: center;
    }
    .pop-head .label {
      font-size: 11px; font-weight: 600;
      letter-spacing: .08em; text-transform: uppercase; color: #5a6472;
    }
    .pop-head .close { margin-left: auto; }
    .pop-head .close.icon-btn { color: #5a6472; }
    .pop-head .close.icon-btn:hover { background: #f1f2ef; color: #1b2430; }
    .popover textarea {
      width: 100%; min-height: 68px; resize: vertical;
      font: 13.5px/1.45 inherit;
      padding: 8px 10px;
      border: 1px solid #dcdfd9; border-radius: 6px;
      color: #1b2430; background: #fff;
    }
    .sev-picker { display: flex; gap: 6px; margin: 10px 0 12px; }
    .sev-btn {
      flex: 1; padding: 5px 0;
      border: 1px solid #dcdfd9; border-radius: 6px;
      background: #fff; font-size: 12px; font-weight: 600; color: #3a4656;
    }
    .sev-btn.low[aria-pressed="true"] { background: #2e9e5b; border-color: #2e9e5b; color: #fff; }
    .sev-btn.medium[aria-pressed="true"] { background: #d97e00; border-color: #d97e00; color: #fff; }
    .sev-btn.high[aria-pressed="true"] { background: #d8372a; border-color: #d8372a; color: #fff; }
    .pop-foot { display: flex; justify-content: space-between; align-items: center; }
    .pop-foot .del { border: 0; background: none; color: #d8372a; padding: 5px 8px; border-radius: 4px; font-size: 13px; }
    .pop-foot .del:hover { background: #fce9e6; }
    .mic {
      display: flex; align-items: center; gap: 6px;
      border: 1px solid #dcdfd9; border-radius: 6px;
      background: #fff; color: #3a4656;
      padding: 5px 10px; font-size: 12.5px; font-weight: 600;
    }
    .mic:hover { background: #f1f2ef; }
    .mic.rec {
      background: #d8372a; border-color: #d8372a; color: #fff;
      animation: rl-rec 1.2s ease infinite;
    }
    .mic.err { border-color: #d8372a; color: #d8372a; }
    .mic.busy { border-color: #2456e6; color: #2456e6; }
    .mic.busy svg { animation: rl-tidy 1s ease-in-out infinite; }
    @keyframes rl-rec { 50% { box-shadow: 0 0 0 5px rgba(216,55,42,.22); } }
    @keyframes rl-tidy {
      0%, 100% { transform: scale(1) rotate(0deg); opacity: 1; }
      50% { transform: scale(1.35) rotate(90deg); opacity: .55; }
    }
    @media (prefers-reduced-motion: reduce) { .mic.rec, .mic.busy svg { animation: none; } }
    .assist { display: flex; gap: 6px; margin-top: 8px; }
    .assist .mic { flex: 1; justify-content: center; }
    .pop-foot .done { padding: 5px 16px; border: 0; border-radius: 6px; background: #1b2430; color: #fff; font-weight: 600; }
    .pop-foot .done:hover { background: #2c3a4d; }

    [hidden] { display: none !important; }
  `;
  shadow.appendChild(style);

  shadow.innerHTML += `
    <div class="overlay marking" id="overlay"></div>
    <aside class="panel" id="panel" aria-label="Easy Annotation">
      <div class="p-head">
        <span class="brand"><span class="brand-mark">1</span>Easy Annotation</span>
        <span class="spacer"></span>
        <button class="icon-btn" id="btnCollapse" title="Collapse panel">&#10095;</button>
        <button class="icon-btn" id="btnClose" title="Hide Easy Annotation (annotations are saved)">&#10005;</button>
      </div>
      <div class="p-body">
        <button class="mode on" id="btnMode">Marking is on
          <small>Click or drag on the page to add an issue</small></button>
        <div class="p-actions">
          <button id="btnExport">Export</button>
          <button id="btnClear">Clear</button>
        </div>
        <div class="export-name" id="exportName" hidden>
          <label for="exportFile">File name</label>
          <div class="row">
            <input id="exportFile" type="text" spellcheck="false">
            <span class="ext">.html</span>
          </div>
          <div class="row btns">
            <button id="exportCancel">Cancel</button>
            <button id="exportGo" class="go">Export</button>
          </div>
        </div>
        <div class="counts" id="counts"></div>
      </div>
      <div class="list" id="list"></div>
    </aside>
    <button class="tab" id="tab" hidden title="Expand Easy Annotation">0</button>
    <div class="popover" id="popover" hidden role="dialog" aria-label="Edit annotation">
      <div class="pop-head" title="Drag to move">
        <span class="num" id="popNum">1</span>
        <span class="label">Issue</span>
        <button class="icon-btn close" id="popClose" aria-label="Close">&#10005;</button>
      </div>
      <textarea id="popComment" placeholder="What's the issue here?"></textarea>
      <div class="assist">
        <button class="mic" id="popMic" title="Dictate your comment">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z"/></svg>
          <span>Dictate</span>
        </button>
        <button class="mic" id="popTidy" title="Fix grammar and clarity with on-device AI">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2c.6 3.9 3.5 6.8 7.4 7.4-3.9.6-6.8 3.5-7.4 7.4-.6-3.9-3.5-6.8-7.4-7.4C8.5 8.8 11.4 5.9 12 2zM19 15l.9 2.6L22.5 18.5l-2.6.9L19 22l-.9-2.6-2.6-.9 2.6-.9z"/></svg>
          <span>Tidy</span>
        </button>
      </div>
      <div class="sev-picker" role="group" aria-label="Severity">
        <button class="sev-btn low" data-sev="low" aria-pressed="false">Low</button>
        <button class="sev-btn medium" data-sev="medium" aria-pressed="false">Medium</button>
        <button class="sev-btn high" data-sev="high" aria-pressed="false">High</button>
      </div>
      <div class="pop-foot">
        <button class="del" id="popDelete">Delete</button>
        <button class="done" id="popDone">Done</button>
      </div>
    </div>
  `;

  const $ = (id) => shadow.getElementById(id);
  const overlay = $("overlay"), panel = $("panel"), popover = $("popover"),
        list = $("list"), counts = $("counts"), tab = $("tab");

  // ---------- overlay sizing ----------
  function sizeOverlay() {
    const de = document.documentElement;
    overlay.style.width = Math.max(de.scrollWidth, de.clientWidth) + "px";
    overlay.style.height = Math.max(de.scrollHeight, de.clientHeight) + "px";
  }
  sizeOverlay();
  window.addEventListener("resize", sizeOverlay);
  if (window.ResizeObserver && document.body) {
    new ResizeObserver(sizeOverlay).observe(document.body);
  }

  // ---------- helpers ----------
  function escapeHTML(s) {
    return String(s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  // ---------- rendering ----------
  function render() {
    overlay.querySelectorAll(".marker, .anno-area:not(.rubber)").forEach((n) => n.remove());
    items.forEach((it, i) => {
      if (it.w > 4 && it.h > 4) {
        const area = document.createElement("div");
        area.className = "anno-area s-" + it.severity;
        area.dataset.index = i;
        area.style.cssText = `left:${it.x}px;top:${it.y}px;width:${it.w}px;height:${it.h}px`;
        overlay.appendChild(area);
      }
      const m = document.createElement("button");
      m.className = "marker s-" + it.severity;
      m.textContent = i + 1;
      m.dataset.index = i;
      m.style.cssText = `left:${it.x}px;top:${it.y}px`;
      m.setAttribute("aria-label", `Issue ${i + 1}, ${it.severity} severity`);
      overlay.appendChild(m);
    });
    renderList();
    persist({ items, savedAt: Date.now(), title: document.title, url: location.href });
  }

  function renderList() {
    const tally = { low: 0, medium: 0, high: 0 };
    items.forEach((it) => tally[it.severity]++);
    counts.innerHTML = ["high", "medium", "low"].map((s) =>
      `<span class="count-chip ${s}${tally[s] ? "" : " zero"}">${tally[s]} ${s === "medium" ? "med" : s}</span>`
    ).join("");
    tab.textContent = items.length;

    list.innerHTML = "";
    if (!items.length) {
      list.innerHTML = `<p class="rail-empty">No issues yet.<br>Click anywhere on the page to add #1.</p>`;
      return;
    }
    items.forEach((it, i) => {
      const card = document.createElement("div");
      card.className = "card s-" + it.severity;
      card.dataset.index = i;
      card.setAttribute("role", "button");
      card.tabIndex = 0;
      card.innerHTML = `
        <span class="num">${i + 1}</span>
        <span>
          <span class="sev-tag">${it.severity}</span>
          <p class="comment${it.comment ? "" : " empty"}">${it.comment ? escapeHTML(it.comment) : "No comment yet"}</p>
        </span>
        <button class="card-del" title="Delete issue ${i + 1}" aria-label="Delete issue ${i + 1}">&#10005;</button>`;
      list.appendChild(card);
    });
  }

  // ---------- editor ----------
  function openEditor(i) {
    stopDictation();
    resetTidy();
    editing = i;
    const it = items[i];
    $("popNum").textContent = i + 1;
    $("popNum").className = "num s-" + it.severity;
    $("popComment").value = it.comment;
    popover.querySelectorAll(".sev-btn").forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.sev === it.severity)));
    popover.hidden = false;

    const marker = overlay.querySelector(`.marker[data-index="${i}"]`);
    const r = marker.getBoundingClientRect();
    let left = r.right + 12, top = r.top - 10;
    if (left + 300 > window.innerWidth - 340) left = r.left - 302; // keep clear of the panel
    if (left < 8) left = 8;
    top = Math.max(8, Math.min(top, window.innerHeight - popover.offsetHeight - 8));
    popover.style.left = left + "px";
    popover.style.top = top + "px";
    $("popComment").focus();
    marker.classList.add("pulse");
    marker.addEventListener("animationend", () => marker.classList.remove("pulse"), { once: true });
  }

  function closeEditor() {
    stopDictation();
    if (editing < 0) return;
    items[editing].comment = $("popComment").value.trim();
    editing = -1;
    popover.hidden = true;
    render();
  }

  // ---------- drag / click to annotate, drag markers to move ----------
  let drag = null;          // creating a new annotation
  let move = null;          // repositioning an existing marker
  let suppressClick = false;

  overlay.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    const marker = e.target.closest(".marker");
    if (marker) {
      const i = +marker.dataset.index;
      move = {
        i, marker,
        area: overlay.querySelector(`.anno-area[data-index="${i}"]`),
        startX: e.pageX, startY: e.pageY,
        dx: e.pageX - items[i].x, dy: e.pageY - items[i].y,
        nx: items[i].x, ny: items[i].y,
        moved: false,
      };
      try { marker.setPointerCapture(e.pointerId); } catch (err) { /* synthetic events */ }
      e.preventDefault();
      return;
    }
    closeEditor();
    drag = {
      x0: e.pageX, y0: e.pageY,
      rubber: null, rect: null,
    };
    try { overlay.setPointerCapture(e.pointerId); } catch (err) { /* synthetic events */ }
    e.preventDefault();
  });
  overlay.addEventListener("pointermove", (e) => {
    if (move) {
      if (!move.moved) {
        if (Math.abs(e.pageX - move.startX) < 4 && Math.abs(e.pageY - move.startY) < 4) return;
        move.moved = true;
        closeEditor();
      }
      const it = items[move.i];
      move.nx = Math.max(0, Math.min(e.pageX - move.dx, overlay.offsetWidth - it.w));
      move.ny = Math.max(0, Math.min(e.pageY - move.dy, overlay.offsetHeight - it.h));
      move.marker.style.left = move.nx + "px";
      move.marker.style.top = move.ny + "px";
      if (move.area) {
        move.area.style.left = move.nx + "px";
        move.area.style.top = move.ny + "px";
      }
      return;
    }
    if (!drag) return;
    if (!drag.rubber) {
      if (Math.abs(e.pageX - drag.x0) < 5 && Math.abs(e.pageY - drag.y0) < 5) return;
      drag.rubber = document.createElement("div");
      drag.rubber.className = "anno-area rubber";
      overlay.appendChild(drag.rubber);
    }
    drag.rect = {
      x: Math.min(drag.x0, e.pageX), y: Math.min(drag.y0, e.pageY),
      w: Math.abs(e.pageX - drag.x0), h: Math.abs(e.pageY - drag.y0),
    };
    const { x, y, w, h } = drag.rect;
    drag.rubber.style.cssText = `left:${x}px;top:${y}px;width:${w}px;height:${h}px`;
  });
  overlay.addEventListener("pointerup", () => {
    if (move) {
      if (move.moved) {
        const it = items[move.i];
        it.x = move.nx;
        it.y = move.ny;
        suppressClick = true;               // don't open the editor after a move
        setTimeout(() => { suppressClick = false; }, 0);
        render();
      }
      move = null;
      return;
    }
    if (!drag) return;
    if (drag.rubber) drag.rubber.remove();
    const rect = drag.rect && drag.rect.w > 8 && drag.rect.h > 8
      ? drag.rect
      : { x: drag.x0, y: drag.y0, w: 0, h: 0 };
    drag = null;
    items.push({ ...rect, comment: "", severity: "medium" });
    render();
    openEditor(items.length - 1);
  });
  overlay.addEventListener("pointercancel", () => {
    if (drag && drag.rubber) drag.rubber.remove();
    drag = null;
    if (move) { move = null; render(); }    // snap back to the stored position
  });

  overlay.addEventListener("click", (e) => {
    if (suppressClick) { suppressClick = false; return; }
    const m = e.target.closest(".marker");
    if (m) openEditor(+m.dataset.index);
  });

  // ---------- panel controls ----------
  list.addEventListener("click", (e) => {
    const del = e.target.closest(".card-del");
    if (del) {
      const i = +del.closest(".card").dataset.index;
      closeEditor();               // indices shift after the splice
      items.splice(i, 1);          // remaining issues renumber automatically
      render();
      return;
    }
    const card = e.target.closest(".card");
    if (!card) return;
    const i = +card.dataset.index;
    const marker = overlay.querySelector(`.marker[data-index="${i}"]`);
    marker.scrollIntoView({ block: "center", behavior: "smooth" });
    setTimeout(() => openEditor(i), 250);
  });
  list.addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === " ") && e.target.classList.contains("card")) {
      e.preventDefault();
      e.target.click();
    }
  });

  function setMarking(on) {
    marking = on;
    overlay.classList.toggle("marking", on);
    const b = $("btnMode");
    b.classList.toggle("on", on);
    b.innerHTML = on
      ? `Marking is on<small>Click or drag on the page to add an issue</small>`
      : `Marking is off<small>The page is interactive; markers stay clickable</small>`;
  }
  $("btnMode").addEventListener("click", () => setMarking(!marking));

  $("btnCollapse").addEventListener("click", () => { panel.hidden = true; tab.hidden = false; });
  tab.addEventListener("click", () => { tab.hidden = true; panel.hidden = false; });
  $("btnClose").addEventListener("click", () => { closeEditor(); host.remove(); });

  $("btnClear").addEventListener("click", () => {
    if (!items.length || confirm(`Remove all ${items.length} annotations on this page?`)) {
      items = []; closeEditor(); render();
    }
  });

  // ---------- popover controls ----------
  popover.querySelectorAll(".sev-btn").forEach((b) => {
    b.addEventListener("click", () => {
      if (editing < 0) return;
      items[editing].severity = b.dataset.sev;
      popover.querySelectorAll(".sev-btn").forEach((x) =>
        x.setAttribute("aria-pressed", String(x === b)));
      $("popNum").className = "num s-" + b.dataset.sev;
      const i = editing;
      render();               // recolors marker, area, and card
      editing = i;            // render() persists; keep the editor session alive
    });
  });
  $("popDone").addEventListener("click", closeEditor);
  $("popClose").addEventListener("click", closeEditor);
  $("popDelete").addEventListener("click", () => {
    stopDictation();
    if (editing < 0) return;
    items.splice(editing, 1); // remaining issues renumber automatically
    editing = -1;
    popover.hidden = true;
    render();
  });
  shadow.addEventListener("keydown", (e) => { if (e.key === "Escape") closeEditor(); });

  // drag the editor by its header — it can otherwise cover the thing being annotated
  const popHead = popover.querySelector(".pop-head");
  let popDrag = null;
  popHead.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || e.target.closest("button")) return;
    popDrag = {
      dx: e.clientX - (parseFloat(popover.style.left) || 0),
      dy: e.clientY - (parseFloat(popover.style.top) || 0),
    };
    try { popHead.setPointerCapture(e.pointerId); } catch (err) { /* synthetic events */ }
    e.preventDefault();
  });
  popHead.addEventListener("pointermove", (e) => {
    if (!popDrag) return;
    const w = popover.offsetWidth, h = popover.offsetHeight;
    popover.style.left = Math.max(8, Math.min(e.clientX - popDrag.dx, window.innerWidth - w - 8)) + "px";
    popover.style.top = Math.max(8, Math.min(e.clientY - popDrag.dy, window.innerHeight - h - 8)) + "px";
  });
  popHead.addEventListener("pointerup", () => { popDrag = null; });
  popHead.addEventListener("pointercancel", () => { popDrag = null; });

  // ---------- voice dictation (Web Speech API) ----------
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const micBtn = $("popMic");
  let rec = null;
  if (!SR) micBtn.hidden = true; // browser has no speech recognition

  function stopDictation() {
    if (rec) {
      const r = rec;
      rec = null;
      try { r.stop(); } catch (e) { /* already stopped */ }
    }
    micBtn.classList.remove("rec");
    micBtn.querySelector("span").textContent = "Dictate";
  }

  let micMsgTimer = null;
  function flagMicError(msg) {
    stopDictation();
    micBtn.querySelector("span").textContent = msg;
    micBtn.classList.add("err");
    clearTimeout(micMsgTimer);
    micMsgTimer = setTimeout(() => {
      micBtn.classList.remove("err");
      micBtn.querySelector("span").textContent = "Dictate";
    }, 4000);
  }

  micBtn.addEventListener("click", () => {
    if (rec) { stopDictation(); return; }
    const ta = $("popComment");
    const base = ta.value.replace(/\s+$/, "");
    const r = new SR();
    r.lang = navigator.language || "en-US";
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e) => {
      let text = "";
      for (const res of e.results) text += res[0].transcript;
      ta.value = (base ? base + " " : "") + text.trim();
    };
    r.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        flagMicError("Mic blocked");
        ta.placeholder = "Microphone blocked — allow mic access for this site, then try again";
      } else if (e.error === "no-speech") {
        flagMicError("No speech heard");
      } else if (e.error !== "aborted") {
        flagMicError("Mic unavailable");
      }
    };
    r.onend = () => { if (rec === r) stopDictation(); };
    try { r.start(); } catch (e) { return; }
    rec = r;
    micBtn.classList.add("rec");
    micBtn.querySelector("span").textContent = "Listening…";
  });

  // ---------- AI tidy (Chrome built-in on-device model, via the background worker) ----------
  const tidyBtn = $("popTidy");
  let tidyBusy = false;
  let tidyUndo = null; // original text while Undo is offered
  let tidyMsgTimer = null;

  if (typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.sendMessage) {
    tidyBtn.hidden = true; // not running as an extension
  }

  function resetTidy() {
    tidyUndo = null;
    tidyBusy = false;
    tidyBtn.disabled = false;
    tidyBtn.classList.remove("err", "busy");
    clearTimeout(tidyMsgTimer);
    tidyBtn.querySelector("span").textContent = "Tidy";
  }

  function flagTidyError(code) {
    const msg =
      code === "downloading" ? "Model downloading — retry soon"
      : code === "unavailable" ? "On-device AI unavailable"
      : "Tidy failed";
    tidyBtn.querySelector("span").textContent = msg;
    tidyBtn.classList.add("err");
    clearTimeout(tidyMsgTimer);
    tidyMsgTimer = setTimeout(() => {
      tidyBtn.classList.remove("err");
      tidyBtn.querySelector("span").textContent = "Tidy";
    }, 4000);
  }

  function requestTidy(text) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ type: "redline-tidy", text }, (resp) => {
          resolve(chrome.runtime.lastError ? { error: "failed" } : resp || { error: "failed" });
        });
      } catch (e) { resolve({ error: "failed" }); }
    });
  }

  tidyBtn.addEventListener("click", async () => {
    const ta = $("popComment");
    if (tidyUndo !== null) { // button is acting as Undo
      ta.value = tidyUndo;
      resetTidy();
      return;
    }
    const text = ta.value.trim();
    if (!text || tidyBusy) return;
    stopDictation();
    const forIndex = editing;
    tidyBusy = true;
    tidyBtn.disabled = true;
    tidyBtn.classList.add("busy");
    tidyBtn.querySelector("span").textContent = "Tidying…";
    const resp = await requestTidy(text);
    if (editing !== forIndex) { resetTidy(); return; } // editor moved on meanwhile
    tidyBusy = false;
    tidyBtn.disabled = false;
    tidyBtn.classList.remove("busy");
    if (resp && resp.text) {
      tidyUndo = text;
      ta.value = resp.text;
      tidyBtn.querySelector("span").textContent = "Undo";
    } else {
      flagTidyError(resp && resp.error);
    }
  });

  // typing after a tidy ends the Undo offer
  $("popComment").addEventListener("input", () => {
    if (tidyUndo !== null && !tidyBusy) resetTidy();
  });

  // ---------- full-page capture (slices via the background worker) ----------
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }
  function requestCapture() {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ type: "redline-capture" }, (resp) => {
          resolve(chrome.runtime.lastError ? null : (resp && resp.dataUrl) || null);
        });
      } catch (e) { resolve(null); } // not running as an extension
    });
  }

  async function captureFullPage() {
    const de = document.documentElement;
    const vw = innerWidth, vh = innerHeight;
    const totalH = Math.min(de.scrollHeight, vh * 20, 30000); // canvas safety cap
    const dpr = devicePixelRatio || 1;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(vw * dpr);
    canvas.height = Math.round(totalH * dpr);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff"; // JPEG has no transparency — avoid black gaps
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const origY = scrollY;
    panel.style.visibility = "hidden"; // keep markers visible, hide our chrome
    tab.style.visibility = "hidden";
    try {
      let y = 0, guard = 0;
      while (guard++ < 25) {
        scrollTo({ top: y, left: 0, behavior: "instant" });
        await sleep(600); // let the page settle; captureVisibleTab is rate-limited
        const slice = await requestCapture();
        if (!slice) return null;
        const img = await loadImage(slice);
        ctx.drawImage(img, 0, Math.round(scrollY * dpr), Math.round(vw * dpr), Math.round(vh * dpr));
        if (scrollY + vh >= totalH - 1) break;
        y = scrollY + vh;
      }
    } finally {
      panel.style.visibility = "";
      tab.style.visibility = "";
      scrollTo({ top: origY, left: 0, behavior: "instant" });
    }
    // JPEG keeps report files ~5-10x smaller than PNG — matters for emailing
    return canvas.toDataURL("image/jpeg", 0.85);
  }

  // ---------- export report ----------
  function defaultExportName() {
    return ((document.title || "easy-annotation-report")
      .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "easy-annotation-report");
  }

  $("btnExport").addEventListener("click", () => {
    if ($("btnExport").disabled) return;
    const box = $("exportName");
    if (!box.hidden) { box.hidden = true; return; } // second click toggles it closed
    $("exportFile").value = defaultExportName();
    box.hidden = false;
    $("exportFile").focus();
    $("exportFile").select();
  });
  $("exportCancel").addEventListener("click", () => { $("exportName").hidden = true; });
  $("exportFile").addEventListener("keydown", (e) => {
    if (e.key === "Enter") $("exportGo").click();
    else if (e.key === "Escape") $("exportName").hidden = true;
  });

  $("exportGo").addEventListener("click", () => {
    const raw = $("exportFile").value
      .replace(/[\\/:*?"<>|]+/g, " ")   // strip characters filesystems reject
      .replace(/\s+/g, " ").trim();
    const filename = (raw.replace(/\.html?$/i, "").trim() || defaultExportName()) + ".html";
    $("exportName").hidden = true;
    buildAndDownloadReport(filename);
  });

  async function buildAndDownloadReport(filename) {
    const btn = $("btnExport");
    if (btn.disabled) return false;
    closeEditor();
    btn.disabled = true;
    btn.textContent = "Capturing…";
    let shot = null;
    try { shot = await captureFullPage(); } catch (e) { shot = null; }
    btn.disabled = false;
    btn.textContent = "Export";

    const title = escapeHTML(document.title || location.hostname);
    const stamp = new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
    const tally = { low: 0, medium: 0, high: 0 };
    items.forEach((it) => tally[it.severity]++);
    const cards = items.map((it, i) => `
      <div class="card s-${it.severity}">
        <span class="n">${i + 1}</span>
        <div><span class="t">${it.severity}</span>
        <p>${it.comment ? escapeHTML(it.comment) : "<em>No comment</em>"}</p></div>
      </div>`).join("");
    const body = shot
      ? `<div class="grid">
           <div class="sheet"><img src="${shot}" alt="Annotated page capture"></div>
           <div class="rail">${cards || "<p>No annotations.</p>"}</div>
         </div>`
      : (cards || "<p>No annotations.</p>");
    const doc = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} — Easy Annotation report</title>
<style>
  body{margin:0;font:14px/1.5 "Avenir Next","Segoe UI",system-ui,sans-serif;color:#1b2430;background:#f1f2ef}
  .wrap{max-width:${shot ? "1280px" : "760px"};margin:0 auto;padding:32px 24px}
  h1{margin:0;font-size:21px}
  header p{margin:4px 0 0;color:#5a6472;font-size:13px;overflow-wrap:anywhere}
  header a{color:#2456e6}
  .chips{display:flex;gap:6px;margin:12px 0 20px;font:600 11.5px ui-monospace,monospace}
  .chips span{padding:2px 9px;border-radius:99px}
  .c-high{color:#d8372a;background:#fce9e6}.c-med{color:#a35f00;background:#fbf0de}.c-low{color:#2e9e5b;background:#e5f4ea}
  .s-low{--c:#2e9e5b}.s-medium{--c:#d97e00}.s-high{--c:#d8372a}
  .card{display:grid;grid-template-columns:26px 1fr;gap:10px;padding:10px 12px;margin:0 0 8px;background:#fff;
        border:1px solid #dcdfd9;border-left:3px solid var(--c);border-radius:6px}
  .card .n{width:24px;height:24px;border-radius:50%;background:var(--c);color:#fff;font:700 11px/24px ui-monospace,monospace;text-align:center}
  .card .t{font:600 10.5px ui-monospace,monospace;letter-spacing:.06em;text-transform:uppercase;color:var(--c)}
  .card p{margin:3px 0 0;overflow-wrap:anywhere}
  .grid{display:grid;grid-template-columns:1fr 320px;gap:20px;align-items:start}
  @media(max-width:900px){.grid{grid-template-columns:1fr}}
  .sheet{background:#fff;border:1px solid #dcdfd9;box-shadow:0 2px 12px rgba(27,36,48,.08)}
  .sheet img{display:block;width:100%;height:auto}
  @media print{@page{margin:12mm}body{background:#fff}.wrap{padding:0}
    .grid{grid-template-columns:1fr}.sheet{box-shadow:none}
    .card,.chips span,.card .n{print-color-adjust:exact;-webkit-print-color-adjust:exact}
    .card{break-inside:avoid}}
</style></head><body><div class="wrap">
<header><h1>${title}</h1>
<p>Easy Annotation report · ${stamp} · ${items.length} issue${items.length === 1 ? "" : "s"}<br>
<a href="${escapeHTML(location.href)}">${escapeHTML(location.href)}</a></p></header>
<div class="chips"><span class="c-high">${tally.high} high</span><span class="c-med">${tally.medium} med</span><span class="c-low">${tally.low} low</span></div>
${body}
</div></body></html>`;
    const blob = new Blob([doc], { type: "text/html" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
    return true;
  }

  // ---------- boot ----------
  restore((data) => {
    if (data && Array.isArray(data.items)) items = data.items;
    render();
  });
})();

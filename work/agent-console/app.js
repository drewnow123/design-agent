/* Handoff. The console for a pipeline that is parked most of the time.
 *
 * Two rules run through this whole file.
 *
 * 1. Every string in state.json was written by an agent that read the open
 *    internet. It is untrusted. Nothing sourced from state is ever assigned
 *    as raw markup. The DOM is built with createElement and textContent, and
 *    the markdown renderer below is hand written for the same reason.
 *
 * 2. Nothing the operator typed is ever thrown away by the machine. Drafts
 *    persist to localStorage, and a background poll never replaces an ask he
 *    is in the middle of reading.
 */

(function () {
  "use strict";

  var POLL_MS = 5000;
  var TICK_MS = 15000;          // elapsed times are coarse on purpose
  var RELEASE_MS = 450;         // the rule closing
  var PHONE = window.matchMedia("(max-width: 560px)");
  var CALM = window.matchMedia("(prefers-reduced-motion: reduce)");

  var STATE_ORDER = { held: 0, stopped: 1, running: 2, ready: 3, clear: 4 };
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  var boardEl = document.getElementById("board");
  var heldCountEl = document.getElementById("heldcount");

  var store = {
    data: null,
    source: null,        // "api" or "sample"
    view: { name: "board" },
    openAsk: null,       // { slug, id, revision } currently rendered answerable
    askChanged: false,   // a poll saw the open ask move underneath us
    busy: false,         // a response is in flight, hold the poll
    cursor: 0,
    cursorActive: false,   // no cursor is drawn until j or k is pressed
    promote: false,        // the next ask rises into Zone 1 once
    problem: null,         // the api answered, and could not read the state
    rows: []
  };

  /* ------------------------------------------------------------ helpers */

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) { n.className = cls; }
    if (text !== undefined && text !== null) { n.textContent = String(text); }
    return n;
  }

  // ids end up in htmlFor and aria-describedby, so they cannot carry the
  // slashes an ask id uses by convention.
  function domId(prefix, askId, key) {
    return (prefix + "-" + askId + "-" + key).replace(/[^A-Za-z0-9_-]+/g, "-");
  }

  function clear(node) {
    while (node.firstChild) { node.removeChild(node.firstChild); }
  }

  function pad2(n) { return (n < 10 ? "0" : "") + n; }

  // An `at` value is either a full instant or a bare date. Some real events in
  // this repo's history have no recorded clock time, and inventing one would
  // be a lie in a register whose whole job is to say what happened.
  function hasClock(at) { return /T\d{2}:\d{2}/.test(String(at || "")); }

  function clockOf(at) {
    var d = new Date(at);
    if (isNaN(d.getTime())) { return String(at); }
    return pad2(d.getHours()) + ":" + pad2(d.getMinutes());
  }

  function dayOf(at) {
    var s = String(at || "");
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    if (!m) { return s; }
    return MONTHS[Number(m[2]) - 1] + " " + Number(m[3]);
  }

  function stamp(at) { return hasClock(at) ? clockOf(at) : dayOf(at); }

  function elapsed(since) {
    var t = new Date(since).getTime();
    if (isNaN(t)) { return ""; }
    var min = Math.floor((Date.now() - t) / 60000);
    if (min < 1) { return "under a min"; }
    if (min < 60) { return min + " min"; }
    var hr = Math.round(min / 60);
    if (hr < 48) { return hr + " hr"; }
    return Math.round(hr / 24) + " days";
  }

  function stateWord(p) {
    if (p.state === "held") { return "held, waiting on you"; }
    if (p.state === "running") { return "running, " + elapsed(p.since); }
    if (p.state === "ready") { return "ready to run"; }
    if (p.state === "clear") { return "clear"; }
    if (p.state === "stopped") { return "stopped " + stamp(p.since); }
    return String(p.state);
  }

  function projects() {
    return (store.data && store.data.projects) || [];
  }

  function enteredAt(p) {
    var t = new Date(p && p.since).getTime();
    return isNaN(t) ? 0 : t;
  }

  // State first, then oldest first. A register whose argument is "show where
  // it stopped" cannot order the things that stopped alphabetically: the one
  // that has been waiting longest is the one to answer first.
  function sorted() {
    return projects().slice().sort(function (a, b) {
      var d = (STATE_ORDER[a.state] === undefined ? 9 : STATE_ORDER[a.state])
            - (STATE_ORDER[b.state] === undefined ? 9 : STATE_ORDER[b.state]);
      if (d !== 0) { return d; }
      var age = enteredAt(a) - enteredAt(b);
      return age !== 0 ? age : String(a.slug).localeCompare(String(b.slug));
    });
  }

  function heldOnes() {
    return sorted().filter(function (p) { return p.state === "held" && p.ask; });
  }

  function findProject(slug) {
    var all = projects();
    for (var i = 0; i < all.length; i++) {
      if (all[i].slug === slug) { return all[i]; }
    }
    return null;
  }

  /* ------------------------------------------------------------- drafts */

  function draftKey(askId) { return "handoff.draft." + askId; }
  function checkKey(askId) { return "handoff.checks." + askId; }

  function readDraft(askId) {
    try { return localStorage.getItem(draftKey(askId)) || ""; } catch (e) { return ""; }
  }

  function writeDraft(askId, value) {
    try { localStorage.setItem(draftKey(askId), value); } catch (e) { /* full or blocked */ }
  }

  function dropDraft(askId) {
    try {
      localStorage.removeItem(draftKey(askId));
      localStorage.removeItem(checkKey(askId));
      localStorage.removeItem(openKey(askId));
    } catch (e) { /* nothing to do */ }
  }

  // Whether the writing surface is open is its own state. Deriving it from
  // "is there a draft" collapses an opened but still empty box on the next
  // poll, which is the moment he is most likely to be mid-thought.
  function openKey(askId) { return "handoff.open." + askId; }

  function readOpen(askId) {
    try { return localStorage.getItem(openKey(askId)) === "1"; } catch (e) { return false; }
  }

  function writeOpen(askId, on) {
    try {
      if (on) { localStorage.setItem(openKey(askId), "1"); }
      else { localStorage.removeItem(openKey(askId)); }
    } catch (e) { /* ignore */ }
  }

  function readChecks(askId) {
    try {
      var raw = localStorage.getItem(checkKey(askId));
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  }

  function writeChecks(askId, ids) {
    try { localStorage.setItem(checkKey(askId), JSON.stringify(ids)); } catch (e) { /* ignore */ }
  }

  /* --------------------------------------------------------- the markdown
   * Hand written, supporting exactly: h1 to h3, paragraphs, ul, ol, tables,
   * fenced code, blockquote, bold, italic, inline code and links. Anything
   * else degrades to a paragraph. Everything is escaped by construction,
   * because every node here is made with createElement and textContent.
   */

  var HEX = /^`?#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})`?$/;

  // Written by code point so the source carries no backslash of its own.
  function isSlash(ch) { return ch === "/" || ch === String.fromCharCode(92); }

  function safeHref(raw) {
    var s = String(raw || "").trim();
    // A leading pair of slashes is protocol relative, so //evil.example/x
    // would inherit the page's scheme and leave the machine. It looks like a
    // path and is not one, so it is rejected before the relative test.
    if (isSlash(s.charAt(0)) && isSlash(s.charAt(1))) { return null; }
    if (/^https?:\/\//i.test(s)) { return s; }
    if (/^[#./]/.test(s) && s.indexOf(":") === -1) { return s; }
    return null;   // javascript:, data: and anything else never becomes a link
  }

  // The underscore branch carries lookarounds that the asterisk branch does
  // not, and the difference is deliberate. CommonMark forbids intraword `_`
  // emphasis precisely so identifiers survive, and every direction doc in
  // this repo opens with a line like `DESIGN_VARIANCE 4 · MOTION_INTENSITY 2`.
  // Without the guard that line loses two underscores and half of it goes
  // italic, which means the console silently alters the text of the document
  // it is asking a person to approve. An opening `_` may not follow an
  // alphanumeric or an underscore, and a closing `_` may not precede one.
  var INLINE = /(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(\*[^*\n]+\*)|((?<![A-Za-z0-9_])_[^_\n]+_(?![A-Za-z0-9_]))|(\[[^\]\n]+\]\([^)\s]+\))/g;

  function inline(text, parent) {
    var src = String(text);

    // Scan the whole string before building anything. This function recurses
    // for bold and italic, and INLINE is one shared global regex: a nested
    // call resets its lastIndex, which would send the outer loop back to the
    // token it just consumed and keep it there. Finishing the scan first
    // makes the recursion safe, because by the time a nested call touches
    // lastIndex this loop is already done with it.
    var toks = [];
    var m;
    INLINE.lastIndex = 0;
    while ((m = INLINE.exec(src)) !== null) {
      toks.push({
        at: m.index,
        text: m[0],
        code: !!m[1],
        bold: !!m[2],
        em: !!(m[3] || m[4]),
        link: !!m[5]
      });
      if (INLINE.lastIndex === m.index) { INLINE.lastIndex++; }
    }

    var last = 0;
    toks.forEach(function (t) {
      if (t.at > last) {
        parent.appendChild(document.createTextNode(src.slice(last, t.at)));
      }
      var tok = t.text;
      if (t.code) {
        parent.appendChild(el("code", "mono", tok.slice(1, -1)));
      } else if (t.bold) {
        var b = el("strong");
        inline(tok.slice(2, -2), b);
        parent.appendChild(b);
      } else if (t.em) {
        var i = el("em");
        inline(tok.slice(1, -1), i);
        parent.appendChild(i);
      } else if (t.link) {
        var cut = tok.indexOf("](");
        var label = tok.slice(1, cut);
        var href = safeHref(tok.slice(cut + 2, -1));
        if (href) {
          var a = el("a", "doc-link");
          a.href = href;
          a.rel = "noopener noreferrer";
          if (/^https?:/i.test(href)) { a.target = "_blank"; }
          inline(label, a);
          parent.appendChild(a);
        } else {
          // javascript: and friends never become a link, only their text
          parent.appendChild(document.createTextNode(label));
        }
      }
      last = t.at + tok.length;
    });

    if (last < src.length) {
      parent.appendChild(document.createTextNode(src.slice(last)));
    }
    return parent;
  }

  function splitRow(line) {
    var s = line.trim().replace(/^\|/, "").replace(/\|$/, "");
    var out = [];
    var buf = "";
    for (var i = 0; i < s.length; i++) {
      if (s[i] === "\\" && s[i + 1] === "|") { buf += "|"; i++; continue; }
      if (s[i] === "|") { out.push(buf.trim()); buf = ""; continue; }
      buf += s[i];
    }
    out.push(buf.trim());
    return out;
  }

  function isSeparator(line) {
    return /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line || "");
  }

  function buildTable(head, rows) {
    var wrap = el("div", "doc-tablewrap");
    var table = el("table", "doc-table");
    if (rows.length > 6) { table.classList.add("rows-many"); }

    var thead = el("thead");
    var htr = el("tr");
    head.forEach(function (h) { inline(h, htr.appendChild(el("th"))); });
    thead.appendChild(htr);
    table.appendChild(thead);

    // A column of hex values gets a real swatch drawn from the real value.
    // The console understands the kind of document it is being asked to
    // approve, which is the single most useful thing it can do here.
    var swatchCol = [];
    head.forEach(function (_, c) {
      var hits = 0;
      rows.forEach(function (r) { if (HEX.test(r[c] || "")) { hits++; } });
      swatchCol[c] = hits >= 2 && hits >= rows.length / 2;
    });

    var tbody = el("tbody");
    rows.forEach(function (cells) {
      var tr = el("tr");
      head.forEach(function (_, c) {
        var td = el("td");
        var raw = cells[c] === undefined ? "" : cells[c];
        if (swatchCol[c] && HEX.test(raw)) {
          var sw = el("span", "swatch");
          sw.style.backgroundColor = raw.replace(/`/g, "");
          td.appendChild(sw);
        }
        inline(raw, td);
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
    return wrap;
  }

  function renderMarkdown(src) {
    var frag = document.createDocumentFragment();
    var headings = [];
    var lines = String(src || "").replace(/\r\n?/g, "\n").split("\n");
    var i = 0;

    while (i < lines.length) {
      var line = lines[i];

      if (!line.trim()) { i++; continue; }

      if (/^\s*```/.test(line)) {
        var body = [];
        i++;
        while (i < lines.length && !/^\s*```/.test(lines[i])) { body.push(lines[i]); i++; }
        i++;
        frag.appendChild(el("pre", "doc-code", body.join("\n")));
        continue;
      }

      var h = /^(#{1,3})\s+(.*)$/.exec(line);
      if (h) {
        var level = h[1].length;
        var node = el("h" + (level + 1), "doc-h" + level);
        inline(h[2].trim(), node);
        if (level === 2) { headings.push({ text: node.textContent, node: node }); }
        frag.appendChild(node);
        i++;
        continue;
      }

      if (/^\s*>\s?/.test(line)) {
        var quoted = [];
        while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
          quoted.push(lines[i].replace(/^\s*>\s?/, ""));
          i++;
        }
        inline(quoted.join(" ").trim(), frag.appendChild(el("blockquote", "doc-quote")));
        continue;
      }

      if (/^\s*\|/.test(line) && isSeparator(lines[i + 1])) {
        var head = splitRow(line);
        i += 2;
        var rows = [];
        while (i < lines.length && /^\s*\|/.test(lines[i])) {
          rows.push(splitRow(lines[i]));
          i++;
        }
        frag.appendChild(buildTable(head, rows));
        continue;
      }

      if (/^\s*[-*]\s+/.test(line) || /^\s*\d+\.\s+/.test(line)) {
        var ordered = /^\s*\d+\.\s+/.test(line);
        var list = el(ordered ? "ol" : "ul", "doc-list");
        var n = 1;
        while (i < lines.length &&
               (ordered ? /^\s*\d+\.\s+/.test(lines[i]) : /^\s*[-*]\s+/.test(lines[i]))) {
          var item = el("li", "doc-li");
          item.setAttribute("data-marker", ordered ? n + "." : "•");
          inline(lines[i].replace(/^\s*(?:[-*]|\d+\.)\s+/, ""), item);
          list.appendChild(item);
          n++;
          i++;
        }
        frag.appendChild(list);
        continue;
      }

      // everything else is a paragraph
      var para = [];
      while (i < lines.length && lines[i].trim() &&
             !/^\s*(#{1,3}\s|>|\||```|[-*]\s|\d+\.\s)/.test(lines[i])) {
        para.push(lines[i].trim());
        i++;
      }
      if (!para.length) { para.push(lines[i].trim()); i++; }
      inline(para.join(" "), frag.appendChild(el("p", "doc-p")));
    }

    return { frag: frag, headings: headings };
  }

  /* ------------------------------------------------------------- chrome */

  function faviconFor(held) {
    var ink = held ? "#F5D547" : "#7B8681";
    var parts = ["<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'>",
                 "<rect width='32' height='32' rx='4' fill='#0E1210'/>"];
    if (held) {
      // the rule stops, and a cross-bar closes it
      parts.push("<rect x='15' y='4' width='2' height='11' fill='#7B8681'/>");
      parts.push("<rect x='9' y='16' width='14' height='3' fill='" + ink + "'/>");
    } else {
      // the rule runs through
      parts.push("<rect x='15' y='4' width='2' height='24' fill='" + ink + "'/>");
    }
    parts.push("</svg>");
    return "data:image/svg+xml," + encodeURIComponent(parts.join(""));
  }

  function updateChrome() {
    var n = heldOnes().length;
    document.title = n > 0 ? n + " held · Handoff" : "Handoff";
    var link = document.querySelector("link[rel='icon']");
    if (link) { link.href = faviconFor(n > 0); }
    heldCountEl.textContent = n > 0 ? n + " held" : "nothing held";
    heldCountEl.classList.toggle("is-held", n > 0);
  }

  function toggleTheme() {
    var root = document.documentElement;
    var next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
    root.setAttribute("data-theme", next);
    try { localStorage.setItem("handoff.theme", next); } catch (e) { /* ignore */ }
    render();
  }

  /* --------------------------------------------------------- band making */

  function band(spineState, extraClass) {
    var row = el("div", "band" + (extraClass ? " " + extraClass : ""));
    var spine = el("div", "spine");
    spine.setAttribute("aria-hidden", "true");
    if (spineState) { spine.setAttribute("data-state", spineState); }
    var content = el("div");
    row.appendChild(spine);
    row.appendChild(content);
    row._spine = spine;
    row._content = content;
    return row;
  }

  /* ---------------------------------------------------------- the asks */

  function askMeta(p, ask) {
    var bits = [];
    if (ask.from) { bits.push(ask.from + " finished " + stamp(ask.at || p.since)); }
    if (ask.meta) { bits.push(ask.meta); }
    return bits.join(" · ");
  }

  function renderAsk(p) {
    var ask = p.ask;
    var row = band(p.state === "stopped" ? "stopped" : "held");
    var box = el("div", "ask holdfield");
    if (p.state === "stopped") { box.classList.add("is-stopped"); }
    box.setAttribute("data-ask", ask.id);

    var head = el("h2", "ask-headline", ask.headline || ("Answer " + p.slug));
    box.appendChild(head);

    var meta = askMeta(p, ask);
    if (meta) { box.appendChild(el("p", "ask-meta", meta)); }

    var body = el("div", "ask-body");
    var foot = el("div", "ask-foot");
    var ctx = { project: p, ask: ask, box: box, spine: row._spine, body: body, foot: foot };

    if (ask.kind === "direction") { shapeDirection(ctx); }
    else if (ask.kind === "build") { shapeBuild(ctx); }
    else if (ask.kind === "findings") { shapeFindings(ctx); }
    else { shapeQuestion(ctx); }

    box.appendChild(body);
    box.appendChild(foot);
    row._content.appendChild(box);

    store.openAsk = { slug: p.slug, id: ask.id, revision: ask.revision };
    if (store.askChanged) { showChanged(box); }
    return row;
  }

  // Amendment B, in one line of the console's own voice.
  function showChanged(box) {
    if (box.querySelector(".ask-notice")) { return; }
    var line = el("p", "ask-notice",
      "this ask changed at " + clockOf(new Date().toISOString()) + ". reload to see it.");
    var meta = box.querySelector(".ask-meta");
    box.insertBefore(line, meta ? meta.nextSibling : box.firstChild.nextSibling);
  }

  function noteInAsk(box, text) {
    var existing = box.querySelector(".ask-notice");
    if (existing) { existing.textContent = text; return; }
    var line = el("p", "ask-notice", text);
    var meta = box.querySelector(".ask-meta");
    box.insertBefore(line, meta ? meta.nextSibling : box.firstChild.nextSibling);
  }

  function control(label, keyHint, onPress, focusKey) {
    var b = el("button", "control");
    b.type = "button";
    b.appendChild(document.createTextNode(label));
    if (keyHint) { b.appendChild(el("span", "key", keyHint)); }
    if (focusKey) { b.setAttribute("data-fk", focusKey); }
    b.addEventListener("click", onPress);
    return b;
  }

  /* shape 1: approve a direction doc */
  function shapeDirection(ctx) {
    var wrap = el("div", "ask-withrail");
    var surface = el("div", "ask-surface");
    var doc = el("article", "doc");
    var out = renderMarkdown(ctx.ask.document);
    doc.appendChild(out.frag);
    surface.appendChild(doc);
    wrap.appendChild(surface);

    if (out.headings.length > 1) {
      var rail = el("nav", "rail");
      rail.setAttribute("aria-label", "Sections of this document");
      rail.appendChild(el("p", "rail-title", "sections"));
      var list = el("div", "rail-list");
      out.headings.forEach(function (h) {
        var b = el("button", "rail-item", h.text);
        b.type = "button";
        b.addEventListener("click", function () {
          h.node.scrollIntoView({ block: "start", behavior: CALM.matches ? "auto" : "smooth" });
        });
        list.appendChild(b);
      });
      rail.appendChild(list);
      wrap.appendChild(rail);
    }

    ctx.body.appendChild(wrap);
    twoWayFoot(ctx, "Approve direction", "Request changes", "approved the direction",
               "What needs to change");
  }

  /* shape 2: review a build */
  function shapeBuild(ctx) {
    var ask = ctx.ask;
    // No panel. The held field is the only bounded surface in the console,
    // and a second rounded box inside it would mean neither boundary reads.
    var surface = el("div", "ask-plain");
    var bar = el("div", "preview-bar");
    var href = safeHref(ask.previewUrl);

    if (PHONE.matches) {
      // An iframe of a desktop layout inside a phone is a misleading way to
      // approve a design, so the phone gets the link instead of the frame.
      if (href) {
        var only = el("a", "control", "Open the preview");
        only.href = href;
        only.target = "_blank";
        only.rel = "noopener noreferrer";
        bar.appendChild(only);
      }
      surface.appendChild(bar);
    } else {
      var widths = el("div", "preview-widths");
      var frame = el("div", "preview-frame");
      frame.setAttribute("data-width", "full");
      ["375", "720", "full"].forEach(function (w) {
        var b = el("button", "width-pick", w);
        b.type = "button";
        b.setAttribute("aria-pressed", w === "full" ? "true" : "false");
        b.addEventListener("click", function () {
          frame.setAttribute("data-width", w);
          widths.querySelectorAll(".width-pick").forEach(function (o) {
            o.setAttribute("aria-pressed", o === b ? "true" : "false");
          });
        });
        widths.appendChild(b);
      });
      bar.appendChild(widths);
      if (href) {
        var out = el("a", "control control-quiet", "Open in a tab");
        out.href = href;
        out.target = "_blank";
        out.rel = "noopener noreferrer";
        bar.appendChild(out);
      }
      surface.appendChild(bar);

      if (href) {
        // Rendering another project's JavaScript inside this console, so the
        // frame gets scripts and nothing else. No allow-same-origin.
        var f = document.createElement("iframe");
        f.setAttribute("sandbox", "allow-scripts");
        f.setAttribute("loading", "lazy");
        f.setAttribute("title", "Preview of " + ctx.project.slug);
        f.src = href;
        frame.appendChild(f);
        surface.appendChild(frame);
      }
    }

    if (ask.changed && ask.changed.length) {
      var changed = el("div", "changed doc");
      changed.appendChild(el("h3", "doc-h3", "What changed"));
      var list = el("ul", "doc-list");
      ask.changed.forEach(function (c) {
        var li = el("li", "doc-li");
        li.setAttribute("data-marker", "•");
        inline(c, li);
        list.appendChild(li);
      });
      changed.appendChild(list);
      surface.appendChild(changed);
    }

    ctx.body.appendChild(surface);
    twoWayFoot(ctx, "Approve build", "Send back with notes", "approved the build",
               "What to send back");
  }

  /* shape 3: triage review findings */
  function shapeFindings(ctx) {
    var ask = ctx.ask;
    var all = ask.findings || [];
    var picked = {};
    readChecks(ask.id).forEach(function (id) { picked[id] = true; });

    var surface = el("div", "ask-plain");
    var set = el("fieldset", "findings");
    var legend = el("legend", "findings-legend",
      "Pick the findings to send back to " + (ask.to || "the builder"));
    set.appendChild(legend);

    var submit = control("", "a", send, "submit");

    function relabel() {
      var n = Object.keys(picked).filter(function (k) { return picked[k]; }).length;
      submit.firstChild.textContent = n === 0
        ? "Send nothing, close the review"
        : "Send " + n + " of " + all.length + " to " + (ask.to || "the builder");
    }

    all.forEach(function (f, idx) {
      var key = f.id || String(idx);
      var boxId = domId("f", ask.id, key);
      var whereId = domId("fw", ask.id, key);

      var rowEl = el("div", "finding");
      var box = document.createElement("input");
      box.type = "checkbox";
      box.id = boxId;
      box.checked = !!picked[key];
      box.addEventListener("change", function () {
        picked[key] = box.checked;
        writeChecks(ask.id, Object.keys(picked).filter(function (k) { return picked[k]; }));
        relabel();
      });

      // The severity and the description both label the checkbox, so it
      // announces "must-fix, focus ring is invisible on the yellow field"
      // instead of the word "must-fix" three times down the list. The path
      // describes rather than names it: read aloud as a name it is noise.
      var sev = el("label", "finding-sev", f.severity || "nitpick");
      sev.setAttribute("data-sev", f.severity || "nitpick");
      sev.htmlFor = boxId;

      var text = el("div", "finding-text");
      var desc = el("label", "finding-desc");
      desc.htmlFor = boxId;
      inline(f.text || "", desc);
      text.appendChild(desc);
      if (f.where) {
        var where = el("span", "finding-where", f.where);
        where.id = whereId;
        text.appendChild(where);
        box.setAttribute("aria-describedby", whereId);
      }

      rowEl.appendChild(box);
      rowEl.appendChild(sev);
      rowEl.appendChild(text);
      set.appendChild(rowEl);
    });

    surface.appendChild(set);
    ctx.body.appendChild(surface);

    relabel();

    function send() {
      var ids = Object.keys(picked).filter(function (k) { return picked[k]; });
      respond(ctx, ids.length ? "send-findings" : "close-review", {
        findings: ids,
        of: all.length
      });
    }

    var controls = el("div", "controls");
    controls.appendChild(submit);
    ctx.foot.appendChild(controls);
  }

  /* shape 4: answer a question */
  function shapeQuestion(ctx) {
    var ask = ctx.ask;
    var surface = el("div", "ask-plain");
    var q = el("p", "question");
    inline(ask.question || ask.headline || "", q);
    surface.appendChild(q);
    if (ask.note) {
      var note = el("p", "question-note");
      inline(ask.note, note);
      surface.appendChild(note);
    }

    var options = (ask.options || []).slice(0, 4);
    if (options.length) {
      var list = el("div", "options");
      options.forEach(function (o, idx) {
        var label = typeof o === "string" ? o : (o.label || "");
        var value = typeof o === "string" ? o : (o.id || label);
        var b = control(label, String(idx + 1), function () {
          respond(ctx, "answer", { answer: value, label: label });
        }, "opt" + (idx + 1));
        b.classList.add("control-wide");
        list.appendChild(b);
      });
      surface.appendChild(list);
      ctx.body.appendChild(surface);
      ctx.foot.appendChild(el("p", "pending", "Pick one. The number keys work too."));
      return;
    }

    var lab = el("label", "write-label", "Your answer");
    var field = el("textarea", "write");
    field.id = "answer-" + ask.id;
    lab.htmlFor = field.id;
    field.value = readDraft(ask.id);
    field.setAttribute("data-fk", "write");
    field.addEventListener("input", function () { writeDraft(ask.id, field.value); });
    surface.appendChild(lab);
    surface.appendChild(field);
    ctx.body.appendChild(surface);

    var controls = el("div", "controls");
    controls.appendChild(control("Send answer", "a", function () {
      respond(ctx, "answer", { answer: field.value.trim() });
    }, "approve"));
    ctx.foot.appendChild(controls);
  }

  /* the response bar shared by the direction and build shapes */
  function twoWayFoot(ctx, yesLabel, noLabel, yesDecision, writeLabel) {
    var controls = el("div", "controls");
    var opened = false;

    var yes = control(yesLabel, "a", function () {
      respond(ctx, "approve", { note: yesDecision });
    }, "approve");

    var no = control(noLabel, "c", function () { openWriting(true); }, "changes");

    controls.appendChild(yes);
    controls.appendChild(no);
    ctx.foot.appendChild(controls);

    var lab = el("label", "write-label", writeLabel);
    var field = el("textarea", "write");
    field.id = "write-" + ctx.ask.id;
    lab.htmlFor = field.id;
    field.setAttribute("data-fk", "write");
    field.value = readDraft(ctx.ask.id);
    field.addEventListener("input", function () { writeDraft(ctx.ask.id, field.value); });

    var sendRow = el("div", "controls send-row");
    sendRow.appendChild(control("Send the notes", null, function () {
      respond(ctx, "changes", { note: field.value.trim() });
    }, "send"));

    function openWriting(focusIt) {
      if (!opened) {
        opened = true;
        writeOpen(ctx.ask.id, true);
        ctx.foot.appendChild(lab);
        ctx.foot.appendChild(field);
        ctx.foot.appendChild(sendRow);
      }
      // The control stays live so a second press puts the caret back in the
      // box rather than doing nothing.
      if (focusIt) { field.focus(); }
    }

    // Reopen on a surviving draft, or on the box simply having been opened.
    // Restoring must not steal focus: render() puts focus back itself.
    if (field.value || readOpen(ctx.ask.id)) { openWriting(false); }

    ctx._openWriting = openWriting;
  }

  /* -------------------------------------------------------- responding */

  function respond(ctx, decision, payload) {
    if (store.busy) { return; }
    store.busy = true;

    var body = JSON.stringify({
      project: ctx.project.slug,
      askId: ctx.ask.id,
      revision: ctx.ask.revision,
      decision: decision,
      payload: payload || {}
    });

    fetch("api/respond", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (json) {
        return { status: res.status, json: json };
      });
    }).then(function (out) {
      store.busy = false;
      if (out.status === 409) {
        store.askChanged = true;
        noteInAsk(ctx.box, "this ask changed at " + clockOf(new Date().toISOString()) +
                           ". reload to see it.");
        return;
      }
      if (out.status !== 200 || !out.json || !out.json.projects) {
        noteInAsk(ctx.box, "the response was not written. " +
                           (out.json && out.json.error ? out.json.error : "the api refused it."));
        return;
      }
      dropDraft(ctx.ask.id);
      release(ctx, out.json);
    }).catch(function () {
      store.busy = false;
      noteInAsk(ctx.box, "the api is not running. nothing was written.");
    });
  }

  // The payoff. You released the line, and you see it release.
  function release(ctx, nextData) {
    var apply = function () {
      store.data = nextData;
      store.askChanged = false;
      store.promote = true;   // whatever is next rises into Zone 1
      render();
    };
    if (CALM.matches) { apply(); return; }
    ctx.spine.classList.add("is-releasing");
    ctx.box.classList.add("is-draining");
    window.setTimeout(apply, RELEASE_MS);
  }

  /* ------------------------------------------------------------ rendering */

  function focusKeyNow() {
    var a = document.activeElement;
    return a && a.getAttribute ? a.getAttribute("data-fk") : null;
  }

  function restoreFocus(key) {
    if (!key) { return; }
    var node = boardEl.querySelector("[data-fk='" + key + "']");
    if (node) {
      node.focus();
      if (node.setSelectionRange && typeof node.value === "string") {
        node.setSelectionRange(node.value.length, node.value.length);
      }
    }
  }

  function render() {
    // A poll can repaint the board while he is halfway down a 3,000 word
    // document. Losing his place would be its own kind of swapping the ask
    // out from under him, so focus and scroll both survive a repaint.
    // go() scrolls to the top before calling this, so navigation still lands
    // at the top rather than being pulled back.
    var keep = focusKeyNow();
    var y = window.scrollY;

    store.openAsk = null;
    store.rows = [];
    clear(boardEl);
    if (store.view.name === "project") { renderProject(); } else { renderBoard(); }
    store.promote = false;
    updateChrome();
    restoreFocus(keep);
    if (window.scrollY !== y) { window.scrollTo(0, y); }
  }

  function renderBoard() {
    var all = sorted();

    if (!all.length) {
      var e = band(null, "empty");
      e._content.appendChild(el("h2", "empty-line", "No projects yet."));
      e._content.appendChild(el("p", "empty-sub",
        "This console reads and answers. Projects start in the terminal, " +
        "by giving the orchestrator a brief."));
      boardEl.appendChild(e);
      boardEl.appendChild(footer());
      return;
    }

    var held = heldOnes();

    if (held.length) {
      var zone = el("div", "zone1");
      var askRow = renderAsk(held[0]);
      if (store.promote) {
        var risen = askRow.querySelector(".ask");
        if (risen) { risen.classList.add("is-promoting"); }
      }
      zone.appendChild(askRow);
      boardEl.appendChild(zone);

      if (held.length > 1) {
        var more = band(null, "moreheld");
        var rest = held.slice(1);
        more._content.appendChild(el("p", "moreheld-count",
          rest.length + " more held"));
        rest.forEach(function (p) {
          var b = el("button", "moreheld-item");
          b.type = "button";
          b.appendChild(el("span", "moreheld-name", p.slug));
          b.appendChild(el("span", "moreheld-what", p.ask.headline || "waiting on you"));
          b.addEventListener("click", function () { go("project", p.slug); });
          more._content.appendChild(b);
        });
        boardEl.appendChild(more);
      }
    } else {
      boardEl.appendChild(calmState(all));
    }

    var head = band(null, "line-head");
    head._content.appendChild(el("h2", "line-title", "The line"));
    boardEl.appendChild(head);

    var rows = el("nav", "line-rows");
    rows.setAttribute("aria-label", "Projects");
    all.forEach(function (p, idx) {
      var r = band(p.state, "reg-band");
      var b = el("button", "reg");
      b.type = "button";
      b.setAttribute("data-state", p.state);
      b.setAttribute("data-fk", "reg:" + p.slug);
      b.appendChild(el("span", "reg-name", p.slug));
      b.appendChild(el("span", "reg-state", stateWord(p)));

      var third;
      if (p.state === "clear") {
        third = el("span", "reg-stage reg-summary",
          (p.stageCount || 0) + " stages · " + dayOf(p.since));
      } else {
        third = el("span", "reg-stage", p.stage || "");
      }
      b.appendChild(third);

      b.addEventListener("click", function () { go("project", p.slug); });
      b.addEventListener("focus", function () { store.cursor = idx; markCursor(); });
      r._content.appendChild(b);
      rows.appendChild(r);
      store.rows.push(b);
    });
    boardEl.appendChild(rows);
    markCursor();
    boardEl.appendChild(footer());
  }

  // The calm state is a shorter page, not an empty container.
  function calmState(all) {
    var b = band(null, "calm");
    b._content.appendChild(el("h2", "calm-line", "Nothing is held."));

    // Two sentences of true fact, and nothing else. The most recently moved
    // project reports its last recorded event, then whatever is running says
    // how long it has been running.
    var recent = null;
    all.forEach(function (p) {
      if (!(p.history || []).length) { return; }
      if (!recent || new Date(p.since).getTime() > new Date(recent.since).getTime()) {
        recent = p;
      }
    });
    var running = all.filter(function (p) { return p.state === "running"; });

    var parts = [];
    if (recent) {
      var h = recent.history[recent.history.length - 1];
      parts.push(h.text + " on " + recent.slug + " at " + stamp(h.at) + ".");
    }
    if (running.length === 1) {
      parts.push(running[0].stage + " has been running on " + running[0].slug +
                 " for " + elapsed(running[0].since) + ".");
    } else if (running.length > 1) {
      parts.push(running.length + " stages are running.");
    }
    if (parts.length) { b._content.appendChild(el("p", "calm-sub", parts.join(" "))); }
    return b;
  }

  function renderProject() {
    var p = findProject(store.view.slug);
    if (!p) {
      // The project left the state file while it was open. Fall back to the
      // board directly: routing through go() here would re-enter render().
      store.view = { name: "board" };
      renderBoard();
      return;
    }

    var backBand = band(null);
    var backNav = el("nav");
    backNav.setAttribute("aria-label", "Console");
    var back = el("button", "back", "← the line");
    back.type = "button";
    back.addEventListener("click", function () { go("board"); });
    backNav.appendChild(back);
    backBand._content.appendChild(backNav);
    boardEl.appendChild(backBand);

    var head = band(p.state, "proj-head");
    head._content.appendChild(el("h2", "proj-name", p.slug));
    var st = el("p", "proj-state");
    if (p.state === "stopped") {
      st.appendChild(document.createTextNode("stopped at "));
      st.appendChild(el("span", "mono", p.stage || ""));
      st.appendChild(document.createTextNode(", " + stamp(p.since) + ". Nothing was written."));
    } else if (p.state === "clear") {
      st.appendChild(document.createTextNode("clear. " + (p.stageCount || 0) +
        " stages, last on " + dayOf(p.since) + "."));
    } else {
      st.appendChild(document.createTextNode(stateWord(p) + ", at "));
      st.appendChild(el("span", "mono", p.stage || ""));
    }
    head._content.appendChild(st);
    boardEl.appendChild(head);

    if (p.ask && (p.state === "held" || p.state === "stopped")) {
      boardEl.appendChild(renderAsk(p));
    }

    var ht = band(null, "hist-title-band");
    ht._content.appendChild(el("p", "hist-title", "What happened"));
    boardEl.appendChild(ht);

    var hist = band(null, "hist");
    (p.history || []).forEach(function (h) {
      var r = el("div", "hist-row");
      r.setAttribute("data-kind", h.kind || "stage");
      r.appendChild(el("span", "hist-at", stamp(h.at)));
      r.appendChild(el("span", "hist-what", h.text || ""));
      r.appendChild(el("span", "hist-detail", h.detail || ""));
      if (h.quote) { r.appendChild(el("p", "hist-quote", h.quote)); }
      hist._content.appendChild(r);
    });
    if (!(p.history || []).length) {
      hist._content.appendChild(el("p", "calm-sub", "Nothing recorded yet."));
    }
    boardEl.appendChild(hist);
    boardEl.appendChild(footer());
  }

  function footer() {
    var f = band(null, "foot");
    var inner = el("div", "foot-inner");
    var isLight = document.documentElement.getAttribute("data-theme") === "light";
    var t = el("button", "theme-toggle", isLight ? "dark" : "light");
    t.type = "button";
    t.setAttribute("data-fk", "theme");
    t.addEventListener("click", toggleTheme);
    inner.appendChild(t);
    if (store.problem) {
      inner.appendChild(el("span", "source-note", "sample data. " + store.problem));
    } else if (store.source === "sample") {
      inner.appendChild(el("span", "source-note", "sample data. the api is not running."));
    }
    f._content.appendChild(inner);
    return f;
  }

  // The cursor is a keyboard affordance, so it is not drawn on load. Marking
  // row 0 before any input suggests a selection nobody made.
  function markCursor() {
    store.rows.forEach(function (r, i) {
      r.classList.toggle("is-cursor", store.cursorActive && i === store.cursor);
    });
  }

  function applyRoute() {
    var m = /^#\/p\/(.+)$/.exec(window.location.hash);
    store.view = m ? { name: "project", slug: decodeURIComponent(m[1]) }
                   : { name: "board" };
    store.askChanged = false;
    window.scrollTo(0, 0);
    render();
  }

  // Navigation goes through the hash rather than around it, so the browser
  // Back button returns to the board and a reload at #/p/<slug> lands on that
  // project instead of dumping him back at the top.
  function go(name, slug) {
    var hash = name === "project" ? "#/p/" + encodeURIComponent(slug) : "#/";
    if (window.location.hash === hash) { applyRoute(); return; }
    window.location.hash = hash;
  }

  /* ------------------------------------------------------------ keyboard */

  // Amendment E. The single most likely bug in this build is `a` approving a
  // direction while he is typing the letter a into the feedback field, so the
  // guard comes before anything else and it is deliberately broad.
  function isTyping(target) {
    if (!target || !target.tagName) { return false; }
    var tag = target.tagName.toUpperCase();
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" ||
           target.isContentEditable === true;
  }

  function press(fk) {
    var node = boardEl.querySelector("[data-fk='" + fk + "']");
    if (node && !node.disabled) { node.click(); return true; }
    return false;
  }

  document.addEventListener("keydown", function (e) {
    // Escape leaves a field, which is field behavior rather than a shortcut.
    if (isTyping(e.target)) {
      if (e.key === "Escape" && !e.ctrlKey && !e.metaKey && !e.altKey) { e.target.blur(); }
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) { return; }

    var k = e.key;

    if (k === "Escape") {
      if (store.view.name === "project") { go("board"); e.preventDefault(); }
      return;
    }

    if (k === "j" || k === "k") {
      if (!store.rows.length) { return; }
      store.cursor = Math.max(0, Math.min(store.rows.length - 1,
        store.cursor + (k === "j" ? 1 : -1)));
      store.cursorActive = true;
      markCursor();
      store.rows[store.cursor].focus();
      e.preventDefault();
      return;
    }

    if (k === "Enter") {
      if (store.rows.length && document.activeElement === document.body) {
        store.rows[store.cursor].click();
        e.preventDefault();
      }
      return;
    }

    if (k === "a") { if (press("approve") || press("submit")) { e.preventDefault(); } return; }
    if (k === "c") { if (press("changes")) { e.preventDefault(); } return; }
    if (k >= "1" && k <= "4") { if (press("opt" + k)) { e.preventDefault(); } return; }
  });

  /* -------------------------------------------------------- data and poll */

  // Once the API has 404ed there is no point asking again every five seconds
  // for the rest of the session, so the retry interval backs off. It keeps
  // trying, so starting the server later is still picked up without a reload.
  var api = { miss: 0, skip: 0 };

  function backOff() {
    api.miss++;
    api.skip = Math.min(Math.pow(2, api.miss), 60);
  }

  function loadSample(problem) {
    return fetch("state.sample.json", { cache: "no-store" })
      .then(function (res) { return res.json(); })
      .then(function (json) {
        return { data: json, source: "sample", problem: problem || null };
      })
      .catch(function () { return null; });
  }

  function loadState() {
    if (api.skip > 0) { api.skip--; return loadSample(); }
    return fetch("api/state", { cache: "no-store" }).then(function (res) {
      if (res.status === 404) { backOff(); return loadSample(); }
      if (!res.ok) {
        // The server answered and could not read the file. That is not the
        // server being down, and printing "the api is not running" here would
        // be a lie about why the board is showing sample data.
        return res.json().catch(function () { return {}; }).then(function (j) {
          backOff();
          return loadSample(j.error || ("the api returned " + res.status + "."));
        });
      }
      api.miss = 0;
      api.skip = 0;
      return res.json().then(function (json) {
        return { data: json, source: "api", problem: null };
      });
    }).catch(function () {
      backOff();
      return loadSample();
    });
  }

  function signature(data) {
    return JSON.stringify(((data && data.projects) || []).map(function (p) {
      return [p.slug, p.state, p.stage, p.since,
              p.ask ? p.ask.id + ":" + p.ask.revision : "",
              (p.history || []).length];
    }));
  }

  function poll() {
    if (store.busy) { return; }
    loadState().then(function (next) {
      if (!next) { return; }

      // Amendment B: never swap an open ask out from under the reader.
      if (store.openAsk) {
        var p = null;
        (next.data.projects || []).forEach(function (c) {
          if (c.slug === store.openAsk.slug) { p = c; }
        });
        var a = p && p.ask;
        if (!a || a.id !== store.openAsk.id || a.revision !== store.openAsk.revision) {
          if (!store.askChanged) {
            store.askChanged = true;
            var box = boardEl.querySelector(".ask");
            if (box) { showChanged(box); }
          }
          return;
        }
      }

      var changed = signature(next.data) !== signature(store.data);
      var sourceChanged = next.source !== store.source;
      var problemChanged = (next.problem || null) !== (store.problem || null);
      store.data = next.data;
      store.source = next.source;
      store.problem = next.problem || null;
      if (changed || sourceChanged || problemChanged) { render(); }
    });
  }

  /* ------------------------------------------------------------- startup */

  window.addEventListener("hashchange", applyRoute);

  PHONE.addEventListener("change", render);

  loadState().then(function (first) {
    if (!first) {
      boardEl.appendChild(el("p", "calm-sub",
        "No state to read. Start the console with python scripts/console.py."));
      return;
    }
    store.data = first.data;
    store.source = first.source;
    store.problem = first.problem || null;
    applyRoute();
    window.setInterval(poll, POLL_MS);
    // Elapsed times are coarse, so the register is repainted rarely.
    window.setInterval(function () {
      if (!store.busy && store.view.name === "board" && !store.openAsk) { render(); }
    }, TICK_MS);
  });
})();

/* Front End Agents. The console for a pipeline that is parked most of the
 * time, drawn as a flow.
 *
 * Four rules run through this whole file.
 *
 * 1. Every string in state.json was written by an agent that read the open
 *    internet. It is untrusted. Nothing sourced from state is ever assigned
 *    as raw markup. The DOM is built with createElement and textContent, and
 *    the markdown renderer below is hand written for the same reason.
 *
 * 2. Nothing the operator typed is ever thrown away by the machine. Drafts
 *    persist to localStorage, and a background poll never replaces an ask he
 *    is in the middle of reading.
 *
 * 3. A sentence is one template with named slots, never a join of rendered
 *    fragments. That is what the SAY table below is for, and it is the fix
 *    for a shipped bug where the page printed a space in front of a full
 *    stop. Two facts are two cells, never one string with a comma in it.
 *
 * 4. One SVG per row owns that row's whole line, end to end. A continuous
 *    line cannot be assembled from segments owned by independent blocks,
 *    and trying to was the entire broken spine defect in the last build.
 *
 * The tool is called Front End Agents on screen. Every storage key, route
 * and file path still says handoff, because those are plumbing: renaming a
 * storage key would silently eat the operator's saved feedback drafts.
 */

(function () {
  "use strict";

  var POLL_MS = 5000;
  var TICK_MS = 15000;          // elapsed times are coarse on purpose
  var RELEASE_MS = 420;         // the field draining
  var PHONE = window.matchMedia("(max-width: 560px)");
  var CALM = window.matchMedia("(prefers-reduced-motion: reduce)");

  var STATE_ORDER = { held: 0, stopped: 1, running: 2, ready: 3, clear: 4 };
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  // The column set is the pipeline, in pipeline order. A history entry
  // naming a stage outside this set appends a column at the right rather
  // than being dropped: silently discarding a recorded event is worse than
  // an odd looking board.
  var STAGES = ["design-strategist", "component-builder", "design-reviewer"];

  var SVGNS = "http://www.w3.org/2000/svg";

  var boardEl = document.getElementById("board");
  var needCountEl = document.getElementById("needcount");
  var topbarEl = document.querySelector(".topbar");
  var sentinelEl = document.getElementById("sentinel");

  var store = {
    data: null,
    source: null,        // "api" or "sample"
    view: { name: "board" },
    openAsk: null,       // { slug, id, revision } currently rendered answerable
    askChanged: false,   // a poll saw the open ask move underneath us
    busy: false,         // a response is in flight, hold the poll
    cursor: 0,
    cursorActive: false, // no cursor is drawn until j or k is pressed
    promote: false,      // the next ask rises into place once
    advance: null,       // the slug whose thread just grew, animated once
    problem: null,       // the api answered, and could not read the state
    rows: [],
    paint: []            // every drawing on the page, repainted on resize
  };

  /* ---------------------------------------------------------- sentences
   *
   * One template per sentence, with slots. Punctuation lives inside the
   * template. Concatenating rendered fragments with a separator is banned,
   * and so is putting a sentence inside any container that carries a gap.
   */

  var SAY = {
    running:    "{stage} has been running for {elapsed}.",
    stopped:    "stopped at {stage}, {time}. Nothing was written.",
    done:       "done. {n} stages, last on {date}.",
    needsyou:   "waiting on you at {stage}.",
    answered:   "answered. The next stage starts from the terminal.",
    askchanged: "this was updated at {time}. reload to see it.",
    noprojects: "Projects start in the terminal, by giving the orchestrator a brief.",
    sample:     "sample data. the server is not running.",
    problem:    "sample data. {reason}",
    nostate:    "No state to read. Start the console with python scripts/console.py.",
    refused:    "the response was not written. {reason}",
    offline:    "the server is not running. nothing was written.",
    finishedat: "{agent} finished at {time}",
    passes:     "{n} passes",
    stagecount: "{n} stages"
  };

  function say(template, slots) {
    return String(template).replace(/\{(\w+)\}/g, function (whole, key) {
      var v = slots ? slots[key] : undefined;
      return (v === undefined || v === null) ? "" : String(v);
    });
  }

  /* ------------------------------------------------------------ helpers */

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) { n.className = cls; }
    if (text !== undefined && text !== null) { n.textContent = String(text); }
    return n;
  }

  function svgEl(tag, attrs) {
    var n = document.createElementNS(SVGNS, tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    }
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

  // An `at` value is either a full instant or a bare date. Some real events
  // in this repo's history have no recorded clock time, and inventing one
  // would be a lie in a register whose whole job is to say what happened.
  function hasClock(at) { return /T\d{2}:\d{2}/.test(String(at || "")); }

  function clockOf(at) {
    var d = new Date(at);
    if (isNaN(d.getTime())) { return String(at); }
    return pad2(d.getHours()) + ":" + pad2(d.getMinutes());
  }

  function dayOf(at) {
    var s = String(at || "");
    // When there is a clock, read the day off the parsed instant so that the
    // date and the time agree about which local day they are on. A bare date
    // has no instant to parse, so it is read out of the string.
    if (hasClock(s)) {
      var d = new Date(s);
      if (!isNaN(d.getTime())) { return MONTHS[d.getMonth()] + " " + d.getDate(); }
    }
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    if (!m) { return s; }
    return MONTHS[Number(m[2]) - 1] + " " + Number(m[3]);
  }

  function isToday(at) {
    var d = new Date(at);
    if (isNaN(d.getTime())) { return false; }
    var now = new Date();
    return d.getFullYear() === now.getFullYear() &&
           d.getMonth() === now.getMonth() &&
           d.getDate() === now.getDate();
  }

  // One fact, and the right one. A clock time on its own silently claims to
  // be today: a project that has been round the loop for four days printed
  // four days of events as bare clock times, in one column, as though they
  // had all happened this morning.
  function stamp(at) {
    if (!hasClock(at)) { return dayOf(at); }
    return isToday(at) ? clockOf(at) : dayOf(at);
  }

  function elapsed(since) {
    var t = new Date(since).getTime();
    if (isNaN(t)) { return ""; }
    var min = Math.floor((Date.now() - t) / 60000);
    if (min < 1) { return "under a minute"; }
    if (min < 60) { return min + " min"; }
    var hr = Math.round(min / 60);
    if (hr < 48) { return hr + " hr"; }
    return Math.round(hr / 24) + " days";
  }

  // The word that prints at the terminus. His own vocabulary, second person
  // where it is his move, and never a word out of the private reference the
  // concept was reasoned with.
  function stateWord(state) {
    if (state === "held") { return "needs you"; }
    if (state === "running") { return "running"; }
    if (state === "ready") { return "answered"; }
    if (state === "clear") { return "done"; }
    if (state === "stopped") { return "stopped"; }
    return String(state);
  }

  // One fact only. Elapsed for running, clock time for stopped, the date for
  // done, the pass count once a project has been round more times than the
  // row can stack, and nothing at all otherwise.
  function timeCell(p, passes) {
    if (passes > 3) { return say(SAY.passes, { n: passes }); }
    if (p.state === "running") { return elapsed(p.since); }
    if (p.state === "stopped") { return stamp(p.since); }
    if (p.state === "clear") { return dayOf(p.since); }
    // Held and answered have no time to print, and a project that has been
    // round the loop has a fact worth more than an empty cell. The drawing
    // says it came back; this says how often.
    if (passes > 1) { return say(SAY.passes, { n: passes }); }
    return "";
  }

  function projects() {
    return (store.data && store.data.projects) || [];
  }

  function enteredAt(p) {
    var t = new Date(p && p.since).getTime();
    return isNaN(t) ? 0 : t;
  }

  // State first, then oldest first. A board whose argument is "show where it
  // stopped" cannot order the things that stopped alphabetically: the one
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

  // Held and stopped both mean the same thing to the operator: your move.
  // That is why they share the attention hue, why handoff.py show counts
  // both as waiting, and why a stopped project belongs in the count, the
  // title and the list of what else needs answering. The console used to
  // disagree with its own command line about the same fact.
  function needsYou() {
    return sorted().filter(function (p) {
      return (p.state === "held" || p.state === "stopped") && p.ask;
    });
  }

  function findProject(slug) {
    var all = projects();
    for (var i = 0; i < all.length; i++) {
      if (all[i].slug === slug) { return all[i]; }
    }
    return null;
  }

  /* ------------------------------------------------------------- drafts */

  // Every key below still says handoff, and that is deliberate. The rename
  // is a display string. Renaming these discards the operator's theme and
  // every saved paragraph of typed feedback.
  function draftKey(askId) { return "handoff.draft." + askId; }
  function checkKey(askId) { return "handoff.checks." + askId; }
  function openKey(askId) { return "handoff.open." + askId; }

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
  // poll, which is the moment he is most likely to be mid thought.
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

  // List parsing. Every direction document in this repo is hard wrapped at
  // about eighty characters, so a list item that runs past that arrives as
  // two lines, and the second one is not a list item. Treating it as the end
  // of the list split the item into a listitem plus a stray paragraph and
  // restarted the next list at one, which is the same class of harm as the
  // intraword underscore bug: the console silently altering the text of the
  // document it is asking a person to approve.
  var LI_UL = /^\s*[-*]\s+/;
  var LI_OL = /^\s*\d+\.\s+/;

  // A thematic break. Every direction document in this repository separates
  // its sections with one of these, often immediately after a list, so
  // without a branch of its own the lazy continuation above appended the
  // three characters to whatever item was open and the reader was shown a
  // document that did not say what its author wrote. That is the third time
  // this same failure class has reached a build, which is why it is now the
  // first thing BLOCK_START tests for.
  var THEMATIC = /^\s{0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/;
  var BLOCK_START = /^\s*(?:#{1,3}\s|>|\||```)|^\s{0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/;
  var BULLET = "•";

  function isItem(line, ordered) {
    return ordered ? LI_OL.test(line) : LI_UL.test(line);
  }

  function isAnyItem(line) {
    return (LI_UL.test(line) || LI_OL.test(line)) && !THEMATIC.test(line);
  }

  // Indentation decides nesting, so it has to survive being read. Both item
  // patterns open with \s* and consume it, which is why every nested item
  // used to land at the top level, and why an ordered list indented under a
  // bullet broke its parent and renumbered itself from one.
  function indentOf(line) {
    var m = /^[ 	]*/.exec(line);
    return m[0].replace(/	/g, "    ").length;
  }

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
    return null;   // javascript:, data:, vbscript: and anything else
  }

  // The underscore branch carries lookarounds that the asterisk branch does
  // not, and the difference is deliberate. CommonMark forbids intraword `_`
  // emphasis precisely so identifiers survive, and every direction doc in
  // this repo opens with a line naming DESIGN_VARIANCE and MOTION_INTENSITY.
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
    // makes the recursion safe.
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

  // A pipe inside a code span is a character, not a column boundary. A
  // direction document that documents a regular expression or a shell
  // pipeline in a table used to lose the rest of that cell without saying
  // so, which is silent content loss on the surface where somebody is being
  // asked to approve the content.
  function splitRow(line) {
    var s = line.trim().replace(/^\|/, "").replace(/\|$/, "");
    var out = [];
    var buf = "";
    var inCode = false;
    for (var i = 0; i < s.length; i++) {
      var ch = s[i];
      if (ch === "\\" && s[i + 1] === "|") { buf += "|"; i++; continue; }
      if (ch === "`") { inCode = !inCode; buf += ch; continue; }
      if (ch === "|" && !inCode) { out.push(buf.trim()); buf = ""; continue; }
      buf += ch;
    }
    out.push(buf.trim());
    return out;
  }

  // One dash is a legal separator cell, and rejecting it meant a table
  // written that way rendered as five lines of literal pipes.
  function isSeparator(line) {
    return /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/.test(line || "");
  }

  function buildTable(head, rows) {
    var wrap = el("div", "doc-tablewrap");
    var table = el("table", "doc-table");
    if (rows.length > 6) { table.classList.add("rows-many"); }

    // The table is as wide as its widest row, not as wide as its header. A
    // row carrying more cells than the header used to have the surplus
    // dropped on the floor, unremarked, on the surface whose entire job is
    // showing somebody exactly what they are approving.
    var width = head.length;
    rows.forEach(function (r) { width = Math.max(width, r.length); });

    var thead = el("thead");
    var htr = el("tr");
    var c;
    for (c = 0; c < width; c++) {
      var th = el("th");
      th.setAttribute("scope", "col");
      inline(head[c] === undefined ? "" : head[c], th);
      htr.appendChild(th);
    }
    thead.appendChild(htr);
    table.appendChild(thead);

    // A column of hex values gets a real swatch drawn from the real value.
    // The console understanding the kind of document it is being asked to
    // approve is the single most useful thing it can do here. The swatch is
    // square, because a specimen is square and a coloured dot is banned.
    var swatchCol = [];
    for (c = 0; c < width; c++) {
      var hits = 0;
      rows.forEach(function (r) { if (HEX.test(r[c] || "")) { hits++; } });
      swatchCol[c] = hits >= 2 && hits >= rows.length / 2;
    }

    var tbody = el("tbody");
    rows.forEach(function (cells) {
      var tr = el("tr");
      for (var k = 0; k < width; k++) {
        var td = el("td");
        var raw = cells[k] === undefined ? "" : cells[k];
        if (swatchCol[k] && HEX.test(raw)) {
          var sw = el("span", "swatch");
          sw.style.backgroundColor = raw.replace(/`/g, "");
          td.appendChild(sw);
        }
        inline(raw, td);
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
    return wrap;
  }

  /* A list, and any list nested inside it.
   *
   * Indentation is read rather than consumed, so an item indented under
   * another item becomes a child list instead of a sibling. The case that
   * did real harm was an ordered list indented under a bullet: it satisfied
   * "is this a list item" but not "is this an item of THIS list", fell
   * through to the terminator, and started a fresh list renumbered from one.
   *
   * Returns the built list and the index of the first line it did not use,
   * so the caller can carry on from there.
   */
  function parseList(lines, i, indent, ordered) {
    var list = el(ordered ? "ol" : "ul", "doc-list");
    var n = 1;
    var item = null;
    var buf = "";

    function commitText() {
      if (item && buf.trim()) { inline(buf.trim(), item); }
      buf = "";
    }

    function closeItem() {
      if (!item) { return; }
      commitText();
      list.appendChild(item);
      item = null;
    }

    while (i < lines.length) {
      var line = lines[i];

      if (!line.trim()) {
        // A blank line ends the list only when what follows is not another
        // item at this level or deeper. Two items with a blank line between
        // them are one loose list, and starting a second list there is what
        // restarted the counter at one.
        var j = i;
        while (j < lines.length && !lines[j].trim()) { j++; }
        if (j < lines.length && isAnyItem(lines[j]) && indentOf(lines[j]) >= indent) {
          i = j;
          continue;
        }
        break;
      }

      if (isAnyItem(line)) {
        var at = indentOf(line);
        if (at >= indent + 2 && item) {
          commitText();
          var sub = parseList(lines, i, at, LI_OL.test(line));
          item.appendChild(sub.node);
          i = sub.next;
          continue;
        }
        if (at < indent) { break; }
        if (!isItem(line, ordered)) { break; }
        closeItem();
        item = el("li", "doc-li");
        item.setAttribute("data-marker", ordered ? n + "." : BULLET);
        n++;
        buf = line.replace(ordered ? LI_OL : LI_UL, "");
        i++;
        continue;
      }

      if (BLOCK_START.test(line)) { break; }

      // Lazy continuation. A non blank line that is neither a new item nor
      // the start of another block belongs to the item above it.
      if (item) {
        buf += " " + line.trim();
        i++;
        continue;
      }

      break;
    }

    closeItem();
    return { node: list, next: i };
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

      if (THEMATIC.test(line)) {
        frag.appendChild(el("hr", "doc-rule"));
        i++;
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

      if (isAnyItem(line)) {
        var built = parseList(lines, i, indentOf(line), LI_OL.test(line));
        frag.appendChild(built.node);
        i = built.next;
        continue;
      }

      // everything else is a paragraph
      var para = [];
      while (i < lines.length && lines[i].trim() &&
             !BLOCK_START.test(lines[i]) && !isAnyItem(lines[i])) {
        para.push(lines[i].trim());
        i++;
      }
      if (!para.length) { para.push(lines[i].trim()); i++; }
      inline(para.join(" "), frag.appendChild(el("p", "doc-p")));
    }

    return { frag: frag, headings: headings };
  }

  /* =========================================================== THE FLOW
   *
   * The board draws the track. A project draws only where it has been.
   *
   * Three stages in the order strategist, builder, reviewer is not a
   * prediction: it is written into CLAUDE.md and is the same for every
   * project, so drawing it is drawing a fact. What is genuinely unknown is
   * whether the reviewer sends the build back, and how many times, and that
   * is the one thing a progress stepper structurally cannot express.
   */

  // Prefer the recorded fields. Fall back to reading the text, so every
  // state file written before those fields existed still draws.
  function readEvent(entry, cols) {
    if (!entry) { return null; }
    var stage = entry.stage || null;
    var event = entry.event || null;
    var text = String(entry.text || "");

    if (!stage) {
      for (var i = 0; i < cols.length; i++) {
        if (text.indexOf(cols[i]) === 0) { stage = cols[i]; break; }
      }
    }
    if (!stage) { return null; }

    if (!event) {
      if (/\bfinished\b/.test(text)) { event = "finished"; }
      else if (/\bstarted\b/.test(text)) { event = "started"; }
      else if (/\b(stopped|failed)\b/.test(text)) { event = "failed"; }
    }
    if (event !== "started" && event !== "finished" && event !== "failed") {
      return null;
    }
    return { stage: stage, event: event };
  }

  var RETURNED = /\bsent (?:it|\d+ of \d+) back\b/;

  // The single event that most changes the drawing, so it is recorded
  // rather than parsed. The server writes `event: "returned"` the moment a
  // decision sends work back, which is the authoritative instant. The
  // phrase match is kept as the fallback for entries written before the
  // field existed, in exactly the shape the stage fields use.
  function isReturn(entry) {
    if (!entry || entry.kind !== "decision") { return false; }
    if (entry.event === "returned") { return true; }
    if (entry.event) { return false; }
    return RETURNED.test(String(entry.text || ""));
  }

  function boardColumns(all) {
    var cols = STAGES.slice();
    function add(name) {
      if (name && cols.indexOf(name) === -1) { cols.push(name); }
    }
    all.forEach(function (p) {
      add(p.stage);
      (p.history || []).forEach(function (e) { add(e.stage); });
    });
    return cols;
  }

  /* The model of one project's thread, in column units. Position k is the
   * left boundary of column k, k plus a half is the middle of it, and k plus
   * one is its right boundary. */
  function flowOf(p, cols) {
    var n = cols.length;
    var back = cols.indexOf("component-builder");
    if (back < 0) { back = Math.min(1, n - 1); }

    var passes = [{ from: 0, to: 0 }];
    var times = [];
    var pos = 0;
    var started = false;

    (p.history || []).forEach(function (entry) {
      if (isReturn(entry)) {
        passes.push({ from: back, to: back });
        pos = back;
        return;
      }
      var e = readEvent(entry, cols);
      if (!e) { return; }
      var k = cols.indexOf(e.stage);
      if (k < 0) { return; }
      if (e.event === "finished") { times[k] = stamp(entry.at); }

      // The thread begins at the first column the record actually names,
      // not at the left edge of the board. A project whose first recorded
      // event is the builder has not been through the strategist, and
      // drawing a line across that column would say it had.
      if (!started) {
        started = true;
        if (k > 0) { passes[0].from = k; pos = k; }
      }

      // Re-entering a column the thread has already run past is a return
      // that nobody recorded a decision for. Drawing it is more honest than
      // drawing a thread that jumps backwards without a line.
      if (e.event === "started" && pos >= k + 1) {
        passes.push({ from: k, to: k });
        pos = k;
      }

      // Only finishing earns the column boundary. A stage that started, or
      // that failed, reached the middle of its column and no further, which
      // is exactly what the record says happened.
      var want = e.event === "finished" ? k + 1 : k + 0.5;
      if (want > pos) { pos = want; }
      passes[passes.length - 1].to = pos;
    });

    var last = passes[passes.length - 1];
    var segCol = -1;

    if (p.state === "running") {
      // The thread stops at the left edge of the column that is running, and
      // the travelling segment occupies the column. The line has arrived at
      // the stage; it has not yet earned it.
      var rk = cols.indexOf(p.stage);
      if (rk >= 0) {
        segCol = rk;
        if (last.to > rk) { last.to = rk; }
        if (last.from > last.to) { last.from = last.to; }
      }
    } else if (p.state === "clear") {
      last.to = n;
    } else if (p.state === "ready" && last.to % 1 !== 0) {
      // ready ends flush at a column boundary, and rounds down rather than
      // up, because rounding up would claim a stage finished that did not.
      last.to = Math.floor(last.to);
    }

    return {
      cols: cols,
      passes: passes,
      times: times,
      segCol: segCol,
      state: p.state,
      slug: p.slug
    };
  }

  /* ------------------------------------------------------------ drawing
   *
   * Every axis aligned stroke coordinate sits on a half pixel, because SVG
   * treats a whole number as the boundary between two pixels and a one pixel
   * stroke centred there straddles both and blurs into a two pixel grey
   * band. Filled squares sit on whole numbers with an even size. Diagonals
   * and arcs stay off the grid and keep their antialiasing, which is why
   * shape-rendering stays at geometricPrecision: switching antialiasing off
   * would fix lines already fixed by hand and wreck the diagonal cut and
   * the return arc.
   */

  function hp(v) { return Math.round(v) + 0.5; }

  /* One pass, drawn as one line.
   *
   * Two rounds were spent trying to make a stack of passes read as a thread
   * that doubled back, and both failed on screen. Parallel hairlines joined
   * at both ends are a rectangle, and the eye segments that shape before it
   * reads any line weight, so widening the spacing and receding the tone
   * did not help: a 1.3:1 difference between two hairlines on a dark ground
   * is not a difference at all.
   *
   * So the stacking is gone. A row draws the current pass and nothing else,
   * and the fact that work came back is carried by a repeat mark at the
   * point it came back to, plus the pass count in the time column.
   *
   * This gives up the claim in DIRECTION-2 section 6 that a thread can be
   * physically longer than the track. That claim was authorised to go. It
   * never survived contact with a screen, and the count carries the fact it
   * was trying to carry.
   */
  var MARKS_MAX = 3;   // repeat marks stop here; the count carries the rest
  var MARK_STEP = 6;   // horizontal spacing between repeat marks
  var WORD_GAP = 10;   // clear space between a terminus and its word
  var TERM_REACH = 5;  // the furthest any terminus extends right of its point
  var WORD_PAD = 5;    // breathing space cut either side of the status word

  function drawFlow(target, model, width, height, opts) {
    clear(target);
    var reserve = opts.reserve;
    var n = model.cols.length;
    var colW = width / n;
    var lastW = Math.max(28, colW - reserve);

    // Column boundaries line up with the real headers. Only the last column
    // is short, so a finished thread always leaves room to print done after
    // its square.
    function X(pos) {
      if (pos <= n - 1) { return pos * colW; }
      return (n - 1) * colW + (pos - (n - 1)) * lastW;
    }

    var y = hp(opts.baseline);
    var current = model.passes[model.passes.length - 1];
    var returns = model.passes.length - 1;

    // Where the status word will sit. It clears the drawn mark rather than
    // the point the mark is centred on.
    var reach = 0;
    if (model.state === "clear") { reach = 3; }
    else if (model.state === "stopped") { reach = 14 / 2 / Math.SQRT2; }

    var wordAt = X(current.to) + reach + WORD_GAP;
    if (model.state === "running" && model.segCol >= 0) {
      // Running has no terminus, so the word prints after the column the
      // segment is travelling in rather than on top of it.
      wordAt = X(model.segCol + 1) + WORD_GAP;
    }

    /* Nothing is drawn behind the status word, ever.
     *
     * A terminus that stops mid track, which is every project held or
     * answered before the reviewer, used to have the track running straight
     * through its own label. On screen that is not a label, it is a
     * strikethrough on the one phrase you are hunting for.
     *
     * The lines break around the word rather than the word being plated
     * with a background colour. A plate is a lie the moment the row takes
     * its hover fill, and a break is what a technical drawing does when a
     * dimension line meets its own number.
     */
    var gap = null;
    if (opts.wordWidth > 0) {
      gap = [wordAt - WORD_PAD, wordAt + opts.wordWidth + WORD_PAD];
    }

    function hline(cls, x1, x2, extra) {
      var runs = [[x1, x2]];
      if (gap) {
        var kept = [];
        runs.forEach(function (r) {
          if (gap[1] <= r[0] || gap[0] >= r[1]) { kept.push(r); return; }
          if (gap[0] > r[0]) { kept.push([r[0], gap[0]]); }
          if (gap[1] < r[1]) { kept.push([gap[1], r[1]]); }
        });
        runs = kept;
      }
      runs.forEach(function (r) {
        if (r[1] - r[0] < 1) { return; }
        var attrs = { "class": cls, d: "M " + hp(r[0]) + " " + y + " L " + hp(r[1]) + " " + y };
        if (extra) { Object.keys(extra).forEach(function (k) { attrs[k] = extra[k]; }); }
        target.appendChild(svgEl("path", attrs));
      });
    }

    // the track: furniture, present on an empty board
    hline("track-line", X(0), X(n));

    // On a phone the track is one full width rule with two hairline ticks at
    // the third positions. Topology survives as proportion.
    if (opts.ticks) {
      for (var t = 1; t < n; t++) {
        target.appendChild(svgEl("path", {
          "class": "track-line",
          d: "M " + hp(X(t)) + " " + (y - 4) + " L " + hp(X(t)) + " " + (y + 4)
        }));
      }
    }

    // the thread: where this project has been, on this pass
    hline("thread-line", X(current.from), X(current.to), { pathLength: "1" });

    // The repeat mark. One tick per return, up to three, hanging below the
    // point work came back to, which is where this pass begins. It is a
    // tally rather than a shape: nothing here is parallel to the thread, so
    // there is no second side for a rectangle to have.
    if (returns > 0) {
      var marks = Math.min(returns, MARKS_MAX);
      for (var m = 0; m < marks; m++) {
        var mx = hp(X(current.from) + m * MARK_STEP);
        target.appendChild(svgEl("path", {
          "class": "repeat-mark",
          d: "M " + mx + " " + (y + 2) + " L " + mx + " " + (y + 8)
        }));
      }
    }

    // the terminus, and there are exactly five of them
    var tx = hp(X(current.to));

    if (model.state === "held") {
      // a twelve pixel vertical cross tick
      target.appendChild(svgEl("path", {
        "class": "term-line",
        d: "M " + tx + " " + (y - 6) + " L " + tx + " " + (y + 6)
      }));
    } else if (model.state === "stopped") {
      // a fourteen pixel diagonal cut through the thread
      var q = 14 / 2 / Math.SQRT2;
      target.appendChild(svgEl("path", {
        "class": "term-line",
        d: "M " + (tx - q) + " " + (y + q) + " L " + (tx + q) + " " + (y - q)
      }));
    } else if (model.state === "clear") {
      // a filled six by six square, on whole numbers
      target.appendChild(svgEl("rect", {
        "class": "term-square",
        x: Math.round(tx - 3),
        y: Math.round(y - 3),
        width: 6,
        height: 6
      }));
    }
    // running has no terminus, and ready ends flush and unmarked

    return {
      wordX: wordAt,
      wordY: y,
      gap: gap,
      segX: model.segCol >= 0 ? X(model.segCol) : 0,
      segW: model.segCol >= 0 ? X(model.segCol + 1) - X(model.segCol) : 0,
      // Flush with the top edge of the thread's pixel row, which is a whole
      // number because y always lands on a half.
      segY: y - 0.5
    };
  }


  /* Repaint every drawing on the page. Called after a render and whenever
   * the board changes width, and never on a scroll. The viewBox is set one
   * to one with the element's own pixel size, so one user unit is one CSS
   * pixel and the half pixel discipline above actually lands. */
  function paintFlow() {
    var phone = PHONE.matches;

    // The reserve at the right hand end of the track is the room the status
    // word needs after the terminus that it closes. It is measured from the
    // widest word actually on the page rather than assumed: the constant it
    // replaces was sized for "done", which is about 34px, and never
    // rechecked against "needs you", which is about 60px. The result was
    // that the word for the commonest state on the board was pulled left,
    // over its own cross tick and across the stacked lanes of any project
    // that had been round the review loop.
    //
    // On a phone the word leaves the terminus entirely, so it needs none.
    var widest = 0;
    store.paint.forEach(function (item) {
      if (item.word) { widest = Math.max(widest, item.word.offsetWidth); }
    });
    var reserve = phone ? 0 : Math.ceil(widest) + WORD_GAP + TERM_REACH + 2;

    store.paint.forEach(function (item) {
      var box = item.holder.getBoundingClientRect();
      var w = Math.round(box.width);
      var h = item.height || Math.round(box.height);
      if (w < 8 || h < 8) { return; }

      item.svg.setAttribute("viewBox", "0 0 " + w + " " + h);
      item.svg.setAttribute("width", w);
      item.svg.setAttribute("height", h);

      var out = drawFlow(item.svg, item.model, w, h, {
        reserve: reserve,
        // On a phone the word leaves the terminus and sits on its own line,
        // so nothing can be drawn behind it and no gap is needed.
        wordWidth: (item.word && !phone) ? item.word.offsetWidth : 0,
        // The baseline is where the current thread runs, and it is the same
        // fraction of the row on every row, so the board keeps one continuous
        // horizontal line to read across whatever the pass counts are.
        baseline: item.baseline !== undefined ? item.baseline : h * 0.42,
        ticks: !!(phone && !item.mini)
      });

      if (item.segWindow) {
        item.segWindow.style.setProperty("--seg-x", out.segX);
        item.segWindow.style.setProperty("--seg-w", out.segW);
        item.segWindow.style.setProperty("--seg-y", out.segY);
      }

      if (item.word) {
        item.word.style.setProperty("--word-x", out.wordX);
        item.word.style.setProperty("--word-y", out.wordY);
        // With the reserve measured above, every word fits after its own
        // terminus at every width and this never fires. It stays as a last
        // resort against a status word longer than any that exists today,
        // because a word running off the right of the board would be worse
        // than a word sitting slightly early.
        if (!phone) {
          var need = item.word.offsetWidth;
          if (out.wordX + need > w) {
            item.word.style.setProperty("--word-x", Math.max(0, w - need));
          }
        }
      }
    });
  }

  // An ask taller than about two thirds of the viewport stops being a whole
  // saturated panel and keeps the field as a frame and a header band, with
  // the body on the reading surface. Measured with the class off first, so
  // the decision is made on the untreated height and cannot oscillate: the
  // treatment only ever adds padding, so a card that qualified once would
  // otherwise keep qualifying on its own padding.
  var TALL_ASK = 0.66;

  function markTallAsk() {
    var box = boardEl.querySelector(".ask");
    if (!box) { return; }
    box.classList.remove("is-tall");
    var natural = box.getBoundingClientRect().height;
    if (natural > window.innerHeight * TALL_ASK) { box.classList.add("is-tall"); }
  }

  /* ------------------------------------------------------------- chrome */

  function faviconFor(needed) {
    var parts = ["<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'>",
                 "<rect width='32' height='32' rx='7' fill='#0B0F0E'/>"];
    if (needed) {
      // the thread stops, and a cross tick closes it
      parts.push("<rect x='4' y='15' width='13' height='2' fill='#8A9691'/>");
      parts.push("<rect x='17' y='10' width='2' height='12' fill='#F5D547'/>");
    } else {
      // the thread runs through
      parts.push("<rect x='4' y='15' width='24' height='2' fill='#8A9691'/>");
    }
    parts.push("</svg>");
    return "data:image/svg+xml," + encodeURIComponent(parts.join(""));
  }

  function updateChrome() {
    var n = needsYou().length;
    document.title = n > 0 ? n + " need you · Front End Agents" : "Front End Agents";
    var link = document.querySelector("link[rel='icon']");
    if (link) { link.href = faviconFor(n > 0); }
    // Nothing renders at zero. A board where no thread ends in a cross tick
    // is a board with nothing for you, and it does not need a sentence
    // saying so.
    needCountEl.textContent = n > 0 ? n + " need you" : "";
  }

  function toggleTheme() {
    var root = document.documentElement;
    var next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
    root.setAttribute("data-theme", next);
    try { localStorage.setItem("handoff.theme", next); } catch (e) { /* ignore */ }
    render();
  }

  /* ------------------------------------------------------------ the asks */

  function askMeta(p, ask) {
    var row = el("div", "ask-meta");
    if (ask.from) {
      row.appendChild(el("span", null,
        say(SAY.finishedat, { agent: ask.from, time: stamp(ask.at || p.since) })));
    }
    if (ask.meta) { row.appendChild(el("span", null, ask.meta)); }
    return row.childElementCount ? row : null;
  }

  function renderAsk(p, cols, withMini) {
    var ask = p.ask;
    var box = el("div", "ask holdfield");
    if (p.state === "stopped") { box.classList.add("is-stopped"); }
    box.setAttribute("data-ask", ask.id);
    box.setAttribute("data-kind", ask.kind || "question");

    var head = el("div", "ask-head");

    // The open ask carries its own project's thread, above the headline,
    // with no column headers. Cut on a phone, where the space is worth more,
    // and cut in the project view, which already draws the same thread about
    // a hundred pixels above this one. It earns its place on the board,
    // where nothing else above it says what this project has cost.
    if (withMini && !PHONE.matches) {
      var model = flowOf(p, cols);
      // One line and a repeat mark, so the 22px the layout budgeted for it
      // is enough again.
      var miniH = 22;
      var miniBase = 11;
      var mini = el("div", "ask-mini");
      mini.setAttribute("aria-hidden", "true");
      mini.style.height = miniH + "px";
      var miniSvg = svgEl("svg", { focusable: "false" });
      mini.appendChild(miniSvg);
      head.appendChild(mini);
      store.paint.push({ holder: mini, svg: miniSvg, model: model,
                         height: miniH, baseline: miniBase, mini: true });
    }

    head.appendChild(el("h2", "ask-headline", ask.headline || ("Answer " + p.slug)));
    var meta = askMeta(p, ask);
    if (meta) { head.appendChild(meta); }
    box.appendChild(head);

    var body = el("div", "ask-body");
    var foot = el("div", "ask-foot");
    var ctx = { project: p, ask: ask, box: box, head: head, body: body, foot: foot };

    if (ask.kind === "direction") { shapeDirection(ctx); }
    else if (ask.kind === "build") { shapeBuild(ctx); }
    else if (ask.kind === "findings") { shapeFindings(ctx); }
    else { shapeQuestion(ctx); }

    box.appendChild(body);
    box.appendChild(foot);

    store.openAsk = { slug: p.slug, id: ask.id, revision: ask.revision };
    if (store.askChanged) { showChanged(box); }
    return box;
  }

  // Amendment B, in one line of the console's own voice.
  function showChanged(box) {
    if (box.querySelector(".ask-notice")) { return; }
    noteInAsk(box, say(SAY.askchanged, { time: clockOf(new Date().toISOString()) }));
  }

  function noteInAsk(box, text) {
    var existing = box.querySelector(".ask-notice");
    if (existing) { existing.textContent = text; return; }
    var head = box.querySelector(".ask-head");
    head.appendChild(el("p", "ask-notice", text));
  }

  function control(label, keyHint, onPress, focusKey) {
    var b = el("button", "control");
    b.type = "button";
    b.appendChild(document.createTextNode(label));
    if (keyHint) {
      // Visible, but not part of the accessible name: without this the
      // control announces "Approve direction a".
      var hint = el("span", "key", keyHint);
      hint.setAttribute("aria-hidden", "true");
      b.appendChild(hint);
    }
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

    if (out.headings.length > 1) {
      // A labelled group rather than a second nav landmark: the register of
      // projects is the one navigation region in this tool, and amendment K
      // says so. It is appended before the document rather than after it,
      // because grid only moves it visually, and a table of contents that a
      // keyboard user reaches after reading the whole document is not a
      // table of contents.
      var rail = el("div", "rail");
      rail.setAttribute("role", "group");
      rail.setAttribute("aria-label", "Sections of this document");
      var railTitle = el("p", "rail-title", "sections");
      railTitle.id = domId("rail", ctx.ask.id, "title");
      rail.setAttribute("aria-labelledby", railTitle.id);
      rail.appendChild(railTitle);
      var list = el("div", "rail-list");
      out.headings.forEach(function (h) {
        var b = el("button", "rail-item", h.text);
        b.type = "button";
        b.addEventListener("click", function () {
          // Move focus with the scroll. Scrolling somebody's view without
          // moving their focus leaves them reading one place and typing in
          // another.
          h.node.setAttribute("tabindex", "-1");
          h.node.scrollIntoView({ block: "start", behavior: CALM.matches ? "auto" : "smooth" });
          h.node.focus({ preventScroll: true });
        });
        list.appendChild(b);
      });
      rail.appendChild(list);
      wrap.appendChild(rail);
    }

    wrap.appendChild(surface);
    ctx.body.appendChild(wrap);
    twoWayFoot(ctx, "Approve direction", "Request changes", "approved the direction",
               "What needs to change");
  }

  /* shape 2: review a build */
  function shapeBuild(ctx) {
    var ask = ctx.ask;
    // No panel. The field is the bounded surface here, and a second rounded
    // box inside it would mean neither boundary reads.
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
      // Three bare numbers with no group label announce as "375, pressed"
      // and nothing else, which does not say what is 375 or what pressing it
      // would do.
      widths.setAttribute("role", "group");
      widths.setAttribute("aria-label", "Preview width");
      var frame = el("div", "preview-frame");
      frame.setAttribute("data-width", "full");
      ["375", "720", "full"].forEach(function (w) {
        var b = el("button", "width-pick", w);
        b.type = "button";
        b.setAttribute("aria-label",
          w === "full" ? "Full width" : "Narrow to " + w + " pixels");
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
        li.setAttribute("data-marker", BULLET);
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

      // Two `label for` pointing at one control do not concatenate. Chromium
      // takes the first and drops the rest, so the previous version of this
      // announced the word "must-fix" three times down the list and never
      // said what any of the findings were. `aria-labelledby` is the form
      // that does compose, and it names both elements in reading order, so
      // the control announces "must-fix, the resolved species name is set
      // in ramp-2 at 17px". Both labels keep their `for` so that clicking
      // either one still toggles the box.
      var sevId = domId("fs", ask.id, key);
      var descId = domId("fd", ask.id, key);

      var sev = el("label", "finding-sev", f.severity || "nitpick");
      sev.setAttribute("data-sev", f.severity || "nitpick");
      sev.id = sevId;
      sev.htmlFor = boxId;

      var text = el("div", "finding-text");
      var desc = el("label", "finding-desc");
      desc.id = descId;
      desc.htmlFor = boxId;
      inline(f.text || "", desc);
      text.appendChild(desc);
      box.setAttribute("aria-labelledby", sevId + " " + descId);
      if (f.where) {
        // The path describes rather than names: read aloud as part of the
        // name it is noise, so it is a description instead.
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
    surface.appendChild(lab);
    surface.appendChild(field);
    ctx.body.appendChild(surface);

    var send = control("Send answer", "a", function () {
      respond(ctx, "answer", { answer: field.value.trim() });
    }, "approve");

    // An empty answer used to submit, write a response file and move the
    // project to ready with no way back to the question. The keyboard path
    // is covered too, because press() refuses a disabled control.
    function syncSend() { send.disabled = field.value.trim() === ""; }
    field.addEventListener("input", function () {
      writeDraft(ask.id, field.value);
      syncSend();
    });
    syncSend();

    var controls = el("div", "controls");
    controls.appendChild(send);
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

    var sendNotes = control("Send the notes", null, function () {
      respond(ctx, "changes", { note: field.value.trim() });
    }, "send");

    // Sending it back with no notes is the one decision in this tool that
    // destroys work without saying anything, so it is refused rather than
    // accepted quietly.
    function syncSend() { sendNotes.disabled = field.value.trim() === ""; }
    field.addEventListener("input", function () {
      writeDraft(ctx.ask.id, field.value);
      syncSend();
    });
    syncSend();

    var sendRow = el("div", "controls send-row");
    sendRow.appendChild(sendNotes);

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
        noteInAsk(ctx.box, say(SAY.askchanged, { time: clockOf(new Date().toISOString()) }));
        return;
      }
      if (out.status !== 200 || !out.json || !out.json.projects) {
        noteInAsk(ctx.box, say(SAY.refused, {
          reason: (out.json && out.json.error) ? out.json.error : "the server refused it."
        }));
        return;
      }
      dropDraft(ctx.ask.id);
      release(ctx, out.json);
    }).catch(function () {
      store.busy = false;
      noteInAsk(ctx.box, SAY.offline);
    });
  }

  // The payoff. You released it, and you see the thread advance.
  function release(ctx, nextData) {
    var slug = ctx.project.slug;
    var apply = function () {
      store.data = nextData;
      store.askChanged = false;
      store.promote = true;    // whatever needs you next rises into place
      store.advance = slug;    // and this one's thread grows, once
      render();
    };
    if (CALM.matches) { apply(); return; }
    ctx.box.classList.add("is-draining");
    window.setTimeout(apply, RELEASE_MS);
  }

  /* ------------------------------------------------------------ rendering */

  function focusKeyNow() {
    var a = document.activeElement;
    return a && a.getAttribute ? a.getAttribute("data-fk") : null;
  }

  // Slugs come from state, and the header of this file declares state
  // untrusted. Building a selector out of one meant a slug carrying a
  // quote threw a SyntaxError straight out of render(), which blanks the
  // board. Comparing the attribute needs no escaping and cannot be made to
  // parse as anything.
  function byFocusKey(key) {
    var all = boardEl.querySelectorAll("[data-fk]");
    for (var i = 0; i < all.length; i++) {
      if (all[i].getAttribute("data-fk") === key) { return all[i]; }
    }
    return null;
  }

  function restoreFocus(key) {
    if (!key) { return; }
    var node = byFocusKey(key);
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
    var keep = focusKeyNow();
    var y = window.scrollY;

    store.openAsk = null;
    store.rows = [];
    store.paint = [];
    clear(boardEl);
    if (store.view.name === "project") { renderProject(); } else { renderBoard(); }
    store.promote = false;
    updateChrome();
    paintFlow();
    markTallAsk();
    store.advance = null;
    restoreFocus(keep);
    if (window.scrollY !== y) { window.scrollTo(0, y); }
  }

  function stageLabel(name) {
    var cut = String(name).lastIndexOf("-");
    return cut > 0 ? String(name).slice(cut + 1) : String(name);
  }

  function flowHead(cols) {
    var head = el("div", "fhead");
    head.setAttribute("aria-hidden", "true");
    head.appendChild(el("span", "fhead-cell"));
    cols.forEach(function (name) {
      var cell = el("span", "fhead-cell");
      cell.appendChild(el("span", "fhead-long", name));
      cell.appendChild(el("span", "fhead-short", stageLabel(name)));
      head.appendChild(cell);
    });
    head.appendChild(el("span", "fhead-cell fhead-time"));
    return head;
  }

  // One row. The whole row is a real button, never a div with a click
  // handler, and every visible word in it is real HTML in a grid cell. The
  // SVG is aria-hidden and contains no text at all.
  function flowRow(p, cols, interactive) {
    var model = flowOf(p, cols);
    var row = el(interactive ? "button" : "div", "frow");
    if (interactive) { row.type = "button"; }
    row.setAttribute("data-state", p.state);

    var name = el("span", "frow-name", p.slug);
    row.appendChild(name);

    var holder = el("span", "frow-track");
    var draw = svgEl("svg", { focusable: "false" });
    draw.setAttribute("aria-hidden", "true");
    holder.appendChild(draw);

    // The window is the running column, and it clips. The bar inside it
    // travels from wholly before the column to wholly after it, so the
    // motion still reads as entering and leaving while nothing is ever
    // painted outside the one column that is running.
    var segWindow = null;
    if (model.segCol >= 0) {
      segWindow = el("span", "seg-window");
      segWindow.setAttribute("aria-hidden", "true");
      segWindow.appendChild(el("span", "seg"));
      holder.appendChild(segWindow);
    }
    row.appendChild(holder);

    var word = el("span", "frow-word", stateWord(p.state));
    row.appendChild(word);

    var passes = model.passes.length;
    row.appendChild(el("span", "frow-time", timeCell(p, passes)));

    // Width buys history: the recorded time under each completed segment,
    // inside its own column, in tabular figures.
    var times = el("span", "frow-times");
    times.setAttribute("aria-hidden", "true");
    cols.forEach(function (unused, k) {
      times.appendChild(el("span", null, model.times[k] || ""));
    });
    row.appendChild(times);

    row.appendChild(el("span", "frow-stage", p.stage || ""));

    if (store.advance === p.slug) { row.classList.add("is-advancing"); }

    store.paint.push({ holder: holder, svg: draw, model: model,
                      word: word, segWindow: segWindow });
    return row;
  }

  function renderBoard() {
    var all = sorted();

    if (!all.length) {
      var e = el("div", "empty");
      e.appendChild(el("h2", "empty-line", "No projects yet."));
      e.appendChild(el("p", "empty-sub", SAY.noprojects));
      boardEl.appendChild(e);
      boardEl.appendChild(footer());
      return;
    }

    var cols = boardColumns(all);
    var held = needsYou();

    // When nothing needs you, nothing occupies the top of the page. The page
    // begins at the column headers.
    if (held.length) {
      var zone = el("div", "zone");
      var askBox = renderAsk(held[0], cols, true);
      if (store.promote) { askBox.classList.add("is-promoting"); }
      zone.appendChild(askBox);
      boardEl.appendChild(zone);

      if (held.length > 1) {
        var more = el("div", "more");
        var rest = held.slice(1);
        more.appendChild(el("h2", "morecount",
          rest.length === 1 ? "1 more needs you" : rest.length + " more need you"));
        var list = el("div", "morelist");
        rest.forEach(function (p) {
          var b = el("button", "morecard");
          b.type = "button";
          b.appendChild(el("span", "morecard-name", p.slug));
          b.appendChild(el("span", "morecard-what",
            p.ask.headline || say(SAY.needsyou, { stage: p.stage })));
          b.addEventListener("click", function () { go("project", p.slug); });
          list.appendChild(b);
        });
        more.appendChild(list);
        boardEl.appendChild(more);
      }
    }

    var flow = el("div", "flow");
    flow.appendChild(flowHead(cols));

    var rows = el("nav", "frows");
    rows.setAttribute("aria-label", "Projects");
    all.forEach(function (p, idx) {
      var row = flowRow(p, cols, true);
      row.setAttribute("data-fk", "row:" + p.slug);
      row.addEventListener("click", function () { go("project", p.slug); });
      row.addEventListener("focus", function () { store.cursor = idx; markCursor(); });
      rows.appendChild(row);
      store.rows.push(row);
    });
    flow.appendChild(rows);
    boardEl.appendChild(flow);

    markCursor();
    boardEl.appendChild(footer());
  }

  function projectSentence(p) {
    if (p.state === "running") {
      return say(SAY.running, { stage: p.stage, elapsed: elapsed(p.since) });
    }
    if (p.state === "stopped") {
      return say(SAY.stopped, { stage: p.stage, time: stamp(p.since) });
    }
    if (p.state === "clear") {
      return say(SAY.done, { n: p.stageCount || 0, date: dayOf(p.since) });
    }
    if (p.state === "held") {
      return say(SAY.needsyou, { stage: p.stage });
    }
    if (p.state === "ready") {
      return SAY.answered;
    }
    return stateWord(p.state);
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

    var cols = boardColumns(projects());

    // A real link to a real URL, and not wrapped in a landmark. The board
    // is the one nav on the page; a second landmark holding a single link
    // back to where you came from is noise in the landmark list, and the
    // comment in index.html already said so before this shipped one anyway.
    var back = el("a", "back", "← all projects");
    back.href = "#/";
    boardEl.appendChild(back);

    var head = el("div", "proj-head");
    head.appendChild(el("h2", "proj-name", p.slug));
    head.appendChild(el("p", "proj-state", projectSentence(p)));
    boardEl.appendChild(head);

    var flow = el("div", "proj-flow");
    flow.appendChild(flowHead(cols));
    flow.appendChild(flowRow(p, cols, false));
    boardEl.appendChild(flow);

    if (p.ask && (p.state === "held" || p.state === "stopped")) {
      boardEl.appendChild(renderAsk(p, cols, false));
    }

    boardEl.appendChild(el("h2", "hist-title", "What happened"));

    var hist = el("div", "hist");
    (p.history || []).forEach(function (h) {
      var r = el("div", "hist-row");
      r.setAttribute("data-kind", h.kind || "stage");
      r.appendChild(el("span", "hist-at", stamp(h.at)));
      r.appendChild(el("span", "hist-what", h.text || ""));
      r.appendChild(el("span", "hist-detail", h.detail || ""));
      if (h.quote) { r.appendChild(el("p", "hist-quote", h.quote)); }
      hist.appendChild(r);
    });
    if (!(p.history || []).length) {
      hist.appendChild(el("p", "empty-sub", "Nothing recorded yet."));
    }
    boardEl.appendChild(hist);
    boardEl.appendChild(footer());
  }

  function footer() {
    // A real landmark, so the theme control and the line saying where the
    // data came from are not adrift outside every region on the page.
    var f = el("footer", "foot");
    var isLight = document.documentElement.getAttribute("data-theme") === "light";
    var t = el("button", "theme-toggle", isLight ? "dark" : "light");
    t.type = "button";
    // The visible word is the destination, which is clear on screen and
    // useless read aloud on its own.
    t.setAttribute("aria-label",
      isLight ? "Switch to the dark theme" : "Switch to the light theme");
    t.setAttribute("data-fk", "theme");
    t.addEventListener("click", toggleTheme);
    f.appendChild(t);
    if (store.problem) {
      f.appendChild(el("span", "source-note", say(SAY.problem, { reason: store.problem })));
    } else if (store.source === "sample") {
      f.appendChild(el("span", "source-note", SAY.sample));
    }
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
  // Back button returns to the board and a reload at #/p/<slug> lands on
  // that project instead of dumping him back at the top.
  function go(name, slug) {
    var hash = name === "project" ? "#/p/" + encodeURIComponent(slug) : "#/";
    if (window.location.hash === hash) { applyRoute(); return; }
    window.location.hash = hash;
  }

  /* ------------------------------------------------------------ keyboard */

  // Amendment E. The single most likely bug in this build is `a` approving a
  // direction while he is typing the letter a into the feedback field, so
  // the guard comes before anything else and it is deliberately broad.
  function isTyping(target) {
    if (!target || !target.tagName) { return false; }
    var tag = target.tagName.toUpperCase();
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" ||
           target.isContentEditable === true;
  }

  function press(fk) {
    var node = byFocusKey(fk);
    if (node && !node.disabled) { node.click(); return true; }
    return false;
  }

  document.addEventListener("keydown", function (e) {
    // Escape leaves a field, which is field behaviour rather than a shortcut.
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
      // The cursor survives a re-render but is only clamped where j and k
      // move it, so a poll that removed a project left this indexing past
      // the end of the array. It also used to fire with no cursor drawn,
      // navigating away from a board showing no selection at all.
      if (store.cursorActive && store.rows.length &&
          document.activeElement === document.body) {
        store.cursor = Math.max(0, Math.min(store.rows.length - 1, store.cursor));
        markCursor();
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
        // server being down, and saying it is would be a lie about why the
        // board is showing sample data.
        return res.json().catch(function () { return {}; }).then(function (j) {
          backOff();
          return loadSample(j.error || ("the server returned " + res.status + "."));
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
      // No transition on the flow when a poll returns unchanged data.
      if (changed || sourceChanged || problemChanged) { render(); }
    });
  }

  /* ------------------------------------------------------------- startup */

  window.addEventListener("hashchange", applyRoute);

  PHONE.addEventListener("change", render);

  // The top bar hairline appears when content is actually underneath it. An
  // IntersectionObserver on a one pixel sentinel, never a scroll listener.
  if (window.IntersectionObserver && sentinelEl && topbarEl) {
    new window.IntersectionObserver(function (entries) {
      topbarEl.classList.toggle("is-lifted", !entries[0].isIntersecting);
    }).observe(sentinelEl);
  }

  // Geometry is measured, never assumed, so the viewBox stays one to one
  // with the element at every width. This is the only reason the board
  // needs to know about resize at all, and it is not a scroll listener.
  //
  // The observer is held in a variable rather than constructed inline. An
  // inline `new ResizeObserver(fn).observe(el)` keeps no reference to the
  // observer, and it is collectable: the board then kept whatever viewBox
  // the last full render left it with, so every thread was drawn to the
  // previous width and the status word hung off the right of the page.
  var lastWidth = 0;
  var onResize = function () {
    var width = boardEl.clientWidth;
    if (width !== lastWidth) {
      lastWidth = width;
      paintFlow();
    }
    // Always, and not only when the width moved. The tall ask threshold is a
    // fraction of the viewport height, so dragging a window shorter is
    // exactly the case that has to re-evaluate it, and it was the one case
    // that never did.
    markTallAsk();
  };

  var boardObserver = null;
  if (window.ResizeObserver) {
    boardObserver = new window.ResizeObserver(onResize);
    boardObserver.observe(boardEl);
  }
  // Kept alongside the observer rather than instead of it. The observer
  // catches a board that changes width without the window doing so; this
  // catches the window, and both are idempotent.
  window.addEventListener("resize", onResize);

  loadState().then(function (first) {
    if (!first) {
      boardEl.appendChild(el("p", "empty-sub", SAY.nostate));
      return;
    }
    store.data = first.data;
    store.source = first.source;
    store.problem = first.problem || null;
    applyRoute();
    window.setInterval(poll, POLL_MS);
    // Elapsed times are coarse, so the board is repainted rarely.
    window.setInterval(function () {
      if (!store.busy && store.view.name === "board" && !store.openAsk) { render(); }
    }, TICK_MS);
  });
})();

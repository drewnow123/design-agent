#!/usr/bin/env node
/* Assertions for the console's markdown renderer.
 *
 *   node scripts/check-markdown.js
 *   node scripts/check-markdown.js path/to/app.js
 *
 * Nothing here is a copy of the renderer. The functions are sliced straight
 * out of the shipping work/agent-console/app.js and run against a DOM small
 * enough to hold them, so a change to app.js is a change to what is tested.
 *
 * Node standard library only, no packages, no build step. The console itself
 * still ships as vanilla HTML, CSS and JS with no dependencies; this file is
 * developer tooling and is never served to a browser.
 *
 * These exist because two renderer bugs shipped, and both had the same shape:
 * the console silently altering the text of a document it was asking a person
 * to approve. The first was intraword underscores turning DESIGN_VARIANCE
 * into italics. The second was a hard wrapped list item splitting into a
 * listitem plus a stray paragraph and restarting the next list at one, which
 * fired on essentially every list in this repo, because every direction
 * document here is wrapped at about eighty characters.
 */

// ---- a DOM, no larger than the renderer needs ----
// A DOM small enough to run the console's markdown renderer, and no smaller.
function mkNode(tag) {
  const n = {
    tagName: String(tag).toUpperCase(),
    nodeType: 1,
    childNodes: [],
    className: "",
    id: "",
    htmlFor: "",
    attrs: {},
    style: {},
    classList: {
      add(c) { n.className = (n.className ? n.className + " " : "") + c; },
    },
    setAttribute(k, v) { n.attrs[k] = String(v); },
    getAttribute(k) { return k in n.attrs ? n.attrs[k] : null; },
    appendChild(c) { n.childNodes.push(c); return c; },
    get firstChild() { return n.childNodes[0] || null; },
    get textContent() {
      return n.childNodes.map(c => c.nodeType === 3 ? c.data : c.textContent).join("");
    },
    set textContent(v) { n.childNodes = [mkText(v)]; },
    querySelector() { return null; },
  };
  return n;
}
function mkText(d) { return { nodeType: 3, data: String(d), get textContent() { return this.data; } }; }
function mkFrag() {
  const f = mkNode("#fragment");
  f.nodeType = 11;
  return f;
}
global.document = {
  createElement: mkNode,
  createTextNode: mkText,
  createDocumentFragment: mkFrag,
};

// Serialize to a compact, diffable tree.
function ser(node, depth = 0) {
  const pad = "  ".repeat(depth);
  if (node.nodeType === 3) return pad + "#text " + JSON.stringify(node.data);
  const cls = node.className ? "." + node.className.split(" ").join(".") : "";
  const marker = node.attrs && node.attrs["data-marker"] !== undefined
    ? " marker=" + JSON.stringify(node.attrs["data-marker"]) : "";
  const head = pad + node.tagName.toLowerCase() + cls + marker;
  const kids = node.childNodes.map(c => ser(c, depth + 1));
  return [head].concat(kids).join("\n");
}

// Extract the markdown renderer out of the SHIPPING app.js and exercise it.
// Nothing here is a copy: if app.js changes, this reads the change.
const fs = require("fs");
const vm = require("vm");
const path = require("path");


const SRC = process.argv[2] ||
  path.join(__dirname, "..", "work", "agent-console", "app.js");
const src = fs.readFileSync(SRC, "utf8");

function slice(from, to) {
  const a = src.indexOf(from);
  const b = src.indexOf(to);
  if (a < 0 || b < 0 || b <= a) throw new Error("could not slice " + from + " .. " + to);
  return src.slice(a, b);
}

const helpers = slice("  function el(tag, cls, text)", "  function svgEl(");
const markdown = slice("  var HEX =", "  /* ===========================================================");

const ctx = { document: global.document, console };
vm.createContext(ctx);
vm.runInContext('"use strict";\n' + helpers + "\n" + markdown, ctx, { filename: "extracted" });

let pass = 0, fail = 0;
function check(name, actual, expected) {
  const ok = actual === expected;
  if (ok) { pass++; console.log("  PASS  " + name); }
  else {
    fail++;
    console.log("  FAIL  " + name);
    console.log("        expected: " + JSON.stringify(expected));
    console.log("        actual:   " + JSON.stringify(actual));
  }
}
function render(md) { return ctx.renderMarkdown(md); }
function tree(md) { return ser(render(md).frag); }

// Every list item, as [marker, text]
function items(md) {
  const out = [];
  (function walk(n) {
    if (n.nodeType !== 1 && n.nodeType !== 11) return;
    if (n.tagName === "LI") out.push([n.getAttribute("data-marker"), n.textContent]);
    n.childNodes.forEach(walk);
  })(render(md).frag);
  return out;
}
function blockTags(md) {
  return render(md).frag.childNodes.map(n => n.tagName.toLowerCase()).join(",");
}

console.log("\n--- 1. a wrapped bullet is one item ---");
{
  const md = [
    "- The resolved species name is set in `ramp-2` at 17px, which is 4.1 to 1",
    "  on the ground, and section 3.1 says in as many words that it never sets",
    "  text.",
    "- No focus ring on the replay control.",
  ].join("\n");
  const it = items(md);
  check("item count", it.length, 2);
  check("first item is joined", it[0][1],
    "The resolved species name is set in ramp-2 at 17px, which is 4.1 to 1 on the ground, and section 3.1 says in as many words that it never sets text.");
  check("no stray paragraph", blockTags(md), "ul");
}

console.log("\n--- 2. a wrapped ordered item is one item ---");
{
  const md = [
    "1. The eight second recordings are roughly 40KB each as raw arrays. Three",
    "   of them is 120KB of blocking data before the hero can draw.",
    "2. The tawny owl recording is genuinely low frequency and may be inaudible",
    "   on a phone speaker.",
  ].join("\n");
  const it = items(md);
  check("item count", it.length, 2);
  check("markers", it.map(x => x[0]).join(" "), "1. 2.");
  check("first item joined", it[0][1],
    "The eight second recordings are roughly 40KB each as raw arrays. Three of them is 120KB of blocking data before the hero can draw.");
  check("single ol", blockTags(md), "ol");
}

console.log("\n--- 3. ordered numbering does not restart across wraps ---");
{
  const md = [
    "1. First item that wraps onto",
    "   a second line.",
    "2. Second item that wraps onto",
    "   a second line.",
    "3. Third item that wraps onto",
    "   a second line.",
  ].join("\n");
  const it = items(md);
  check("markers stay sequential", it.map(x => x[0]).join(" "), "1. 2. 3.");
  check("one list only", blockTags(md), "ol");
}

console.log("\n--- 4. a blank line inside a list does not restart it ---");
{
  const md = [
    "1. First item.",
    "",
    "2. Second item.",
    "",
    "3. Third item.",
  ].join("\n");
  const it = items(md);
  check("markers stay sequential", it.map(x => x[0]).join(" "), "1. 2. 3.");
  check("one list only", blockTags(md), "ol");
}

console.log("\n--- 5. a blank line then a paragraph does end the list ---");
{
  const md = ["- One.", "- Two.", "", "A following paragraph."].join("\n");
  check("blocks", blockTags(md), "ul,p");
  check("item count", items(md).length, 2);
}

console.log("\n--- 6. a heading ends the list ---");
{
  const md = ["- One.", "## Next section", "text"].join("\n");
  check("blocks", blockTags(md), "ul,h3,p");
  check("item count", items(md).length, 1);
}

console.log("\n--- 7. DIRECTION-3 section 9, verbatim hard wrapped ---");
{
  const md = [
    "- [ ] `box-shadow` appears only as the four elevation tokens and the well",
    "  inset. Zero ad-hoc shadows. Zero coloured glows.",
    "- [ ] `--elev-3` is referenced exactly once.",
    "- [ ] Every axis-aligned SVG stroke coordinate ends in `.5`. Every filled",
    "  square coordinate is a whole number with an even size.",
  ].join("\n");
  const it = items(md);
  check("item count", it.length, 3);
  check("one list only", blockTags(md), "ul");
  // Task list syntax is not supported, so `[ ]` renders as the characters
  // that are actually in the document. That is the correct degradation: the
  // renderer shows what was written rather than inventing a control.
  check("third item joined", it[2][1],
    "[ ] Every axis-aligned SVG stroke coordinate ends in .5. Every filled square coordinate is a whole number with an even size.");
}

console.log("\n--- 8. amendment K: intraword underscore survives ---");
{
  const md = "Dials: DESIGN_VARIANCE 5 and MOTION_INTENSITY 6 and VISUAL_DENSITY 6.";
  check("identifiers intact", render(md).frag.textContent,
    "Dials: DESIGN_VARIANCE 5 and MOTION_INTENSITY 6 and VISUAL_DENSITY 6.");
  const md2 = "A phrase with _real emphasis_ in it.";
  const t2 = tree(md2);
  check("real emphasis still italicises", /em/.test(t2), true);
}

console.log("\n--- 9. underscores survive inside a wrapped list item ---");
{
  const md = [
    "- Dials are DESIGN_VARIANCE 5 and MOTION_INTENSITY 6, which the console",
    "  must not alter when it renders them.",
  ].join("\n");
  check("intact", items(md)[0][1],
    "Dials are DESIGN_VARIANCE 5 and MOTION_INTENSITY 6, which the console must not alter when it renders them.");
}

console.log("\n--- 10. tables and hex swatches ---");
{
  const md = [
    "| Token | Value | Role |",
    "|---|---|---|",
    "| `bg` | #0C1116 | The ground |",
    "| `ink` | #E8EEF2 | Primary text |",
  ].join("\n");
  const t = tree(md);
  check("table rendered", /doc-table/.test(t), true);
  check("two swatches", (t.match(/span\.swatch/g) || []).length, 2);
}

console.log("\n--- 11. safeHref refuses what it must ---");
{
  const bad = ["javascript:alert(1)", "data:text/html,x", "vbscript:x", "//evil.example/x"];
  bad.forEach(h => check("rejects " + h, ctx.safeHref(h), null));
  check("accepts https", ctx.safeHref("https://example.com/x"), "https://example.com/x");
  check("accepts relative", ctx.safeHref("./thing"), "./thing");
}

console.log("\n--- 12. a fenced code block is untouched ---");
{
  const md = ["```", "playhead:  transform translateX", "  indented line", "```"].join("\n");
  const f = render(md).frag;
  check("pre", f.childNodes[0].tagName, "PRE");
  check("content exact", f.childNodes[0].textContent,
    "playhead:  transform translateX\n  indented line");
}


console.log("\n--- 13. a thematic break is a rule, not text ---");
{
  const md = ["- One.", "- Two.", "---", "A paragraph after the break."].join("\n");
  check("blocks", blockTags(md), "ul,hr,p");
  check("the list keeps two items", items(md).length, 2);
  check("no item swallowed the rule",
    items(md).every(i => i[1].indexOf("-") !== 0), true);
  check("nothing renders the characters", render(md).frag.textContent.indexOf("---"), -1);
}
{
  const md = ["A paragraph.", "", "---", "", "Another paragraph."].join("\n");
  check("between paragraphs", blockTags(md), "p,hr,p");
}
{
  check("asterisk form", blockTags("Text.\n\n***\n\nMore."), "p,hr,p");
  check("underscore form", blockTags("Text.\n\n___\n\nMore."), "p,hr,p");
  check("long form", blockTags("Text.\n\n-----\n\nMore."), "p,hr,p");
}
{
  // a setext-looking line must not become a rule when it is really an item
  check("a bullet is still a bullet", blockTags("- item"), "ul");
}

console.log("\n--- 14. nested lists keep their level and their numbering ---");
{
  const md = [
    "- Top one.",
    "  - Nested a.",
    "  - Nested b.",
    "- Top two.",
  ].join("\n");
  const t = tree(md);
  check("one outer list", blockTags(md), "ul");
  check("a nested list exists", /ul[\s\S]*ul/.test(t), true);
  check("two top level items", render(md).frag.childNodes[0].childNodes
    .filter(n => n.tagName === "LI").length, 2);
}
{
  const md = [
    "- Top one.",
    "  1. Nested first.",
    "  2. Nested second.",
    "  3. Nested third.",
    "- Top two.",
  ].join("\n");
  const t = tree(md);
  check("outer list is not split", blockTags(md), "ul");
  check("a nested ordered list exists", /ol/.test(t), true);
  const ol = (function find(n) {
    if (n.tagName === "OL") return n;
    for (const c of n.childNodes) { const r = c.childNodes ? find(c) : null; if (r) return r; }
    return null;
  })(render(md).frag);
  check("nested ordered list found", !!ol, true);
  check("nested numbering runs 1 2 3",
    ol ? ol.childNodes.map(li => li.getAttribute("data-marker")).join(" ") : "",
    "1. 2. 3.");
  check("two top level items", render(md).frag.childNodes[0].childNodes
    .filter(n => n.tagName === "LI").length, 2);
}
{
  const md = [
    "1. Outer one.",
    "   - Nested bullet that also wraps onto",
    "     a second line.",
    "2. Outer two.",
  ].join("\n");
  check("outer ordered list is not split", blockTags(md), "ol");
  const ol = render(md).frag.childNodes[0];
  check("outer numbering runs 1 2",
    ol.childNodes.filter(n => n.tagName === "LI")
      .map(li => li.getAttribute("data-marker")).join(" "), "1. 2.");
}

console.log("\n--- 15. tables lose nothing ---");
{
  const md = [
    "| A | B |",
    "|---|---|",
    "| one | two | three |",
    "| four | five |",
  ].join("\n");
  const t = tree(md);
  const cells = (t.match(/^\s*td/gm) || []).length;
  // The table is padded to a rectangle, so two rows at a width of three is
  // six cells: the surplus cell is kept and the short row is filled.
  check("a row longer than its header keeps every cell", cells, 6);
  check("the extra cell text survives", /three/.test(render(md).frag.textContent), true);
}
{
  const md = [
    "| Token | Value |",
    "|---|---|",
    "| `a | b` | a pipe inside inline code |",
  ].join("\n");
  const cells = (tree(md).match(/^\s*td/gm) || []).length;
  check("a pipe inside inline code does not split a cell", cells, 2);
  check("the code text is intact",
    /a \| b/.test(render(md).frag.textContent), true);
}
{
  const md = ["| A | B |", "|-|-|", "| one | two |"].join("\n");
  check("a single dash separator is still a table", /doc-table/.test(tree(md)), true);
}
{
  const md = ["| A | B |", "|---|---|", "| one |"].join("\n");
  const cells = (tree(md).match(/^\s*td/gm) || []).length;
  check("a short row still fills the header width", cells, 2);
}


console.log("\n--- 16. this repository's own direction documents ---");
{
  // The scenario that matters: handoff.py hold --kind direction --doc on a
  // real doc from this repo. Every one of them separates sections with a
  // thematic break, several of them directly after a list.
  const dir = path.join(__dirname, "..", "work", "agent-console-design");
  let docs = [];
  try { docs = fs.readdirSync(dir).filter(n => n.endsWith(".md")); } catch (e) { docs = []; }
  check("found the direction documents", docs.length > 0, true);
  docs.forEach(name => {
    const src = fs.readFileSync(path.join(dir, name), "utf8");
    const out = render(src);
    const text = out.frag.textContent;
    // no thematic break survives as characters
    check(name + ": no literal rule in the output", /(^|\s)---(\s|$)/.test(text), false);
    // no list item begins with the rule it should have ended at
    const bad = [];
    (function walk(n) {
      if (n.tagName === "LI") {
        const t = n.textContent.trim();
        if (/^[-*_]{3,}\s/.test(t) || /\s[-*_]{3,}$/.test(t)) bad.push(t.slice(0, 40));
      }
      (n.childNodes || []).forEach(walk);
    })(out.frag);
    check(name + ": no item swallowed a rule", bad.length, 0);
    // identifiers survive
    if (/DESIGN_VARIANCE/.test(src))
      check(name + ": DESIGN_VARIANCE intact", /DESIGN_VARIANCE/.test(text), true);
    // rules were actually rendered where the source has them
    const wanted = (src.split("\n").filter(l => /^\s{0,3}(-{3,}|\*{3,}|_{3,})\s*$/.test(l))).length;
    const got = (ser(out.frag).match(/^\s*hr/gm) || []).length;
    check(name + ": every rule rendered (" + wanted + ")", got, wanted);
  });
}


console.log("\n--- 17. link forms that are not supported degrade visibly ---");
{
  // These are not silent losses: the characters stay on the page, so the
  // reader sees exactly what the author wrote even though no anchor is
  // built. Asserted so that a future change cannot make them silent.
  const md = "See the [spec][ref] for more.";
  check("a reference link keeps its text", render(md).frag.textContent,
    "See the [spec][ref] for more.");
  const md2 = 'See the [spec](https://example.com "The spec") for more.';
  const t2 = tree(md2);
  check("a titled link keeps its characters",
    /The spec/.test(render(md2).frag.textContent), true);
  const md3 = "See the [spec](https://example.com) for more.";
  check("a plain link does become an anchor", /doc-link/.test(tree(md3)), true);
}

console.log("\n" + (fail === 0 ? "ALL " + pass + " ASSERTIONS PASS" : pass + " pass, " + fail + " FAIL"));
process.exit(fail === 0 ? 0 : 1);

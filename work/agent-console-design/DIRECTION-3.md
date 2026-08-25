I have what I need. Here is the full document.

---

# DIRECTION-3: the visual language

**Front End Agents. Replaces sections 2 (type), 3 (colour), 5 (motion) and 8 (anti-patterns) of `DIRECTION.md`, and section 8 (motion) of `DIRECTION-2.md`.**

Everything structural in `DIRECTION-2.md` stands unchanged and is not mine to touch: the flow/thread form, track vs thread, the five terminus glyphs, the status vocabulary, the sentence-template rules, the responsive behaviour, the four ask shapes, the accessibility floor, every `DECISIONS.md` amendment. This document changes only how the thing looks and feels.

**Design read:** single-operator control surface for a person who is the bottleneck in his own pipeline, now rendered in a dimensional, high-DPI product language, leaning toward a Swiss-neutral variable UI face over a soft elevation system, with a hard flat drawing at the centre of it.

Dials: DESIGN_VARIANCE 5 (unchanged, the structure is settled) · MOTION_INTENSITY 6 (was 2) · VISUAL_DENSITY 6 (unchanged).

---

## 0. The one rule that resolves the brief

The owner wants rounded, dimensional, springy. The structural spec requires that the flow diagram stay a precise diagram. Those pull in opposite directions, and every bad version of this build will be a version that let them blur.

> **The furniture is soft, dimensional and reactive. The drawing is hard, flat and still. Every element in this console is one or the other, and nothing is both.**

Furniture: the shell, the ask field, cards, controls, inputs, the reading surface, the response bar. These get radius, elevation, hover states, and springs.

Drawing: everything inside a row's SVG. The track, the thread, the five termini, the return arc, the travelling segment. Zero radius (with one 4px exception, argued in section 5), zero shadow, zero fill, zero spring, zero hover.

The contrast between the two is the design. A soft, warm, dimensional page with one hard technical drawing sitting in the middle of it reads as *instrument*. Softening the drawing to match the furniture would produce a node graph, which the structural spec bans by name and which is the single most likely way this build fails.

---

## 1. Type

### 1.1 The three voices, kept

The two-voice split (three, counting machine literals) was called out in `DECISIONS.md` as one of the two ideas not up for negotiation. It survives, with new faces.

The rule is unchanged:

> The system speaks in one voice, the documents speak in another, and machine literals speak in a third. If you cannot say which voice a string belongs to, you have used the wrong face.

There is an Apple precedent for exactly this, which is worth naming because it is the strongest defence of the split against anyone who wants to collapse it: Apple ships **SF Pro** for interface, **SF Mono** for code, and **New York** for reading. Three voices, same semantic division. This is not a quirk of the old direction. It is what a mature system does.

SF Pro itself is not licensable as a webfont (Apple's licence covers designing for Apple platforms, not shipping the font over HTTP), so all three of ours are OFL and self-hosted.

### 1.2 System voice: Instrument Sans

**Instrument Sans**, SIL OFL 1.1, variable, axes `wght 400 to 700`, `wdth 75 to 100`, plus italics we will not use.

Why this and not the alternatives:

- **It is the free version of the paid upgrade path the original direction already wanted.** `DIRECTION.md` section 2 named "Untitled Sans or ABC Diatype" as the with-budget console voice. Instrument Sans lives in exactly that territory: a tight neo-grotesque with squared bowls, flat horizontal terminals, a tall x-height, and no personality tics. We get the upgrade for nothing.
- **The width axis is real and this console has a real use for it.** The board is a fixed-column grid: a name column, three equal stage columns, a time column. At 720px those columns are tight. `wdth 92` on the column headers and the dense metadata gives us genuinely narrower letterforms drawn by the designer, instead of negative letter-spacing or a horizontal `transform`, both of which look cheap on a 4K panel where you can actually see the distortion. Almost nobody exploits a width axis in product UI. It is the sharpest thing in this type spec.
- **It is not the reflex.** Inter is banned by the brief. Geist Sans is now the reflex default of every AI-generated developer tool in 2026 and would make this look like a Vercel template. Schibsted Grotesk (incumbent) is good but slightly editorial and slightly soft; "sharp and fresh" wants the harder cut.

**Not apple-esque in the letterforms, deliberately.** The temptation with "apple-esque" is a friendly geometric with circular bowls (Poppins, Circular, Wix Madefor Display). That is Apple's *marketing* register, not Apple's *tool* register. Xcode, Logic and Final Cut are SF Pro: neutral, tight, mechanical. This is a precision operator console. The rounding the owner asked for is spent on the radius and elevation system, not on the letterforms. Keeping the type sharp is what stops the whole thing from going soft.

### 1.3 Document voice: Newsreader

**Newsreader**, SIL OFL 1.1, variable, axes `opsz 6 to 72`, `wght 200 to 800`, with a real italic.

Literata was chosen originally for a specific reason: sturdy low-contrast stems that survive a dark background at 1x. That reasoning was correct for a 1x display. It is the wrong trade on a 4K panel, and this is the single most literal answer in this document to "4K HD quality, sharp and fresh."

- On a 2x display, a stroke that is 1 CSS pixel wide is 2 device pixels. The fine strokes of a higher-contrast transitional serif are no longer mush, they are the thing that makes the page look expensive. Literata's low-contrast, slab-adjacent stems were insurance against a rendering problem this machine does not have.
- **Newsreader has a genuine `opsz` axis from 6 to 72.** That is not decoration. It means a doc h1 at 30px automatically gets tighter spacing and finer hairlines, and body at 17px automatically gets more open spacing and sturdier stems, from the same file. This is the exact mechanism SF Pro uses (Display vs Text) and it is why Apple type looks correct at every size. Set `font-optical-sizing: auto` and let it work.
- It has a real italic, drawn rather than sloped, which the direction-doc treatment already depends on for notes, captions and blockquotes.

The reading experience does not regress: measure, tables breaking right, the h2 rail and hex swatches are all unchanged. Prose goes **up** from 16.5px to 17px, and the phone size goes from 15.5px to 16px, because the `opsz` axis makes the smaller sizes sturdier than Literata was at the same measure.

### 1.4 Machine literal: Geist Mono

**Geist Mono**, OFL, variable, used at 400 and 500 only. Sharp terminals, tall x-height, a slashed zero by default, and figures that hold their shape at 12px on a dark ground better than the incumbent.

Verify the OFL text ships in the repo before self-hosting. If it does not, the fallback in order is **Commit Mono** (OFL, purpose-built for code, neutral) then keeping **Spline Sans Mono**. The mono appears in four places in the whole tool, so this is the lowest-stakes decision here.

The ban is unchanged and is important: mono is for strings a machine will consume. Paths, slugs, hex values, agent names, code blocks. Never a label, never a heading, never a status word. Monospace as an interface voice is terminal cosplay and it is the fastest route back to the generic agent dashboard.

### 1.5 Weight, and the dark-mode grade

Three weight steps per family, and a systematic offset for dark mode.

| Step | Light | Dark | Used for |
|---|---|---|---|
| `--w-reg` | 450 | 430 | body metadata, register columns, timestamps |
| `--w-med` | 540 | 520 | project names, control labels, column headers |
| `--w-strong` | 620 | 600 | headlines, view headings, status words, the wordmark |

**Why dark mode is 20 units lighter.** Light text on a dark ground appears optically heavier than the same weight dark-on-light, because of irradiation: bright pixels bleed into their dark neighbours in the eye. Every serious dark UI compensates for this; Apple ships a whole optical grade for it. Because both faces are variable, we get the correct compensation for free by stepping the axis, which is strictly better than the usual bodge of picking a lighter named weight and living with the jump.

Set this through `font-variation-settings` on the `wght` axis, not through `font-weight` keywords, so the values are continuous and exact. Keep `font-synthesis-weight: none` so the browser cannot invent a fourth weight.

### 1.6 Scale, system voice (Instrument Sans)

| Role | Size / line height | Weight step | `wdth` | Tracking |
|---|---|---|---|---|
| Ask headline | 28 / 34px | strong | 100 | -0.018em |
| View heading, calm line, empty line | 20 / 26px | strong | 100 | -0.012em |
| Wordmark | 17 / 22px | strong | 100 | -0.010em |
| Project name, board row | 16.5 / 22px | med | 100 | -0.006em |
| Control label | 14 / 16px | med | 100 | 0 |
| Status word at the terminus | 13.5 / 18px | strong | 100 | 0 |
| Register metadata, time column | 13 / 18px | reg | 96 | 0.004em |
| Stage column header | 12 / 16px | med | 92 | 0.010em |
| Micro: counts, key hints | 11.5 / 14px | med | 96 | 0.012em |

At 375px the ask headline drops to 22 / 28px. Everything else holds.

**Tabular figures everywhere a number sits in a column.** Timestamps, elapsed times, per-stage times under the thread at 1240px, finding counts, word counts, and every numeric column inside a rendered doc table.

**No uppercase anywhere, and no tracking above 0.012em.** This ban survives intact from the old direction and it is the one that keeps this from becoming every AI console of 2026. One wide-tracked uppercase eyebrow undoes the whole thing.

### 1.7 Scale, document voice (Newsreader)

| Role | Size / leading | Weight | Notes |
|---|---|---|---|
| Doc h1 | 30 / 36px | 600 | Once per doc. `opsz` auto |
| Doc h2 | 22 / 29px | 600 | Hairline above, 36px clear space |
| Doc h3 | 17.5 / 25px | 700 | No rule |
| Doc body | 17px / 1.60 | 400 light, 390 dark | Measure capped 66ch |
| Doc table cell | 15px / 1.45 | 400 | `opsz` forced to 14 for sturdiness in dense rows |
| Note, caption | 14px / 1.50 | 400 italic | |
| Blockquote | 17px / 1.60 | 400 italic | Left rule, no quote marks |
| Typed feedback (textarea) | 17px / 1.60 | 400 | What you write is a document too |

Machine literal, Geist Mono: inline at `0.92em` of its context at 400. Code blocks 13.5px / 1.55 on the well surface.

Phone: prose and finding text at 16px, measure uncapped, tables scroll in place. Font size is never reduced to force a table to fit.

### 1.8 Loading and budget

Four latin-subset woff2 files: Instrument Sans roman variable (wght + wdth), Newsreader roman variable, Newsreader italic variable, Geist Mono variable. Roughly 210 to 250KB, in the same band as today.

`font-display: swap`, preload Instrument Sans and Newsreader roman only. Give each `@font-face` a metric-matched local fallback with `size-adjust`, `ascent-override` and `descent-override` so the swap does not shift layout. On a board of forty rows a font swap without metric overrides is a visible jolt, and CLS on a tool you stare at is worse than CLS on a page you scroll past.

If the budget has to be cut, the order is: Newsreader italic first, Geist Mono second (falling back to `ui-monospace`).

---

## 2. Colour

### 2.1 The old rule, and precisely how far it relaxes

The old system allowed exactly one hue, yellow, meaning "this needs you." That was the aesthetic risk of the original direction and it was a good one. "Sharp and fresh" asks for more life. Here is exactly how much more, and no more:

> **Two chromatic tokens exist. `attn` means a person has to do something. `live` means something is moving right now, including you.** Everything else in this interface is a neutral. Colour is never the first signal for anything, and never the only one.

Every other status keeps its achromatic treatment. `ready`, `clear` and `done` get no hue, because finished things recede rather than glow, and because a green tick would collapse this into the CI pipeline view the structural spec bans.

**`stopped` does not get red, and this is deliberate.** The whole concept is that this pipeline's normal condition is stopped. A failure hue would turn a normal condition into an alarm, and it is the templated answer. `stopped` shares the `attn` hue with `held`, because both mean the same thing to the operator: your move. They are separable before you read the word, exactly as `DECISIONS.md` amendment 4 requires, by the terminus glyph (cross-tick vs diagonal cut) and by the 1px border on the stopped field.

### 2.2 What `live` is for, and why focus uses it

`live` is aqua. It appears in exactly three places:

1. **The travelling segment** inside the running stage's column. The one genuinely live thing in the interface.
2. **The focus ring.** Where your next keystroke lands.
3. **The keyboard cursor row** on the board, as a 1px inset ring.

Those are one meaning, not two: *the thing that is in motion or about to be*. This is also the fix for `DECISIONS.md` amendment C, which had to invent a second focus token because a yellow ring vanishes on the light-mode yellow field. Aqua clears 3:1 against every surface in both themes including the yellow field, so the `--focus-on-field` token is deleted and one token does the job.

Aqua also has the largest hue separation available from the yellow while keeping both at very high luminance on a dark ground, so the two never read as versions of each other in peripheral vision.

### 2.3 Dark, designed first

The ground stays a green-black rather than a slate. `#0F172A` slate is named in the old direction's anti-reference list and it remains the single clearest tell of a generic 2026 dashboard. The ground goes one step darker than before to buy room for the elevation system underneath it.

| Token | Value | Contrast | Use |
|---|---|---|---|
| `--bg` | `#0B0F0E` | base | Page. Cool green-black |
| `--surface-1` | `#121716` | 1.07:1 on bg | Row hover fill, register band, quiet grouping |
| `--surface-2` | `#171D1C` | 1.12:1 on bg | Cards, doc reading surface, preview frame |
| `--surface-3` | `#1E2524` | 1.22:1 on bg | Control hover, highest resting surface |
| `--well` | `#080B0A` | 1.03:1 on bg | Inputs, code blocks, sunk areas |
| `--ink` | `#E6EDEB` | **16.24:1** on bg, 14.55:1 on surface-2 | Primary text |
| `--ink-2` | `#A2ADAA` | **8.35:1** on bg, 7.48:1 on surface-2 | Secondary, metadata |
| `--ink-3` | `#7C8783` | **5.16:1** on bg, 4.62:1 on surface-2 | Tertiary, timestamps, done projects |
| `--rule` | `#222A28` | decorative | Hairlines, table rules |
| `--rule-strong` | `#333E3B` | decorative | Structural rules, header underline |
| `--track` | `#333E3B` | 1.68:1, decorative | The permanent three-column track |
| `--thread` | `#8A9691` | **6.25:1** on bg, 5.87:1 on surface-1 | The drawn thread, terminus square, return arc |
| `--attn` | `#F5D547` | **13.35:1** on bg, 11.96:1 on surface-2 | The hue. Termini, held count, held state word |
| `--attn-field` | `#221F0C` | 1.18:1 on bg | The held region's surface. Visibly warmer |
| `--attn-line` | `#5A4B12` | decorative | Border on the stopped field, field rules |
| `--attn-on-field` | `#F5D547` | **11.28:1** on attn-field | Ink on the held field |
| `--live` | `#45DDD0` | **11.48:1** on bg, 9.70:1 on attn-field | Travelling segment, focus ring, cursor row |

Two constraints that fall out of these numbers and must be honoured:

- **`--ink-3` is not permitted on `--surface-3`** (4.24:1, under AA). `--surface-3` is a control hover fill and its labels are `--ink` or `--ink-2`. Do not put a timestamp on it.
- **`--track` is decoration and is declared as such.** It sits at 1.68:1 and does not meet the 3:1 graphical-object floor. This is correct and defensible: the topology it draws is expressed redundantly by the three real text column headers, so nothing is lost if the track is invisible. Everything the track is *not*, that is, everything carrying information, sits at 4.5:1 or better, which is stricter than WCAG requires for a graphic. That gap between 1.68 and 6.25 is exactly the furniture/drawing distinction from section 0, expressed in luminance.

### 2.4 Light

Light mode inverts the stacking, which is the correct convention and was not right before: the page is slightly grey and cards are near-white and lift off it. Previously the page and the raised surface were nearly the same value, which works when there are no shadows and stops working the moment there are.

| Token | Value | Contrast | Use |
|---|---|---|---|
| `--bg` | `#EDF1EF` | base | Page. Cool green-tinted paper, not cream |
| `--surface-1` | `#F6F9F8` | | Row hover fill, register band |
| `--surface-2` | `#FCFEFD` | | Cards, doc reading surface. Off-white, never `#FFF` |
| `--surface-3` | `#F1F5F3` | | Control hover |
| `--well` | `#E3E9E6` | | Inputs, code blocks |
| `--ink` | `#101614` | **16.07:1** on bg, 14.88:1 on well | Primary text |
| `--ink-2` | `#424D4A` | **7.78:1** on bg | Secondary, metadata |
| `--ink-3` | `#5F6C68` | **4.86:1** on bg | Tertiary, timestamps, done projects |
| `--rule` | `#DBE3DF` | decorative | Hairlines |
| `--rule-strong` | `#C3CCC8` | decorative | Structural rules |
| `--track` | `#C3CCC8` | 1.44:1, decorative | The track |
| `--thread` | `#4C5955` | **6.49:1** on bg, 7.06:1 on surface-1 | The drawn thread |
| `--attn` | `#7A6000` | **5.38:1** on bg | The held glyph and word where it sits on a normal surface |
| `--attn-field` | `#FFE873` | | The held region's surface, saturated |
| `--attn-line` | `#B08F00` | | Border on the stopped field |
| `--attn-on-field` | `#1A1400` | **14.90:1** on attn-field | Ink on the yellow field |
| `--live` | `#0E7C74` | **4.47:1** on bg | Travelling segment, focus ring (graphic, 3:1 floor) |
| `--live-ink` | `#0B6A63` | **5.76:1** on bg | The rare case where `live` sets text |

The light-mode inversion of the held field is the point, not a compromise. In dark it is a warm dark panel with yellow ink. In light it is a saturated yellow panel with near-black ink, which is how every caution panel in the physical world works. In both modes the held region is still the only chromatic surface on the page.

### 2.5 Display P3

Two tokens get a P3 upgrade and nothing else does.

| Token | sRGB fallback | P3 |
|---|---|---|
| `--attn` (dark) | `#F5D547` | `color(display-p3 0.949 0.831 0.235)` |
| `--live` (dark) | `#45DDD0` | `color(display-p3 0.286 0.866 0.812)` |
| `--live-ink` (light) | `#0B6A63` | `color(display-p3 0.043 0.416 0.388)` |

Delivered as a plain declaration order (sRGB value first, P3 value second on the same property), guarded by `@media (color-gamut: p3)` so non-P3 panels never parse it. The aqua is the one that actually gains: it goes from a good cyan to a genuinely electric one on a P3 monitor, and it is the token that most needs to catch the eye at the edge of vision.

**Neutrals stay sRGB.** A P3 neutral is the same colour and only introduces colour-management rounding on a screenshot or a colour-managed capture. There is no upside.

**The published contrast ratios above are floors.** Every P3 value is chosen to sit within two percent of its sRGB fallback's relative luminance, so no ratio in this document changes when the P3 branch is taken. Any future P3 value must be checked against this before it ships.

### 2.6 What colour is still not allowed to do

- **No colour for severity.** `must-fix`, `worth fixing` and `nitpick` are carried by order and weight, as before.
- **No colour for `ready`, `clear` or `done`.**
- **No coloured links.** Links are `--ink` with a 1px underline at 0.12em offset.
- **No coloured dots anywhere.** No chips, no pills, no badges, no status capsules. This is unchanged and it is structural.
- **No third hue for anything**, including any future state. If a fourth state arrives, it gets a glyph.
- **No glow.** `attn` is a field, `live` is a stroke. Neither is ever a `box-shadow` in its own colour. A coloured outer glow is the fastest way to make this look like the thing it is trying not to be.

The bonus the old direction identified still holds and gets stronger: when a build preview loads in the iframe full of somebody else's colours, an almost-achromatic console makes the boundary between the console and the artifact under review completely obvious, with no chrome and no label needed.

---

## 3. Elevation, radius, surface

### 3.1 The elevation system

`DIRECTION.md`'s "zero box-shadows, no exceptions" is lifted. In its place, a system with four levels and a strict construction rule.

> **Every elevation is exactly three or four layers: a ring, a contact shadow, an ambient shadow, and on dark, a top inset highlight. Never a single-layer shadow. Never more than four layers.**

A single `box-shadow` always reads cheap, because real light does not produce one uniform penumbra. Stripe, Linear and Vercel all layer. What separates a good stack from a generic one is that each layer has a job:

- **Ring**: `0 0 0 1px`, zero blur, zero offset. This is Vercel's technique and it is worth taking wholesale. It draws the containing line without a border's box-model cost, which means it never double-draws at a nesting boundary and never fights `box-sizing`.
- **Contact**: small blur, small positive offset, **negative spread**. Tight and dark, directly under the element. This is what makes the object look like it is resting on something.
- **Ambient**: large blur, large positive offset, **large negative spread**. Faint and wide. This is what makes the object look like it is in a room.
- **Top inset highlight (dark only)**: `inset 0 1px 0 0` at low white alpha. On a dark ground a black shadow is nearly invisible, so the top edge catching light is what actually separates the surface from the page. This is the Raycast insight and it is the single most important line in the dark stack.

**Shadows are tinted, never pure black on light.** On light the shadow colour is `--ink` (`#101614`) at varying alpha, not `rgb(0 0 0)`. A neutral black shadow on a green-tinted paper reads as a dirty grey smudge. On dark, pure black is correct, because the ground is already near-black and the shadow's job is to be darker than the page.

| Level | Dark | Light | Used by |
|---|---|---|---|
| `--elev-0` | none | none | Page, register rows, the flow diagram, tables, rules |
| `--elev-1` | `inset 0 1px 0 0 rgb(255 255 255 / .055)`, `0 0 0 1px rgb(255 255 255 / .055)`, `0 1px 2px -1px rgb(0 0 0 / .55)`, `0 6px 16px -6px rgb(0 0 0 / .45)` | `0 0 0 1px rgb(16 22 20 / .055)`, `0 1px 2px -1px rgb(16 22 20 / .10)`, `0 6px 16px -8px rgb(16 22 20 / .10)` | Resting cards, the doc reading surface, the preview frame, compact held items |
| `--elev-2` | `inset 0 1px 0 0 rgb(255 255 255 / .075)`, `0 0 0 1px rgb(255 255 255 / .07)`, `0 2px 4px -2px rgb(0 0 0 / .60)`, `0 14px 32px -12px rgb(0 0 0 / .55)` | `0 0 0 1px rgb(16 22 20 / .07)`, `0 2px 4px -2px rgb(16 22 20 / .12)`, `0 14px 32px -14px rgb(16 22 20 / .14)` | The open ask field. Hover state of a card |
| `--elev-3` | `inset 0 1px 0 0 rgb(255 255 255 / .09)`, `0 0 0 1px rgb(255 255 255 / .08)`, `0 4px 8px -4px rgb(0 0 0 / .65)`, `0 24px 56px -20px rgb(0 0 0 / .60)` | `0 0 0 1px rgb(16 22 20 / .08)`, `0 4px 8px -4px rgb(16 22 20 / .14)`, `0 24px 56px -22px rgb(16 22 20 / .16)` | The pinned response bar at 375px. Nothing else |
| `--well-inset` | `inset 0 1px 2px 0 rgb(0 0 0 / .50)`, `inset 0 0 0 1px rgb(255 255 255 / .04)` | `inset 0 1px 2px 0 rgb(16 22 20 / .07)`, `inset 0 0 0 1px rgb(16 22 20 / .07)` | Inputs, textareas, code blocks |

**`--elev-3` is used exactly once in the whole tool.** There are no modals, no toasts, no popovers, no dropdowns. The only thing that genuinely floats over content is the response bar pinned to the bottom of a 375px viewport. If a builder reaches for `--elev-3` a second time, something has been invented that does not belong here.

**Do not animate a box-shadow.** Shadow interpolation is a repaint per frame and it is the cheapest way to wreck INP on a board with forty rows. Where a card lifts on hover, the shadow is swapped as a discrete step at the start of the transition and the *motion* comes from `transform: translateY`. State the two elevation values, transition the transform, do not transition the shadow.

### 3.2 The radius scale

Rounded is the point, so there is a real scale. Four steps plus zero.

| Token | Value | Applies to |
|---|---|---|
| `--r-0` | `0` | The flow diagram, table structure, rules, the colour swatch |
| `--r-1` | `4px` | Checkbox, inline code, key hints, small ticks, the return arc's turns |
| `--r-2` | `8px` | Controls, buttons, inputs, textareas, register row hover fill |
| `--r-3` | `12px` | Cards, the doc reading surface, code blocks, the preview frame |
| `--r-4` | `20px` | The ask field. The outermost bounded surface, and only that |

**`--r-full` (`9999px`) is defined and never used.** Nothing in this tool is a pill. Pills would reintroduce the badge and chip vocabulary that the structural spec bans, and once one pill exists a builder will make a second one that carries status. Define it so nobody invents an alternative, then use it zero times, and make that a pre-flight check.

**The swatch stays square at `--r-0`.** A colour swatch beside a hex value in a rendered direction doc is a specimen, and specimens are square. Rounding it makes it read as a dot, and coloured dots are banned. This is the smallest decision in this document and it is the one most likely to get "improved" by accident.

### 3.3 The concentric radius rule

Nested corners with the same radius look wrong: the arcs are not concentric, so the gap between them widens at the corner and the inner shape appears to bulge. The fix is well established and Apple formalised it in SwiftUI as `ConcentricRectangle` at WWDC 2025.

> **Inner radius = outer radius minus the gap between the two edges. If the gap exceeds the outer radius, the inner radius is 0.**

And the corollary, which is half the rule and is usually forgotten:

> **A child that is flush to its parent's edge inherits the parent's radius on the flush corners.**

The response bar spans the full width of the ask field and sits at its bottom edge, so it takes `--r-4` on its bottom two corners and `0` on its top two. The old build already does this by hand; now it is a rule.

**Concentric nesting happens exactly once, at one boundary.** The ask field is `--r-4` (20px) and pads `8px` around the doc reading surface, so the reading surface is `20 - 8 = 12px`, which lands exactly on `--r-3`. That is the only place in the tool where two rounded frames nest. Anything deeper is a sibling sitting *on* a surface, not a frame *inside* a frame, and takes its own radius straight from the scale.

Two nested frames are correct. Three is a bug, and it is the cards-inside-cards-inside-cards look that makes an interface feel amateur.

### 3.4 Surfaces and hover

Surfaces are legitimate now, but not everywhere. The register is still a register.

| Element | Rest | Hover | Pressed |
|---|---|---|---|
| Register row | flat on `--bg` | `--surface-1` fill, `--r-2`, no shadow, **no lift** | `--surface-2` fill |
| Compact held item (card) | `--surface-2`, `--r-3`, `--elev-1` | `--elev-2`, `translateY(-1px)` | `--elev-1`, `scale(.985)` |
| Control (button) | 1px ring in `currentColor` at 40% | `--surface-3` fill, ring to 70% | `scale(.975)`, ring to 100% |
| Quiet control (text link style) | underline only | `--ink` | opacity 0.7 |
| Input, textarea | `--well` + `--well-inset` | ring warms one step | focus ring in `--live` |
| Ask field | `--attn-field`, `--r-4`, `--elev-2` | no hover, it is not a target | |

**Register rows do not lift on hover, and this is the accessory I removed.** The board is a register of up to twelve rows, each containing a precise drawing. Lifting a row on mouse-over turns a diagram into a bouncy list, drags the thread up with it, and makes the whole board feel loose when the mouse crosses it. The row gets a soft tinted fill with a rounded corner, which is enough to say "this is a target," and that is all it gets. Cards lift. Rows do not.

### 3.5 Glass, rationed to one

Exactly one element in this tool uses `backdrop-filter`: **the sticky top bar.**

`blur(20px) saturate(1.6)` over `--bg` at 72% alpha. It is the single most legible "Apple" signal available that is not slop, it is what every macOS and iOS toolbar does, and it is genuinely correct here because content really does scroll under it.

- Fallback when `backdrop-filter` is unsupported: opaque `--bg`.
- Fallback under `prefers-reduced-transparency: reduce`: opaque `--bg`.
- The top bar's bottom hairline is **absent until content scrolls under it**, then fades in over 140ms. Detect with an IntersectionObserver on a 1px sentinel at the top of `main`. Not a scroll listener, which stays banned.

Nothing else blurs. Not cards, not the ask field, not the response bar, not the preview frame. `backdrop-filter` on a scrolling container is a continuous GPU repaint and it is the exact trap that makes an "apple-esque" web build feel worse than a flat one.

---

## 4. Motion

Motion intensity goes from 2 to 6. "Flowy slight bounces on animated buttons and cards" is the instruction, and **"slight" is the whole engineering problem.**

### 4.1 The house spring

A spring's overshoot is set by its damping ratio. For a target first-peak overshoot of three percent, the damping ratio is:

`ζ = 0.75` gives a first-peak overshoot of **3.0 percent**, which lands at about 2.8 percent when sampled for CSS.

For calibration: `ζ = 0.72` gives 4 percent, `ζ = 0.78` gives 2 percent, and the `cubic-bezier(0.34, 1.56, 0.64, 1)` "spring" token found all over the web gives roughly **10 percent**. That last one is the toy bounce. It is what the brief is warning about and it must not appear in this build.

**`--ease-spring`**, ζ = 0.75, sampled at 21 points from the underdamped step response, peak 1.0284:

```
linear(
  0, 0.0753 5%, 0.2404 10%, 0.4298 15%, 0.6061 20%, 0.7518 25%,
  0.8616 30%, 0.9375 35%, 0.9861 40%, 1.0127 45%, 1.0254 50%,
  1.0284 55%, 1.0261 60%, 1.0213 65%, 1.0160 70%, 1.0110 75%,
  1.0069 80%, 1.0038 85%, 1.0017 90%, 1.0004 95%, 1
)
```

`linear()` has shipped in all major browsers since December 2023 and sits near 90 percent support. Guard it with `@supports (animation-timing-function: linear(0, 1))` and fall back to:

**`--ease-spring-fallback`**: `cubic-bezier(0.34, 1.26, 0.64, 1)`, whose maximum output is 1.022, so about **2.2 percent** overshoot. Close enough that nobody will see the difference, and crucially not the 1.56 version.

### 4.2 The other three curves

| Token | Value | Overshoot | For |
|---|---|---|---|
| `--ease-standard` | `cubic-bezier(0.2, 0, 0, 1)` | none | Colour, opacity, small discrete state changes, hover tints |
| `--ease-settle` | `cubic-bezier(0.16, 1, 0.3, 1)` | none | Anything in the diagram. Long, decisive, no bounce |
| `--ease-enter` | `cubic-bezier(0.32, 0.72, 0, 1)` | none | The pinned response bar entering at 375px |
| `--ease-spring` | above | 2.8% | Press release, card promotion, card lift settle |

`--ease-settle` is kept from the existing build unchanged. It is a genuinely good curve and it is already the right one for the thread.

### 4.3 Durations

| Token | Value | For |
|---|---|---|
| `--t-press` | 90ms | Press down |
| `--t-quick` | 140ms | Hover tint, focus ring, top bar hairline |
| `--t-release` | 240ms | Press release spring |
| `--t-move` | 420ms | Card promotion, field drain |
| `--t-thread` | 520ms | The thread extending |
| `--t-arc` | 700ms | The return arc drawing |

### 4.4 Every behaviour, by trigger

| # | Behaviour | Trigger | Property | Duration | Easing |
|---|---|---|---|---|---|
| 1 | **Press down** | `:active` on any control | `scale(.975)` + ring to 100% | 90ms | `--ease-standard` |
| 2 | **Press release** | `:active` removed | `scale(1)` | 240ms | `--ease-spring` |
| 3 | **Card lift** | pointer enters a compact held item | `translateY(-1px)`, elevation swaps at frame 0 | 240ms | `--ease-spring` |
| 4 | **Card settle** | pointer leaves | `translateY(0)` | 240ms | `--ease-spring` |
| 5 | **Row hover** | pointer enters a register row | `background-color` only | 140ms | `--ease-standard` |
| 6 | **Focus ring** | `:focus-visible` | `outline-color` from transparent | 140ms | `--ease-standard` |
| 7 | **Promotion** | the next held ask rises into place | `translateY(10px)` to `0` | 420ms | `--ease-spring` |
| 8 | **Field drain** | a decision lands | `background-color`, `color` | 420ms | `--ease-settle` |
| 9 | **Thread extends** | a decision lands | SVG path length | 520ms | `--ease-settle` |
| 10 | **Return arc draws** | a build is sent back | SVG path length, right to left | 700ms | `--ease-settle` |
| 11 | **Travelling segment** | a stage is running | `transform: translateX` | 2000ms loop | `linear` |
| 12 | **Top bar hairline** | content scrolls under | `opacity` | 140ms | `--ease-standard` |
| 13 | **Response bar enters** | 375px, ask opens | `translateY(100%)` to `0` | 420ms | `--ease-enter` |

**Why press-down does not spring and press-release does.** Contact with a physical object is abrupt: the surface stops the finger. Release is elastic: the material returns. Springing the press *down* is the tell of an over-animated interface and it makes a button feel mushy under the finger. This asymmetry is the whole reason the button will feel right.

**Why hover does not spring.** Hover is continuous. A spring on hover means every time the mouse crosses a card, the card wobbles, and if the mouse crosses three cards in half a second you get three overlapping wobbles. Hover gets the spring only on the settle, at a 1px travel, which is imperceptible as a bounce and perceptible as quality.

### 4.5 The diagram never springs

**Hard rule.** Behaviours 9, 10 and 11 are the only motion inside an SVG, and all three are non-overshooting. A thread that overshoots its terminus and springs back has drawn, for two frames, a line longer than the project's record, which is a lie about the data. It also instantly reads as a node-graph animation library.

Bans carried forward from `DIRECTION-2.md` section 8, unchanged: drawing the track in on load, drawing threads in on load, any `stroke-dasharray` reveal on load, hover effects on threads, a pulsing terminus, and any transition on the flow when a poll returns unchanged data. Only the row the operator just acted on ever animates. Elapsed times update every 15 seconds.

### 4.6 The reduced-motion position

A spring system needs this stated precisely, because "turn off animation" is not a position.

Under `prefers-reduced-motion: reduce`:

1. **Nothing overshoots.** Every `--ease-spring` becomes `--ease-standard`. This is the only global substitution and it is the most important one, because overshoot is the specific thing that triggers vestibular discomfort.
2. **Nothing translates.** Behaviours 3, 4, 7 and 13 lose their `translateY` entirely and become an instant position with a 120ms opacity or background transition to preserve the sense that something changed.
3. **Press feedback becomes a background tone change**, not a scale. Existing behaviour, kept.
4. **The travelling segment becomes a static half-filled span** in `--live` inside the running column. Existing behaviour, kept. The state is still expressed chromatically and by the word "running."
5. **The thread still extends and the return arc still appears**, instantly rather than drawn. This is the line that matters: reduced motion must never remove *information*. The thread's new length and the arc's existence are data. They arrive, they just do not travel.
6. **Colour and opacity transitions are kept at up to 140ms.** Reduced motion means reduced *movement*, not a hard cut to zero on everything. Instantly swapping a background is jarring in a different way.

Every one of these degradations is lossless, because in each case a word or a glyph already carries the meaning.

Implementation stays as it is today: CSS transitions plus one keyframe animation, no scroll listeners, no `requestAnimationFrame`, no libraries. Animate `transform` and `opacity` only, with the two SVG path-length cases as the documented exception.

---

## 5. How the flow diagram looks

This is the part most at risk and it gets the tightest spec.

### 5.1 The boundary

Inside a row's SVG: **no radius, no shadow, no fill, no gradient, no hover, no spring.** The SVG is `aria-hidden`, contains zero text, and every visible word is real HTML in a grid cell, exactly as `DIRECTION-2.md` section 2.5 requires.

The soft, dimensional language stops at the edge of the drawing. The row around it may be a rounded tinted surface. The drawing on it is a technical illustration.

### 5.2 Geometry and the sub-pixel hairline

The SVG's `viewBox` is set 1:1 with its CSS pixel size, so one user unit equals one CSS pixel. Then:

- **Every horizontal and vertical stroke sits on a half-pixel coordinate.** SVG treats whole-number coordinates as the boundary *between* pixels, so a 1px stroke centred on a whole number straddles two pixels and antialiases into a blurred 2px grey band. `y = 20.5` renders as one crisp line. This is the difference between the diagram looking drawn and looking printed on a fogged window.
- **Every filled square sits on whole-number coordinates with an even size.** A 6px square at `x = 40, y = 18` is exact. On a half-pixel it is not.
- **Diagonals and arcs stay off the half-pixel grid and keep antialiasing.** `shape-rendering: crispEdges` is **banned**: it turns antialiasing off globally for the element, which fixes the axis-aligned lines we have already fixed by hand and wrecks the `stopped` diagonal cut and the return arc. Use `shape-rendering: geometricPrecision` or leave it at `auto`.
- `vector-effect: non-scaling-stroke` on every stroke, so one hairline is exactly its declared width at every viewport width, with no media queries. Kept from `DIRECTION-2.md`.
- `stroke-linecap: butt` everywhere. Round caps on a thread make it read as a node-graph noodle, and the `ready` terminus is defined as "ends flush at the column boundary, unmarked," which a round cap silently violates by adding half a stroke width.

**The true sub-pixel hairline, and where it goes.** A 1px CSS border is two device pixels on a 2x display. That is fine for the thread, which is data and should be solid. It is heavier than it needs to be for the track, which is furniture.

> At `min-resolution: 2dppx`, the **track** drops to `stroke-width: 0.5`, which is one true device pixel, and its colour steps one notch up in contrast to compensate for the halved coverage. The **thread** stays at `stroke-width: 1`.

This produces a visible two-tier hierarchy of line weight that only exists on a high-DPI panel and degrades cleanly to a single 1px weight at 1x. It is the most direct answer available to "4K HD quality" and it costs one media query.

HTML borders stay at 1 CSS pixel throughout. A 0.5px HTML rule needs either `box-shadow: 0 0 0 0.5px` or a scaled pseudo-element, both of which are fragile across browsers and both of which vanish at 1x. The sub-pixel treatment lives in the one place we fully control the DPR branch.

### 5.3 The five termini, drawn

All five are exactly as `DIRECTION-2.md` section 2.3 defines them. Here is the geometry.

| State | Mark | Geometry | Colour |
|---|---|---|---|
| `held` | Vertical cross-tick | 12px tall, 1.5px wide, centred on the thread's y, x on the half-pixel | `--attn` |
| `running` | No terminus | 24px segment, 2px, travelling forward in the current column | `--live` |
| `ready` | Flush end, unmarked | thread ends exactly at the column boundary x, butt cap | `--thread` |
| `clear` | Filled square | 6 by 6px, whole-number coordinates, no stroke | `--thread` |
| `stopped` | Diagonal cut | 14px at -45 degrees, 1.5px, antialiased | `--attn` |

The cross-tick and the diagonal cut are 1.5px rather than 1px on purpose: the terminus is the highest-information mark in the interface and it should out-weigh the line it closes.

The travelling segment is the one place a gradient exists in this build. See section 6.4.

### 5.4 The return arc

Drawn under the row, right to left, landing at the left edge of the column it returns to, with the one arrowhead in the whole interface.

- **Orthogonal, not bezier.** Down, left, up. A bezier curve here is exactly the "bezier spaghetti" the structural spec bans, and it is what every auto-layout graph library produces.
- **The turns get a 4px radius.** This is the only rounding permitted inside the drawing, and it earns its place: a hard 90 degree turn in a 1px line reads as a circuit trace, whereas a 4px turn reads as a drawn line changing direction. It is also the one concession the diagram makes to the owner's "rounded edges," and one is the right number.
- **The arrowhead is two 1px line segments, not a filled triangle.** A filled triangle marker is the Mermaid tell. Two strokes at 30 degrees, 7px long, butt caps.
- Colour `--thread`. The arc is history, not attention.
- Second forward pass at a 4px vertical offset, stacking to three passes, then the row prints the pass count. Unchanged.

### 5.5 The row, the track, and the columns

- **The track** is drawn once per row as the furniture, in `--track`, at 0.5px on high-DPI and 1px otherwise. It is present on an empty board.
- **The three stage columns get no fills, no tints, no zebra, no swimlanes, no colours.** Unchanged and non-negotiable.
- **Column headers** are real HTML in `--ink-3`, Instrument Sans at 12px, `wdth 92`, sentence case. Never uppercase.
- **Row hover** applies `--surface-1` with `--r-2` behind the whole grid row including the SVG. The drawing does not change. No lift, no shadow, no thread hover.
- **Row keyboard focus** applies the `--live` outline *and* thickens the thread from 1px to 1.5px. Two signals, one of them colour-independent, consistent with the rule that status is never colour alone.
- **At 375px** the track becomes one full-width rule with two hairline ticks (1px by 8px, `--track`) at the third positions. The return arc still draws. Unchanged.

---

## 6. Rendering at 4K

The brief asked for this to be taken literally. Here are the five answers.

### 6.1 Text rendering, and one piece of dead code

**`-webkit-font-smoothing: antialiased` currently sits in `body` and does nothing on this machine.** It is a macOS-only property. On Windows, Chrome and Edge render through DirectWrite and ignore it entirely. Remove it rather than carry a line that implies a decision was made.

The real lever on Windows is weight, and section 1.5 is the answer: **step the variable `wght` axis down by 20 units in dark mode.** Light text on a dark ground appears optically heavier because of irradiation, and DirectWrite's grayscale antialiasing at high DPI does nothing to counteract it. Because both faces are variable, this is a true continuous grade rather than a jump to the next named weight.

`text-rendering` stays at `auto`. `optimizeLegibility` forces kerning and ligature processing, has a measurable layout cost on a page rendering a 3,000 word document, and has a long history of dropping glyphs in some engines. It is a superstition, not an optimisation.

`font-optical-sizing: auto` is set globally, which is what activates Newsreader's `opsz` axis. Override it explicitly only for doc table cells, which are forced to `opsz 14` so the 15px cells stay sturdy in dense rows rather than getting the finer strokes their size would otherwise request.

### 6.2 Hairlines

Answered in 5.2. HTML rules stay at 1 CSS pixel. The SVG track goes to a true 0.5px device-pixel hairline at `min-resolution: 2dppx` with a compensating colour step. That is the only sub-pixel line in the build, and it is in the one place where a DPR branch is safe.

### 6.3 Banding

**There is no gradient in this build large enough to band.** That is the primary defence, and it is a design decision rather than a technique: no mesh, no aurora, no gradient headers, no gradient text, no gradient borders. Elevation is carried by layered shadows, not by a background gradient, which is the usual source of banding in dark UIs.

The rule for anyone extending this: **a single-hue gradient under about 200px in this palette cannot band on a 10-bit panel. A gradient longer than that will, and is banned.** If one is ever genuinely needed, interpolate `in oklab` (single hue) or `in oklch` (multi hue), never in sRGB, which produces the grey dip in the middle that makes a gradient look muddy before it even bands. Noise-dither overlays are not permitted as a fix, because the fix is to not need one.

### 6.4 The one gradient

The travelling segment. A 24px `--live` bar with two hard ends reads as a caterpillar crawling along the thread. Giving it a 24px trailing fade makes it read as motion.

- Total length 48px: 24px solid `--live`, then 24px fading to transparent behind it.
- Interpolated `in oklab`, single hue.
- 48px is two orders of magnitude short of the length at which this palette bands.

That is the entire gradient budget for the tool. One gradient, 48px long, functional. Pre-flight check: a grep for `gradient` returns exactly one match.

### 6.5 Wide gamut

Answered in 2.5. Two chromatic tokens get a `color(display-p3 ...)` value behind a `@media (color-gamut: p3)` guard with the sRGB value declared first. Neutrals stay sRGB. Every P3 value is luminance-matched to its fallback within two percent so the published contrast ratios hold in both gamuts.

---

## 7. What I rejected, and why

Named specifically, because "apple-esque" is the exact brief that produces generic glassmorphic gradient soup, and the way to avoid that is to name the traps rather than to try to avoid them by feel.

**1. Glass on everything.** The trap. Apple's Liquid Glass is documented for Apple platforms only; there is no official web implementation, and every web version is a `backdrop-filter` plus refraction-highlight stack that looks cheap at 1x and destroys INP the moment it moves. Rejected wholesale. **Took:** one blur, on the top bar, where content actually scrolls underneath, with both an unsupported fallback and a `prefers-reduced-transparency` fallback.

**2. Vercel's radius scale.** Vercel's Geist system permits 4px, 6px and 9999px only, with 6px as the default container radius. Rejected: 6px containers are too tight for a brief whose first two words about shape are "rounded edges," and the 9999px pill would reintroduce the badge vocabulary the structural spec bans. **Took:** the `0 0 0 1px` ring-as-border technique, wholesale, because it avoids the box-model and double-border problems a real border has at nesting boundaries.

**3. Raycast's `rgba(255, 255, 255, 0.06)` card border, as a literal value.** **Took:** the underlying insight, which is that dark-mode elevation is a ring plus a top inset highlight rather than a shadow, because a black shadow on a near-black ground is invisible. **Rejected:** the value itself. It is tuned to Raycast's neutral `#101111`. On this build's green-cast `#0B0F0E` a pure-white ring reads faintly blue and fights the ground. Ours is tinted toward the ink.

**4. `cubic-bezier(0.34, 1.56, 0.64, 1)`.** This is the "spring" token you find in the wild, and it overshoots about 10 percent. That is the toy bounce the brief warns against by name. **Took:** the idea of a spring token. **Rejected:** that spring. Computed a damping ratio of 0.75 for a 3 percent first peak and sampled it into a 21-point `linear()`, with a 2.2 percent cubic-bezier as the support fallback.

**5. Springing anything inside the diagram.** The most tempting mistake in the whole build, because the brief says "flowy slight bounces on animated buttons and cards" and it would be easy to read the thread as a card. A thread that overshoots draws a line longer than the project's record for two frames, which is a lie about the data.

**6. Material's elevation ladder.** Twenty-four dp levels for an application that needs three depths and uses the third exactly once.

**7. Red, green and amber CI status colours.** The templated answer, and it would invert the whole concept: this pipeline's normal condition is stopped, and a failure hue turns a normal condition into an alarm. `stopped` keeps the attention hue and is separated from `held` by its glyph and its field border.

**8. Inter, Geist Sans, and SF Pro imitations.** Inter is the reflex and is banned by the brief. Geist Sans is the 2026 reflex for developer tools specifically and would make this look like a Vercel template. SF Pro is not licensable as a webfont. Instrument Sans gets to the same place with a width axis nobody uses.

**9. A friendly geometric for "apple-esque."** Circular bowls and soft terminals are Apple's marketing register, not the register of Xcode or Logic. This is a precision operator console. The rounding is spent on radius and elevation; the letterforms stay sharp.

**10. `shape-rendering: crispEdges`.** It disables antialiasing for the whole element, which fixes axis-aligned lines that half-pixel positioning has already fixed properly, and destroys the `stopped` diagonal cut and the return arc's turns.

**11. `text-rendering: optimizeLegibility`** and **`-webkit-font-smoothing: antialiased`**. One is a cost with no benefit; the other is a no-op on this machine.

**12. Decorative gradients of every kind.** Mesh, aurora, gradient text, gradient headers, animated gradient borders. One functional 48px gradient exists and nothing else.

**13. Hover lift on register rows.** Cut deliberately, as the one accessory removed. Cards lift; rows tint.

**14. A rounded colour swatch.** Specimens are square. A rounded swatch reads as a dot and coloured dots are banned.

**15. Animating `box-shadow`.** A repaint per frame across a board of rows. Elevation swaps as a discrete step; the transform carries the motion.

---

## 8. Second pass: what changed after critique

The brief said to iterate. Four things changed between the first draft of this direction and this one.

**Dropped the second focus token.** The first pass kept the attention hue for focus, which meant carrying `DECISIONS.md` amendment C's `--focus-on-field` inversion forever. Moving focus to the `live` hue removes a token, resolves the amendment permanently, and turns out to be semantically *better*: focus and "running" both mean "this is the thing currently in motion."

**Killed the row hover lift.** The first pass gave every interactive element the same lift-and-settle spring. On a board of twelve rows, each containing a hairline drawing, that made the whole page feel loose under the mouse. Rows tint, cards lift.

**Cut the second blur.** The first pass blurred both the top bar and the pinned response bar at 375px. Two blurs is a pattern; one blur is a decision. The response bar is a control surface and control surfaces should be solid.

**Made the concentric rule apply exactly once.** The first pass stated the general formula, which is geometrically correct and produces absurd results at this tool's padding scale (a 20px field padding 22px would require a square-cornered card inside it). Restating it as "one concentric boundary, everything deeper is a sibling on a surface" is both honest and a useful constraint against nested-card creep.

---

## 9. Pre-flight, for the builder

Mechanical checks. Each one is a grep or a count.

- [ ] `box-shadow` appears only as the four elevation tokens and the well inset. Zero ad-hoc shadows. Zero coloured glows.
- [ ] `--elev-3` is referenced exactly once.
- [ ] `border-radius: 9999px` and `--r-full` appear zero times.
- [ ] `backdrop-filter` appears exactly once, with both fallbacks.
- [ ] `gradient` appears exactly once, at 48px, `in oklab`.
- [ ] Zero `border-radius` inside any SVG except the return arc's 4px turns.
- [ ] Zero `transition` or `animation` on any SVG element except behaviours 9, 10 and 11.
- [ ] `--ease-spring` never appears on an element inside an SVG.
- [ ] `cubic-bezier(0.34, 1.56` appears zero times.
- [ ] `shape-rendering: crispEdges` appears zero times.
- [ ] `-webkit-font-smoothing` and `text-rendering: optimizeLegibility` appear zero times.
- [ ] `text-transform: uppercase` appears zero times.
- [ ] Every axis-aligned SVG stroke coordinate ends in `.5`. Every filled square coordinate is a whole number with an even size.
- [ ] `color(display-p3` appears exactly three times, each preceded by an sRGB fallback and wrapped in `@media (color-gamut: p3)`.
- [ ] `--ink-3` never sits on `--surface-3`.
- [ ] The focus ring is an `outline`, never a `box-shadow`, and is visible on `--bg`, on `--surface-2`, and on `--attn-field` in both themes.
- [ ] `prefers-reduced-motion: reduce` removes every overshoot and every translate, and removes no information.
- [ ] Zero em-dashes and zero en-dashes in any visible string.
- [ ] Zero emoji.
- [ ] A grep of the rendered page for a space followed by a period or a comma returns nothing.

And the one that is not mechanical, so it needs a person: **look at the board and ask whether the drawing still looks drawn.** If the thread has picked up a shadow, a rounded cap, a hover state or a bounce, section 0 has been broken and the rest of the work does not matter.

---

## Sources

- [Vercel design tokens, typography and CSS variables (DesignMD)](https://designmd.cc/benchmarks/vercel) and [Design system inspired by Vercel](https://www.ifuryst.com/DESIGN.md/vercel/design-md/) for the ring-as-border technique and the 4 / 6 / 9999 radius scale
- [Raycast design system tokens](https://open-design.ai/plugins/design-system-raycast/) and [Raycast DESIGN.md](https://github.com/VoltAgent/awesome-design-md/blob/main/design-md/raycast/DESIGN.md) for dark-mode elevation as ring plus inset highlight
- [Springs and bounces in native CSS, Josh W. Comeau](https://www.joshwcomeau.com/animation/linear-timing-function/) for `linear()` spring sampling, overshoot semantics and browser support
- [Easing curves are a design language](https://www.baraa.app/blog/easing-curves-are-a-design-language) for the `cubic-bezier(0.34, 1.56, 0.64, 1)` spring token in common use
- [The math behind nesting rounded corners, Cloud Four](https://cloudfour.com/thinks/the-math-behind-nesting-rounded-corners/) and [ConcentricRectangle and corner radius consistency](https://livsycode.com/swiftui/concentricrectangle-and-corner-radius-consistency/) for the concentric radius rule and Apple's WWDC 2025 API
- [Designing better CSS box shadows](https://theosoti.com/blog/designing-shadows/) and [CSS box shadow definitive guide](https://ultimatedesigntools.com/blog/css-box-shadow-guide/) for umbra / penumbra / ambient layering and tinted shadows
- [Wide gamut color in CSS with Display-P3, WebKit](https://webkit.org/blog/10042/wide-gamut-color-in-css-with-display-p3/) and [Using Display-P3 colour](https://darn.es/using-display-p3-colour/) for the fallback pattern
- [Why CSS gradients look grayish: banding and OKLCH](https://www.toolbox365.net/tutorials/gradient-banding-and-oklch/) for oklab / oklch interpolation
- [WebKit font smoothing](https://dbushell.com/2024/11/05/webkit-font-smoothing/) and [MDN `font-smooth`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/font-smooth) for the macOS-only behaviour
- [MDN `shape-rendering`](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/shape-rendering) and [For crisp edges, use anything but crispEdges](https://coderwall.com/p/ufldzw/for-crisp-edges-use-anything-but-crispedges) for half-pixel stroke alignment
- [Instrument Sans on Fontsource](https://fontsource.org/fonts/instrument-sans) and [Newsreader on Fontsource](https://fontsource.org/fonts/newsreader) for variable axis ranges
- [Apple Human Interface Guidelines, Materials](https://developer.apple.com/design/human-interface-guidelines/materials) for the platform-only scope of Liquid Glass

---

Files read: `C:\Users\handr\Documents\Agents\design-agent\work\agent-console-design\DIRECTION-2.md`, `C:\Users\handr\Documents\Agents\design-agent\work\agent-console-design\DIRECTION.md`, `C:\Users\handr\Documents\Agents\design-agent\work\agent-console-design\DECISIONS.md`, `C:\Users\handr\Documents\Agents\design-agent\work\agent-console\styles.css`.

Note for the orchestrator: this document is written to be saved as `C:\Users\handr\Documents\Agents\design-agent\work\agent-console-design\DIRECTION-3.md`, which `DIRECTION-2.md` line 7 already forward-references.

> "Direction proposed. This is ready for human review — do not proceed to component-builder until the user approves or gives feedback."
agentId: aa28012ac566d3ae9 (use SendMessage with to: 'aa28012ac566d3ae9', summary: '<5-10 word recap>' to continue this agent)
<usage>subagent_tokens: 172256
tool_uses: 23
duration_ms: 923226</usage>
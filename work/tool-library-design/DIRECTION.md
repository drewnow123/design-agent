# Fifth Street Tool Library — visual direction

A one-page site for a neighborhood tool-lending library. Someone lands on it
because a neighbor mentioned it, and leaves knowing three things: what they can
borrow, what it costs, and when the door is open.

This is a **short test project** for exercising the Handoff console — one page,
one HTML file, no build step.

## The problem with the obvious version

The obvious version is a soft-shadowed card grid on white, a hero with a
gradient, and a photo of hands holding a drill. That reads as a SaaS landing
page for a tool library, not as a tool library. The institution it should feel
like is a **public library card catalog**: plain, dense, legible, faintly
municipal, and completely unembarrassed about it.

## Direction

**Typography.** One serif, one mono, no sans. Headings and body in a
transitional serif (Newsreader is already self-hosted in this repo). Every
piece of *data* — hours, fees, catalog counts, the shelf codes — in Geist Mono
at a small size. The split does the work a second typeface usually does: prose
is prose, and anything you'd read off a card is monospaced.

**Color.** Paper, not white. A warm off-white ground (`#f4f1ea`), near-black
ink (`#1c1a17`), and one accent: a stamped-red (`#a8321e`) used only for the
membership call to action and the "on loan" state. Rules and borders are hairline
ink at low opacity, never gray boxes. Dark mode inverts to ink-on-charcoal
keeping the same red.

**Layout.** A single measured column, ~62ch, left-aligned, no centering of body
text. The catalog is not a card grid — it is a **table**, with shelf code,
item, and status as columns, the way a real catalog is. Section breaks are a
horizontal rule and a small-caps monospace label, not a big heading with air
around it.

**The one deliberate flourish.** The masthead is a borrowed-book due-date
stamp: the library name set large in serif, with a mono line beneath it listing
the last four dates the library was open, struck through. It is the only
decorative element, and it carries real information.

## Reference points

Not Stripe, not Linear. Closer to: a university press colophon page, an actual
Dewey card, and the typographic density of a printed transit timetable.

## What gets built

One `index.html` with inline `<style>`, self-hosting the two fonts already in
`work/agent-console/fonts/`. Sections: masthead, what this is, catalog table
(~8 rows), membership + fees, hours + address. No JS beyond a theme toggle if
it is free.

## Open question for you

The stamped-red accent is the one choice I'd flag. It is the difference between
"municipal and dry" and "municipal with a pulse." If you'd rather it stay
strictly two-color ink-on-paper, say so and I'll drop the red entirely and use
weight and rules alone.

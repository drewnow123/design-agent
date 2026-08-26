# Builds

One directory per brief. `index.html` is the register of what is in here, and
it is generated, so this file does not repeat the list.

```
python scripts/build-index.py            write work/index.html
python scripts/build-index.py --check    verify it, write nothing
```

Regenerate after creating a project directory and after a stage writes files
into one. The generator is safe to run repeatedly: it writes nothing when
nothing changed.

Structure is discovered, prose is written. The generator walks this directory
for the projects, their documents, their paths, the findings count and the
order. `index.json` holds the half no walk can produce: the display names, the
one or two sentence glosses, and the occasional clause on a document whose name
is not enough. A directory missing from `index.json` still appears on the page,
named from its slug; a slug in `index.json` with no directory is an error.

The design direction for the page is `work-index-design/DIRECTION.md`, and
`work-index-design/DECISIONS.md` amends it.

Served at http://localhost:8788 by the `static-preview` launch config.

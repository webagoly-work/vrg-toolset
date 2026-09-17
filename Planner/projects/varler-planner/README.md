# Varler Planner

Villanyszerelési tervező — electrical planning tool for residential and commercial work.
Builds to **one self-contained HTML file** that runs offline in a browser.

```bash
npm install          # once (jsdom, for the tests)
npm run build        # → dist/varler_planner.html
npm test             # build + 595 assertions + 70 golden renders
```

Open `dist/varler_planner.html` in a browser. That is the whole product.

## Where to look

| | |
|---|---|
| `docs/ARCHITECTURE.md` | module map, invariants — **read before editing** |
| `docs/DECISIONS.md` | why things are the way they are |
| `docs/1.1_backlog.md` | queued features and what they demand of the model |
| `tests/README.md` | how the suite works, and what it cannot check |
| `docs/browser_verification_checklist.md` | the manual pass jsdom can't do |

## Status

**1.0.0** — the refactor is complete: golden tests, source split, document schema with stable ids,
one editor surface with two projections, layered rendering, scoped history, an action registry
driving the palette and the shell, a translation seam and a standards panel.

Next: the 1.1 backlog in `docs/1.1_backlog.md`.

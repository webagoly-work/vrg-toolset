# VRG Oldalpanel (Side panel) — `shared/sidepanel/`

A framework-free side panel that any VRG page can add to get a column of **modules**: quick-access buttons, switches,
a note, status rows, or a module of its own. It has a collapsed icon rail, a simple / detailed mode, sections you can
open and close, a resize grip, and saved state. It is a classic script with no build step and no dependencies, and it
runs under the VRG Asztal's CSP (`script-src 'self'`).

## Where it comes from

It is the Varler Planner's side panel, lifted out of the Planner:

| Planner idea | Source | Here |
|---|---|---|
| A fixed frame: "places that never move, only their contents change" | `Planner/projects/varler-planner/src/05db-layout.js:10-22` | the panel stays put; modules are added and removed |
| `PANEL_HOME`: each panel says where it lives | `05db-layout.js:51` | a module declares `order` and `level` |
| The phase tools as a grid or a list (`phLayout`) | `05db-layout.js:62`, `:105` | `modules.links(items, { layout: 'grid' \| 'list' })` |
| `.side` columns of `.grp` sections with an uppercase heading | `src/shell.html:116-126` | `.vrg-sp` with `.vrg-sp-mod` sections |
| The sidebars' resizers | `src/shell.html:329` | the grip on the inner edge (drag it; double-click resets) |
| Tab hides the sidebars for the wide work mode | `src/05d-shell.js:109` | collapse to the rail (◂ / ▸, the hotkey, Esc) |
| The Mélyvíz look of the sidebars | `src/shell.html:387-391` | `sidepanel.css` on the `--mv-*` tokens |

New here: the simple / detailed mode (modules and link items marked `level: 'detailed'` only show in detailed mode),
the icon rail with badges, controls declared as data, and saved state (`persistKey`).

## Add it to a page (3 lines)

```html
<link rel="stylesheet" href="../shared/sidepanel/sidepanel.css">
<script src="../shared/sidepanel/sidepanel.js"></script>
<script>VRGSidePanel.create(document.getElementById('app'), { side: 'right', title: 'Gyors elérés', modules: [VRGSidePanel.modules.links([...])] });</script>
```

The **host** element becomes a flex row (`.vrg-sp-host`). The panel takes its own width, and the host's other children
share the rest (`flex: 1 1 auto; min-width: 0` is set for them). The host needs a height, because the panel fills it and
scrolls inside. Load `shared/melyviz.css` first for the real tokens; without it the CSS falls back to the same colours.

## API

```js
const panel = VRGSidePanel.create(host, {
  side: 'right',                 // 'left' | 'right'
  title: 'Gyors elérés', titleEn: 'Quick access',
  width: 280,                    // clamped to 180–640; the grip changes it
  collapsed: false,              // a saved state wins over this
  modes: ['simple', 'detailed'], mode: 'simple',
  persistKey: 'sessions',        // saves to localStorage 'vrg.sidepanel.sessions'; omit = no saving
  hotkey: 'Alt+\\',              // works while the focus is inside the host; null = none
  globalHotkey: false,           // true = also when nothing has the focus (document.body)
  modules: [ ... ],              // optional; the same as calling add() for each
  onEvent: (type, data) => {},   // 'collapse' 'mode' 'width' 'section' 'change' 'run' 'error'
});
panel.add(module)        // → panel; replaces a module with the same id
panel.remove(id)         // → boolean
panel.get(id)            // → the normalized module | null
panel.list()             // → every id, in order
panel.open(id)           // expands the panel, opens the section (switching to detailed if needed), focuses it
panel.setMode('detailed' | 'simple') · panel.mode()
panel.toggle(force?)     // → collapsed (true / false) · panel.collapsed()
panel.setWidth(px)       // → the clamped width · panel.width()
panel.refresh(id?)       // re-renders one module or all of them
panel.destroy()          // runs every module's cleanup and removes the panel
panel.el                 // the <aside class="vrg-sp">
```

### The module contract

```js
{
  id: 'links',                   // [A-Za-z0-9][A-Za-z0-9_.:-]{0,63}
  title: 'Gyors elérés', icon: '⚡',  // icon ≤ 4 characters (also on the rail)
  order: 10,                     // ascending; ties by id
  level: 'simple',               // 'detailed' = shown only in detailed mode
  open: true,                    // the section's first state (the user's choice is saved)
  controls: [                    // drawn in the section above the content; values are saved
    { id: 'layout', kind: 'select', label: 'Elrendezés', options: [{ value: 'grid', label: 'Rács' }], value: 'grid', onChange(v, ctx) {} },
    { id: 'n', kind: 'slider', label: 'Sűrűség', min: 1, max: 4, step: 1, value: 2, onChange(v, ctx) {} },
    { id: 'on', kind: 'toggle', label: 'Bekapcsolva', value: true, onChange(v, ctx) {} },
    { id: 'go', kind: 'button', label: 'Frissítés', onChange(_, ctx) {} },
  ],
  render(el, ctx) { /* fill el; may return a cleanup function */ },
  onMode(mode, el, ctx) {},      // optional: called after every layout (e.g. to show or hide detailed items)
}
// ctx = { panel, module, mode, el, value(id), setValue(id, v), emit(type, data), setBadge(text) }
```

A module is mounted while its mode shows it, and unmounted (its cleanup runs) when the mode hides it. A `render` that
throws shows an error line in its own section and fires an `error` event; the panel keeps working. Write text with
`textContent`, never `innerHTML`.

### Built-in modules

| Factory | What it is |
|---|---|
| `modules.links(items, { id, title, icon, order, level, layout })` | quick-access buttons: `{ id, label, icon, title, level, disabled, run(item, ctx) }`; `run` may be async; a throw becomes an `error` event. `module.set(items)` replaces the list |
| `modules.toggles(list, o)` | switches: `{ id, label, title, value, onChange(v, ctx) }`, saved |
| `modules.notes(o)` | a saved free-text note (≤ 4000 characters); the badge ● shows when it has text |
| `modules.status(rows, o)` | `{ label, value, tone: 'ok' \| 'warn' \| 'crit' \| 'dim' }` rows (or a function returning them); `module.update(rows)`; the badge shows the worst tone |

Every factory takes `{ id, title, icon, order, level, open }`, so one page can have two link modules.

## Saved state

With `persistKey`, the panel keeps the following in `localStorage` under `vrg.sidepanel.<key>`: collapsed, mode,
width, closed sections, and control / note values. It is read back through a cleaner, and anything odd is dropped.
Every storage call is wrapped in try/catch. Under `file://` (null origin) nothing is saved and nothing fails; serve the
page to keep state.

## Tests

`node --test shared/sidepanel/test/sidepanel.test.js` runs the pure helpers (module checks, ordering, mode filtering,
control values, saved state, keys) and then the demo in Chromium when Playwright is installed. The Chromium test checks
for console errors, collapse to the rail, the hotkey, the mode switch, links and their error event, computed colours
against the tokens, state across a reload, and drag-resize. Set `SP_SHOT=<file.png>` to keep a screenshot.
`demo.html` shows all four built-ins and a custom module.

## Where it would help

| Host | What the panel would carry |
|---|---|
| `Dashboard/page/panes/sessions.js` (Munkamenetek) | **Gyors elérés**: Munkavászon, Ügynöknyom, DevLog, Rétegverem, Divergencia, Thread Board; a status module for the servers |
| `SessionCanvas/vrg-munkavaszon.html` | its side panel (Most / Párhuzamos munka / Feladatok / Eszközök / Napló) as modules, with simple = Most + Feladatok |
| `Map/vrg-terkep.html` | the layer switches as a toggles module and the job list as links, collapsible over the map |
| `Archive/vrg-archive.html` | the filters (scope, group, search) as controls, and the recent pages as links |
| `Stack/control.html` (and the other Rétegverem pages) | one shared navigation module across the Stack pages, plus a status module for the stack server |
| `Calculator/*.html` | the inputs that are rarely changed in a detailed-level module, the result as a status module |

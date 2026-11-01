/* Small general widgets. Each export is a self-contained page: { manifest, strings, mount }. */
import { t, getLocale } from '../core/i18n.js';
import { formatDate, formatNumber, parseNumber } from '../core/format.js';
import { evaluate } from '../core/expr.js';
import { convert, UNITS } from '../core/units.js';
import { h, segmented } from '../ui/dom.js';
import { addButton, deleteWithUndo, guide, liveRender, pageWrap, panel } from './shared.js';
import { radar as drawRadar, ticks, el, ring } from '../ring.js';

const pad = (n) => String(n).padStart(2, '0');
const hms = (s) => `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;

export const clock = {
  manifest: { id: 'clock', category: 'widgets', permissions: [], offline: true, name: { hu: 'Óra és világidő', en: 'Clock and world time' } },
  strings: { hu: { 'clock.world': 'Világidő' }, en: { 'clock.world': 'World time' } },
  mount(root) {
    const zones = ['Europe/London', 'America/New_York', 'Asia/Dubai', 'Asia/Tokyo'];
    const big = h('div.bignum');
    const date = h('p.hint');
    const rows = zones.map((z) => ({ z, node: h('b') }));
    const tick = () => {
      const now = new Date();
      big.textContent = new Intl.DateTimeFormat(getLocale(), { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(now);
      date.textContent = formatDate(now);
      for (const r of rows) r.node.textContent = new Intl.DateTimeFormat(getLocale(), { timeZone: r.z, hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
    };
    root.append(pageWrap(panel(null, big, date), panel(t('clock.world'),
      rows.map((r) => h('div.result', {}, h('span.k', { text: r.z.split('/')[1].replace('_', ' ') }), r.node)))));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  },
};

export const timer = {
  manifest: { id: 'timer', category: 'widgets', permissions: [], offline: true, name: { hu: 'Időzítő, stopper, pomodoro', en: 'Timer, stopwatch, pomodoro' } },
  strings: {
    hu: { 'timer.stopwatch': 'Stopper', 'timer.timer': 'Időzítő', 'timer.pomodoro': 'Pomodoro', 'timer.start': 'Indítás', 'timer.pause': 'Szünet', 'timer.reset': 'Nullázás', 'timer.minutes': 'Perc', 'timer.done': 'Letelt az idő' },
    en: { 'timer.stopwatch': 'Stopwatch', 'timer.timer': 'Timer', 'timer.pomodoro': 'Pomodoro', 'timer.start': 'Start', 'timer.pause': 'Pause', 'timer.reset': 'Reset', 'timer.minutes': 'Minutes', 'timer.done': 'Time is up' },
  },
  mount(root) {
    let mode = 'stopwatch';
    let minutes = 25;
    let elapsed = 0;
    let startedAt = null;
    let id = null;
    const total = () => (mode === 'pomodoro' ? 25 * 60 : minutes * 60);
    const seconds = () => Math.floor((elapsed + (startedAt ? Date.now() - startedAt : 0)) / 1000);
    const big = h('div.bignum', { role: 'timer' });
    const note = h('p.hint', { role: 'status' });
    const toggle = h('button.btn.primary', { type: 'button' });
    const paint = () => {
      const s = seconds();
      const left = Math.max(0, total() - s);
      big.textContent = hms(mode === 'stopwatch' ? s : left);
      toggle.textContent = t(startedAt ? 'timer.pause' : 'timer.start');
      if (mode !== 'stopwatch' && left === 0 && startedAt) { stop(); note.textContent = t('timer.done'); navigator.vibrate?.(300); }
    };
    const stop = () => {
      if (startedAt) elapsed += Date.now() - startedAt;
      startedAt = null;
      clearInterval(id);
      paint();
    };
    const reset = () => { stop(); elapsed = 0; note.textContent = ''; paint(); };
    toggle.onclick = () => {
      if (startedAt) { stop(); return; }
      note.textContent = '';
      startedAt = Date.now();
      id = setInterval(paint, 250);
      paint();
    };
    const minutesField = h('label.field', {}, h('span.k', { text: t('timer.minutes') }),
      h('input.input', { type: 'text', inputMode: 'numeric', value: String(minutes), onchange: (e) => { minutes = parseNumber(e.target.value) ?? 25; reset(); } }));
    const pick = (m) => { mode = m; minutesField.hidden = m !== 'timer'; reset(); };
    root.append(pageWrap(
      segmented(['stopwatch', 'timer', 'pomodoro'].map((m) => ({ value: m, label: t('timer.' + m) })), mode, pick),
      panel(null, minutesField, big, note, toggle, addButton(t('timer.reset'), reset))));
    minutesField.hidden = true;
    paint();
    return () => clearInterval(id);
  },
};

export const notes = {
  manifest: { id: 'notes', category: 'widgets', permissions: [], offline: true, name: { hu: 'Jegyzetek', en: 'Scratchpad notes' } },
  strings: {
    hu: { 'notes.title': 'Jegyzet', 'notes.saved': 'Mentve ezen az eszközön', 'notes.hint': 'Ügyféladatot inkább a Munkalapra írj, onnan törölhető.' },
    en: { 'notes.title': 'Note', 'notes.saved': 'Saved on this device', 'notes.hint': 'Keep client details on the Field job page, where they can be erased.' },
  },
  mount(root, ctx) {
    const view = liveRender(root, ctx, async () => {
      const rec = (await ctx.db.get('note', 'scratch')) ?? { id: 'scratch', text: '' };
      const status = h('p.hint', { role: 'status' });
      let timer = null;
      return pageWrap(panel(t('notes.title'),
        h('textarea.input', {
          rows: 12, value: rec.text, 'aria-label': t('notes.title'),
          oninput: (e) => {
            clearTimeout(timer);
            timer = setTimeout(async () => { await ctx.db.put('note', { ...rec, text: e.target.value }); status.textContent = t('notes.saved'); }, 300);
          },
        }),
        status, h('p.hint', { text: t('notes.hint') })));
    });
    return view.stop;
  },
};

export const todo = {
  manifest: { id: 'todo', category: 'widgets', permissions: [], offline: true, name: { hu: 'Teendők', en: 'To-do list' } },
  strings: {
    hu: { 'todo.title': 'Teendők', 'todo.new': 'Új teendő', 'todo.none': 'Nincs teendő. Írj be egyet, és nyomd meg a Hozzáadást.' },
    en: { 'todo.title': 'To-do', 'todo.new': 'New to-do', 'todo.none': 'Nothing to do. Type one and press Add.' },
  },
  mount(root, ctx) {
    const view = liveRender(root, ctx, async () => {
      const items = await ctx.db.list('todo');
      const input = h('input.input', { type: 'text', 'aria-label': t('todo.new'), placeholder: t('todo.new') });
      return pageWrap(panel(t('todo.title'),
        items.length ? items.map((i) => h('div.lrow', {},
          h('label.tpl.grow', {},
            h('input', { type: 'checkbox', checked: !!i.done, onchange: async (e) => { await ctx.db.put('todo', { ...i, done: e.target.checked }); } }),
            h('span.tname.plain', { text: i.text })),
          h('button.btn', { type: 'button', text: t('common.delete'), onclick: () => deleteWithUndo(ctx, 'todo', i, i.text, view.refresh) }))) : guide(t('todo.none')),
        input,
        addButton(t('common.add'), async () => {
          const text = input.value.trim();
          if (!text) { input.focus(); return; }
          await ctx.db.put('todo', { text, done: false });
          await view.refresh();
        })));
    });
    return view.stop;
  },
};

export const scicalc = {
  manifest: { id: 'scicalc', category: 'widgets', permissions: [], offline: true, name: { hu: 'Tudományos számológép', en: 'Scientific calculator' } },
  strings: {
    hu: { 'sci.input': 'Kifejezés', 'sci.equals': 'Eredmény', 'sci.clear': 'Törlés', 'sci.back': 'Vissza', 'sci.error': 'Nem értelmezhető kifejezés', 'sci.deg': 'Szögek fokban' },
    en: { 'sci.input': 'Expression', 'sci.equals': 'Result', 'sci.clear': 'Clear', 'sci.back': 'Back', 'sci.error': 'Cannot read this expression', 'sci.deg': 'Angles in degrees' },
  },
  mount(root) {
    const input = h('input.input', { type: 'text', inputMode: 'decimal', 'aria-label': t('sci.input') });
    const result = h('div.bignum.small', { role: 'status' });
    const show = () => {
      if (!input.value.trim()) { result.textContent = ''; return; }
      try {
        const v = evaluate(input.value);
        result.textContent = Number.isFinite(v) ? formatNumber(Number(v.toPrecision(12))) : t('sci.error');
      } catch {
        result.textContent = t('sci.error');
      }
    };
    input.oninput = show;
    const put = (text) => { input.value += text; show(); };
    const keys = ['7', '8', '9', '÷', 'sin(', '4', '5', '6', '×', 'cos(', '1', '2', '3', '-', 'tan(', '0', ',', '^', '+', 'sqrt(', '(', ')', 'π', 'log(', 'ln('];
    root.append(pageWrap(panel(null, input, result,
      h('div.keys', {}, keys.map((k) => h('button.btn', { type: 'button', text: k.length > 1 ? k.replace('(', '') : k, 'aria-label': k, onclick: () => put(k) }))),
      h('div.btn-row', {},
        addButton(t('sci.back'), () => { input.value = input.value.slice(0, -1); show(); }),
        addButton(t('sci.clear'), () => { input.value = ''; show(); })),
      h('p.hint', { text: t('sci.deg') }))));
  },
};

export const units = {
  manifest: { id: 'units', category: 'widgets', permissions: [], offline: true, name: { hu: 'Mértékegység-átváltó', en: 'Unit converter' } },
  strings: {
    hu: { 'units.group': 'Mennyiség', 'units.value': 'Érték', 'units.from': 'Miből', 'units.to': 'Mibe', 'units.length': 'Hossz', 'units.area': 'Terület', 'units.power': 'Teljesítmény', 'units.energy': 'Energia', 'units.pressure': 'Nyomás', 'units.temperature': 'Hőmérséklet' },
    en: { 'units.group': 'Quantity', 'units.value': 'Value', 'units.from': 'From', 'units.to': 'To', 'units.length': 'Length', 'units.area': 'Area', 'units.power': 'Power', 'units.energy': 'Energy', 'units.pressure': 'Pressure', 'units.temperature': 'Temperature' },
  },
  mount(root) {
    let group = 'length';
    const body = h('div');
    const draw = () => {
      const names = Object.keys(UNITS[group]);
      const opts = (sel) => names.map((n) => h('option', { value: n, text: n, selected: n === sel }));
      const value = h('input.input', { type: 'text', inputMode: 'decimal', value: '1', oninput: () => show() });
      const from = h('select.input', { onchange: () => show() }, opts(names[0]));
      const to = h('select.input', { onchange: () => show() }, opts(names[1]));
      const out = h('div.bignum.small', { role: 'status' });
      const show = () => {
        const v = parseNumber(value.value);
        out.textContent = v == null ? '' : `${formatNumber(Number(convert(v, group, from.value, to.value).toPrecision(8)))} ${to.value}`;
      };
      body.replaceChildren(panel(t('units.' + group),
        h('label.field', {}, h('span.k', { text: t('units.value') }), value),
        h('label.field', {}, h('span.k', { text: t('units.from') }), from),
        h('label.field', {}, h('span.k', { text: t('units.to') }), to), out));
      show();
    };
    root.append(pageWrap(
      h('select.input', { 'aria-label': t('units.group'), onchange: (e) => { group = e.target.value; draw(); } },
        Object.keys(UNITS).map((g) => h('option', { value: g, text: t('units.' + g) }))),
      body));
    draw();
  },
};

export const dice = {
  manifest: { id: 'dice', category: 'thematic', permissions: [], offline: true, name: { hu: 'Kocka és kezdeményezés', en: 'Dice and initiative' } },
  strings: {
    hu: { 'dice.die': 'd{n}', 'dice.rollDie': 'Dobás: d{n}', 'dice.last': 'Utolsó dobás', 'dice.init': 'Kezdeményezés', 'dice.name': 'Szereplő neve', 'dice.add': 'Hozzáadás dobással', 'dice.clear': 'Lista törlése', 'dice.none': 'Még nincs szereplő a sorrendben.' },
    en: { 'dice.die': 'd{n}', 'dice.rollDie': 'Roll d{n}', 'dice.last': 'Last roll', 'dice.init': 'Initiative', 'dice.name': 'Character name', 'dice.add': 'Add with a roll', 'dice.clear': 'Clear list', 'dice.none': 'No one in the order yet.' },
  },
  mount(root) {
    let list = [];
    const big = h('div.bignum', { role: 'status', text: '–' });
    const order = h('div');
    const roll = (sides) => 1 + crypto.getRandomValues(new Uint32Array(1))[0] % sides;
    const paint = () => order.replaceChildren(...(list.length
      ? list.map((c) => h('div.result', {}, h('span', { text: c.name }), h('b', { text: formatNumber(c.value) })))
      : [guide(t('dice.none'))]));
    const name = h('input.input', { type: 'text', 'aria-label': t('dice.name'), placeholder: t('dice.name') });
    root.append(pageWrap(
      panel(t('dice.last'), big, h('div.keys', {}, [4, 6, 8, 10, 12, 20, 100].map((s) => h('button.btn', { type: 'button', text: t('dice.die', { n: s }), 'aria-label': t('dice.rollDie', { n: s }), onclick: () => { big.textContent = formatNumber(roll(s)); } })))),
      panel(t('dice.init'), order, name,
        addButton(t('dice.add'), () => {
          if (!name.value.trim()) { name.focus(); return; }
          list.push({ name: name.value.trim(), value: roll(20) });
          list.sort((a, b) => b.value - a.value);
          name.value = '';
          paint();
        }),
        addButton(t('dice.clear'), () => { list = []; paint(); }))));
    paint();
  },
};

const AXES = 12;
export const radar = {
  manifest: { id: 'radar', category: 'thematic', permissions: [], offline: true, name: { hu: 'Attribútumradar', en: 'Attribute radar' } },
  strings: {
    hu: { 'radar.title': 'Attribútumok', 'radar.total': 'Összpontszám: {n}', 'radar.1': 'Célzás', 'radar.2': 'Lopakodás', 'radar.3': 'Higgadtság', 'radar.4': 'Technika', 'radar.5': 'Meggyőzés', 'radar.6': 'Állóképesség', 'radar.7': 'Észlelés', 'radar.8': 'Vezetés', 'radar.9': 'Nyelvek', 'radar.10': 'Orvoslás', 'radar.11': 'Közelharc', 'radar.12': 'Intuíció' },
    en: { 'radar.title': 'Attributes', 'radar.total': 'Total points: {n}', 'radar.1': 'Marksman', 'radar.2': 'Stealth', 'radar.3': 'Composure', 'radar.4': 'Tech', 'radar.5': 'Charm', 'radar.6': 'Endurance', 'radar.7': 'Perception', 'radar.8': 'Driving', 'radar.9': 'Languages', 'radar.10': 'Medicine', 'radar.11': 'Close combat', 'radar.12': 'Intuition' },
  },
  mount(root, ctx) {
    const axes = Array.from({ length: AXES }, (_, i) => t('radar.' + (i + 1)));
    const saved = ctx.store.pageSetting('radar', 'values');
    const values = Array.isArray(saved) && saved.length === AXES ? saved.slice() : Array(AXES).fill(10);
    const svg = el('svg', { viewBox: '0 0 560 520', role: 'img', 'aria-label': t('radar.title') });
    const total = h('p.hint', { role: 'status' });
    const draw = () => {
      drawRadar(svg, { axes, values, max: 20 });
      total.textContent = t('radar.total', { n: formatNumber(values.reduce((a, b) => a + b, 0)) });
    };
    root.append(pageWrap(panel(t('radar.title'), svg, total,
      axes.map((a, i) => {
        const shown = h('b', { text: formatNumber(values[i]) });
        return h('label.field', {}, h('span.k', {}, a, ' ', shown),
          h('input.range', {
            type: 'range', min: 0, max: 20, value: values[i],
            oninput: (e) => { values[i] = Number(e.target.value); shown.textContent = formatNumber(values[i]); draw(); },
            onchange: () => ctx.store.setPageSetting('radar', 'values', values.slice()),
          }));
      }))));
    draw();
  },
};

export const statusring = {
  manifest: { id: 'statusring', category: 'thematic', permissions: [], offline: true, name: { hu: 'Állapotgyűrű', en: 'Ambient status ring' } },
  strings: {
    hu: { 'ring.label': 'Környezeti állapotgyűrű', 'ring.jobs': '{n} munka', 'ring.open': '{n} teendő', 'ring.hint': 'A gyűrű a helyi adatokat mutatja. Csökkentett mozgásnál áll.' },
    en: { 'ring.label': 'Ambient status ring', 'ring.jobs': '{n} jobs', 'ring.open': '{n} to-dos', 'ring.hint': 'The ring shows local data. It stays still with reduced motion.' },
  },
  mount(root, ctx) {
    const view = liveRender(root, ctx, async () => {
      const jobs = (await ctx.db.list('job')).length;
      const open = (await ctx.db.list('todo', (x) => !x.done)).length;
      const svg = el('svg', { viewBox: '0 0 300 300', role: 'img', 'aria-label': t('ring.label') });
      const spin = el('g', { class: 'r-spin' }, svg);
      ticks(spin, { cx: 150, cy: 150, r: 130, n: 180, every: 15 });
      ring(svg, { cx: 150, cy: 150, r: 122 });
      ring(svg, { cx: 150, cy: 150, r: 100, dash: '2 6' });
      ring(svg, { cx: 150, cy: 150, r: 66, stroke: 'var(--cyan)' });
      const text = (y, value, cls) => { el('text', { x: 150, y, 'text-anchor': 'middle', class: cls }, svg).textContent = value; };
      text(146, t('ring.jobs', { n: formatNumber(jobs) }), 'r-lbl');
      text(166, t('ring.open', { n: formatNumber(open) }), 'r-mono');
      return pageWrap(panel(null, svg, h('p.hint', { text: t('ring.hint') })));
    });
    return view.stop;
  },
};

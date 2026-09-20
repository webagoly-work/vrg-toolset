// The floor diagram view.
//
// Every colour here comes from buildDiagram(), which is a pure function of the
// geometry and the progress — so the drawing cannot say "done" while the list
// says otherwise. There is no diagram state to keep in sync.

import { el, clear } from '../../ui/dom.js';
import { svg } from '../../ui/components.js';
import { buildDiagram } from '../../core/diagram.js';

const R = 110;   // symbol radius in millimetres — readable at a room's scale

function shape(j) {
  const cls = 'sym sym-' + j.allapot + (j.kiemelt ? ' sym-hi' : '');
  const g = svg('g', { class: cls, transform: `translate(${j.x} ${j.y})` });
  const title = svg('title', {});
  title.textContent = `${j.cimke}${j.ref ? ' ' + j.ref : ''} — ${label(j.allapot)}`;
  g.appendChild(title);

  switch (j.alak) {
    case 'negyzet':
      g.appendChild(svg('rect', { x: -R, y: -R, width: R * 2, height: R * 2, rx: R * 0.25 }));
      break;
    case 'negyzet-ures':
      g.appendChild(svg('rect', { x: -R, y: -R, width: R * 2, height: R * 2, rx: R * 0.25, class: 'hollow' }));
      break;
    case 'rombusz':
      g.appendChild(svg('polygon', { points: `0,${-R * 1.25} ${R * 1.25},0 0,${R * 1.25} ${-R * 1.25},0` }));
      break;
    case 'csillag': {
      g.appendChild(svg('circle', { r: R * 0.8 }));
      for (let i = 0; i < 4; i++) {
        const a = (Math.PI / 4) + i * (Math.PI / 2);
        g.appendChild(svg('line', {
          x1: Math.cos(a) * R, y1: Math.sin(a) * R,
          x2: Math.cos(a) * R * 1.7, y2: Math.sin(a) * R * 1.7, class: 'ray'
        }));
      }
      break;
    }
    case 'kor-ures':
      g.appendChild(svg('circle', { r: R, class: 'hollow' }));
      break;
    default:
      g.appendChild(svg('circle', { r: R }));
  }
  return g;
}

const label = s => ({
  kesz: 'megvan', reszben: 'részben megvan', nincs: 'még nincs kiválasztva',
  ismeretlen: 'besorolatlan fajta', 'nincs-igeny': 'nincs hozzá igény'
}[s] || s);

function createDiagram(opts) {
  const { onPickCategory } = opts;
  let state = { szint: null, kiemeltKategoriak: [] };
  let model = null;

  const canvas = el('div', { class: 'diagram-canvas' });
  const legend = el('div', { class: 'diagram-legend' });
  const levels = el('div', { class: 'diagram-levels' });
  const note = el('p', { class: 'note' });

  function render(rajz, progress) {
    model = buildDiagram({
      rajz, progress, szint: state.szint, kiemeltKategoriak: state.kiemeltKategoriak
    });
    clear(canvas); clear(legend); clear(levels);

    if (model.ures) {
      note.textContent = model.ok;
      return;
    }

    // ------------------------------------------------------- level tabs
    if (model.szintek.length > 1) {
      for (const sz of model.szintek) {
        levels.appendChild(el('button', {
          type: 'button',
          class: 'treebtn' + (sz === model.szint ? ' on' : ''),
          text: sz,
          onclick: () => { state.szint = sz; render(rajz, progress); }
        }));
      }
    }

    // ----------------------------------------------------------- canvas
    const root = svg('svg', {
      viewBox: model.viewBox, class: 'floorplan',
      role: 'img', 'aria-label': 'Alaprajz a terv eszközeivel'
    });
    const rooms = svg('g', { class: 'rooms' });
    for (const r of model.helyisegek) rooms.appendChild(svg('polygon', { points: r.pontok }));
    root.appendChild(rooms);

    const ops = svg('g', { class: 'openings' });
    for (const n of model.nyilasok) {
      ops.appendChild(svg('circle', { cx: Math.round(n.x), cy: Math.round(n.y), r: 70, class: 'op-' + n.tipus }));
    }
    root.appendChild(ops);

    const syms = svg('g', { class: 'symbols' });
    for (const j of model.jelek) syms.appendChild(shape(j));
    root.appendChild(syms);
    canvas.appendChild(root);

    // ----------------------------------------------------------- legend
    for (const row of model.jelmagyarazat) {
      legend.appendChild(el('button', {
        type: 'button',
        class: 'legend-row' + (row.kiemelt ? ' on' : ''),
        title: row.kategoriak.length ? 'Szűrés erre: ' + row.kategoriak.join(', ') : 'Ehhez nincs kategória',
        onclick: () => { if (row.kategoriak.length && onPickCategory) onPickCategory(row.kategoriak); }
      }, [
        el('span', { class: 'dot sym-' + row.allapot }),
        el('span', { class: 'lbl', text: row.cimke }),
        el('span', { class: 'cnt', text: `${row.van}/${row.kell}` }),
        el('span', { class: 'tick', text: row.allapot === 'kesz' ? '✓' : '' })
      ]));
    }

    const s = model.osszegzes;
    note.textContent = `${s.jel} jel a rajzon · ${s.kesz} megvan · ${s.reszben} részben · ${s.nincs} még nincs. ` +
      'A színek a listád állásából jönnek, nem külön nyilvántartásból — a rajz és a lista nem tud eltérni egymástól.';
  }

  /** Light up whatever the currently selected catalogue item could answer. */
  function highlight(kategoriak) {
    state.kiemeltKategoriak = kategoriak || [];
  }

  const root = el('div', { class: 'diagram' }, [levels, canvas, legend, note]);
  return { root, render, highlight, model: () => model };
}

export { createDiagram };

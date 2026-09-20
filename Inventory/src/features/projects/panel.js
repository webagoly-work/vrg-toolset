// Projects panel: import a Planner drawing, see what it needs, and watch the
// list fill up against it.
//
// The progress bars are the point. A plan says "36 sockets"; this says how
// many of those 36 you have actually chosen a product for.

import { el, clear, option } from '../../ui/dom.js';
import * as fmt from '../../core/format.js';
import * as pi from '../../core/plannerimport.js';
import { createDiagram } from './diagram.js';

function createProjectPanel(opts) {
  const { store, lists, projects, onChanged, onPickCategory } = opts;
  const diagram = createDiagram({ onPickCategory });

  const message = el('p', { class: 'note' });
  const body = el('div');
  const fileInput = el('input', {
    type: 'file', accept: '.json,.vplan,application/json', hidden: true,
    onchange: e => { const f = e.target.files[0]; if (f) importPlan(f); e.target.value = ''; }
  });

  function say(text, kind) {
    message.textContent = text || '';
    message.className = 'note' + (kind ? ' ' + kind : '');
  }

  const picker = el('select', {
    id: 'pr-active',
    onchange: e => { projects.focus(e.target.value); onChanged(); render(); }
  });

  // ------------------------------------------------------------- import
  function importPlan(file) {
    const reader = new FileReader();
    reader.onerror = () => say('A fájlt nem sikerült beolvasni.', 'err-note');
    reader.onload = () => {
      let parsed;
      try { parsed = JSON.parse(String(reader.result)); }
      catch (e) { return say('A fájl nem érvényes JSON.', 'err-note'); }

      let plan;
      try { plan = pi.parsePlan(parsed); }
      catch (e) { return say('Importálás sikertelen: ' + e.message, 'err-note'); }

      const p = projects.create({
        nev: plan.projekt.megnevezes || plan.nev,
        cim: plan.projekt.cim,
        datum: (plan.mentve || '').slice(0, 10),
        terv: { forras: plan.forras, nev: plan.nev, mentve: plan.mentve, igenyek: plan.igenyek, rajz: plan.rajz }
      });
      projects.focus(p.id);
      onChanged();
      render();
      say([`Importálva: „${plan.nev}” — ${plan.osszegzes.eszkoz} eszköz, ` +
        `${plan.osszegzes.nyomvonal_fm} fm nyomvonal, ${plan.igenyek.length} igény.`]
        .concat(plan.warnings).join(' '),
        plan.warnings.length ? 'warn-note' : 'ok-note');
    };
    reader.readAsText(file);
  }

  // ----------------------------------------------------------- autofill
  function autofill() {
    const p = projects.active();
    if (!p || !p.terv) return;
    const l = projects.ensureList(p.id);
    const prog = pi.progress(p.terv, lists.rows(l.id));
    const plan = pi.autofillPlan(prog, store);

    if (!plan.javaslatok.length) {
      return say('Nincs mit kitölteni: ' +
        (plan.nincs.length ? plan.nincs.map(n => n.igeny.cimke + ' — ' + n.ok).join('; ')
          : 'minden igény teljesítve.'),
        plan.nincs.length ? 'warn-note' : 'ok-note');
    }

    const preview = plan.javaslatok
      .map(j => `${j.igeny.cimke}: ${j.mennyiseg} ${j.igeny.egyseg} → ${j.item.megnevezes} (${j.miert})`)
      .join('\n');
    if (!confirm(`Kitöltöm ezeket?\n\n${preview}\n\nA mennyiségek hozzáadódnak a listához.`)) {
      return say('Kitöltés megszakítva.');
    }
    for (const j of plan.javaslatok) lists.add(j.item.vrg_id, j.mennyiseg, l.id);
    onChanged();
    render();
    say(`Kitöltve: ${plan.javaslatok.length} igény.` +
      (plan.nincs.length ? ` ${plan.nincs.length} igényhez nincs megfelelő tétel a katalógusban.` : ''),
      plan.nincs.length ? 'warn-note' : 'ok-note');
  }

  // ---------------------------------------------------------- rendering
  function renderPicker() {
    clear(picker);
    const ps = projects.all();
    if (!ps.length) { picker.appendChild(option('', 'nincs projekt', true)); return; }
    for (const p of ps) picker.appendChild(option(p.id, p.nev, p.id === projects.activeId()));
  }

  function bar(done, total) {
    const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
    return el('div', { class: 'pbar' + (pct >= 100 ? ' full' : '') }, [
      el('span', { style: `width:${pct}%` })
    ]);
  }

  function render() {
    renderPicker();
    clear(body);
    const p = projects.active();
    if (!p) {
      body.appendChild(el('p', {
        class: 'note',
        text: 'Még nincs projekt. Importálj egy Planner mentést (.vplan.json) — a rajzból kiolvasom, ' +
          'miből mennyi kell, és innentől látod, mennyi van már kiválasztva.'
      }));
      return;
    }

    const l = p.listaId ? lists.get(p.listaId) : null;
    body.appendChild(el('dl', { class: 'kvs' }, [
      el('dt', { text: 'Cím' }), el('dd', { class: p.cim ? null : 'muted', text: p.cim || '—' }),
      el('dt', { text: 'Terv' }), el('dd', { text: p.terv ? `${p.terv.nev} (${(p.terv.mentve || '').slice(0, 10)})` : '—' }),
      el('dt', { text: 'Lista' }), el('dd', { text: l ? `${l.nev} — ${Object.keys(l.sorok).length} sor` : '—' })
    ]));

    if (!p.terv || !p.terv.igenyek.length) {
      body.appendChild(el('p', { class: 'note', text: 'Ehhez a projekthez nincs importált terv.' }));
      return;
    }

    const prog = pi.progress(p.terv, projects.rows(p.id));
    body.appendChild(el('div', { class: 'stats' }, [
      ['b', `${prog.kesz}/${prog.osszes}`, 'igény teljesítve'],
      ['b', prog.hianyzo_fajta, 'fajta hiányzik'],
      ['b', prog.ismeretlen, 'besorolatlan fajta']
    ].map(([, v, lab], i) => el('div', { class: 'stat' + (i === 1 && prog.hianyzo_fajta ? ' gap' : '') }, [
      el('b', { text: String(v) }), el('span', { text: lab })
    ]))));

    body.appendChild(el('table', { class: 'mini reqs' }, [
      el('thead', {}, [el('tr', {}, ['Mi kell', 'Kell', 'Van', 'Hiányzik', 'Haladás']
        .map((h, i) => el('th', { class: i >= 1 && i <= 3 ? 'num' : null, text: h })))]),
      el('tbody', {}, prog.sorok.map(r => el('tr', { class: r.ismeretlen ? 'unknown-req' : (r.kesz ? 'done-req' : null) }, [
        el('td', {}, [
          el('span', { text: r.cimke }),
          r.ismeretlen ? el('span', { class: 'pack-warn', title: 'A Planner ezt a fajtát nem tudom kategóriához kötni.', text: ' ⚠' }) : null,
          r.tetelek.length ? el('div', { class: 'req-items', text: r.tetelek.map(t => `${t.mennyiseg}× ${t.megnevezes}`).join(' · ') }) : null
        ].filter(Boolean)),
        el('td', { class: 'num', text: fmt.num(r.mennyiseg) + ' ' + r.egyseg }),
        el('td', { class: 'num', text: fmt.num(r.van) }),
        el('td', { class: 'num' + (r.hianyzik ? ' up' : ' down'), text: r.hianyzik ? fmt.num(r.hianyzik) : '✓' }),
        el('td', {}, [bar(r.van, r.mennyiseg)])
      ])))
    ]));

    // the diagram is rendered from the same progress object the table used
    if (p.terv.rajz) {
      body.appendChild(el('h3', { class: 'log-head', text: 'Alaprajz' }));
      body.appendChild(diagram.root);
      diagram.render(p.terv.rajz, prog);
    }

    if (prog.ismeretlen) {
      body.appendChild(el('p', {
        class: 'note warn-note',
        text: 'A ⚠ jelölt fajtákat a Planner tervéből nem tudom kategóriához kötni, ezért nem is tudom ' +
          'automatikusan kitölteni — de itt maradnak, hogy ne vesszenek el.'
      }));
    }
  }

  const root = el('div', { class: 'panel projects-panel', hidden: true }, [
    el('div', { class: 'controls' }, [
      el('label', { for: 'pr-active' }, ['Projekt', picker]),
      el('button', { type: 'button', onclick: () => fileInput.click(), text: '⭱ Planner terv importálása' }),
      el('button', {
        type: 'button', onclick: autofill, text: '✦ Hiányzók kitöltése kedvencekből'
      }),
      el('div', { class: 'spacer' }),
      el('button', {
        type: 'button', class: 'ghost', text: 'Lista megnyitása',
        onclick: () => { const p = projects.active(); if (p) { projects.focus(p.id); onChanged(); render(); } }
      }),
      el('button', {
        type: 'button', class: 'ghost danger', text: 'Projekt törlése',
        onclick: () => {
          const p = projects.active(); if (!p) return;
          if (!confirm(`„${p.nev}” projekt törlése? A listája megmarad.`)) return;
          projects.remove(p.id, false); onChanged(); render();
        }
      })
    ]),
    message,
    body,
    fileInput
  ]);

  render();
  return {
    root, render,
    highlight: cats => { diagram.highlight(cats); if (!root.hidden) render(); },
    diagram,
    toggle: () => { root.hidden = !root.hidden; if (!root.hidden) render(); return !root.hidden; }
  };
}

export { createProjectPanel };

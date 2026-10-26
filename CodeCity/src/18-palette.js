// 18-palette.js — Ctrl+K: one palette over files, actions, START.cmd tools, prompts, agents and branches
// (live workspace P2, KV-06). Plain text finds files (accent-insensitive, the Kapu kpNorm way), START.cmd
// tools and shortcut prompts; prefixes switch the list: > commands (the RCO actions on the open file,
// the selection's group actions, the looks), @ agents, # branches. Tools, prompts, agents and branches
// come from the segéd (GET /api/catalog); from file:// the palette has files and commands only.

const pal = { el: null, rows: [], k: 0, cat: null, catFor: null };
const PAL_EMPTY = { tools: [], prompts: [], agents: [], branches: [] };
const palNorm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

async function palCatalog() {
  await kvReady();
  if (pal.catFor === current.city) return pal.cat;
  pal.catFor = current.city; pal.cat = PAL_EMPTY;
  if (kv.match) try { const r = await fetch('/api/catalog'); if (r.ok) pal.cat = await r.json(); } catch (e) { /* stays empty */ }
  return pal.cat;
}

// file score: name prefix > name contains > every term in the path > the letters in order in the path
function palScore(f, q, terms) {
  const n = palNorm(f.name), p = palNorm(f.p);
  if (n.startsWith(q)) return 100 - n.length / 100;
  if (n.includes(q)) return 80 - n.length / 100;
  if (terms.every(t => p.includes(t))) return 50 - p.length / 1000;
  let j = 0;
  for (const ch of p) if (ch === q[j]) j++;
  return j === q.length ? 10 - p.length / 1000 : 0;
}
const palHit = (s, terms) => { const n = palNorm(s); return terms.every(t => n.includes(t)); };
// a Claude prompt for a prompt card or an agent: its text, then the paths it is about
const palAsk = head => selAskClaude(selPrompt(head));

function palRows(raw) {
  const c = current.city, cat = pal.cat || PAL_EMPTY, pre = /^[>@#]/.test(raw) ? raw[0] : '';
  const q = palNorm(raw.slice(pre ? 1 : 0).trim()), terms = q.split(/\s+/).filter(Boolean);
  const keep = (label, extra = '') => !terms.length || palHit(label + ' ' + extra, terms);
  const rows = [];
  if (pre === '>') {
    const target = sel.set.size ? null : shownFile ? kvCtx({ file: shownFile }) : null;
    if (sel.set.size) {
      rows.push({ kind: 'parancs', label: `Kérdezd Claude-ot ezekről (${hu(sel.set.size)} kijelölve)`, run: SEL_ACT.ask },
        { kind: 'parancs', label: 'Kijelölt útvonalak másolása', run: SEL_ACT.copy },
        { kind: 'parancs', label: 'Kijelölés törlése', run: SEL_ACT.clear });
    } else if (target) {
      for (const a of KV_ACT) { const s = kvActState(a, target);
        rows.push({ kind: shownFile.name, label: a.label, off: !s.on, why: s.why, run: () => a.run(target) }); }
    } else rows.push({ kind: 'tipp', label: 'Válassz ki egy épületet (kattintás) vagy többet (Ctrl+kattintás, Shift+húzás)', off: true, why: '' });
    for (const l of LENSES) rows.push({ kind: 'nézet', label: `Nézet: ${l.name} (${l.key})`, run: () => setLens(l.id) });
    rows.push({ kind: 'nézet', label: 'Utak be / ki (U)', run: toggleRoads }, { kind: 'idő', label: 'A mai állapot (End)', run: tlLatest });
    return rows.filter(r => keep(r.label, r.kind));
  }
  if (pre === '@') {
    if (!kv.match) return [{ kind: 'ügynök', label: 'Az ügynökök listája a segéddel jön', off: true, why: KV_WHY.companion }];
    return cat.agents.filter(a => keep(a.name, a.description)).map(a => ({ kind: 'ügynök', label: '@' + a.name, hint: a.description,
      run: () => palAsk(`Használd a(z) ${a.name} ügynököt (.claude/agents/${a.name}.md) ehhez:`) }));
  }
  if (pre === '#') {
    if (!kv.match) return [{ kind: 'ág', label: 'Az ágak listája a segéddel jön', off: true, why: KV_WHY.companion }];
    return cat.branches.filter(b => keep(b)).map(b => ({ kind: 'ág', label: '#' + b, hint: 'a metróvonalak a P7-ben jönnek — most: név másolása',
      run: () => kvCopy(b) }));
  }
  if (terms.length) {
    const scored = [];
    c.files.forEach((f, i) => { if (f.gone) return; const s = palScore(f, q, terms); if (s > 0) scored.push([s, f]); });
    scored.sort((a, b) => b[0] - a[0]);
    for (const [, f] of scored.slice(0, 30)) rows.push({ kind: 'fájl', label: f.name, hint: f.p, run: () => { showFile(f); flyTo(f); } });
  }
  for (const t of cat.tools) if (keep(t.name, t.path)) rows.push({ kind: 'START.cmd ' + (t.n === 10 ? 0 : t.n === 11 ? 'K' : t.n), label: t.name, hint: t.path,
    run: () => kvCall('open-tool', { path: t.path }).then(r => kvDone(r, 'Megnyitva, ahogy a START.cmd nyitja')) });
  for (const p of cat.prompts) if (keep(p.name, p.text.slice(0, 200))) rows.push({ kind: 'prompt', label: p.name, hint: p.text.split('\n')[0].slice(0, 90),
    run: () => palAsk(p.text.trim()) });
  if (!terms.length && !rows.length) rows.push({ kind: 'tipp', label: 'Írj egy fájlnevet — vagy > parancsok · @ ügynökök · # ágak', off: true, why: '' });
  return rows;
}

function palRender() {
  const ul = pal.el.querySelector('ul');
  pal.k = Math.max(0, Math.min(pal.k, pal.rows.length - 1));
  ul.innerHTML = pal.rows.map((r, k) => `<li data-k="${k}" class="${k === pal.k ? 'on' : ''}${r.off ? ' off' : ''}" role="option">` +
    `<span class="dim">${esc(r.kind)}</span> ${esc(r.label)}${r.hint ? ` <span class="dim">${esc(r.hint)}</span>` : ''}` +
    (r.off && r.why ? `<small>${esc(r.why)}</small>` : '') + '</li>').join('') || '<li class="off">Nincs találat</li>';
  const on = ul.querySelector('li.on');
  if (on) on.scrollIntoView({ block: 'nearest' });
}
async function palUpdate() { await palCatalog(); pal.rows = palRows(pal.el.querySelector('input').value); palRender(); }
function palRun(k) {
  const r = pal.rows[k];
  if (!r || r.off) return;
  palClose(); r.run();
}
function palOpen(text = '') {
  if (!current) return;
  kvMenuClose();
  if (!pal.el) {
    pal.el = document.createElement('div'); pal.el.id = 'pal';
    pal.el.innerHTML = '<input type="search" autocomplete="off" spellcheck="false" aria-label="Parancspaletta" placeholder="Fájl, eszköz, prompt — > parancsok · @ ügynökök · # ágak"><ul role="listbox"></ul>';
    const inp = pal.el.querySelector('input');
    inp.addEventListener('input', () => { pal.k = 0; palUpdate(); });
    inp.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); pal.k += e.key === 'ArrowDown' ? 1 : -1; palRender(); }
      else if (e.key === 'Enter') { e.preventDefault(); palRun(pal.k); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); palClose(); }
    });
    pal.el.querySelector('ul').addEventListener('click', e => { const li = e.target.closest('li[data-k]'); if (li) palRun(+li.dataset.k); });
    document.body.append(pal.el);
  }
  pal.el.hidden = false; pal.k = 0;
  const inp = pal.el.querySelector('input');
  inp.value = text; inp.focus();
  return palUpdate();
}
function palClose() { if (pal.el) pal.el.hidden = true; }
addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); pal.el && !pal.el.hidden ? palClose() : palOpen(); }
});
addEventListener('pointerdown', e => { if (pal.el && !pal.el.hidden && !pal.el.contains(e.target)) palClose(); }, true);

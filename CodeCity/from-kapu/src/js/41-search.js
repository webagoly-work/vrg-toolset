// Search: accent-insensitive over departments, programs and their layer nodes.

// lower case, accents off: "Árvíztűrő" -> "arvizturo"
function kpNorm(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

const KP_KIND_RANK = { program: 0, dept: 1, agent: 2, go: 2, folder: 3, local: 3, git: 4 };

// Every searchable thing, with the board node id it lands on.
function kpSearchItems(topo, view) {
  const items = [];
  const progs = (topo.programs || []).filter(p => view === 'vision' || p.status !== 'v2');
  let order = 0;
  for (const d of topo.departments || []) {
    items.push({ id: 'dept:' + d.id, kind: 'dept', dept: d.id, t: d.t, body: [d.tEn, d.d, d.dEn], long: '', order: order++ });
  }
  for (const p of progs) {
    items.push({ id: p.id + ':L1', kind: 'program', dept: p.dept, progId: p.id, t: p.t, body: [p.d, p.dEn], long: [p.long, p.longEn].join(' '), order: order++ });
    (p.folders || []).forEach((f, i) => items.push({ id: p.id + ':L2:f' + i, kind: f.local && !f.url && !f.ref ? 'local' : 'folder', dept: p.dept, progId: p.id,
      layer: 'L2', cell: p.id + ':L2', idx: i, t: f.t || f.path || f.ref, body: [f.d, f.dEn], long: '', order: order++ }));
    (p.agent || []).forEach((a, i) => items.push({ id: p.id + ':L3:a' + i, kind: a.go ? 'go' : 'agent', dept: p.dept, progId: p.id,
      layer: 'L3', cell: p.id + ':L3', idx: i, t: a.t, body: [a.d, a.dEn, a.go], long: '', order: order++ }));
    if (p.git) items.push({ id: p.id + ':L4:g', kind: 'git', dept: p.dept, progId: p.id, layer: 'L4', t: (p.git.paths || []).join(' '), body: [], long: '', order: order++ });
  }
  return items;
}

// Title hits first, then description, then long text; programs before departments before docs.
function kpSearch(topo, q, view) {
  const nq = kpNorm(q).trim();
  if (!nq) return [];
  const terms = nq.split(/\s+/);
  const hit = s => { const n = kpNorm(s); return terms.every(t => n.includes(t)); };
  const out = [];
  for (const it of kpSearchItems(topo, view)) {
    const tier = hit(it.t) ? 3 : hit(it.body.filter(Boolean).join(' ')) ? 2 : hit(it.long) ? 1 : 0;
    if (tier) out.push(Object.assign({ tier }, it));
  }
  return out.sort((a, b) => b.tier - a.tier || KP_KIND_RANK[a.kind] - KP_KIND_RANK[b.kind] || a.order - b.order);
}

// ---- UI: Ctrl+K panel
const KP_KIND_HU = { dept: 'részleg', program: 'program', folder: 'mappa', local: 'helyi mappa', agent: 'AI dokumentum', go: 'GO brief', git: 'git' };

function kpSearchOpen() {
  const root = document.getElementById('kpModal');
  const input = kpEl('input', { class: 'kp-search-in', type: 'search', placeholder: 'Keresés… (ékezet nélkül is)', 'aria-label': 'Keresés' });
  const list = kpEl('div', { class: 'kp-search-list', role: 'listbox' });
  const box = kpEl('div', { class: 'kp-search' }, input, list);
  const back = kpEl('div', { class: 'kp-backdrop', onclick: e => { if (e.target === back) close(); } }, box);
  let res = [], sel = 0;
  function close() { root.replaceChildren(); }
  function draw() {
    list.replaceChildren(...res.slice(0, 30).map((r, i) => kpEl('div', {
      class: 'kp-search-r' + (i === sel ? ' sel' : ''), role: 'option',
      onclick: () => { close(); kpFlyTo(r); }
    }, kpEl('span', { class: 'kp-search-t' }, r.t), kpEl('span', { class: 'kp-search-k' }, KP_KIND_HU[r.kind] || r.kind))));
    if (input.value.trim() && !res.length) list.append(kpEl('div', { class: 'kp-search-none' }, 'Nincs találat ebben a nézetben.'));
  }
  input.addEventListener('input', () => { res = kpSearch(kpResolveRefs(kpData.topology), input.value, kpBoard.view); sel = 0; draw(); });
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { sel = Math.min(sel + 1, Math.max(0, Math.min(res.length, 30) - 1)); draw(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { sel = Math.max(sel - 1, 0); draw(); e.preventDefault(); }
    else if (e.key === 'Enter' && res[sel]) { close(); kpFlyTo(res[sel]); }
    else if (e.key === 'Escape') close();
    e.stopPropagation();
  });
  root.replaceChildren(back);
  input.focus();
}

// make the target drawable (focus, collapse, layer, stack), then centre on it and pulse
function kpFlyTo(r) {
  if (kpBoard.focus && kpBoard.focus !== r.dept) kpBoard.focus = null;
  kpBoard.collapsed = kpBoard.collapsed.filter(d => d !== r.dept);
  if (r.layer && kpBoard.layers[r.layer] === false) kpBoard.layers[r.layer] = true;
  if (r.cell && r.idx >= KP_LAYOUT.stackMax && !kpBoard.expanded.includes(r.cell)) kpBoard.expanded.push(r.cell);
  kpBoardRender();
  const n = kpBoard.layout.nodes.find(x => x.id === r.id);
  if (!n) return;
  kpCenterOn(n.x + n.w / 2, n.y + n.h / 2, Math.max(kpBoard.cam.k, 1));
  kpSetFocusNode(n.id);
  const g = document.querySelector('#kpCam [data-id="' + CSS.escape(n.id) + '"]');
  if (g) { g.classList.remove('kp-pulse'); void g.getBBox(); g.classList.add('kp-pulse'); }
}

if (typeof module !== 'undefined') module.exports = { kpNorm, kpSearch, kpSearchItems };

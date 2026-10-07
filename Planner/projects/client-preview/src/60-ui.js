// 60-ui.js — the HTML layer over the canvas: level tags, the room card, legend, switches.

function applyI18n() {
  document.documentElement.lang = LANG;
  document.querySelectorAll('[data-i18n]').forEach(n => { n.textContent = t(n.dataset.i18n); });
  $('cpvLang').textContent = LANG === 'en' ? 'HU' : 'EN';
  $('cpvLang').setAttribute('aria-label', LANG === 'en' ? 'Magyar nyelv' : 'English');
  $('cpvTheme').textContent = document.documentElement.dataset.theme === 'light' ? t('dark') : t('light');
}

// ---- tags: HTML labels pinned to scene points ----
function buildTags() {
  const box = $('tags'); box.textContent = '';
  S.tags.forEach(tg => { tg.el = el('div', 'cpv-tag' + (tg.kind === 'ghost' ? ' cpv-tag--ghost' : '')); box.appendChild(tg.el); });
  refreshTagText();
}
function refreshTagText() { S.tags.forEach(tg => { tg.el.textContent = tg.text(); }); }
function placeTags(cam) {
  const w = window.innerWidth, h = window.innerHeight, v = new THREE.Vector3();
  S.tags.forEach(tg => {
    v.copy(tg.pos).project(cam);
    const vis = v.z < 1 && Math.abs(v.x) < 1.2 && Math.abs(v.y) < 1.2;
    tg.el.style.display = vis ? '' : 'none';
    if (vis) tg.el.style.transform = `translate(${((v.x + 1) / 2 * w + 14).toFixed(1)}px, ${((1 - v.y) / 2 * h - 7).toFixed(1)}px)`;
  });
}

// ---- the room card (design system RoomBrief, vanilla markup) ----
function roomCounts(M, r) {
  const c = { endpoint: 0, light: 0, socket: 0, switch: 0, box: 0 };
  r.devices.forEach(id => { const d = M.devById[id]; if (!d) return;
    if (d.kind === 'endpoint') c.endpoint++; if (c[d.type] != null) c[d.type]++; if (d.kind === 'junction') c.box++; });
  return c;
}
function showRoomCard(M, r) {
  const card = $('cpvRoom');
  if (!r) { card.hidden = true; return; }
  const L = M.lv[r.level], c = roomCounts(M, r);
  $('cpvRoomLevel').textContent = (LANG === 'en' ? L.nameEn : L.name) + ' · ' + t('room');
  $('cpvRoomIdx').textContent = pad2(r.idx) + ' / ' + pad2(r.count);
  $('cpvRoomName').textContent = roomTitle(r);
  const sub = roomSubtitle(r); $('cpvRoomSub').textContent = sub; $('cpvRoomSub').hidden = !sub;
  $('cpvRoomSub').lang = LANG === 'en' ? 'hu' : 'en';
  const rows = [[t('area'), fmtNum(r.area, 1) + ' m²'], [t('endpoints'), c.endpoint]];
  if (c.light) rows.push([t('lights'), c.light]); if (c.socket) rows.push([t('sockets'), c.socket]);
  if (c.switch) rows.push([t('switches'), c.switch]); if (c.box) rows.push([t('boxes'), c.box]);
  const dl = $('cpvRoomStats'); dl.textContent = '';
  rows.forEach(([k, v]) => { dl.appendChild(el('dt', null, k)); dl.appendChild(el('dd', null, String(v))); });
  // circuit kinds present, by device type until circuits arrive from the stack (phase 3)
  const kinds = []; if (c.light || c.switch) kinds.push('lighting'); if (c.socket) kinds.push('socket');
  const chips = $('cpvRoomChips'); chips.textContent = '';
  const KN = { lighting: ['Világítás', 'Lighting'], socket: ['Dugalj', 'Sockets'] };
  kinds.forEach(k => { const s = el('span', 'vrg-chip vrg-k-' + k); s.appendChild(el('span', 'vrg-swatch')); s.appendChild(document.createTextNode(KN[k][LANG === 'en' ? 1 : 0])); chips.appendChild(s); });
  chips.hidden = !kinds.length;
  card.hidden = false;
}

// ---- legend: what the dots and the faint level mean ----
function buildLegend(M) {
  const ul = $('cpvLegend'); ul.textContent = '';
  const has = k => M.devices.some(d => d.kind === k && !M.lv[d.level].ghost);
  const rows = [['endpoint', 'legEndpoint']];
  if (has('junction')) rows.push(['junction', 'legJunction']);
  if (has('rbx')) rows.push(['rbx', 'legRbx']);
  if (has('board')) rows.push(['board', 'legBoard']);
  if (M.levels.some(L => L.ghost)) rows.push(['ghost', 'legGhost']);
  rows.forEach(([g, k]) => { const li = el('li'); li.appendChild(el('span', 'vrg-glyph vrg-glyph--' + g)); li.appendChild(el('span', null, t(k))); ul.appendChild(li); });
}

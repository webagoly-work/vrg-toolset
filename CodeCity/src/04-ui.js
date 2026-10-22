// 04-ui.js — title, legend, hover tip, info panel, share link, opening a city.json; boot.

const $ = id => document.getElementById(id);
let current = null;
const hu = n => n.toLocaleString('hu-HU');
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const dayOf = ci => {
  const c = current.city.commits[ci];
  return c ? `${new Date(c[0] * 1000).toLocaleDateString('hu-HU')} <span class="dim">${c[4]}</span>` : '—';
};

function onHover(e) {
  const tip = $('tip'), hit = pickAt(e);
  setHover(hit && hit.file ? hit.i : -1);
  if (!hit) { tip.hidden = true; return; }
  const r = canvas.getBoundingClientRect();
  tip.textContent = hit.file ? hit.file.p : (hit.dir.path || current.city.repo.name) + '/';
  tip.style.left = (e.clientX - r.left) + 'px';
  tip.style.top = (e.clientY - r.top) + 'px';
  tip.hidden = false;
}

function onPick(e) {
  const hit = pickAt(e);
  if (!hit) closePanel();
  else if (hit.file) showFile(hit.file);
  else showDir(hit.dir);
}

function openPanel(title, rows, extra = '') {
  const panel = $('panel');
  panel.innerHTML = `<span class="x" title="Bezárás">×</span><h3>${esc(title)}</h3><table>${rows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}</table>${extra}`;
  panel.querySelector('.x').onclick = closePanel;
  panel.hidden = false;
}
let shownFile = null;   // the file whose panel is open, refreshed when the replay moves
function closePanel() {
  $('panel').hidden = true; shownFile = null; roadsRefresh();
  share.sel = ''; setBeacon(null); writeHashSoon();
}
function showFile(f) {
  const c = current.city;
  openPanel(f.p, [['Nyelv', f.lang], ['Sorok', hu(f.loc)], ['Commitok', hu(f.n)],
    ['Első commit', dayOf(f.born)], ['Utolsó módosítás', dayOf(f.last)],
    ['Fő szerző', f.own >= 0 ? esc(c.authors[f.own]) : '—'],
    ['Ügynök-arány', f.n ? Math.round(100 * f.ag / f.n) + ' %' : '—'],
    ...(fileAtT(f) ? [['Ezen a ponton', `${hu(fileAtT(f)[0])} commit · ~${hu(fileAtT(f)[1])} sor`]] : [])], roadsPanelHtml(f));
  shownFile = f; roadsRefresh(); share.sel = f.p; setBeacon(f); writeHashSoon();
}
function showDir(d) {
  const s = dirStats(d);
  shownFile = null; roadsRefresh();
  openPanel((d.path || current.city.repo.name) + '/', [['Fájlok', hu(s.files)], ['Sorok', hu(s.loc)], ['Almappák', hu(d.dirs.size)]]);
  share.sel = ''; setBeacon(null); writeHashSoon();
}

// ---- share link: camera + selection live in the #hash (God's Eye View's sharelink idea), so a
// link from Kapu, the Dashboard or a chat opens the city exactly there. Only for embedded cities:
// a city opened from a file has no stable address to come back to.
const share = { sel: '' };
let hashTimer = 0, hashRead = false;       // never write before the incoming link has been read
// the whole view as URL parameters: the share link, and (12-tour) one shot of a tour
function viewState() {
  const t = orbit.target, q = new URLSearchParams();
  q.set('cam', [t.x, t.z, orbit.theta, orbit.phi, orbit.r].map(v => +v.toFixed(2)).join(','));
  if (share.sel) q.set('sel', share.sel);
  if (lens.id !== 'alap') q.set('lens', lens.id);
  if (roads.all) q.set('roads', '1');
  if (query.text) q.set('q', query.text);
  if (replay.T < replay.last) q.set('t', current.city.commits[replay.T][4]);
  return q;
}
function writeHashSoon() {
  if (!window.CITY || !current || !hashRead) return;
  clearTimeout(hashTimer);
  hashTimer = setTimeout(() => {
    const q = viewState(), keep = new URLSearchParams(location.hash.slice(1));
    for (const k of ['tour', 'loop']) if (keep.get(k)) q.set(k, keep.get(k));   // a wallboard link stays one
    history.replaceState(null, '', '#' + q.toString());
  }, 250);
}
onCameraMoved = writeHashSoon;
// apply a view; a missing key means its default, so a view is complete on its own.
// ms > 0 flies the camera there instead of jumping
function applyView(q, ms = 0) {
  const cam = (q.get('cam') || '').split(',').map(Number);
  if (cam.length === 5 && cam.every(Number.isFinite)) flyCamera(cam, ms);
  setLens(q.get('lens') || 'alap');
  if ((q.get('roads') === '1') !== roads.all) toggleRoads();
  $('q').value = q.get('q') || ''; showQuery(q.get('q') || '');
  const ti = current.city.commits.findIndex(c => c[4] === q.get('t'));
  applyTime(ti >= 0 ? ti : replay.last, ms ? 300 : 0);
  const f = q.get('sel') && current.city.files.find(x => x.p === q.get('sel') && !x.gone);
  if (f) showFile(f); else if (shownFile) closePanel();
}
function flyCamera([x, z, theta, phi, r], ms) {
  if (!ms) { orbit.target.set(x, 0, z); Object.assign(orbit, { theta, phi, r }); placeCamera(); return; }
  const a = { x: orbit.target.x, z: orbit.target.z, theta: orbit.theta, phi: orbit.phi, r: orbit.r }, t0 = performance.now();
  // turn the short way round
  let dt = theta - a.theta; dt = ((dt + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
  const step = () => {   // performance.now(), not the rAF stamp: the two clocks can disagree
    const k = Math.min(1, Math.max(0, (performance.now() - t0) / ms)), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;   // ease in-out
    orbit.target.set(a.x + (x - a.x) * e, 0, a.z + (z - a.z) * e);
    orbit.theta = a.theta + dt * e; orbit.phi = a.phi + (phi - a.phi) * e; orbit.r = a.r + (r - a.r) * e;
    placeCamera();
    if (k < 1) flyCamera.raf = requestAnimationFrame(step);
  };
  cancelAnimationFrame(flyCamera.raf);
  flyCamera.raf = requestAnimationFrame(step);
}
function readHash() {
  const q = new URLSearchParams(location.hash.slice(1));
  applyView(q);
  hashRead = true;
  writeHashSoon();
  return q;
}
$('link').addEventListener('click', () => {
  const done = () => { $('link').textContent = 'Másolva ✓'; setTimeout(() => { $('link').textContent = 'Link'; }, 1500); };
  if (navigator.clipboard) navigator.clipboard.writeText(location.href).then(done, () => prompt('Link:', location.href));
  else prompt('Link:', location.href);
});

// ---- freshness: the city is a snapshot; say how old (God's Eye View's stale-feed honesty)
function freshness(city) {
  const days = Math.floor((Date.now() - Date.parse(city.repo.scannedAt)) / 86400000);
  const el = $('fresh');
  el.textContent = days < 1 ? 'friss felmérés' : `${days} napos felmérés`;
  el.className = 'badge' + (days > 7 ? ' old' : '');
  el.title = `Felmérve: ${new Date(city.repo.scannedAt).toLocaleString('hu-HU')} — újra: node CodeCity/scan.js`;
  el.hidden = false;
}

function load(city) {
  if (!city || city.kind !== 'vrg-codecity') { alert('Ez nem Kódváros-fájl (city.json).'); return; }
  current = cityModel(city);
  layoutCity(current);
  roadsPrepare(current);
  hudPrepare();
  showCity(current);
  freshness(city);
  tlSetup();
  lensApply();
  toursLoad();
  const live = city.files.filter(f => !f.gone).length;
  $('title').textContent = `${city.repo.name}${city.repo.head ? ' @ ' + city.repo.head : ''} · ${hu(live)} fájl · ${hu(city.commits.length)} commit · ${hu(city.authors.length)} szerző`;
  document.title = `${city.repo.name} — VRG Kódváros`;
  $('drop').hidden = true; $('panel').hidden = true;
  $('link').hidden = !window.CITY;
}

function readFile(file) {
  file.text().then(t => { window.CITY = null; load(JSON.parse(t)); }).catch(err => alert('Nem olvasható: ' + err.message));
}
$('file').addEventListener('change', e => e.target.files[0] && readFile(e.target.files[0]));
const stage = $('stage');
stage.addEventListener('dragover', e => { e.preventDefault(); $('drop').classList.add('over'); });
stage.addEventListener('dragleave', () => $('drop').classList.remove('over'));
stage.addEventListener('drop', e => {
  e.preventDefault(); $('drop').classList.remove('over');
  if (e.dataTransfer.files[0]) readFile(e.dataTransfer.files[0]);
});

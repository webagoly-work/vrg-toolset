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

function openPanel(title, rows) {
  const panel = $('panel');
  panel.innerHTML = `<span class="x" title="Bezárás">×</span><h3>${esc(title)}</h3><table>${rows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}</table>`;
  panel.querySelector('.x').onclick = closePanel;
  panel.hidden = false;
}
let shownFile = null;   // the file whose panel is open, refreshed when the replay moves
function closePanel() {
  $('panel').hidden = true; shownFile = null;
  share.sel = ''; setBeacon(null); writeHashSoon();
}
function showFile(f) {
  const c = current.city;
  openPanel(f.p, [['Nyelv', f.lang], ['Sorok', hu(f.loc)], ['Commitok', hu(f.n)],
    ['Első commit', dayOf(f.born)], ['Utolsó módosítás', dayOf(f.last)],
    ['Fő szerző', f.own >= 0 ? esc(c.authors[f.own]) : '—'],
    ['Ügynök-arány', f.n ? Math.round(100 * f.ag / f.n) + ' %' : '—'],
    ...(fileAtT(f) ? [['Ezen a ponton', `${hu(fileAtT(f)[0])} commit · ~${hu(fileAtT(f)[1])} sor`]] : [])]);
  shownFile = f; share.sel = f.p; setBeacon(f); writeHashSoon();
}
function showDir(d) {
  const s = dirStats(d);
  shownFile = null;
  openPanel((d.path || current.city.repo.name) + '/', [['Fájlok', hu(s.files)], ['Sorok', hu(s.loc)], ['Almappák', hu(d.dirs.size)]]);
  share.sel = ''; setBeacon(null); writeHashSoon();
}

// ---- share link: camera + selection live in the #hash (God's Eye View's sharelink idea), so a
// link from Kapu, the Dashboard or a chat opens the city exactly there. Only for embedded cities:
// a city opened from a file has no stable address to come back to.
const share = { sel: '' };
let hashTimer = 0, hashRead = false;       // never write before the incoming link has been read
function writeHashSoon() {
  if (!window.CITY || !current || !hashRead) return;
  clearTimeout(hashTimer);
  hashTimer = setTimeout(() => {
    const t = orbit.target, q = new URLSearchParams();
    q.set('cam', [t.x, t.z, orbit.theta, orbit.phi, orbit.r].map(v => +v.toFixed(2)).join(','));
    if (share.sel) q.set('sel', share.sel);
    if (lens.id !== 'nyelv') q.set('lens', lens.id);
    if (replay.T < replay.last) q.set('t', current.city.commits[replay.T][4]);
    history.replaceState(null, '', '#' + q.toString());
  }, 250);
}
onCameraMoved = writeHashSoon;
function readHash() {
  const q = new URLSearchParams(location.hash.slice(1));
  const cam = (q.get('cam') || '').split(',').map(Number);
  if (cam.length === 5 && cam.every(Number.isFinite)) {
    orbit.target.set(cam[0], 0, cam[1]);
    [orbit.theta, orbit.phi, orbit.r] = cam.slice(2);
    placeCamera();
  }
  if (q.get('lens')) setLens(q.get('lens'));
  const ti = current.city.commits.findIndex(c => c[4] === q.get('t'));
  if (ti >= 0) applyTime(ti, 0);
  const f = q.get('sel') && current.city.files.find(x => x.p === q.get('sel') && !x.gone);
  hashRead = true;
  if (f) showFile(f);
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
  showCity(current);
  freshness(city);
  tlSetup();
  lensApply();
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

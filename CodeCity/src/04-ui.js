// 04-ui.js — title, legend, hover tip, info panel, opening a city.json; boot.

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
  const hit = pickAt(e), panel = $('panel');
  if (!hit) { panel.hidden = true; return; }
  const c = current.city, rows = [];
  let title;
  if (hit.file) {
    const f = hit.file;
    title = f.p;
    rows.push(['Nyelv', f.lang], ['Sorok', hu(f.loc)], ['Commitok', hu(f.n)],
      ['Első commit', dayOf(f.born)], ['Utolsó módosítás', dayOf(f.last)],
      ['Fő szerző', f.own >= 0 ? esc(c.authors[f.own]) : '—'],
      ['Ügynök-arány', f.n ? Math.round(100 * f.ag / f.n) + ' %' : '—']);
  } else {
    const d = hit.dir, s = dirStats(d);
    title = (d.path || c.repo.name) + '/';
    rows.push(['Fájlok', hu(s.files)], ['Sorok', hu(s.loc)], ['Almappák', hu(d.dirs.size)]);
  }
  panel.innerHTML = `<span class="x" title="Bezárás">×</span><h3>${esc(title)}</h3><table>${rows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}</table>`;
  panel.querySelector('.x').onclick = () => { panel.hidden = true; };
  panel.hidden = false;
}

function legend(city) {
  const by = {};
  for (const f of city.files) if (!f.gone) by[f.lang] = (by[f.lang] || 0) + f.loc;
  const top = Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 9);
  $('legend').innerHTML = top.map(([l]) => `<div><i style="background:#${langColor(l).toString(16).padStart(6, '0')}"></i>${esc(l)}</div>`).join('');
}

function load(city) {
  if (!city || city.kind !== 'vrg-codecity') { alert('Ez nem Kódváros-fájl (city.json).'); return; }
  current = cityModel(city);
  layoutCity(current);
  showCity(current);
  legend(city);
  const live = city.files.filter(f => !f.gone).length;
  $('title').textContent = `${city.repo.name}${city.repo.head ? ' @ ' + city.repo.head : ''} · ${hu(live)} fájl · ${hu(city.commits.length)} commit · ${hu(city.authors.length)} szerző`;
  document.title = `${city.repo.name} — VRG Kódváros`;
  $('drop').hidden = true; $('panel').hidden = true;
}

function readFile(file) {
  file.text().then(t => load(JSON.parse(t))).catch(err => alert('Nem olvasható: ' + err.message));
}
$('file').addEventListener('change', e => e.target.files[0] && readFile(e.target.files[0]));
const stage = $('stage');
stage.addEventListener('dragover', e => { e.preventDefault(); $('drop').classList.add('over'); });
stage.addEventListener('dragleave', () => $('drop').classList.remove('over'));
stage.addEventListener('drop', e => {
  e.preventDefault(); $('drop').classList.remove('over');
  if (e.dataTransfer.files[0]) readFile(e.dataTransfer.files[0]);
});

if (window.CITY) load(window.CITY); else $('drop').hidden = false;

// test hook: page.html#pick=0.5,0.6 hovers and clicks at that fraction of the canvas (tools/shot.js)
const pickHook = /#pick=([\d.]+),([\d.]+)/.exec(location.hash);
if (pickHook && window.CITY) setTimeout(() => {
  const r = canvas.getBoundingClientRect();
  const e = { clientX: r.left + r.width * pickHook[1], clientY: r.top + r.height * pickHook[2] };
  onHover(e); onPick(e);
}, 300);

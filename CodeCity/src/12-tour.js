// 12-tour.js — Városnézés: authored tours through the city (God's Eye View's Scene Director, small).
// A shot is a VIEW — exactly what a share link holds (camera, look, commit, selection, query, roads) —
// plus a title, a caption and timings: fly seconds, then hold seconds. So any link is a shot.
// Tours come from three places: the automatic one (generated from the data), the ones scan.js baked in
// (--tour file.json), and the viewer's own (kept in memory; exported/imported as JSON, because
// localStorage does not survive file:// pages). #tour=auto&loop=1 plays on open: a wallboard.

const tours = { list: [], sel: 0, playing: null };
const TOUR_KIND = 'vrg-codecity-tours';

function autoTour() {
  const c = current.city, files = c.files, T = replay.last, side = current.side;
  const v = o => { const q = new URLSearchParams(); for (const [k, x] of Object.entries(o)) if (x !== undefined && x !== '') q.set(k, x); return q.toString(); };
  const camOn = (rect, r) => [rect.x + rect.w / 2, rect.z + rect.h / 2, 0.8, 0.9, r].map(x => +x.toFixed(2)).join(',');
  const live = files.filter(f => stateAt(f, f.i, T)[0] > 0);
  const shots = [{ title: 'Áttekintés', text: `${c.repo.name}: ${hu(live.length)} fájl, ${hu(c.commits.length)} commit, ${hu(c.authors.length)} szerző.`,
    view: v({ cam: camOn({ x: -side / 2, z: -side / 2, w: side, h: side }, side * 1.25) }), fly: 2, hold: 4 }];
  const tops = [...current.root.dirs.values()].map(d => [d, dirStats(d)]).sort((a, b) => b[1].loc - a[1].loc);
  if (tops[0]) {
    const [d, s] = tops[0];
    shots.push({ title: `A legnagyobb körzet: ${d.name}/`, text: `${hu(s.files)} fájl, ${hu(s.loc)} sor. A színek a nyelvet mutatják.`,
      view: v({ cam: camOn(d.rect, Math.max(d.rect.w, d.rect.h) * 1.4), lens: 'nyelv' }), fly: 3, hold: 5 });
  }
  landmarks.slice(0, 3).forEach((i, n) => {
    const f = files[i];
    shots.push({ title: `${n + 1}. tájékozódási pont: ${f.name}`, text: `${hu(roads.importers[i].length)} fájl importálja — cián ívek jönnek be, borostyán ívek mennek ki.`,
      view: v({ cam: camOn(f.rect, Math.max(60, Math.sqrt(f.rect.w * f.rect.h) * 7)), sel: f.p }), fly: 3, hold: 5 });
  });
  const heat = heatCounts(), hotDirs = [];
  (function walk(d) { if (d.depth === 2 || (d.depth === 1 && !d.dirs.size)) { let h = 0; (function sum(x) { x.files.forEach(f => { h += heat[f.i]; }); x.dirs.forEach(sum); })(d); hotDirs.push([d, h]); } if (d.depth < 2) d.dirs.forEach(walk); })(current.root);
  hotDirs.sort((a, b) => b[1] - a[1]);
  if (hotDirs[0] && hotDirs[0][1] > 0) {
    const [d] = hotDirs[0];
    shots.push({ title: `Itt folyik most a munka: ${d.path}/`, text: 'Hő nézet: a friss változások izzanak; a darus házakon a legtöbb.',
      view: v({ cam: camOn(d.rect, Math.max(d.rect.w, d.rect.h) * 1.6), lens: 'ho' }), fly: 3, hold: 5 });
  }
  if (c.commits.length > 2) {
    const first = c.commits[0], mid = c.commits[Math.floor(c.commits.length / 2)];
    shots.push({ title: 'Így kezdődött', text: `Az első commit: ${new Date(first[0] * 1000).toLocaleDateString('hu-HU')} — „${first[3]}”.`,
      view: v({ cam: camOn({ x: -side / 2, z: -side / 2, w: side, h: side }, side * 1.1), t: first[4], lens: 'kor' }), fly: 2.5, hold: 4 });
    shots.push({ title: 'Félúton', text: `${new Date(mid[0] * 1000).toLocaleDateString('hu-HU')} — „${mid[3]}”.`,
      view: v({ cam: camOn({ x: -side / 2, z: -side / 2, w: side, h: side }, side * 1.1), t: mid[4], lens: 'kor' }), fly: 2, hold: 4 });
  }
  shots.push({ title: 'Ma', text: 'Az ablakok ott világítanak, ahol mostanában dolgoztak.', view: v({ cam: camOn({ x: -side / 2, z: -side / 2, w: side, h: side }, side * 1.25) }), fly: 3, hold: 5 });
  return { id: 'auto', title: 'Automatikus városnézés', shots, auto: true };
}

function toursLoad() {
  tours.list = [autoTour(), ...(current.city.tours || []).map((t, i) => ({ ...t, id: 'beepitett-' + i, baked: true }))];
  try { const own = JSON.parse(localStorage.getItem(tourKey()) || '[]'); tours.list.push(...own); } catch { /* file:// or blocked: memory only */ }
  tours.sel = 0;
  tourRender();
}
const tourKey = () => 'kodvaros-tours:' + current.city.repo.name;
function toursSave() {
  try { localStorage.setItem(tourKey(), JSON.stringify(tours.list.filter(t => !t.auto && !t.baked))); } catch { /* memory only */ }
}

// ---- playback
const sleep = (ms, token) => new Promise(res => { const id = setTimeout(res, ms); token.cancel = () => { clearTimeout(id); res(); }; });
async function playTour(t, loop = false) {
  stopTour();
  const token = {};
  tours.playing = token;
  $('stage').classList.add('touring');
  do {
    for (let n = 0; n < t.shots.length; n++) {
      if (tours.playing !== token) return;
      const s = t.shots[n];
      caption(s, n, t.shots.length);
      const view = new URLSearchParams(s.view);
      applyView(view, (s.fly || 2) * 1000);
      await sleep((s.fly || 2) * 1000, token);
      if (tours.playing !== token) return;
      // land exactly on the shot, even if frames were throttled (background tab, TV browser)
      const cam = (view.get('cam') || '').split(',').map(Number);
      if (cam.length === 5 && cam.every(Number.isFinite)) { cancelAnimationFrame(flyCamera.raf); flyCamera(cam, 0); }
      await sleep((s.hold || 4) * 1000, token);
    }
  } while (loop && tours.playing === token);
  if (tours.playing === token) stopTour();
}
function stopTour() {
  if (tours.playing && tours.playing.cancel) tours.playing.cancel();
  tours.playing = null;
  $('caption').hidden = true;
  $('stage').classList.remove('touring');
  tourRender();
}
function caption(s, n, total) {
  $('caption').innerHTML = `<div class="cap-n">${n + 1} / ${total}</div><h2>${esc(s.title)}</h2>${s.text ? `<p>${esc(s.text)}</p>` : ''}<div class="cap-hint">Esc: megállítás</div>`;
  $('caption').hidden = false;
}

// ---- the drawer
function tourRender() {
  const box = $('tours');
  if (box.hidden || !current) return;
  const t = tours.list[tours.sel] || tours.list[0];
  box.innerHTML = `<span class="x" title="Bezárás">×</span><h3>Városnézés</h3>
    <select id="tour-sel">${tours.list.map((x, i) => `<option value="${i}"${i === tours.sel ? ' selected' : ''}>${esc(x.title)}${x.baked ? ' (beépített)' : ''}</option>`).join('')}</select>
    <div class="row"><button class="btn" id="tour-play">${tours.playing ? '⏹ Megállítás' : '▶ Lejátszás'}</button>
      <label><input type="checkbox" id="tour-loop"> ismétlés</label></div>
    <ol class="shots">${t.shots.map((s, i) => `<li data-shot="${i}"><span>${esc(s.title)}</span>${t.auto || t.baked ? '' : `<button class="del" data-del="${i}" title="Törlés">✕</button>`}</li>`).join('')}</ol>
    <div class="row"><button class="btn" id="tour-add" title="A mostani nézet új jelenet lesz">+ Jelenet</button>
      <button class="btn" id="tour-export">Mentés…</button><label class="btn">Betöltés…<input id="tour-import" type="file" accept=".json" hidden></label></div>
    <div class="dim small">${t.auto ? 'Az automatikus túra az adatokból készül; a „+ Jelenet” saját túrát indít.' : 'Fájlból megnyitott oldalon a túrák csak Mentés… után maradnak meg.'}</div>`;
  box.querySelector('.x').onclick = () => { box.hidden = true; };
  $('tour-sel').onchange = e => { tours.sel = +e.target.value; tourRender(); };
  $('tour-play').onclick = () => (tours.playing ? stopTour() : playTour(t, $('tour-loop').checked));
  $('tour-add').onclick = () => addShot();
  $('tour-export').onclick = exportTours;
  $('tour-import').onchange = e => e.target.files[0] && importTours(e.target.files[0]);
  box.querySelector('.shots').onclick = e => {
    const del = e.target.closest('[data-del]');
    if (del) { t.shots.splice(+del.dataset.del, 1); toursSave(); tourRender(); return; }
    const li = e.target.closest('[data-shot]');
    if (li) { stopTour(); const s = t.shots[+li.dataset.shot]; caption(s, +li.dataset.shot, t.shots.length); applyView(new URLSearchParams(s.view), 1200); }
  };
}
function addShot() {
  let t = tours.list[tours.sel];
  if (!t || t.auto || t.baked) {
    t = { id: 'sajat-' + Date.now(), title: 'Saját túra ' + (tours.list.filter(x => !x.auto && !x.baked).length + 1), shots: [] };
    tours.list.push(t); tours.sel = tours.list.length - 1;
  }
  const title = prompt('A jelenet címe:', shownFile ? shownFile.name : `Jelenet ${t.shots.length + 1}`);
  if (title === null) return;
  const text = prompt('Felirat (elhagyható):', '') || '';
  t.shots.push({ title, text, view: viewState().toString(), fly: 2.5, hold: 5 });
  toursSave(); tourRender();
}
function exportTours() {
  const own = tours.list.filter(t => !t.auto);
  const doc = { kind: TOUR_KIND, version: 1, repo: current.city.repo.name, tours: own.map(({ title, shots }) => ({ title, shots })) };
  downloadFile(`${current.city.repo.name}-varosnezes.json`, new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' }));
}
function importTours(file) {
  file.text().then(txt => {
    const doc = JSON.parse(txt);
    if (doc.kind !== TOUR_KIND || !Array.isArray(doc.tours)) throw new Error('ez nem Városnézés-fájl');
    for (const t of doc.tours) {
      if (!t || typeof t.title !== 'string' || !Array.isArray(t.shots)) continue;
      const shots = t.shots.filter(s => s && typeof s.title === 'string' && typeof s.view === 'string')
        .map(s => ({ title: s.title, text: String(s.text || ''), view: s.view, fly: +s.fly || 2.5, hold: +s.hold || 5 }));
      tours.list.push({ id: 'import-' + Date.now() + '-' + tours.list.length, title: t.title, shots });
    }
    tours.sel = tours.list.length - 1; toursSave(); tourRender();
  }).catch(err => alert('Nem tölthető be: ' + err.message));
}
function downloadFile(name, blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

$('tour-btn').onclick = () => { const b = $('tours'); b.hidden = !b.hidden; tourRender(); };
addEventListener('keydown', e => { if (e.key === 'Escape' && tours.playing) stopTour(); });
canvas.addEventListener('pointerdown', () => { if (tours.playing) stopTour(); });   // touching the city takes the wheel back

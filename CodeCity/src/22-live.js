// 22-live.js — the live repo (P3, KV-08). Served by the Kódváros segéd, the page listens on GET /api/stream:
// an 'fs' event pulses the roofs of the changed files (the replay's flash, fading over ~2 s) and lists them;
// a 'git' event (a commit, a checkout) fetches the fresh city from /api/city and swaps it in place —
// camera, look, open file and selection stay; no reload. "Mi változott?" shows the commits since the last
// visit (kept per repo in localStorage, when the browser allows it) and this session's live changes.

const live = { es: null, pulse: new Float32Array(0), raf: 0, fs: new Map(), seen: null, since: [], swapping: false };
// settles once the stream said hello and any catch-up swap is done (a test hook waits on it)
live.ready = new Promise(r => { live.readyResolve = r; });
const LIVE_KEY = () => 'kodvaros-seen:' + current.city.repo.name;
const liveMine = () => kv.for === current.city && kv.match;

// ---- pulses: the aFlash attribute, as the max of the replay's flash and the live pulse
function livePulse(idx) {
  if (live.pulse.length !== replay.flash.length) live.pulse = new Float32Array(replay.flash.length);
  for (const i of idx) live.pulse[i] = 1;
  if (!live.raf) { live.fadeAt = performance.now(); live.raf = requestAnimationFrame(liveFade); }
}
// the glow fades by time (×0.97 per 60th of a second, ~2 s), not per frame: the wallpaper draws only 1–5 frames a second
function liveFade() {
  const fl = world.buildings.geometry.attributes.aFlash, now = performance.now(), k = Math.pow(0.97, Math.min(600, (now - (live.fadeAt || now)) / (1000 / 60)));
  live.fadeAt = now;
  let any = false;
  for (let i = 0; i < live.pulse.length; i++) {
    if (live.pulse[i] <= 0) continue;
    live.pulse[i] = live.pulse[i] < 0.02 ? 0 : live.pulse[i] * k;
    fl.array[i] = Math.max(replay.flash[i], live.pulse[i]);
    any = any || live.pulse[i] > 0;
  }
  fl.needsUpdate = true; requestRender();
  live.raf = any ? requestAnimationFrame(liveFade) : 0;
}

// ---- "Mi változott?": commits since the last visit + live changes this session
function liveSeenInit() {
  const c = current.city.commits, latest = c.length ? c[c.length - 1][0] : 0;
  let prev = null;
  try { prev = JSON.parse(localStorage.getItem(LIVE_KEY()) || 'null'); } catch (e) { /* file:// or blocked */ }
  // read once per visit: an in-place swap must not mistake this visit's own mark for the last visit
  if (!live.seenRead) { live.seenRead = true; live.seen = prev; }
  live.since = live.seen ? c.map((k, ci) => ci).filter(ci => c[ci][0] > live.seen.t) : [];
  try { localStorage.setItem(LIVE_KEY(), JSON.stringify({ t: latest, at: Date.now() })); } catch (e) { /* memory only */ }
  liveBadge();
}
function liveBadge() {
  const b = $('news-btn'), n = live.since.length + live.fs.size;
  b.hidden = !n;
  b.textContent = `Mi változott? ${n}`;
}
function liveNews() {
  const c = current.city, byPath = new Map(c.files.map(f => [f.p, f]));
  const touched = new Map();
  for (const ci of live.since) { const ch = c.commits[ci][5] || []; for (let i = 0; i < ch.length; i += 3) touched.set(ch[i], (touched.get(ch[i]) || 0) + 1); }
  const top = [...touched].sort((a, b) => b[1] - a[1]).slice(0, 12);
  const when = live.seen ? new Date(live.seen.at).toLocaleString('hu-HU') : '';
  const commits = live.since.slice().reverse().slice(0, 30).map(ci => { const k = c.commits[ci];
    return `<li data-ci="${ci}">${new Date(k[0] * 1000).toLocaleDateString('hu-HU')} <span class="dim">${esc(k[4])}</span> ${esc(k[3])}${k[2] >= 0 ? ' <span class="dim">· ügynök</span>' : ''}</li>`; }).join('');
  const files = top.map(([i, n]) => `<li data-path="${esc(c.files[i].p)}">${esc(c.files[i].name)} <span class="dim">${n}× · ${esc(c.files[i].p)}</span></li>`).join('');
  const now = [...live.fs].reverse().map(([p, k]) => `<li${byPath.has(p) ? ` data-path="${esc(p)}"` : ''}>${esc(p)} <span class="dim">${esc(k.kind)} · ${new Date(k.at).toLocaleTimeString('hu-HU')}${byPath.has(p) ? '' : ' · még nincs épülete'}</span></li>`).join('');
  openPanel('Mi változott?', [['Utolsó látogatás', when || 'ez az első'], ['Új commit azóta', hu(live.since.length)], ['Élő változás most', hu(live.fs.size)]],
    (now ? `<h4>Most, élőben (még nincs commitolva)</h4><ul class="kv-hist">${now}</ul>` : '') +
    (commits ? `<h4>Commitok a legutóbbi látogatás óta</h4><ul class="kv-hist">${commits}</ul>` : '') +
    (files ? `<h4>A legtöbbet érintett fájlok</h4><ul class="kv-hist">${files}</ul>` : '') +
    (!now && !commits ? '<p class="dim">Csend: semmi új a legutóbbi látogatás óta.</p>' : ''));
  $('panel').querySelectorAll('li[data-ci]').forEach(li => { li.onclick = () => { tlPause(); applyTime(+li.dataset.ci, 260); }; });
}

// ---- a commit landed: the fresh city in place of the old one, the view kept
async function liveSwap() {
  if (live.swapping || !liveMine()) return;
  live.swapping = true;
  try {
    const r = await fetch('/api/city');
    if (!r.ok) return kvToast('Az új állapot felmérése nem sikerült');
    const city = await r.json();
    if (city.repo.head === current.city.repo.head) return;
    const cam = { t: orbit.target.clone(), theta: orbit.theta, phi: orbit.phi, r: orbit.r };
    const open = shownFile && shownFile.p, picked = sel.set.size ? selFiles().map(f => f.p) : null;
    const was = current.city.commits.length;
    load(city);
    await kvReady();
    Object.assign(orbit, { theta: cam.theta, phi: cam.phi, r: cam.r }); orbit.target.copy(cam.t); placeCamera();
    if (open) { const f = city.files.find(x => x.p === open); if (f) showFile(f); }
    if (picked) selSetPaths(picked);
    agentsEvent({ list: ag.list });   // the figures stood in the old city
    fenDraw(); jbDraw(); hlDraw(); mtDraw(); landDraw(); pwDraw(); worldDraw();
    const n = city.commits.length - was;
    // the new commits flash like a replay step, and their files pulse
    const idx = [];
    for (let ci = Math.max(0, was); ci < city.commits.length; ci++) { const ch = city.commits[ci][5] || []; for (let i = 0; i < ch.length; i += 3) idx.push(ch[i]); }
    livePulse(idx);
    // what was live and is now committed leaves the "now" list
    for (const i of idx) live.fs.delete(city.files[i].p);
    liveSeenInit();
    kvToast(n > 0 ? `${hu(n)} új commit: ${city.commits[city.commits.length - 1][3]}` : 'A város frissült (' + city.repo.head + ')');
  } catch (e) { kvToast('Az új állapot betöltése nem sikerült'); } finally { live.swapping = false; }
}

function liveConnect() {
  if (live.es || !kv.match) return;
  live.es = new EventSource('/api/stream' + (KV_WALL ? '?wallpaper=1' : ''));   // 00-wallpaper: a light listener
  live.es.addEventListener('hello', e => {
    const h = JSON.parse(e.data).head;
    $('live-dot').hidden = false;
    // the page's data is older than HEAD (START.cmd scans on open; a plain `node companion.js` does not)
    (h && current.city.repo.head && h !== current.city.repo.head ? liveSwap() : Promise.resolve()).then(live.readyResolve);
  });
  live.es.addEventListener('fs', e => liveFsEvent(JSON.parse(e.data)));
  live.es.addEventListener('git', () => { liveSwap(); if (mt.map) mtLoad(); });   // 28-metro: lines move with HEAD
  // live Claude (23-agents): the sessions and what they touch
  live.es.addEventListener('agents', e => { if (liveMine()) agentsEvent(JSON.parse(e.data)); });
  live.es.addEventListener('beam', e => { if (liveMine()) beamEvent(JSON.parse(e.data)); });
  live.es.addEventListener('fences', e => { if (liveMine()) fencesEvent(JSON.parse(e.data)); });   // 24-fences
  // 26-jobs: workshops, gates, the port street
  live.es.addEventListener('jobs', e => { if (liveMine()) jobsEvent(JSON.parse(e.data)); });
  live.es.addEventListener('job', e => { if (liveMine()) jobEvent(JSON.parse(e.data)); });
  live.es.addEventListener('joblog', e => { if (liveMine()) joblogEvent(JSON.parse(e.data)); });
  live.es.addEventListener('ports', e => { if (liveMine()) portsEvent(JSON.parse(e.data)); });
  live.es.addEventListener('pipes', e => { if (liveMine()) pipesEvent(JSON.parse(e.data)); });   // 27-health
  live.es.addEventListener('disk', e => { if (liveMine()) diskEvent(JSON.parse(e.data)); });   // 29-land: Tárház
  live.es.addEventListener('power', e => { if (liveMine()) powerEvent(JSON.parse(e.data)); });   // 30-power: Erőmű
  live.es.addEventListener('net', e => { if (liveMine()) netEvent(JSON.parse(e.data)); });   // 30-power: station, border, shore
  live.es.addEventListener('cargo', e => { if (liveMine()) cargoEvent(JSON.parse(e.data)); });   // 31-flows: ships and planes
  live.es.addEventListener('apps', e => { if (liveMine()) appsEvent(JSON.parse(e.data)); });   // 33-apps: open programs (vrg-probe)
  // 34-stadium: now playing, sound towers and their peaks, Bluetooth buoys, the USB port board (vrg-probe)
  live.es.addEventListener('media', e => { if (liveMine()) mediaEvent(JSON.parse(e.data)); });
  live.es.addEventListener('audio', e => { if (liveMine()) audioEvent(JSON.parse(e.data)); });
  live.es.addEventListener('peaks', e => { if (liveMine()) peaksEvent(JSON.parse(e.data)); });
  live.es.addEventListener('bt', e => { if (liveMine()) btEvent(JSON.parse(e.data)); });
  live.es.addEventListener('usb', e => { if (liveMine()) usbEvent(JSON.parse(e.data)); });
  // 35-etw: the exact cargo per process (vrg-etw, the user's elevated task)
  live.es.addEventListener('etw', e => { if (liveMine()) etwEvent(JSON.parse(e.data)); });
  live.es.addEventListener('etwcargo', e => { if (liveMine()) etwCargoEvent(JSON.parse(e.data)); });
  live.es.onerror = () => { $('live-dot').hidden = true; };
}
function liveFsEvent(d) {
    if (!liveMine()) return;
    const by = new Map(current.city.files.map((f, i) => [f.p, i])), idx = [];
    for (const { p, kind } of d.paths) {
      live.fs.set(p, { kind, at: Date.now() });
      if (by.has(p)) idx.push(by.get(p));
    }
    if (idx.length) livePulse(idx);
    liveBadge();
    if (!$('panel').hidden && $('panel').querySelector('h3') && $('panel').querySelector('h3').textContent === 'Mi változott?') liveNews();
}
async function liveInit() {
  liveSeenInit();
  await kvReady();
  liveConnect();
  // 00-wallpaper: hidden = no stream (the wallpaper behind a fullscreen app, the overlay dismissed)
  if (KV_WALL || KV_OVERLAY) document.addEventListener('visibilitychange', () => { if (document.hidden) { if (live.es) { live.es.close(); live.es = null; } } else if (!live.es) liveConnect(); });
  if (KV_WALL) return;   // the wallpaper is the scene only — no terminal offer, gates, metro or H: walk
  termResumeOffer();   // 21-term: Claude tabs from before a restart
  if (kv.match) palCatalog().then(jbLoad);   // 26-jobs: the gates need the START.cmd tools
  if (kv.match) mtLoad();   // 28-metro
  if (kv.match) landLoad();   // 29-land: the H: walk starts here
}
$('news-btn').onclick = liveNews;

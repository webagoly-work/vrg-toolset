// 47-hm-time.js — Gépország's memory (CITY-D48 B, option H3): the last 15 minutes in this page's memory only, nothing written,
// gone with the page. The strip shows the load and a drag replays the city as it was, with a permanent banner so a past moment
// can never read as live; closing a program is off while looking back. The ring fills only while the view is open, because
// the feed runs only then (R11), so a gap in the strip is time the view was closed. Each second is folded by program family,
// about 150 rows instead of 450. The opt-in saved recording is the segéd's: aggregated by class, no names (homeland.js).

const HM_RING_S = 900;
function hmCompact(procs) {
  hm.fam = hm.fam || new Map();
  return hmFold(procs).map(g => { if (!hm.fam.has(g.key)) hm.fam.set(g.key, hm.fam.size + 1); g.pid = hm.fam.get(g.key); g.ppid = 0; return g; });
}
function hmLoadOf(e) {
  const m = e.mem, cpu = e.cores.reduce((a, c) => a + c.u + c.k, 0) / Math.max(1, e.cores.length);
  return [Math.min(100, cpu), m.total ? 100 * (1 - m.avail / m.total) : 0, Math.min(100, Math.max(0, ...e.disks.map(d => d.busy)))];
}
function hmRingPush(d) {
  // the observer's own share is taken here: folded, one observing process would mark its whole family
  const obsCpu = d.procs.filter(p => p.obs).reduce((a, p) => a + p.cpu, 0);
  hm.ring.push({ at: d.at, load: hmLoadOf(d), ev: Object.assign({}, d, { procs: hmCompact(d.procs), obsCpu }) });
  const from = d.at - HM_RING_S * 1000;
  while (hm.ring.length && hm.ring[0].at < from) hm.ring.shift();
  hmTimePaint();
}

function hmTimeBuild() {
  const el = document.createElement('div');
  el.id = 'hm-time'; el.hidden = true;
  el.innerHTML = `<canvas id="hm-strip" width="440" height="34" title="Az elmúlt 15 perc: húzd a visszanézéshez (← →), End: élő"></canvas>
    <button class="btn" id="hm-live" hidden>Élő</button>
    <button class="btn" id="hm-rec" title="Mentett felvétel: 10 másodpercenként összesítve, osztályonként, programnevek nélkül">Felvétel</button>
    <button class="btn" id="hm-recs" title="A mentett felvételek">Felvételek</button>`;
  hm.ui.append(el);
  const past = document.createElement('div');
  past.id = 'hm-past'; past.hidden = true;
  hm.ui.append(past);
  const cv = $('hm-strip'), at = e => { const r = cv.getBoundingClientRect(); hmScrubTo((e.clientX - r.left) / r.width); };
  cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); at(e); cv.onpointermove = at; });
  cv.addEventListener('pointerup', () => { cv.onpointermove = null; });
  $('hm-live').onclick = hmLiveAgain;
  $('hm-rec').onclick = hmRecToggle;
  $('hm-recs').onclick = hmRecList;
}
function hmTimePaint() {
  const el = $('hm-time');
  if (!el) return;
  el.hidden = !!hm.estate || hm.ring.length < 2;
  if (el.hidden) return;
  const cv = $('hm-strip'), g = cv.getContext('2d'), W = cv.width, H = cv.height, css = getComputedStyle(document.documentElement);
  const t1 = hm.ring[hm.ring.length - 1].at, X = at => W * (1 - (t1 - at) / (HM_RING_S * 1000));
  g.clearRect(0, 0, W, H);
  // the three loads as lines: warm for what the machine is doing, grey for memory and disk (Mélyvíz M1, R1)
  [[1, css.getPropertyValue('--dim') || '#7d8a96'], [2, '#4c565f'], [0, '#e8a873']].forEach(([k, col]) => {
    g.strokeStyle = col.trim(); g.lineWidth = k ? 1 : 1.5; g.beginPath();
    hm.ring.forEach((s, i) => { const x = X(s.at), y = H - 2 - s.load[k] / 100 * (H - 4), gap = i && s.at - hm.ring[i - 1].at > 5000; if (!i || gap) g.moveTo(x, y); else g.lineTo(x, y); });
    g.stroke();
  });
  if (hm.scrub != null) { g.fillStyle = '#93d3e6'; g.fillRect(X(hm.scrub) - 1, 0, 2, H); }
}
function hmScrubTo(f) {
  if (!hm.ring.length) return;
  const t1 = hm.ring[hm.ring.length - 1].at, at = t1 - (1 - Math.max(0, Math.min(1, f))) * HM_RING_S * 1000;
  hmShowAt(hm.ring.reduce((b, s) => (Math.abs(s.at - at) < Math.abs(b.at - at) ? s : b)));
}
function hmStep(sec) {
  if (!hm.ring.length) return;
  const at = (hm.scrub == null ? hm.ring[hm.ring.length - 1].at : hm.scrub) + sec * 1000;
  if (hm.scrub != null && at >= hm.ring[hm.ring.length - 1].at) return hmLiveAgain();
  hmShowAt(hm.ring.reduce((b, s) => (Math.abs(s.at - at) < Math.abs(b.at - at) ? s : b)));
}
function hmShowAt(s) {
  hm.scrub = s.at; hm.confirm = null;
  const mins = Math.max(0, Math.round((hm.ring[hm.ring.length - 1].at - s.at) / 60000));
  const el = $('hm-past');
  el.hidden = false;
  el.textContent = `VISSZANÉZÉS · ${new Date(s.at).toLocaleTimeString('hu-HU')}${mins ? ` · ${mins} perce` : ''} — nem élő kép`;
  $('hm-live').hidden = false;
  hm.ev = s.ev;
  hmApply(s.ev); hmHud(); hmPanel(); hmTimePaint();
}
function hmLiveAgain() {
  hm.scrub = null;
  $('hm-past').hidden = true; $('hm-live').hidden = true;
  const last = hm.ring[hm.ring.length - 1];
  if (last) { hm.ev = last.ev; hmApply(last.ev); hmHud(); hmPanel(); }
  hmTimePaint();
}

// ---- the saved recording: the segéd writes it, only while this switch is on
function hmRecPaint() { const b = $('hm-rec'); if (b) { b.classList.toggle('on', !!hm.rec); b.textContent = hm.rec ? '● Felvétel fut' : 'Felvétel'; } }
async function hmRecToggle() {
  if (hm.fixture) { kvToast('Próbaadat: nincs mit menteni'); return; }
  const r = await kvCall('hm-rec', { on: !hm.rec });
  if (r.status !== 200) { kvToast((r.json && r.json.error) || 'Nem sikerült'); return; }
  hm.rec = !!r.json.rec; hmRecPaint();
  kvToast(hm.rec ? 'Felvétel indul: összesítve, nevek nélkül' : 'Felvétel leállt');
}
async function hmRecList() {
  if (hm.fixture) { kvToast('Próbaadat: nincs mentett felvétel'); return; }
  const r = await kvCall('hm-recs', {});
  const list = (r.json && r.json.list) || [];
  hm.sel = null;
  openPanel('Felvételek', list.length ? list.slice(0, 12).map(x => [esc(new Date(x.at).toLocaleString('hu-HU')), `${Math.round(x.secs / 60)} perc · CPU max ${Math.round(x.cpuMax)} % · RAM max ${Math.round(x.ramMax)} %`]) : [['Nincs mentett felvétel', '']],
    '<p class="dim">Tízmásodpercenkénti összesítés osztályonként, programnevek, mappák és fájlok nélkül. Csak ezen a gépen, a repó .cache mappájában.</p>' + hmFooter('M', 'segéd, homeland.js'));
}

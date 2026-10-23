// 16-session.js — Munkamenet: replay one agent session (CITY-D7 A, mindwalk-style). A light hops from
// building to building in the order the session read (blue), searched (violet) or edited (amber)
// them; touched roofs keep a dot in the strongest colour they got. A search over a folder lights the
// district's middle. The data is paths + kind + time only (scan.js --sessions, see sessions.js).
// city.sessions[i]: { id, t0, dirs, ev: [dt, kind, target, ...] }, target < 0 -> dirs[~target]

const sess = { s: null, k: 0, timer: 0, raf: 0, obj: null, marks: new Map(), hops: [] };
const SESS_KIND = ['olvas', 'keres', 'szerkeszt'], SESS_COLOR = [0x5ab8ff, 0xb48cff, 0xffa63a];
const SESS_SECONDS = 30;   // the whole session in ~30 s, whatever its real length

function sessLabel(s) {
  const n = s.ev.length / 3, min = Math.max(1, Math.round(s.ev[s.ev.length - 3] / 60));
  return `${new Date(s.t0 * 1000).toLocaleString('hu-HU', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · ${min} p · ${n} lépés`;
}
function sessOptions() {
  const list = current.city.sessions || [], sel = $('sess');
  sel.hidden = $('sess-play').hidden = !list.length;
  sel.innerHTML = '<option value="">Munkamenet: —</option>' + list.map((s, i) => `<option value="${i}">${esc(sessLabel(s))}</option>`).join('');
  sessStop(true);
}

function dirByPath(p) {
  let d = current.root;
  for (const part of p ? p.split('/') : []) { d = d.dirs.get(part); if (!d) return null; }
  return d;
}
// a district's skyline at the shown commit, so a folder mark floats above its roofs (cached per T)
const skyline = new Map();
function skylineOf(d) {
  const key = replay.T + '|' + d.path;
  if (!skyline.has(key)) {
    if (skyline.size > 500) skyline.clear();
    let top = (d.depth + 1) * PLATE;
    const walk = x => { for (const f of x.files) { const h = stateAt(f, f.i, replay.T)[0]; if (h > 0) top = Math.max(top, f.base + h); } x.dirs.forEach(walk); };
    walk(d);
    skyline.set(key, top);
  }
  return skyline.get(key);
}
// where event k points: a roof (or the empty plot), or above the middle of a district
function sessPoint(target) {
  if (target >= 0) {
    const f = current.city.files[target];
    return roofOf(target) || new THREE.Vector3(f.rect.x + f.rect.w / 2, f.base, f.rect.z + f.rect.h / 2);
  }
  const d = dirByPath(sess.s.dirs[~target]);
  return d && new THREE.Vector3(d.rect.x + d.rect.w / 2, skylineOf(d) + 4, d.rect.z + d.rect.h / 2);
}

function sessDispose() {
  if (!sess.obj) return;
  scene.remove(sess.obj);
  sess.obj.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
  sess.obj = null;
}
// marks (touched roofs), the last hops as a fading line, and the light itself at `head`
function sessDraw(head) {
  sessDispose();
  const group = new THREE.Group(), mp = [], mc = [];
  for (const [t, kind] of sess.marks) {
    const p = sessPoint(t); if (!p) continue;
    const c = new THREE.Color(SESS_COLOR[kind]);
    mp.push(p.x, p.y + 1.2, p.z); mc.push(c.r, c.g, c.b);
  }
  const pts = (pos, col, size) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    if (col) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    return g;
  };
  if (mp.length) group.add(new THREE.Points(pts(mp, mc), new THREE.PointsMaterial({ size: 6, sizeAttenuation: false, vertexColors: true, depthWrite: false })));
  const hops = sess.hops.slice(-12).map(([t, kind]) => [sessPoint(t), kind]).filter(h => h[0]);
  if (hops.length > 1) {
    const lp = [], lc = [];
    hops.forEach(([p, kind], n) => {
      const a = 0.1 + 0.9 * (n + 1) / hops.length, c = new THREE.Color(SESS_COLOR[kind]);
      lp.push(p.x, p.y + 3, p.z); lc.push(c.r * a, c.g * a, c.b * a);
    });
    if (head) { const last = lc.length - 3; lp.push(head.x, head.y, head.z); lc.push(lc[last], lc[last + 1], lc[last + 2]); }
    group.add(new THREE.Line(pts(lp, lc), new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })));
  }
  if (head) group.add(new THREE.Points(pts([head.x, head.y, head.z]), new THREE.PointsMaterial({ size: 16, sizeAttenuation: false, color: SESS_COLOR[sess.hops.length ? sess.hops[sess.hops.length - 1][1] : 0], depthWrite: false })));
  group.traverse(o => { o.raycast = () => {}; });
  sess.obj = group;
  scene.add(group);
  requestRender();
}

function sessReadout(k) {
  const s = sess.s, el = $('sess-now');
  if (!s) { el.hidden = true; return; }
  const n = s.ev.length / 3, counts = [0, 0, 0];
  for (let j = 0; j < Math.min(k, n); j++) counts[s.ev[j * 3 + 1]]++;
  const sw = i => `<i style="background:#${SESS_COLOR[i].toString(16)}"></i>`;
  let now = '';
  if (k > 0) {
    const j = (k - 1) * 3, t = s.ev[j + 2];
    const name = t >= 0 ? current.city.files[t].p : (s.dirs[~t] || current.city.repo.name) + '/';
    now = `<div class="now">${sw(s.ev[j + 1])}${new Date((s.t0 + s.ev[j]) * 1000).toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' })} · ${SESS_KIND[s.ev[j + 1]]} · <b>${esc(name)}</b></div>`;
  }
  el.innerHTML = `<span class="x" title="Bezárás (Esc)">×</span><b>Munkamenet</b> <span class="dim">${esc(s.id)} · ${Math.min(k, n)} / ${n}</span>${now}`
    + `<div class="dim">${[0, 1, 2].map(i => `${sw(i)}${SESS_KIND[i]}: ${counts[i]}`).join(' · ')}</div>`;
  el.querySelector('.x').onclick = () => { $('sess').value = ''; sessStop(); writeHashSoon(); };
  el.hidden = false;
}

// record event k as done (mark + hop)
function sessTake(k) {
  const s = sess.s, j = k * 3, t = s.ev[j + 2], kind = s.ev[j + 1];
  sess.marks.set(t, Math.max(kind, sess.marks.get(t) ?? -1));
  sess.hops.push([t, kind]);
}

function sessStop(quiet) {
  clearTimeout(sess.timer); cancelAnimationFrame(sess.raf);
  sess.s = null; sess.k = 0; sess.marks.clear(); sess.hops = [];
  $('sess-play').textContent = '▶';
  sessDispose(); sessReadout(0);
  if (!quiet) requestRender();
}
function sessSelect(i) {
  sessStop(true);
  sess.s = (current.city.sessions || [])[i] || null;
}
// the finished picture: every mark, no light — for links and the initial view
function sessShowAll() {
  if (!sess.s) return;
  clearTimeout(sess.timer); cancelAnimationFrame(sess.raf);
  sess.marks.clear(); sess.hops = [];
  const n = sess.s.ev.length / 3;
  for (let k = 0; k < n; k++) sessTake(k);
  sess.k = n; $('sess-play').textContent = '▶';
  sessDraw(null); sessReadout(n);
}
function sessPlay() {
  const s = sess.s; if (!s) return;
  const n = s.ev.length / 3;
  if (sess.k >= n) { sess.k = 0; sess.marks.clear(); sess.hops = []; }
  // replay time: real gaps, each capped at 20 s, then squeezed into SESS_SECONDS (min 120 ms a hop)
  let total = 0; const gap = [];
  for (let k = 0; k < n; k++) { const g = k ? Math.min(20, s.ev[k * 3] - s.ev[(k - 1) * 3]) : 0; gap.push(g); total += g; }
  const scale = total ? SESS_SECONDS * 1000 / total : 0;
  $('sess-play').textContent = '⏸';
  const hop = () => {
    if (sess.s !== s) return;
    if (sess.k >= n) { $('sess-play').textContent = '▶'; sessDraw(null); return; }
    const from = sess.hops.length ? sessPoint(sess.hops[sess.hops.length - 1][0]) : null;
    const to = sessPoint(s.ev[sess.k * 3 + 2]);
    const ms = Math.max(120, Math.min(1500, (gap[sess.k + 1] || 0) * scale || 300));
    sessTake(sess.k); sess.k++; sessReadout(sess.k);
    // fly the light along a low arc from the previous stop to this one
    if (from && to && !reduceMotion.matches) {
      const t0 = performance.now(), fly = Math.min(ms * 0.7, 600), lift = 4 + from.distanceTo(to) * 0.15, p = new THREE.Vector3();
      const step = () => {
        if (sess.s !== s) return;
        const u = Math.min(1, (performance.now() - t0) / fly);
        p.lerpVectors(from, to, u); p.y += 3 + lift * 4 * u * (1 - u);
        sessDraw(p);
        if (u < 1) sess.raf = requestAnimationFrame(step);
      };
      cancelAnimationFrame(sess.raf); sess.raf = requestAnimationFrame(step);
    } else sessDraw(to && to.clone().setY(to.y + 3));
    sess.timer = setTimeout(hop, ms);
  };
  hop();
}
function sessToggle() {
  if (!sess.s) return;
  if ($('sess-play').textContent === '⏸') { clearTimeout(sess.timer); cancelAnimationFrame(sess.raf); $('sess-play').textContent = '▶'; return; }
  sessPlay();
}

$('sess').onchange = e => {
  if (e.target.value === '') sessStop(); else { sessSelect(+e.target.value); sessPlay(); }
  writeHashSoon();
};
$('sess-play').onclick = () => {
  if (!sess.s && $('sess').value !== '') sessSelect(+$('sess').value);
  sessToggle();
};
addEventListener('keydown', e => {
  if (e.key === 'Escape' && sess.s) { $('sess').value = ''; sessStop(); writeHashSoon(); }
});

// the timeline moved: roofs changed height, so redraw a paused or finished session in place
function sessRefresh() { if (sess.s && sess.obj && $('sess-play').textContent === '▶') sessDraw(null); }

// 27-health.js — health at a glance (P6, KV-15; README §7.1 #2 #8, §7.2 #1 #8; report §5.3, R1–R3).
// Weather: a test job that failed puts a storm over the district it speaks for; a pass clears it — a calm city
// means all is well (R1), so a clear sky is simply nothing. The repair tunnel: the repo files named in the failing
// output, joined underground in the order they appear (error → origin). Pipes: each build runs under the city
// from its sources to its page; a source newer than the page floods the page's plot. The inspector's lamp: one
// lamp per top-level district — red storm, amber stale build, green tests passed, grey nothing known.
// The Now ribbon: three lines — what runs, what needs you (at most four advisors), what changed — and an empty
// line stays empty.

const hl = { pipes: [], group: null, tunnel: [], el: null };
const HL_RED = 0xff3b3b, HL_AMBER = 0xffb300, HL_GREEN = 0x6fe39a, HL_GREY = 0x56607a, HL_WATER = 0x3aa0ff;
const hlTop = () => [...current.root.dirs.values()];

// district -> 'storm' | 'clear' from the last run of the tests that speak for it
function hlWeather() {
  const w = new Map();
  for (const j of jb.list) {
    if (j.kind !== 'test' || !j.district) continue;
    if (j.state === 'hiba') w.set(j.district, 'storm');
    else if (j.state === 'kész' && w.get(j.district) !== 'storm') w.set(j.district, 'clear');
  }
  return w;
}
// the repo files a failing log names, in order (a path, absolute or repo-relative, with an extension; :line kept)
function hlTunnelOf(lines) {
  const root = (kv.root || '').replace(/\\/g, '/').toLowerCase(), by = new Map(current.city.files.map((f, i) => [f.p.toLowerCase(), i]));
  const out = [], seen = new Set();
  for (const line of lines) {
    // no spaces inside a path: '    at CodeCity/core.js:41' must give CodeCity/core.js
    for (const m of line.matchAll(/((?:[A-Za-z]:)?[\\/]?(?:[\w.@-]+[\\/])+[\w.@-]+\.[A-Za-z0-9]{1,5})(?::(\d+))?/g)) {
      let p = m[1].replace(/\\/g, '/');
      if (root && p.toLowerCase().startsWith(root + '/')) p = p.slice(root.length + 1);
      p = p.replace(/^\.?\//, '');
      const i = by.get(p.toLowerCase());
      if (i === undefined || seen.has(i)) continue;
      seen.add(i); out.push({ i, line: m[2] ? +m[2] : null });
    }
  }
  return out.slice(0, 12);
}
function hlDraw() {
  if (!world) return;
  if (hl.group) { world.group.remove(hl.group); hl.group.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
  hl.group = new THREE.Group();
  const k = agScale(), weather = hlWeather(), by = new Map(current.city.files.map((f, i) => [f.p, i]));
  const centre = i => { const f = current.city.files[i]; return new THREE.Vector3(f.rect.x + f.rect.w / 2, 0, f.rect.z + f.rect.h / 2); };
  const stale = new Set(hl.pipes.filter(p => p.stale).map(p => p.out.split('/')[0]));
  for (const d of hlTop()) {
    if (!d.rect) continue;
    const { x, z, w, h } = d.rect, c = new THREE.Vector3(x + w / 2, 0, z + h / 2), wx = weather.get(d.path);
    if (wx === 'storm') {   // a dark cloud and rain over the district
      const cloud = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, 1.5 * k, h * 0.9), new THREE.MeshBasicMaterial({ color: 0x1a1d2a, transparent: true, opacity: 0.75, fog: false }));
      cloud.position.set(c.x, 40 * k, c.z);
      const rain = [];
      for (let n = 0; n < 60; n++) { const rx = x + Math.random() * w, rz = z + Math.random() * h, ry = Math.random() * 36 * k; rain.push(new THREE.Vector3(rx, ry + 3 * k, rz), new THREE.Vector3(rx, ry, rz)); }
      const drops = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(rain), new THREE.LineBasicMaterial({ color: 0x6a8cff, transparent: true, opacity: 0.6, fog: false }));
      const bolt = new THREE.Line(new THREE.BufferGeometry().setFromPoints([c.clone().setY(39 * k), c.clone().add(new THREE.Vector3(2 * k, 26 * k, 1 * k)), c.clone().add(new THREE.Vector3(-1 * k, 14 * k, 0)), c.clone().setY(4 * k)]),
        new THREE.LineBasicMaterial({ color: HL_RED, fog: false }));
      hl.group.add(cloud, drops, bolt);
    }
    // the inspector's lamp
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(1.1 * k, 12, 8), new THREE.MeshBasicMaterial({ fog: false,
      color: wx === 'storm' ? HL_RED : stale.has(d.path) ? HL_AMBER : wx === 'clear' ? HL_GREEN : HL_GREY }));
    lamp.position.set(x + 2 * k, d.depth * PLATE + 3 * k, z + 2 * k);
    hl.group.add(lamp);
  }
  // pipes under the city; a stale one floods its page's plot
  for (const p of hl.pipes) {
    const o = by.get(p.out), sd = agDir(p.src) || agDir(p.src.split('/')[0]);
    if (o === undefined || !sd || !sd.rect) continue;
    const a = new THREE.Vector3(sd.rect.x + sd.rect.w / 2, -2 * k, sd.rect.z + sd.rect.h / 2), b = centre(o).setY(-2 * k);
    hl.group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([a.clone().setY(0), a, b, b.clone().setY(0)]),
      new THREE.LineBasicMaterial({ color: p.stale ? HL_WATER : 0x2f3a5a, fog: false })));
    if (p.stale) {
      const f = current.city.files[o], pad = 3 * k;
      const water = new THREE.Mesh(new THREE.BoxGeometry(f.rect.w + 2 * pad, 0.6 * k, f.rect.h + 2 * pad), new THREE.MeshBasicMaterial({ color: HL_WATER, transparent: true, opacity: 0.45, fog: false }));
      water.position.copy(centre(o)).setY(f.base + 0.3 * k);
      hl.group.add(water);
    }
  }
  // the repair tunnel: down from each named building, joined underground, red
  if (hl.tunnel.length) {
    const pts = [];
    hl.tunnel.forEach((t, n) => { const c = centre(t.i); if (n === 0) pts.push(c.clone().setY(0)); pts.push(c.clone().setY(-5 * k)); });
    const last = centre(hl.tunnel[hl.tunnel.length - 1].i);
    pts.push(last.setY(0));
    hl.group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: HL_RED, fog: false })));
    for (const t of hl.tunnel) { const s2 = new THREE.Mesh(new THREE.CylinderGeometry(0.5 * k, 0.5 * k, 5 * k, 8), new THREE.MeshBasicMaterial({ color: HL_RED, fog: false })); s2.position.copy(centre(t.i)).setY(-2.5 * k); hl.group.add(s2); }
    livePulse(hl.tunnel.map(t => t.i));
  }
  hl.group.traverse(o => { o.raycast = () => {}; });
  world.group.add(hl.group);
  requestRender();
}

// ---- the Now ribbon
function hlAdvisors() {
  const out = [];
  for (const j of jb.list.filter(j => j.state === 'hiba')) {
    const t = j.kind === 'test' ? hl.tunnel : [];
    out.push({ c: 'red', text: `${j.name}: elbukott${t.length ? ' — javító alagút: ' + t.map(x => current.city.files[x.i].name + (x.line ? ':' + x.line : '')).join(' → ') : ''}`, act: 'jobs' });
  }
  const wait = ag.list.filter(a => agBay(a.state) === 'var');
  if (wait.length) out.push({ c: 'amber', text: `${hu(wait.length)} Claude-munkamenet rád vár: ${wait.map(a => a.name || a.id).slice(0, 2).join(', ')}`, act: 'hall' });
  const clash = fen.list.filter(f => f.conflict);
  if (clash.length) out.push({ c: 'red', text: `Ütközés: ${clash.slice(0, 2).map(f => f.p).join(', ')}${clash.length > 2 ? ' és még ' + (clash.length - 2) : ''}`, act: 'hall' });
  if (ag.alerts.length) out.push({ c: 'red', text: `Korlátozott zóna: ${ag.alerts[0].zone}`, act: 'hall' });
  if (pw.net && !pw.net.internet.up) out.push({ c: 'amber', text: 'A Határ zárva: nincs internet — minden helyi tovább működik', act: 'news' });
  for (const p of hl.pipes.filter(p => p.stale)) out.push({ c: 'amber', text: `Elavult build: ${p.name} (${p.newest} újabb) — Üzemek → ${p.job ? 'build' : 'kézzel'}`, act: 'jobs' });
  return out.slice(0, 4);
}
function hlRibbon() {
  if (!current) return;
  if (!hl.el) {
    hl.el = document.createElement('div'); hl.el.id = 'now'; hl.el.setAttribute('aria-live', 'polite');
    hl.el.addEventListener('click', e => { const a = e.target.closest('[data-act]'); if (!a) return; if (a.dataset.act === 'jobs') jbToggle(true); else if (a.dataset.act === 'hall') agToggle(true); else if (a.dataset.act === 'news') liveNews(); });
    document.body.append(hl.el);
  }
  const claude = ag.list.filter(a => agBay(a.state) === 'dolgozik').length, servers = jb.list.filter(j => j.kind === 'server' && j.state.startsWith('fut')).length;
  const busy = jb.list.filter(j => j.kind !== 'server' && j.state === 'fut').length;
  const run = [claude && `${hu(claude)} Claude dolgozik`, servers && `${hu(servers)} szerver fut`, busy && `${hu(busy)} build/teszt fut`].filter(Boolean).join(' · ');
  const adv = hlAdvisors();
  const changed = [live.since.length && `${hu(live.since.length)} új commit`, live.fs.size && `${hu(live.fs.size)} fájl változik élőben`].filter(Boolean).join(' · ');
  hl.el.innerHTML = (run ? `<div class="l run"><b>Most</b> ${esc(run)}</div>` : '') +
    adv.map(a => `<div class="l adv ${a.c}" data-act="${a.act}"><b>Rád vár</b> ${esc(a.text)}</div>`).join('') +
    (changed ? `<div class="l chg" data-act="news"><b>Változott</b> ${esc(changed)}</div>` : '');
  hl.el.hidden = !hl.el.innerHTML;
}
function pipesEvent(d) { hl.pipes = d.list || []; hlDraw(); hlRibbon(); }
// a test that failed: its tunnel from the log; one that passed again: the tunnel goes
function hlJobChanged(st) {
  if (st.kind === 'test' && st.state === 'hiba') hl.tunnel = hlTunnelOf(jb.logs.get(st.id) || []);
  else if (st.kind === 'test' && st.state === 'kész' && !jb.list.some(j => j.kind === 'test' && j.state === 'hiba')) hl.tunnel = [];
  hlDraw(); hlRibbon();
}

// 28-metro.js — git made visible (P7, KV-16; report §5.2, §5.4). Each branch beside the main one is a metro
// line floating over the city in its own colour: its stations are the files it changed. A branch checked out in
// a worktree also gets a twin island off the west shore, joined to the city by a bridge as wide as it is ahead +
// behind. The Metró panel: per line — ahead/behind, its commits, a read-only merge preview (git merge-tree:
// stations both sides touched turn amber, conflicts red) and "Kérd Claude-ot összefésülni" (a pre-filled prompt;
// the city itself never merges, CITY-D10 A). The reflog lane: a slider through where HEAD has been; scrubbing it
// moves the timeline to that commit when the city knows it.

const mt = { map: null, preview: null, el: null, group: null, open: null };
const mtColor = name => new THREE.Color().setHSL(agHue('br:' + name), 0.7, 0.58);

async function mtLoad() {
  await kvReady();
  if (!kv.match) return;
  try { const r = await fetch('/api/gitmap'); if (r.ok) mt.map = await r.json(); } catch (e) { /* the segéd is gone */ }
  mtDraw(); mtPanel();
}
function mtDraw() {
  if (!world) return;
  if (mt.group) { world.group.remove(mt.group); mt.group.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
  mt.group = new THREE.Group();
  if (!mt.map) return;
  const k = agScale(), s = current.side, by = new Map(current.city.files.map((f, i) => [f.p, i]));
  const both = new Set(mt.preview ? mt.preview.both : []), clash = new Set(mt.preview ? mt.preview.conflicts : []);
  mt.map.branches.forEach((b, n) => {
    const col = mtColor(b.name), y = 46 * k + n * 6 * k;
    // stations: the branch's files the city knows, in the order a walk west -> east meets them
    const st = b.files.map(f => by.get(f)).filter(i => i !== undefined).map(i => current.city.files[i])
      .map(f => ({ f, at: new THREE.Vector3(f.rect.x + f.rect.w / 2, y, f.rect.z + f.rect.h / 2) })).sort((a, c) => a.at.x - c.at.x || a.at.z - c.at.z);
    if (st.length > 1) mt.group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(st.map(x => x.at)), new THREE.LineBasicMaterial({ color: col, fog: false })));
    for (const x of st) {
      const hot = mt.preview && mt.preview.branch === b.name && (clash.has(x.f.p) ? 0xff3b3b : both.has(x.f.p) ? 0xffb300 : 0);
      const ball = new THREE.Mesh(new THREE.SphereGeometry(1.3 * k, 12, 8), new THREE.MeshBasicMaterial({ color: hot || col, fog: false }));
      ball.position.copy(x.at);
      const drop = new THREE.Line(new THREE.BufferGeometry().setFromPoints([x.at, x.at.clone().setY(x.f.base + replay.cur[x.f.i * 3])]),
        new THREE.LineDashedMaterial({ color: hot || col, dashSize: k, gapSize: k, fog: false }));
      drop.computeLineDistances();
      mt.group.add(ball, drop);
    }
    // a worktree on this branch: a twin island off the west shore, a bridge as wide as ahead + behind
    const wt = mt.map.worktrees.find(w => !w.main && w.branch === b.name);
    if (wt) {
      const iz = -s / 2 + s * (0.2 + 0.18 * n), ix = -s / 2 - s * 0.32, size = s * 0.12;
      const island = new THREE.Mesh(new THREE.BoxGeometry(size, 1.2 * k, size), new THREE.MeshBasicMaterial({ color: col.clone().multiplyScalar(0.55), fog: false }));
      island.position.set(ix, 0.6 * k, iz);
      const span = (-s / 2) - (ix + size / 2), wdt = Math.max(0.6 * k, Math.min(size * 0.8, (b.ahead + b.behind) * 0.4 * k));
      const bridge = new THREE.Mesh(new THREE.BoxGeometry(span, 0.4 * k, wdt), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.7, fog: false }));
      bridge.position.set(ix + size / 2 + span / 2, 0.8 * k, iz);
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: jbLabel(`+${b.ahead} −${b.behind}`, '#' + col.getHexString()), fog: false, depthWrite: false }));
      sp.position.set(ix, 6 * k, iz); sp.scale.set(8 * k, 4 * k, 1);
      mt.group.add(island, bridge, sp);
    }
  });
  mt.group.traverse(o => { o.raycast = () => {}; });
  world.group.add(mt.group);
  requestRender();
}

function mtPanel() {
  const btn = $('metro-btn');
  btn.hidden = !mt.map;
  if (!mt.map) return;
  btn.textContent = 'Metró' + (mt.map.branches.length ? ' ' + mt.map.branches.length : '');
  if (!mt.el || mt.el.hidden) return;
  const m = mt.map, pv = mt.preview;
  const line = b => {
    const c = '#' + mtColor(b.name).getHexString(), wt = m.worktrees.find(w => !w.main && w.branch === b.name);
    const p = pv && pv.branch === b.name ? pv : null;
    return `<div class="line" data-br="${esc(b.name)}"><div class="hd"><i style="background:${c}"></i><b>${esc(b.name)}</b>` +
      `<span class="dim">${hu(b.ahead)} előre · ${hu(b.behind)} le van maradva · ${hu(b.files.length)} állomás${wt ? ' · worktree: ' + esc(wt.name) : ''}</span></div>` +
      `<div class="row"><button class="btn" data-pv>Összefésülés előnézete</button><button class="btn" data-ask title="Claude Code nyílik, a prompt előtöltve — nem küldi el magától">Kérd Claude-ot összefésülni</button></div>` +
      (p ? `<div class="pv ${p.clean ? 'ok' : 'bad'}">${p.clean ? 'Tisztán összefésülhető' : hu(p.conflicts.length) + ' ütközés: ' + p.conflicts.map(esc).join(', ')}` +
        `${p.both.length ? ` · mindkét oldal módosította: ${p.both.map(esc).join(', ')}` : ''}<span class="dim"> — csak előnézet (git merge-tree), semmi nem változott</span></div>` : '') +
      `<ul class="kv-hist">${b.commits.slice(0, 8).map(c2 => `<li>${new Date(c2.t * 1000).toLocaleDateString('hu-HU')} <span class="dim">${esc(c2.h)}</span> ${esc(c2.s)}</li>`).join('')}</ul></div>`;
  };
  mt.el.innerHTML = '<span class="x" title="Bezárás">×</span><h3>Metró — ágak, worktree-k, reflog</h3>' +
    (m.branches.length ? m.branches.map(line).join('') : `<p class="dim">Csak a ${esc(m.main)} ág van — nincs más vonal.</p>`) +
    `<h4>Reflog-sáv — hol járt a ${esc(m.main)}</h4><input type="range" class="rl" min="0" max="${Math.max(0, m.reflog.length - 1)}" value="0" aria-label="Reflog">` +
    `<div class="rlnow dim"></div>`;
  mtReflog(0);
}
function mtReflog(k) {
  const e = mt.map && mt.map.reflog[k], out = mt.el && mt.el.querySelector('.rlnow');
  if (!e || !out) return;
  const ci = current.city.commits.findIndex(c => c[4] === e.h);
  out.innerHTML = `${esc(e.gd)} · ${new Date(e.t * 1000).toLocaleString('hu-HU')} · <b>${esc(e.h)}</b> ${esc(e.s)}` + (ci < 0 ? ' <span class="dim">(ezt a commitot a város nem ismeri)</span>' : '');
  if (ci >= 0) { tlPause(); applyTime(ci, 200); }
}
function mtToggle(force) {
  if (!mt.el) {
    mt.el = document.createElement('aside'); mt.el.id = 'metro'; mt.el.hidden = true;
    mt.el.addEventListener('click', async e => {
      if (e.target.closest('.x')) return mtToggle(false);
      const ln = e.target.closest('[data-br]'), br = ln && ln.dataset.br;
      if (!br) return;
      if (e.target.closest('[data-pv]')) {
        const r = await fetch('/api/merge-preview?branch=' + encodeURIComponent(br)), j = await r.json();
        if (!r.ok) return kvToast(j.error || 'Az előnézet nem sikerült');
        mt.preview = j; mtDraw(); mtPanel();
      } else if (e.target.closest('[data-ask]')) {
        const pv = mt.preview && mt.preview.branch === br ? mt.preview : null;
        selAskClaude(`Fésüld össze a(z) ${br} ágat a(z) ${mt.map.main} ágba ebben a repóban. Előtte nézd meg, mit hoz (git log ${mt.map.main}..${br}, git diff ${mt.map.main}...${br}), ` +
          `és magyarázd el egyszerűen, mi fog változni${pv && !pv.clean ? `; ütközés várható itt: ${pv.conflicts.join(', ')}` : ''}. Csak akkor fésüld össze, ha egyetértek; ne pusholj.`);
      }
    });
    mt.el.addEventListener('input', e => { if (e.target.classList.contains('rl')) mtReflog(+e.target.value); });
    document.body.append(mt.el);
  }
  mt.el.hidden = force === undefined ? !mt.el.hidden : !force;
  if (!mt.el.hidden) mtLoad();
}
$('metro-btn').onclick = () => mtToggle();

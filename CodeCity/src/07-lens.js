// 07-lens.js — lenses as LOOKS on keys 1–6 (God's Eye View's sensor styles, re-thought for code):
// each lens recolours the buildings AND changes the night around them — window light, body glow,
// plates, sky and fog — so you can tell which question the city is answering at a glance.
// Time-aware lenses (heat, agent, age) are evaluated at the commit being shown.
// Also here: cranes on the hottest buildings (any lens).

const IRONBOW = [[0, 0x0b0420], [0.25, 0x4a0a7a], [0.5, 0xc2185b], [0.7, 0xff6f00], [0.88, 0xffd54f], [1, 0xfffbe6]];
const OWNER_COLORS = [0xe8734a, 0x4f8fe6, 0x5fc4a8, 0xf2c94c, 0x9b6fe0, 0xd0567a, 0x90a080, 0x5ad0e6];
const _c1 = new THREE.Color(), _c2 = new THREE.Color();
function ramp(stops, t) {
  t = Math.min(1, Math.max(0, t));
  for (let i = 1; i < stops.length; i++) if (t <= stops[i][0]) {
    const [a, ca] = stops[i - 1], [b, cb] = stops[i];
    return _c1.setHex(ca).lerp(_c2.setHex(cb), (t - a) / (b - a || 1)).clone();
  }
  return new THREE.Color(stops[stops.length - 1][1]);
}
const hex = c => '#' + c.getHexString();

// ---- the lenses. color(f, i, ctx) -> THREE.Color; legend() -> html
const LENSES = [
  { key: '1', id: 'alap', name: 'Alap', group: '', sky: '', horizon: 0x1b2442, plate: [0.64, 0.25, 0.07],
    win: 0xffc76b, gain: 1.1, glow: 0, time: false,
    color: () => new THREE.Color(0x5d6274),
    legend: () => `<b>Alap</b><div class="dim">ablakok: friss munka világít</div>` },
  { key: '2', id: 'ho', name: 'Hő', group: 'Idő', sky: 'lens-heat', horizon: 0x14061f, plate: [0.75, 0.5, 0.05],
    win: 0xfff1c8, gain: 0.25, glow: 0.55, time: true,
    color: (f, i, x) => ramp(IRONBOW, x.heat[i] / x.maxHeat),
    legend: () => `<b>Hő — friss változás</b><div class="ramp" style="background:linear-gradient(90deg,${IRONBOW.map(([t, c]) => hex(new THREE.Color(c)) + ' ' + t * 100 + '%').join(',')})"></div><div class="ends"><span>hideg</span><span>forró</span></div><div class="dim">utolsó ${HEAT_WINDOW()} commit</div>` },
  { key: '3', id: 'kor', name: 'Kor', group: 'Idő', sky: 'lens-noir', horizon: 0x15151a, plate: [0, 0, 0.08],
    win: 0xf3ead6, gain: 0.9, glow: 0.12, time: true,
    color: (f, i) => _c1.setHex(0xe8dcc0).lerp(_c2.setHex(0x26262b), Math.sqrt(ageOf(i))).clone(),
    legend: () => `<b>Kor — utolsó érintés</b><div class="ramp" style="background:linear-gradient(90deg,#e8dcc0,#8a8578,#26262b)"></div><div class="ends"><span>friss</span><span>régi</span></div><div class="dim">rom: 2 éve érintetlen</div>` },
  { key: '4', id: 'ugynok', name: 'Ügynök', group: 'Emberek', sky: 'lens-nvg', horizon: 0x061a0c, plate: [0.38, 0.5, 0.05],
    win: 0xb6ffc8, gain: 0.7, glow: 0.35, time: true,
    color: (f, i) => { const s = agentShareOf(i); return s ? _c1.setHex(0x173b22).lerp(_c2.setHex(0x7dff9a), 0.25 + 0.75 * s).clone() : new THREE.Color(0x1a221c); },
    legend: () => `<b>Ügynök-arány</b><div class="ramp" style="background:linear-gradient(90deg,#1a221c,#2a6a3c,#7dff9a)"></div><div class="ends"><span>nincs adat</span><span>100 %</span></div><div class="dim">Co-Authored-By alapján</div>` },
  { key: '5', id: 'tulaj', name: 'Tulaj', group: 'Emberek', sky: '', horizon: 0x1b2442, plate: [0.64, 0.25, 0.07],
    win: 0xffc76b, gain: 0.9, glow: 0.05, time: false,
    color: f => new THREE.Color(f.own >= 0 && f.own < OWNER_COLORS.length ? OWNER_COLORS[f.own] : 0x707a90).multiplyScalar(0.62),
    legend: () => '<b>Fő szerző</b>' + current.city.authors.slice(0, OWNER_COLORS.length).map((a, i) => `<div><i style="background:${hex(new THREE.Color(OWNER_COLORS[i]))}"></i>${esc(a)}</div>`).join('') },
  { key: '6', id: 'nyelv', name: 'Nyelv', group: 'Szerkezet', sky: '', horizon: 0x1b2442, plate: [0.64, 0.25, 0.07],
    win: 0xffc76b, gain: 1.1, glow: 0, time: false,
    color: f => new THREE.Color(langColor(f.lang)).multiplyScalar(0.62),
    legend: () => {
      const by = {};
      for (const f of current.city.files) if (!f.gone) by[f.lang] = (by[f.lang] || 0) + f.loc;
      return '<b>Nyelv</b>' + Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 9)
        .map(([l]) => `<div><i style="background:#${langColor(l).toString(16).padStart(6, '0')}"></i>${esc(l)}</div>`).join('');
    } },
];
let lens = LENSES.find(l => l.id === 'alap');   // CITY-D6: the plain Git City night is the default   // Nyelv: the look approved at the C3 check stays the default

function lensApply() {
  if (!world) return;
  const files = current.city.files, b = world.buildings;
  const heat = heatCounts(), ctx = { heat, maxHeat: Math.max(1, ...heat) };   // cranes need heat in every lens
  const delta = compareDeltas();   // 14-compare: when a base is pinned, the change since it wins over the lens
  files.forEach((f, i) => { world.baseColor[i] = (delta && compareColor(i, delta)) || lens.color(f, i, ctx); b.setColorAt(i, world.baseColor[i]); });
  if (hovered >= 0) b.setColorAt(hovered, _c1.copy(world.baseColor[hovered]).lerp(_c2.setHex(0xffffff), 0.55));
  b.instanceColor.needsUpdate = true;
  const u = b.material.userData.uniforms;
  u.uWinColor.value.setHex(lens.win); u.uWinGain.value = delta ? 0.3 : lens.gain; u.uBodyGlow.value = delta ? 0.4 : lens.glow;
  const [ph, ps, pl] = lens.plate;
  world.dirOf.forEach((d, i) => world.plates.setColorAt(i, _c1.setHSL(ph, ps, pl + Math.min(d.depth, 6) * 0.025)));
  world.plates.instanceColor.needsUpdate = true;
  scene.fog.color.setHex(lens.horizon);
  const st = $('stage');
  st.classList.remove('lens-heat', 'lens-nvg', 'lens-noir');
  if (lens.sky) st.classList.add(lens.sky);
  st.style.setProperty('--horizon', hex(new THREE.Color(lens.horizon)));
  $('legend').innerHTML = delta ? compareLegend(delta) : lens.legend();
  document.querySelectorAll('#lenses button').forEach(x => x.classList.toggle('on', x.dataset.lens === lens.id));
  placeCranes(ctx);
  compareGhosts(delta);
  requestRender();
}

function setLens(id) {
  const l = LENSES.find(x => x.id === id || x.key === id);
  if (!l) return;
  lens = l;
  lensApply();
  writeHashSoon();
}

// ---- cranes: a mast and a jib on buildings with heavy recent churn (top of the heat ranking)
let cranes = null;
function placeCranes(ctx) {
  if (!cranes) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffb547 });
    const mast = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), mat, 64);
    const jib = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0.3, 0, 0), mat, 64);
    mast.raycast = jib.raycast = () => {};       // cranes are decoration: never steal a pick
    cranes = { mast, jib };
    scene.add(mast, jib);
  }
  const files = current.city.files, heat = ctx.heat, max = ctx.maxHeat;
  const hot = files.map((f, i) => i).filter(i => heat[i] >= Math.max(3, max * 0.6) && stateAt(files[i], i, replay.T)[0] > 0)
    .sort((a, b) => heat[b] - heat[a]).slice(0, 64);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  hot.forEach((i, n) => {
    // placed where the building is going (the tween target), not where it is mid-animation
    const f = files[i], { x, z, w, h: d } = f.rect, [bh, s] = stateAt(f, i, replay.T), top = f.base + bh;
    const size = Math.min(8, Math.max(1.5, Math.min(w, d) * s)), mh = 1.5 + size * 0.6, t = Math.max(0.12, size * 0.04);
    m.makeScale(t, mh, t).setPosition(x + w / 2, top, z + d / 2);
    cranes.mast.setMatrixAt(n, m);
    q.setFromAxisAngle(up, (i * 2.399) % (Math.PI * 2));      // golden-angle spread: cranes do not all point one way
    m.compose(new THREE.Vector3(x + w / 2, top + mh, z + d / 2), q, new THREE.Vector3(size * 1.1, t, t));
    cranes.jib.setMatrixAt(n, m);
  });
  cranes.mast.count = cranes.jib.count = hot.length;
  cranes.mast.instanceMatrix.needsUpdate = cranes.jib.instanceMatrix.needsUpdate = true;
}

// ---- lens bar, grouped like God's Eye View's layer panel
function lensBar() {
  const groups = [...new Set(LENSES.map(l => l.group))];
  $('lenses').innerHTML = groups.map(g => `<span class="grp">${g ? `<small>${g}</small>` : ''}${LENSES.filter(l => l.group === g)
    .map(l => `<button class="btn" data-lens="${l.id}" title="${l.name} (${l.key})"><kbd>${l.key}</kbd>${l.name}</button>`).join('')}</span>`).join('')
    + '<span class="grp"><small>Kapcsolatok</small><button id="roads-btn" class="btn" title="Minden import-út (U)"><kbd>U</kbd>Utak</button></span>';
  $('lenses').onclick = e => { const bt = e.target.closest('button'); if (bt) setLens(bt.dataset.lens); };
}
lensBar();
addEventListener('keydown', e => {
  if (!current || e.ctrlKey || e.metaKey || e.altKey || e.target.closest('input:not([type=range]), textarea')) return;
  if (/^[1-6]$/.test(e.key)) setLens(e.key);
});

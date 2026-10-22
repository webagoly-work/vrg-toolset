// 14-compare.js — Összevetés: pin a base commit, then the city shows the change from base to the
// shown commit (CodeCharta's delta map): green grew · red shrank · bright green new · grey unchanged,
// and files deleted since the base stand as red glass ghosts. Lines are numstat running sums at both
// ends, so the two sides are measured the same way. Δ pins/unpins; the strip marks the base in red.

const compare = { base: null, ghosts: null };
const GROW = 0x5fe08a, SHRINK = 0xff5a5a, NEW = 0xb6ffc8, SAME = 0x3a3f4f;

const locAtT = (i, T) => { const k = countUpTo(replay.touch[i], T); return k ? replay.locAt[i][k - 1] : 0; };
const aliveAt = (i, T) => stateAt(current.city.files[i], i, T)[0] > 0;

// null when no base is pinned; else per file: {kind: 'new'|'gone'|'diff'|'none', d}
function compareDeltas() {
  if (compare.base === null || !current) return null;
  const B = compare.base, T = replay.T, files = current.city.files;
  const out = files.map((f, i) => {
    const a = aliveAt(i, B), b = aliveAt(i, T);
    if (!a && !b) return { kind: 'none', d: 0 };
    if (!a) return { kind: 'new', d: locAtT(i, T) };
    if (!b) return { kind: 'gone', d: -locAtT(i, B) };
    return { kind: 'diff', d: locAtT(i, T) - locAtT(i, B) };
  });
  out.maxAbs = Math.max(1, ...out.filter(x => x.kind === 'diff').map(x => Math.abs(x.d)));
  return out;
}

function compareColor(i, delta) {
  const x = delta[i];
  if (x.kind === 'new') return new THREE.Color(NEW);
  if (x.kind !== 'diff') return null;
  if (!x.d) return new THREE.Color(SAME);
  const k = 0.35 + 0.65 * Math.log2(1 + Math.abs(x.d)) / Math.log2(1 + delta.maxAbs);
  return new THREE.Color(SAME).lerp(new THREE.Color(x.d > 0 ? GROW : SHRINK), k);
}

function compareLegend(delta) {
  const n = k => delta.filter(x => x.kind === k).length;
  const up = delta.filter(x => x.kind === 'diff' && x.d > 0).length, down = delta.filter(x => x.kind === 'diff' && x.d < 0).length;
  const c = current.city.commits, bc = c[compare.base], tc = c[replay.T];
  const sw = h => `<i style="background:#${h.toString(16).padStart(6, '0')}"></i>`;
  return `<b>Összevetés</b><div class="dim">${bc[4]} → ${tc ? tc[4] : 'most'}</div>`
    + `<div>${sw(NEW)}új: ${hu(n('new'))}</div><div>${sw(GROW)}nőtt: ${hu(up)}</div><div>${sw(SHRINK)}csökkent: ${hu(down)}</div>`
    + `<div>${sw(0x8a2a2a)}törölt (szellem): ${hu(n('gone'))}</div><div>${sw(SAME)}változatlan</div>`;
}

// red glass where a file stood at the base but is gone now
function compareGhosts(delta) {
  if (!compare.ghosts) {
    compare.ghosts = new THREE.InstancedMesh(unitBox, new THREE.MeshBasicMaterial({ color: SHRINK, transparent: true, opacity: 0.22, depthWrite: false }), Math.max(1, current.city.files.length));
    compare.ghosts.raycast = () => {};
    scene.add(compare.ghosts);
  }
  const g = compare.ghosts, m = new THREE.Matrix4(), files = current.city.files;
  let n = 0;
  if (delta) files.forEach((f, i) => {
    if (delta[i].kind !== 'gone' || n >= g.instanceMatrix.count) return;
    const [h, s] = stateAt(f, i, compare.base), { x, z, w, h: d } = f.rect;
    g.setMatrixAt(n++, m.makeScale(w * s, h, d * s).setPosition(x + w / 2, f.base, z + d / 2));
  });
  g.count = n;
  g.instanceMatrix.needsUpdate = true;
}

function setBase(B) {
  compare.base = B === null || B === undefined ? null : Math.max(0, Math.min(replay.last, B));
  $('tl-base').classList.toggle('on', compare.base !== null);
  $('tl-base').title = compare.base === null ? 'Összevetés: a mostani commit lesz a bázis (B)' : `Bázis: ${current.city.commits[compare.base][4]} — kattintásra megszűnik (B)`;
  lensApply(); drawStrip(); writeHashSoon();
}
$('tl-base').onclick = () => setBase(compare.base === null ? replay.T : null);
addEventListener('keydown', e => {
  if (!current || e.ctrlKey || e.metaKey || e.altKey || e.target.closest('input:not([type=range]), textarea, select')) return;
  if (e.key === 'b' || e.key === 'B') setBase(compare.base === null ? replay.T : null);
});

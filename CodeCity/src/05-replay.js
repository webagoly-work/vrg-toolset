// 05-replay.js — the city at commit T: which files exist, how tall, how wide, how lit.
// Height = commits so far, footprint = lines so far (inside the fixed plot), windows = recency on
// the clock at T. Between commits the city is tweened, not jumped (God's Eye View interpolates
// its live feeds the same way). The plot itself never moves — that is the layout's promise.
// replay.cur holds [height, footprint scale, lit] per file; height 0 = does not exist at T.

const replay = { T: -1, last: -1, touch: [], locAt: [], cur: new Float32Array(0), flash: new Float32Array(0), raf: 0 };

function replayPrepare(model) {
  const { files, commits } = model.city;
  const touch = files.map(() => []), delta = files.map(() => []);
  commits.forEach((c, ci) => {
    const ch = c[5];
    for (let i = 0; i < ch.length; i += 3) { touch[ch[i]].push(ci); delta[ch[i]].push(ch[i + 1] - ch[i + 2]); }
  });
  replay.touch = touch;
  replay.locAt = delta.map(d => { let s = 0; return d.map(x => (s = Math.max(0, s + x))); }); // LOC after each touch
  replay.last = Math.max(0, commits.length - 1);   // an empty history still shows "now"
  replay.T = -1;
  replay.cur = new Float32Array(files.length * 3);
  replay.flash = new Float32Array(files.length);
}

// number of entries in sorted a that are <= t
function countUpTo(a, t) { let lo = 0, hi = a.length; while (lo < hi) { const m = (lo + hi) >> 1; if (a[m] <= t) lo = m + 1; else hi = m; } return lo; }

function litAt(ci, T) {
  const c = current.city.commits;
  if (ci < 0 || !c[T]) return 0.06;
  const span = Math.max(1, c[T][0] - c[0][0]);
  const r = Math.max(0, 1 - (c[T][0] - c[ci][0]) / span);
  return 0.06 + 0.86 * r * r;
}

// [height, footprint scale, lit] of file i at commit T (T = replay.last means "now", from disk)
function stateAt(f, i, T) {
  const now = T >= replay.last, tl = replay.touch[i], k = countUpTo(tl, T);
  if (f.gone ? f.goneAt <= T || k === 0 : k === 0 && !(now || tl.length === 0)) return [0, 0, 0];
  const n = now ? f.n : k;
  const loc = now ? f.loc : replay.locAt[i][k - 1];
  const s = Math.sqrt(Math.min(1, Math.max(0.15, loc / Math.max(1, f.maxLoc))));
  return [heightN(n), s, litAt(k ? tl[k - 1] : -1, T)];
}

const _m = new THREE.Matrix4();
function writeInstances(vals) {
  const b = world.buildings, files = current.city.files, lit = b.geometry.attributes.aLit, fl = b.geometry.attributes.aFlash;
  for (let i = 0; i < files.length; i++) {
    const h = vals[i * 3], s = vals[i * 3 + 1], { x, z, w, h: d } = files[i].rect;
    if (h <= 0) _m.makeScale(0, 0, 0);
    else _m.makeScale(w * s, h, d * s).setPosition(x + w / 2, files[i].base, z + d / 2);
    b.setMatrixAt(i, _m);
    lit.array[i] = vals[i * 3 + 2];
    fl.array[i] = replay.flash[i];
  }
  b.instanceMatrix.needsUpdate = lit.needsUpdate = fl.needsUpdate = true;
  b.boundingSphere = null; b.boundingBox = null;   // raycast recomputes them from the new matrices
  replay.cur.set(vals);
  placeBeacon();
}

// show commit T; animate = tween length in ms (0 = jump)
function applyTime(T, animate = 0) {
  T = Math.max(0, Math.min(replay.last, T));
  const files = current.city.files, target = new Float32Array(files.length * 3);
  for (let i = 0; i < files.length; i++) target.set(stateAt(files[i], i, T), i * 3);
  // roof flash: the files this commit touched; older flashes fade as the replay moves on
  // (a plain jump to "now" shows no flash: the present city has no current commit to point at)
  for (let i = 0; i < replay.flash.length; i++) replay.flash[i] *= 0.45;
  if (animate || T < replay.last) { const ch = (current.city.commits[T] || [])[5] || []; for (let i = 0; i < ch.length; i += 3) replay.flash[ch[i]] = 1; }
  else replay.flash.fill(0);
  replay.T = T;
  cancelAnimationFrame(replay.raf);
  if (!animate || replay.cur.every(v => v === 0)) { writeInstances(target); onTimeChanged(); return; }
  const from = replay.cur.slice(), t0 = performance.now(), tmp = new Float32Array(target.length);
  const step = now => {
    const k = Math.min(1, (now - t0) / animate), e = k * (2 - k);   // ease-out
    for (let j = 0; j < tmp.length; j++) {
      // a building being born grows from the ground; one disappearing sinks into it
      tmp[j] = from[j] + (target[j] - from[j]) * e;
    }
    writeInstances(k < 1 ? tmp : target);
    if (k < 1) replay.raf = requestAnimationFrame(step);
  };
  replay.raf = requestAnimationFrame(step);
  onTimeChanged();
}
let onTimeChanged = () => {};   // 06-timeline and 04-ui hook in

// the file at the shown commit, for the info panel: [commits so far, lines so far] or null at "now"
function fileAtT(f) {
  if (replay.T >= replay.last) return null;
  const k = countUpTo(replay.touch[f.i], replay.T);
  return [k, k ? replay.locAt[f.i][k - 1] : 0];
}

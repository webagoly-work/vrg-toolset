// 30-scene.js — the building as three.js objects, coloured only from the design tokens.
//
// Rules from the design system (README "The levelled stack"):
// - levels are pulled apart (EXPLODE); a level outside the work is a ghost at opacity-ghost,
//   never pickable; an empty level never reaches the model at all;
// - everything is linework: room slabs, translucent walls with hairline edges;
// - the halo and the lit circuit draw last, depth test off, so no floor can hide them (50-halo).

const S = { scene: null, root: null, pickRooms: [], tags: [], lineMats: [] };
const WALL_CUT = 1200;                     // mm: cutaway height of walls on the levels in the work

function disposeTree(o) {
  o.traverse(n => { if (n.geometry) n.geometry.dispose(); if (n.material) [].concat(n.material).forEach(m => m.dispose()); });
}
function basicMat(tk, opacity, extra) {
  const c = tokColor(tk);
  return new THREE.MeshBasicMaterial(Object.assign({ color: c.color, transparent: true, opacity: c.alpha * opacity, depthWrite: false, side: THREE.DoubleSide }, extra || {}));
}
function lineMat(tk, opacity) {
  const c = tokColor(tk);
  return new THREE.LineBasicMaterial({ color: c.color, transparent: true, opacity: c.alpha * opacity, depthWrite: false });
}

// a wall rectangle minus its doors and windows -> boxes [a0, a1, zLo, zHi] along the wall axis (mm)
function wallPieces(w, ops) {
  const horiz = (w.x1 - w.x0) >= (w.y1 - w.y0), a0 = horiz ? w.x0 : w.y0, a1 = horiz ? w.x1 : w.y1;
  const c0 = horiz ? w.y0 : w.x0, c1 = horiz ? w.y1 : w.x1, H = w.h;
  const iv = ops.filter(o => { const c = horiz ? o.y : o.x, a = horiz ? o.x : o.y; return c >= c0 - 80 && c <= c1 + 80 && a > a0 && a < a1; })
    .map(o => { const a = horiz ? o.x : o.y, lo = o.type === 'window' ? o.sill : 0;
      return [Math.max(a0, a - o.w / 2), Math.min(a1, a + o.w / 2), lo, Math.min(H, lo + o.h)]; })
    .sort((p, q) => p[0] - q[0]);
  const out = []; let cur = a0;
  iv.forEach(([s, e, lo, hi]) => {
    if (s > cur) out.push([cur, s, 0, H]);
    if (lo > 0) out.push([s, e, 0, lo]);
    if (hi < H) out.push([s, e, hi, H]);
    cur = Math.max(cur, e);
  });
  if (cur < a1) out.push([cur, a1, 0, H]);
  return { horiz, c0, c1, pieces: out };
}

function buildScene(M) {
  if (S.root) { S.scene.remove(S.root); disposeTree(S.root); }
  S.root = new THREE.Group(); S.pickRooms = []; S.tags = [];
  S.scene.add(S.root);
  const light = document.documentElement.dataset.theme === 'light';
  const ghostK = tokNum('opacity-ghost', 0.4);

  M.levels.forEach(L => {
    const g = new THREE.Group(), k = L.ghost ? ghostK : 1;
    g.name = 'level:' + L.id; S.root.add(g);
    // in the work: solid floor plates, smoked walls, bright cut edges. A ghost: hairlines only.
    const mSlab = basicMat('slab', L.ghost ? 0.15 * k : (light ? 0.95 : 0.9)), mEdge = lineMat('line-strong', k);
    const mWall = basicMat('ground-raised', L.ghost ? 0 : (light ? 0.6 : 0.55)),
      mWallEdge = L.ghost ? lineMat('line-strong', k) : lineMat(light ? 'line-strong' : 'line-bright', light ? 0.9 : 0.5);

    // room slabs
    M.rooms.filter(r => r.level === L.id).forEach(r => {
      const shape = new THREE.Shape(r.poly.map(([x, y]) => new THREE.Vector2((x - M.cx) * MM, -(y - M.cy) * MM)));
      const geo = new THREE.ShapeGeometry(shape); geo.rotateX(-Math.PI / 2);
      const mesh = new THREE.Mesh(geo, mSlab); mesh.position.y = L.y + 0.002; mesh.renderOrder = 1;
      g.add(mesh);
      const loop = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(r.poly.map(([x, y]) => P(M, L.id, x, y, 2))), mEdge);
      g.add(loop);
      if (!L.ghost) { mesh.userData.room = r; S.pickRooms.push(mesh); r.mesh = mesh; }
    });

    // walls, split around doors and windows
    const ops = M.openings.filter(o => o.level === L.id);
    let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
    M.walls.filter(w => w.level === L.id).forEach(w0 => {
      // the levels in the work are cut away at WALL_CUT so the rooms read like a plan; a ghost keeps full height
      const w = L.ghost ? w0 : Object.assign({}, w0, { h: Math.min(w0.h, WALL_CUT) });
      bx0 = Math.min(bx0, w.x0); by0 = Math.min(by0, w.y0); bx1 = Math.max(bx1, w.x1); by1 = Math.max(by1, w.y1);
      const { horiz, c0, c1, pieces } = wallPieces(w, ops);
      pieces.forEach(([a, b, lo, hi]) => {
        const len = (b - a) * MM, ht = (hi - lo) * MM, dep = (c1 - c0) * MM;
        if (len < 0.005 || ht < 0.005) return;
        const geo = new THREE.BoxGeometry(horiz ? len : dep, ht, horiz ? dep : len);
        const mid = horiz ? P(M, L.id, (a + b) / 2, (c0 + c1) / 2, w.z0 + (lo + hi) / 2) : P(M, L.id, (c0 + c1) / 2, (a + b) / 2, w.z0 + (lo + hi) / 2);
        const box = new THREE.Mesh(geo, mWall); box.position.copy(mid); box.renderOrder = 2; g.add(box);
        const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), mWallEdge); edges.position.copy(mid); edges.renderOrder = 3; g.add(edges);
      });
    });

    // level plate outline + its tag at the right corner
    if (bx0 < Infinity) {
      const plate = [[bx0, by0], [bx1, by0], [bx1, by1], [bx0, by1]].map(([x, y]) => P(M, L.id, x, y, 0));
      g.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(plate), lineMat('line', k)));
      S.tags.push({ kind: L.ghost ? 'ghost' : 'level', level: L, pos: P(M, L.id, bx1, by0, 0), text: () => (LANG === 'en' ? L.nameEn : L.name) + (L.ghost ? ' · ' + t('legGhost') : '') });
    }

    // devices
    const mDot = basicMat('layer-endpoint', k, { depthWrite: true, transparent: k < 1 }), mBox = basicMat('ink-faint', k, { depthWrite: true, transparent: k < 1 });
    const mRbx = basicMat('layer-rbx', k), mBoard = basicMat('layer-board', k);
    const gDot = new THREE.SphereGeometry(0.045, 16, 12), gBox = new THREE.BoxGeometry(0.07, 0.07, 0.07);
    const gRbx = new THREE.BoxGeometry(0.12, 0.12, 0.12), gBoard = new THREE.OctahedronGeometry(0.1);
    M.devices.filter(d => d.level === L.id).forEach(d => {
      const off = d.nx != null ? 25 : 0;
      const pos = P(M, L.id, d.x + (d.nx || 0) * off, d.y + (d.ny || 0) * off, Math.min(d.h, L.h - 40));
      const geo = d.kind === 'endpoint' ? gDot : d.kind === 'rbx' ? gRbx : d.kind === 'board' ? gBoard : gBox;
      const mat = d.kind === 'endpoint' ? mDot : d.kind === 'rbx' ? mRbx : d.kind === 'board' ? mBoard : mBox;
      const m = new THREE.Mesh(geo, mat); m.position.copy(pos); m.renderOrder = 4; m.userData.device = d; g.add(m);
    });
  });
}

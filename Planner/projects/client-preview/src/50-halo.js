// 50-halo.js — the room halo (design system RoomHalo, WebGL version):
// sand-soft wash, a 7px halo glow at opacity-halo-glow (dark theme only), a crisp 1.4px halo
// line, and a dotted ring 0.5 m outside. Drawn 2 cm above the slab, depth test off, last.

const H = { group: null, fade: 0, room: null };

function fatLine(pts, tk, width, opacity, dashed) {
  const c = tokColor(tk), geo = new JSM.LineGeometry();
  const flat = []; pts.forEach(v => flat.push(v.x, v.y, v.z)); flat.push(pts[0].x, pts[0].y, pts[0].z);
  geo.setPositions(flat);
  const mat = new JSM.LineMaterial({ color: c.color, linewidth: width, transparent: true, opacity: c.alpha * opacity,
    depthTest: false, depthWrite: false, dashed: !!dashed, dashSize: 0.05, gapSize: 0.25 });
  mat.resolution.set(window.innerWidth, window.innerHeight);
  S.lineMats.push(mat);
  const line = new JSM.Line2(geo, mat); line.computeLineDistances(); line.renderOrder = 20;
  line.userData.baseOpacity = mat.opacity;
  return line;
}
function clearHalo() {
  if (!H.group) return;
  S.scene.remove(H.group); disposeTree(H.group);
  S.lineMats = S.lineMats.filter(m => !H.mats.includes(m));
  H.group = null; H.room = null;
}
function showHalo(M, r) {
  clearHalo(); if (!r) return;
  const before = S.lineMats.length;
  const lift = 20, L = M.lv[r.level];
  const ring = offsetPolygon(r.poly, 500);
  const pts = r.poly.map(([x, y]) => P(M, L.id, x, y, lift)), rpts = ring.map(([x, y]) => P(M, L.id, x, y, lift));
  const g = new THREE.Group(); g.renderOrder = 20;
  const shape = new THREE.Shape(r.poly.map(([x, y]) => new THREE.Vector2((x - M.cx) * MM, -(y - M.cy) * MM)));
  const geo = new THREE.ShapeGeometry(shape); geo.rotateX(-Math.PI / 2);
  const wash = new THREE.Mesh(geo, basicMat('sand-soft', 1, { depthTest: false }));
  wash.position.y = L.y + lift * MM; wash.renderOrder = 19; wash.userData.baseOpacity = wash.material.opacity; g.add(wash);
  if (document.documentElement.dataset.theme !== 'light') g.add(fatLine(pts, 'halo', tokNum('stroke-glow', 7), tokNum('opacity-halo-glow', 0.35)));
  g.add(fatLine(pts, 'halo', tokNum('stroke-halo', 1.4), 1));
  g.add(fatLine(rpts, 'halo', 1, 0.8, true));
  H.mats = S.lineMats.slice(before);
  H.group = g; H.room = r; H.fade = 0;
  S.scene.add(g); haloOpacity(0);
}
function haloOpacity(f) {
  if (!H.group) return;
  H.group.traverse(n => { if (n.material && n.userData.baseOpacity != null) n.material.opacity = n.userData.baseOpacity * f; });
}
// fade in over 400 ms; true while still fading
function haloStep(dtMs) {
  if (!H.group || H.fade >= 1) return false;
  H.fade = Math.min(1, H.fade + dtMs / (REDUCED ? 150 : 400)); haloOpacity(H.fade); return H.fade < 1;
}
const REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

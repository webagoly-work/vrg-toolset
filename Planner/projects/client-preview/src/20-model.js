// 20-model.js — read the embedded model (or a dropped one) and derive what the scene needs.

const EXPLODE = 2.2;                       // m of extra air between levels: the levelled look

function readEmbeddedModel() {
  const raw = ($('cpv-model').textContent || '').replace('/*__MODEL__*/', '').trim();
  if (!raw || raw === '{}') return null;
  try { const m = JSON.parse(raw); return m && m.kind === 'vrg-client-preview' ? m : null; } catch (_) { return null; }
}

// Adds display data: room order and labels, level display heights, the scene centre.
function prepareModel(m) {
  const levels = m.levels.slice().sort((a, b) => a.z - b.z);
  levels.forEach((L, i) => { L.y = L.z * MM + i * EXPLODE; L.ghost = L.scope === 'ghost'; });
  const lv = {}; levels.forEach(L => lv[L.id] = L);
  // rooms in reading order per level (top row first, then left to right), numbered from 01
  const order = (a, b) => { const ca = polyCentroid(a.poly), cb = polyCentroid(b.poly);
    return Math.abs(ca[1] - cb[1]) > 1500 ? ca[1] - cb[1] : ca[0] - cb[0]; };
  levels.forEach(L => {
    const rs = m.rooms.filter(r => r.level === L.id).sort(order);
    rs.forEach((r, i) => { r.idx = i + 1; r.count = rs.length; r.centroid = polyCentroid(r.poly); });
  });
  const devById = {}; m.devices.forEach(d => devById[d.id] = d);
  // scene centre: the in-scope rooms, falling back to all walls
  const pts = [];
  m.rooms.filter(r => lv[r.level] && !lv[r.level].ghost).forEach(r => r.poly.forEach(p => pts.push(p)));
  if (!pts.length) m.walls.forEach(w => { pts.push([w.x0, w.y0], [w.x1, w.y1]); });
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  pts.forEach(([x, y]) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); });
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, span = Math.max(x1 - x0, y1 - y0) * MM;
  return Object.assign(m, { levels, lv, devById, cx, cy, span: span || 10 });
}
// plan mm (x, y) at height h (mm) on a level -> scene Vector3
function P(M, level, x, y, h) { return new THREE.Vector3((x - M.cx) * MM, M.lv[level].y + (h || 0) * MM, (y - M.cy) * MM); }

// Title in the current language, the other language as the muted second line.
// An unnamed room is "Helyiség 03" / "Room 03" (name it in the Planner's room dialog).
function roomTitle(r) {
  const hu = r.name || 'Helyiség ' + pad2(r.idx), en = r.nameEn || (r.name ? '' : 'Room ' + pad2(r.idx));
  return LANG === 'en' ? (en || hu) : hu;
}
function roomSubtitle(r) {
  const hu = r.name || 'Helyiség ' + pad2(r.idx), en = r.nameEn || (r.name ? '' : 'Room ' + pad2(r.idx));
  return LANG === 'en' ? (en ? hu : '') : en;
}

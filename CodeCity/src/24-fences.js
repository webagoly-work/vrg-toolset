// 24-fences.js — fences and the conflict radar (P4, KV-11; report §5.2). The segéd sends 'fences': each file a
// Claude session edited (an automatic Kapu claim, kept 3 days in memory) or a worktree changed against main, with
// its owners. Each owner raises a low fence around the building in its colour — a session's figure colour, a
// worktree's own (dashed). Two or more owners on one plot is a conflict: the fence turns red, a crossed-fence
// icon stands over the roof, and the Városháza board gets an 'ütközés' line — before anyone tries a merge.

const fen = { list: [], group: null };
const FEN_RED = 0xff3b3b;
const fenColor = o => new THREE.Color().setHSL(agHue(o.kind === 'worktree' ? 'wt:' + o.id : o.id), o.kind === 'worktree' ? 0.55 : 0.75, 0.6);
const fenName = o => o.kind === 'worktree' ? 'worktree: ' + o.id : (ag.list.find(a => a.id === o.id) || { name: o.id }).name || o.id;

function fencesEvent(d) {
  fen.list = d.list || [];
  fenDraw(); agBoard();
}
function fenDraw() {
  if (!world) return;
  if (fen.group) { world.group.remove(fen.group); fen.group.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
  fen.group = new THREE.Group();
  const by = new Map(current.city.files.map((f, i) => [f.p, i])), k = agScale();
  for (const fc of fen.list) {
    const i = by.get(fc.p);
    if (i === undefined || replay.cur[i * 3] <= 0) continue;
    const f = current.city.files[i], { x, z, w, h } = f.rect, top = f.base + replay.cur[i * 3];
    fc.owners.forEach((o, n) => {
      // one ring of fence per owner, each a little wider than the last
      const pad = 0.35 * k * (n + 1), hgt = 1.4 * k;
      const box = new THREE.BoxGeometry(w + 2 * pad, hgt, h + 2 * pad).translate(x + w / 2, f.base + hgt / 2, z + h / 2);
      const mat = o.kind === 'worktree'
        ? new THREE.LineDashedMaterial({ color: fc.conflict ? FEN_RED : fenColor(o), dashSize: 0.6 * k, gapSize: 0.4 * k, fog: false })
        : new THREE.LineBasicMaterial({ color: fc.conflict ? FEN_RED : fenColor(o), fog: false });
      const line = new THREE.LineSegments(new THREE.EdgesGeometry(box), mat);
      if (o.kind === 'worktree') line.computeLineDistances();
      fen.group.add(line);
    });
    if (fc.conflict) {   // the crossed-fence icon over the roof
      const r = Math.max(2.2 * k, 0.45 * Math.max(w, h)), c = new THREE.Vector3(x + w / 2, top + r * 1.8, z + h / 2);
      const pts = [new THREE.Vector3(-r, -r, 0), new THREE.Vector3(r, r, 0), new THREE.Vector3(-r, r, 0), new THREE.Vector3(r, -r, 0),
        new THREE.Vector3(-r * 1.3, -r * 0.4, 0), new THREE.Vector3(r * 1.3, -r * 0.4, 0), new THREE.Vector3(-r * 1.3, r * 0.4, 0), new THREE.Vector3(r * 1.3, r * 0.4, 0)];
      const icon = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: FEN_RED, fog: false }));
      icon.position.copy(c);
      icon.onBeforeRender = (r2, s2, cam) => icon.quaternion.copy(cam.quaternion);   // always faces the viewer
      fen.group.add(icon);
    }
  }
  fen.group.traverse(o => { o.raycast = () => {}; });
  world.group.add(fen.group);
  requestRender();
}
// the board's 'ütközés' block (23-agents draws the board and asks for this)
function fenAlertsHtml() {
  const cs = fen.list.filter(fc => fc.conflict);
  if (!cs.length) return '';
  return '<div class="alerts"><h4>Ütközés — több gazdája van egy fájlnak</h4>' + cs.slice(0, 20).map(fc =>
    `<div class="alert" data-path="${esc(fc.p)}"><b>${esc(fc.p)}</b> <span class="dim">${fc.owners.map(o => esc(fenName(o))).join(' · ')}</span></div>`).join('') + '</div>';
}

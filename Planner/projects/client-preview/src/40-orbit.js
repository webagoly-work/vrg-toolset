// 40-orbit.js — a small orbit camera: drag rotates, right/shift-drag pans, wheel and pinch zoom.
// The camera eases toward a goal (azimuth, polar, radius, target) so every move is calm; the
// tour (phase 4) drives the same goal with longer durations.

const O = {
  az: -0.62, po: 0.92, r: 20, target: new THREE.Vector3(),
  goal: { az: -0.62, po: 0.92, r: 20, target: new THREE.Vector3() },
  minPo: 0.12, maxPo: 1.45, minR: 3, maxR: 80, ease: 0.14, moving: false,
};
function orbitFit(M) {
  O.goal.r = O.r = Math.max(8, M.span * 2.3);
  O.maxR = O.goal.r * 2.5; O.minR = Math.max(2, M.span * 0.18);
  const inLv = M.levels.filter(L => !L.ghost), top = M.levels[M.levels.length - 1];
  const y = inLv.length ? (inLv[0].y + top.y) / 2 * 0.6 : 0;   // a little above the work, so a ghost above stays in frame
  O.goal.target.set(0, y, 0); O.target.copy(O.goal.target);
}
function orbitApply(cam) {
  const sp = Math.sin(O.po);
  cam.position.set(O.target.x + O.r * sp * Math.sin(O.az), O.target.y + O.r * Math.cos(O.po), O.target.z + O.r * sp * Math.cos(O.az));
  cam.lookAt(O.target);
}
// one easing step; true while still moving
function orbitStep(cam) {
  const g = O.goal, e = O.ease;
  O.az += (g.az - O.az) * e; O.po += (g.po - O.po) * e; O.r += (g.r - O.r) * e; O.target.lerp(g.target, e);
  orbitApply(cam);
  return Math.abs(g.az - O.az) > 1e-4 || Math.abs(g.po - O.po) > 1e-4 || Math.abs(g.r - O.r) > 1e-3 || O.target.distanceTo(g.target) > 1e-3;
}
function orbitBind(canvas, cam, onChange, onClick, onHover) {
  const ptrs = new Map(); let mode = null, sx = 0, sy = 0, moved = 0, pinch0 = 0;
  const clampGoal = () => { O.goal.po = Math.min(O.maxPo, Math.max(O.minPo, O.goal.po)); O.goal.r = Math.min(O.maxR, Math.max(O.minR, O.goal.r)); };
  const pan = (dx, dy) => {
    const k = O.goal.r / canvas.clientHeight * 1.1;
    const right = new THREE.Vector3().setFromMatrixColumn(cam.matrix, 0).setY(0).normalize();
    const fwd = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), right).normalize();
    O.goal.target.addScaledVector(right, -dx * k).addScaledVector(fwd, -dy * k);
  };
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('pointerdown', e => {
    canvas.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, [e.clientX, e.clientY]);
    sx = e.clientX; sy = e.clientY; moved = 0;
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = Math.hypot(a[0] - b[0], a[1] - b[1]); mode = 'pinch'; }
    else mode = (e.button === 2 || e.shiftKey) ? 'pan' : 'rot';
  });
  canvas.addEventListener('pointermove', e => {
    if (!ptrs.has(e.pointerId)) { onHover(e); return; }
    const [px, py] = ptrs.get(e.pointerId), dx = e.clientX - px, dy = e.clientY - py;
    ptrs.set(e.pointerId, [e.clientX, e.clientY]); moved += Math.abs(dx) + Math.abs(dy);
    if (moved > 4) canvas.classList.add('is-drag');
    if (mode === 'pinch' && ptrs.size === 2) {
      const [a, b] = [...ptrs.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (pinch0) O.goal.r *= pinch0 / d; pinch0 = d; pan(dx / 2, dy / 2);
    } else if (mode === 'rot') { O.goal.az -= dx * 0.006; O.goal.po -= dy * 0.005; }
    else if (mode === 'pan') pan(dx, dy);
    clampGoal(); onChange();
  });
  const up = e => {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.delete(e.pointerId); canvas.classList.remove('is-drag');
    if (ptrs.size === 0) { if (moved < 5 && e.type === 'pointerup' && e.button === 0) onClick(e); mode = null; }
    else mode = 'rot';
  };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', e => { e.preventDefault(); O.goal.r *= Math.exp(e.deltaY * 0.0012); clampGoal(); onChange(); }, { passive: false });
  canvas.tabIndex = 0;
  canvas.addEventListener('keydown', e => {
    const step = { ArrowLeft: [0.12, 0], ArrowRight: [-0.12, 0], ArrowUp: [0, -0.08], ArrowDown: [0, 0.08] }[e.key];
    if (step) { O.goal.az += step[0]; O.goal.po += step[1]; clampGoal(); onChange(); e.preventDefault(); }
    else if (e.key === '+' || e.key === '=') { O.goal.r *= 0.85; clampGoal(); onChange(); }
    else if (e.key === '-') { O.goal.r /= 0.85; clampGoal(); onChange(); }
  });
}

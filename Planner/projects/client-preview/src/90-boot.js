// 90-boot.js — start-up, the render loop (on demand: nothing redraws while nothing moves),
// picking, and the dev path of dropping a model JSON onto an empty page.

let M = null, R = null, CAM = null, dirty = true, last = performance.now(), hoverRoom = null;
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();

function initGL() {
  const canvas = $('gl');
  try { R = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); }
  catch (e) { $('cpvEmpty').hidden = false; $('cpvEmpty').querySelector('p').textContent = 'Ez a böngésző nem tud 3D-t megjeleníteni (WebGL). Próbáld Chrome-ban vagy Edge-ben.'; return false; }
  R.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  R.setClearColor(0x000000, 0);
  S.scene = new THREE.Scene();
  CAM = new THREE.PerspectiveCamera(34, 1, 0.05, 500);
  resize(); window.addEventListener('resize', resize);
  orbitBind(canvas, CAM, () => { dirty = true; }, onClick, onHover);
  return true;
}
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  R.setSize(w, h, false); CAM.aspect = w / h; CAM.updateProjectionMatrix();
  S.lineMats.forEach(m => m.resolution.set(w, h)); dirty = true;
}
function pickRoom(e) {
  ndc.set(e.clientX / window.innerWidth * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, CAM);
  const hit = ray.intersectObjects(S.pickRooms, false)[0];
  return hit ? hit.object.userData.room : null;
}
function setHover(r) {
  if (r === hoverRoom) return;
  if (hoverRoom && hoverRoom.mesh) hoverRoom.mesh.material = hoverRoom.mesh.userData.baseMat;
  hoverRoom = r;
  if (r && r.mesh) {
    if (!r.mesh.userData.baseMat) r.mesh.userData.baseMat = r.mesh.material;
    if (!S.hoverMat) S.hoverMat = basicMat('sand-soft', 1.6);
    r.mesh.material = S.hoverMat;
  }
  $('gl').classList.toggle('is-hover', !!r);
  dirty = true;
}
function onHover(e) { setHover(pickRoom(e)); }
function onClick(e) {
  const r = pickRoom(e);
  if (r && H.room === r) { selectRoom(null); return; }
  selectRoom(r);
}
function selectRoom(r) { showHalo(M, r); showRoomCard(M, r); dirty = true; }

function frame(now) {
  const dt = now - last; last = now;
  const moving = orbitStep(CAM), fading = haloStep(dt);
  if (moving || fading || dirty) { R.render(S.scene, CAM); placeTags(CAM); dirty = false; }
  requestAnimationFrame(frame);
}

function rebuild() {
  const keep = H.room;
  S.hoverMat && S.hoverMat.dispose(); S.hoverMat = null; hoverRoom = null;
  clearHalo(); buildScene(M); buildTags(); buildLegend(M);
  if (keep) { selectRoom(keep); H.fade = 1; haloOpacity(1); }
  dirty = true;
}
function start(model) {
  M = prepareModel(model);
  $('cpvName').textContent = M.name || 'Terv';
  document.title = (M.name ? M.name + ' · ' : '') + t('crumb');
  $('cpvEmpty').hidden = true;
  orbitFit(M); orbitApply(CAM);
  rebuild(); applyI18n();
}

function bindSwitches() {
  $('cpvLang').onclick = () => { LANG = LANG === 'en' ? 'hu' : 'en'; applyI18n(); refreshTagText(); buildLegend(M); if (H.room) showRoomCard(M, H.room); };
  $('cpvTheme').onclick = () => {
    const root = document.documentElement; root.dataset.theme = root.dataset.theme === 'light' ? 'dark' : 'light';
    applyI18n(); if (M) rebuild();
  };
  $('cpvRoomClose').onclick = () => selectRoom(null);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && H.room) selectRoom(null); });
}
function bindDrop() {
  const box = $('cpvEmpty');
  window.addEventListener('dragover', e => { e.preventDefault(); box.classList.add('is-drop'); });
  window.addEventListener('dragleave', () => box.classList.remove('is-drop'));
  window.addEventListener('drop', e => {
    e.preventDefault(); box.classList.remove('is-drop');
    const f = e.dataTransfer.files && e.dataTransfer.files[0]; if (!f) return;
    f.text().then(s => { const m = JSON.parse(s); if (m.kind !== 'vrg-client-preview') throw new Error('not a model'); selectRoom(null); start(m); })
      .catch(() => { box.hidden = false; box.querySelector('p').textContent = 'Ez nem előnézeti modell. A Plannerből exportált .json kell.'; });
  });
}

if (initGL()) {
  bindSwitches(); bindDrop(); applyI18n();
  const m = readEmbeddedModel();
  if (m) start(m); else $('cpvEmpty').hidden = false;
  requestAnimationFrame(frame);
}
// read-only handle for tests and the browser console (module scope hides everything else)
window.__cpv = { get model() { return M; }, scene: S, orbit: O, halo: H, selectRoom: r => selectRoom(r), get renderer() { return R; } };

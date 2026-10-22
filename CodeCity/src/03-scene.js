// 03-scene.js — renderer, orbit camera, district plates and instanced buildings, picking.
// Renders on demand only (requestRender): an idle city costs nothing.

const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const scene = new THREE.Scene();
const BG = 0x0d1220;
scene.background = new THREE.Color(BG);
const camera = new THREE.PerspectiveCamera(45, 1, 0.5, 5000);
scene.add(new THREE.HemisphereLight(0xc8d8ff, 0x1a1a28, 1.1));
const sun = new THREE.DirectionalLight(0xffffff, 1.7);
sun.position.set(0.8, 2, 0.5);
scene.add(sun);

let renderQueued = false;
function requestRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => { renderQueued = false; renderer.render(scene, camera); });
}
new ResizeObserver(() => {
  const r = canvas.parentElement.getBoundingClientRect();
  renderer.setSize(r.width, r.height, false);
  camera.aspect = r.width / Math.max(1, r.height);
  camera.updateProjectionMatrix();
  requestRender();
}).observe(canvas.parentElement);

// ---- orbit camera: left drag rotates, right drag or Shift pans, wheel zooms
const orbit = { target: new THREE.Vector3(), theta: 0.8, phi: 0.95, r: 300 };
function placeCamera() {
  const { target: t, theta, phi, r } = orbit;
  camera.position.set(t.x + r * Math.sin(phi) * Math.sin(theta), t.y + r * Math.cos(phi), t.z + r * Math.sin(phi) * Math.cos(theta));
  camera.lookAt(t);
  requestRender();
}
let drag = null;
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('pointerdown', e => {
  drag = { x: e.clientX, y: e.clientY, pan: e.button === 2 || e.shiftKey, moved: 0 };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointerup', e => {
  if (drag && drag.moved < 4) onPick(e);
  drag = null;
});
canvas.addEventListener('pointermove', e => {
  if (!drag) { onHover(e); return; }
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  drag.x = e.clientX; drag.y = e.clientY; drag.moved += Math.abs(dx) + Math.abs(dy);
  if (drag.pan) {
    const k = orbit.r * 0.0015, s = Math.sin(orbit.theta), c = Math.cos(orbit.theta);
    orbit.target.x -= (dx * c + dy * s) * k;
    orbit.target.z -= (-dx * s + dy * c) * k;
  } else {
    orbit.theta -= dx * 0.005;
    orbit.phi = Math.min(1.45, Math.max(0.12, orbit.phi - dy * 0.005));
  }
  placeCamera();
});
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  orbit.r = Math.min(4000, Math.max(8, orbit.r * Math.exp(e.deltaY * 0.001)));
  placeCamera();
}, { passive: false });

// ---- the city
const unitBox = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0); // base at y=0
let world = null; // { group, buildings, plates, fileOf[], dirOf[], baseColor[] }

function showCity(model) {
  if (world) { scene.remove(world.group); world.buildings.dispose(); world.plates.dispose(); }
  const group = new THREE.Group(), m = new THREE.Matrix4(), col = new THREE.Color();

  const dirs = [];
  (function walk(d) { dirs.push(d); d.dirs.forEach(walk); })(model.root);
  const plates = new THREE.InstancedMesh(unitBox, new THREE.MeshLambertMaterial(), dirs.length);
  dirs.forEach((d, i) => {
    const { x, z, w, h } = d.rect;
    m.makeScale(w, PLATE, h).setPosition(x + w / 2, d.depth * PLATE, z + h / 2);
    plates.setMatrixAt(i, m);
    plates.setColorAt(i, col.setHSL(0.62, 0.18, 0.13 + Math.min(d.depth, 6) * 0.035));
  });

  const live = model.city.files.filter(f => !f.gone);
  const buildings = new THREE.InstancedMesh(unitBox, new THREE.MeshLambertMaterial(), live.length);
  const baseColor = [];
  live.forEach((f, i) => {
    const { x, z, w, h } = f.rect;
    m.makeScale(w, heightOf(f), h).setPosition(x + w / 2, f.base, z + h / 2);
    buildings.setMatrixAt(i, m);
    col.setHex(langColor(f.lang));
    baseColor.push(col.clone());
    buildings.setColorAt(i, col);
  });
  group.add(plates, buildings);
  scene.add(group);
  world = { group, buildings, plates, fileOf: live, dirOf: dirs, baseColor };

  scene.fog = new THREE.Fog(BG, model.side * 1.2, model.side * 3.5);
  orbit.target.set(0, 0, 0);
  orbit.r = model.side * 1.25;
  placeCamera();
}

// ---- picking
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
function pickAt(e) {
  if (!world) return null;
  const r = canvas.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObjects([world.buildings, world.plates], false)[0];
  if (!hit) return null;
  return hit.object === world.buildings ? { file: world.fileOf[hit.instanceId], i: hit.instanceId } : { dir: world.dirOf[hit.instanceId] };
}
let hovered = -1;
function setHover(i) {
  if (i === hovered) return;
  const b = world.buildings, c = new THREE.Color();
  if (hovered >= 0) b.setColorAt(hovered, world.baseColor[hovered]);
  if (i >= 0) b.setColorAt(i, c.copy(world.baseColor[i]).lerp(new THREE.Color(0xffffff), 0.55));
  hovered = i;
  b.instanceColor.needsUpdate = true;
  requestRender();
}

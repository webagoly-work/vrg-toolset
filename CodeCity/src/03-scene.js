// 03-scene.js — renderer, orbit camera, district plates and instanced buildings, picking.
// Renders on demand only (requestRender): an idle city costs nothing.
// Night look (WP-C3): the sky is CSS behind a transparent canvas; windows are procedural (shader),
// lit in proportion to how recently the file changed — Git City's idea, re-implemented.

const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const scene = new THREE.Scene();
const HORIZON = 0x1b2442;                     // = --horizon in city.css, so fog melts into the sky
const camera = new THREE.PerspectiveCamera(45, 1, 0.5, 5000);
scene.add(new THREE.HemisphereLight(0x8aa0ff, 0x10101a, 0.75));
const moon = new THREE.DirectionalLight(0xc8d4ff, 1.1);
moon.position.set(-0.6, 2, 0.9);
scene.add(moon);

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
let onCameraMoved = () => {};                 // 04-ui hooks the share link in here
function placeCamera() {
  const { target: t, theta, phi, r } = orbit;
  camera.position.set(t.x + r * Math.sin(phi) * Math.sin(theta), t.y + r * Math.cos(phi), t.z + r * Math.sin(phi) * Math.cos(theta));
  camera.lookAt(t);
  requestRender();
  onCameraMoved();
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

// ---- building material: Lambert + procedural windows
// aLit (per instance, 0..1) = share of windows that are lit. Windows sit on a world-space grid
// (1.1 wide, 1.4 per floor) so floors line up across the city. When a window cell gets smaller
// than a few pixels, it fades to its average brightness — that is the LOD, and it stops the
// distant city from shimmering.
function buildingMaterial() {
  const mat = new THREE.MeshLambertMaterial();
  mat.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
attribute float aLit;
varying float vLit; varying vec3 vWPos; varying vec3 vONrm; flat varying float vSeed;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vLit = aLit; vONrm = objectNormal; vSeed = float(gl_InstanceID);
vWPos = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying float vLit; varying vec3 vWPos; varying vec3 vONrm; flat varying float vSeed;
// fract-only hash (no sin of large numbers: that amplified float noise into speckled windows);
// the seed is flat and every input is rounded, so a window cell is one value end to end
float cityHash(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
if (abs(vONrm.y) < 0.5) {
  float u = abs(vONrm.x) > 0.5 ? vWPos.z : vWPos.x;
  vec2 cell = vec2(u / 1.1, vWPos.y / 1.4);
  vec2 f = fract(cell);
  float win = step(0.22, f.x) * step(f.x, 0.78) * step(0.28, f.y) * step(f.y, 0.78);
  float face = dot(floor(vONrm + 0.5), vec3(1.0, 2.0, 3.0));
  float on = step(cityHash(vec3(floor(cell), vSeed * 7.0 + face)), vLit);
  float far = smoothstep(0.25, 0.6, max(fwidth(cell.x), fwidth(cell.y)));
  win = mix(win, 0.3, far); on = mix(on, vLit, far);
  diffuseColor.rgb *= mix(1.0, 0.35, win);
  totalEmissiveRadiance += win * on * vec3(1.0, 0.78, 0.42) * 1.1;
}`);
  };
  return mat;
}

// ---- the city
const unitBox = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0); // base at y=0
let world = null; // { group, buildings, plates, fileOf[], dirOf[], baseColor[], beacon }

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
    plates.setColorAt(i, col.setHSL(0.64, 0.25, 0.07 + Math.min(d.depth, 6) * 0.025));
  });

  const live = model.city.files.filter(f => !f.gone);
  const geo = unitBox.clone();
  const lit = new Float32Array(live.length);
  const buildings = new THREE.InstancedMesh(geo, buildingMaterial(), live.length);
  const baseColor = [];
  live.forEach((f, i) => {
    const { x, z, w, h } = f.rect;
    m.makeScale(w, heightOf(f), h).setPosition(x + w / 2, f.base, z + h / 2);
    buildings.setMatrixAt(i, m);
    col.setHex(langColor(f.lang)).multiplyScalar(0.62);   // night: the body recedes, windows carry the light
    baseColor.push(col.clone());
    buildings.setColorAt(i, col);
    lit[i] = litOf(f, model);
  });
  geo.setAttribute('aLit', new THREE.InstancedBufferAttribute(lit, 1));

  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1, 12, 1, true).translate(0, 0.5, 0),
    new THREE.MeshBasicMaterial({ color: 0xffcf5a, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  beacon.visible = false;
  group.add(plates, buildings, beacon);
  scene.add(group);
  world = { group, buildings, plates, fileOf: live, dirOf: dirs, baseColor, beacon };

  scene.fog = new THREE.Fog(HORIZON, model.side * 1.1, model.side * 3.2);
  orbit.target.set(0, 0, 0);
  orbit.r = model.side * 1.25;
  placeCamera();
}

// a light column over the selected building, as tall as the city is wide
function setBeacon(f) {
  const b = world.beacon;
  b.visible = !!f;
  if (f) {
    const { x, z, w, h } = f.rect, r = Math.max(0.6, Math.min(w, h) * 0.18);
    b.scale.set(r, current.side * 0.6, r);
    b.position.set(x + w / 2, f.base + heightOf(f), z + h / 2);
  }
  requestRender();
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

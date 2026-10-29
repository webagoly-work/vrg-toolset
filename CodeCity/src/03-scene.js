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
let afterRender = () => {};                   // screen-space overlays (10-query brackets, 11-hud) hook in
function requestRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => { renderQueued = false; renderer.render(scene, camera); afterRender(); lookFrame(); });   // 37-look: quality tiers
}
new ResizeObserver(() => {
  const r = canvas.parentElement.getBoundingClientRect();
  renderer.setSize(r.width, r.height, false);
  camera.aspect = r.width / Math.max(1, r.height);
  camera.updateProjectionMatrix();
  requestRender();
}).observe(canvas.parentElement);

// ---- orbit camera: left drag rotates, right drag pans, wheel zooms; Shift+left drag boxes a selection (19-select)
const orbit = { target: new THREE.Vector3(), theta: 0.8, phi: 0.95, r: 300 };
let onCameraMoved = () => {};                 // 04-ui hooks the share link in here
function placeCamera() {
  const { target: t, theta, phi, r } = orbit;
  camera.position.set(t.x + r * Math.sin(phi) * Math.sin(theta), t.y + r * Math.cos(phi), t.z + r * Math.sin(phi) * Math.cos(theta));
  camera.lookAt(t);
  landFog();   // 29-land: the fog follows the zoom
  worldCam();   // 32-world: near/far follow the zoom, from a floor to the planet
  requestRender();
  onCameraMoved();
}
let drag = null;
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('pointerdown', e => {
  drag = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, pan: e.button === 2,
    box: e.button === 0 && e.shiftKey && !!world, add: e.ctrlKey || e.metaKey, moved: 0 };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointerup', e => {
  // a right click that did not drag is the RCO menu (17-actions); a right drag pans
  if (drag && drag.box && drag.moved >= 4) selBoxEnd(drag.x0, drag.y0, e.clientX, e.clientY, drag.add);
  else if (drag && drag.moved < 4) { if (sel.rect) sel.rect.hidden = true; if (e.button === 2) onContext(e); else onPick(e); }
  drag = null;
});
canvas.addEventListener('pointermove', e => {
  if (!drag) { onHover(e); return; }
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  drag.x = e.clientX; drag.y = e.clientY; drag.moved += Math.abs(dx) + Math.abs(dy);
  if (drag.box) { selBoxDraw(drag.x0, drag.y0, e.clientX, e.clientY); return; }
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
  orbit.r = Math.min(120000, Math.max(8, orbit.r * Math.exp(e.deltaY * 0.001)));   // out to the GitWorld planet (32-world)
  placeCamera();
}, { passive: false });

// ---- building material: Lambert + procedural windows
// aLit (per instance, 0..1) = share of windows that are lit. Windows sit on a world-space grid
// (1.1 wide, 1.4 per floor) so floors line up across the city. When a window cell gets smaller
// than a few pixels, it fades to its average brightness — that is the LOD, and it stops the
// distant city from shimmering.
function buildingMaterial() {
  const mat = new THREE.MeshLambertMaterial();
  // the look (07-lens) drives these: window colour and strength, and how much the body glows itself
  const uniforms = { uWinColor: { value: new THREE.Color(1.0, 0.78, 0.42) }, uWinGain: { value: 1.1 }, uBodyGlow: { value: 0 } };
  mat.userData.uniforms = uniforms;
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
attribute float aLit; attribute float aFlash;
varying float vLit; varying float vFlash; varying vec3 vWPos; varying vec3 vONrm; flat varying float vSeed;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vLit = aLit; vFlash = aFlash; vONrm = objectNormal; vSeed = float(gl_InstanceID);
vWPos = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying float vLit; varying float vFlash; varying vec3 vWPos; varying vec3 vONrm; flat varying float vSeed;
// fract-only hash (no sin of large numbers: that amplified float noise into speckled windows);
// the seed is flat and every input is rounded, so a window cell is one value end to end
uniform vec3 uWinColor; uniform float uWinGain; uniform float uBodyGlow;
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
  totalEmissiveRadiance += win * on * uWinColor * uWinGain;
} else if (vONrm.y > 0.5) {
  totalEmissiveRadiance += vFlash * vec3(1.0, 0.92, 0.7) * 1.6;   // roof flash: touched by this commit
}
totalEmissiveRadiance += diffuseColor.rgb * uBodyGlow;`);
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

  // every file that ever existed gets an instance (index = file index); 05-replay sizes them,
  // and a file that does not exist at the shown commit is scaled to nothing
  const all = model.city.files;
  const geo = unitBox.clone();
  const buildings = new THREE.InstancedMesh(geo, buildingMaterial(), all.length);
  buildings.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const baseColor = [];
  all.forEach((f, i) => {
    col.setHex(langColor(f.lang)).multiplyScalar(0.62);   // night: the body recedes, windows carry the light
    baseColor.push(col.clone());
    buildings.setColorAt(i, col);
  });
  geo.setAttribute('aLit', new THREE.InstancedBufferAttribute(new Float32Array(all.length), 1).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aFlash', new THREE.InstancedBufferAttribute(new Float32Array(all.length), 1).setUsage(THREE.DynamicDrawUsage));

  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1, 12, 1, true).translate(0, 0.5, 0),
    new THREE.MeshBasicMaterial({ color: 0xffcf5a, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  beacon.visible = false;
  group.add(plates, buildings, beacon);
  scene.add(group);
  scene.fog = new THREE.Fog(HORIZON, model.side * 1.1, model.side * 3.2);
  world = { group, buildings, plates, fileOf: all, dirOf: dirs, baseColor, beacon };
  replayPrepare(model);
  applyTime(replay.last, false);

  orbit.target.set(0, 0, 0);
  orbit.r = model.side * 1.25;
  placeCamera();
}

// a light column over the selected building, as tall as the city is wide; follows the replay
let beaconFile = null;
function setBeacon(f) {
  beaconFile = f;
  placeBeacon();
}
function placeBeacon() {
  const b = world.beacon, f = beaconFile, h = f ? replay.cur[f.i * 3] : 0;
  b.visible = !!f && h > 0;
  if (b.visible) {
    const { x, z, w, h: d } = f.rect, r = Math.max(0.6, Math.min(w, d) * 0.18);
    b.scale.set(r, current.side * 0.6, r);
    b.position.set(x + w / 2, f.base + h, z + d / 2);
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
  // a building scaled to nothing (not born yet / deleted) has a singular matrix: never a real hit
  const hit = ray.intersectObjects([world.buildings, world.plates], false)
    .find(h => h.object !== world.buildings || replay.cur[h.instanceId * 3] > 0);
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

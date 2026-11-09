// 03-scene.js — renderer, orbit camera, district plates and instanced buildings, picking.
// Renders on demand only (requestRender): an idle city costs nothing.
// Night look (WP-C3): the sky is CSS behind a transparent canvas; windows are procedural (shader),
// lit in proportion to how recently the file changed — Git City's idea, re-implemented.

const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const scene = new THREE.Scene();
const HORIZON = 0x11202b;                     // = --horizon in city.css and the Mélyvíz water (38-sea), so fog melts into it
const camera = new THREE.PerspectiveCamera(45, 1, 0.5, 5000);
scene.add(new THREE.HemisphereLight(0x9ec4d6, 0x0a1218, 0.75));   // Melyviz: ice sky light, deep-water ground
const moon = new THREE.DirectionalLight(0xd2e4ee, 1.1);
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
    box: e.button === 0 && e.shiftKey && !!world && vw.id !== 'homeland', add: e.ctrlKey || e.metaKey, moved: 0 };
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
  // K2-09 Hangulat (50-mood.js): uDetail = floor lines, darkened feet, roof parapets, warm/cool window tints (static);
  // uTime + uFlick = a few windows switching on and off over time, only while the moving life runs
  // K2-03 grammar (51-grammar.js): per instance aGram = (typology, roof pitch, hash, awning hue),
  // aWear = (scaffolding, patina and ivy); uMat = how strongly materials tint the lens colour (1 on Alap)
  const uniforms = { uWinColor: { value: new THREE.Color(1.0, 0.78, 0.42) }, uWinGain: { value: 1.1 }, uBodyGlow: { value: 0 },
    uDetail: { value: 1 }, uTime: { value: 0 }, uFlick: { value: 0 }, uMat: { value: 1 } };
  mat.userData.uniforms = uniforms;
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
attribute float aLit; attribute float aFlash;
attribute vec2 aHouse; attribute vec4 aGram; attribute vec2 aWear;   // 51-grammar: (roof part, slope side), (kind, pitch, var, owner), (churn, age) — packed: WebGL allows 16 attributes
varying float vLit; varying float vFlash; varying vec3 vWPos; varying vec3 vONrm; flat varying float vSeed;
varying vec3 vObj; flat varying vec3 vScale; flat varying float vKind; flat varying float vVar; flat varying float vOwn; flat varying float vChurn; flat varying float vAge; flat varying float vRoofH;`)
      // the roof: ridge vertices rise by the pitch (in world units, so a tall house does not get a tall roof); towers
      // (over 16 high) are flat-roofed. The slope normals follow the real pitch.
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
float gSy = length(instanceMatrix[1].xyz), gSz = length(instanceMatrix[2].xyz);
float gKind = mod(aGram.x, 16.0), gDist = floor(aGram.x / 16.0 + 0.01);   // K2-04: typology and district, packed
float gTower = step(gDist == 2.0 ? 9.0 : 16.0, gSy) * (step(gKind, 3.5) + step(9.5, gKind));   // downtown climbs sooner
float gRoofH = aGram.y * (1.0 - gTower) * gSz * 0.5;
float gK = gRoofH / max(gSy, 0.001);
if (aHouse.y != 0.0) objectNormal = normalize(vec3(0.0, 0.5, aHouse.y * gK));`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
transformed.y += step(1.5, aHouse.x) * gK;
vLit = aLit; vFlash = aFlash; vONrm = objectNormal; vSeed = float(gl_InstanceID);
vKind = gTower > 0.5 ? 7.0 : gKind; vVar = aGram.z; vOwn = aGram.w; vChurn = aWear.x; vAge = aWear.y; vRoofH = gRoofH;
vObj = transformed; vScale = vec3(length(instanceMatrix[0].xyz), gSy, gSz);
vWPos = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying float vLit; varying float vFlash; varying vec3 vWPos; varying vec3 vONrm; flat varying float vSeed;
varying vec3 vObj; flat varying vec3 vScale; flat varying float vKind; flat varying float vVar; flat varying float vOwn; flat varying float vChurn; flat varying float vAge; flat varying float vRoofH;
// fract-only hash (no sin of large numbers: that amplified float noise into speckled windows);
// the seed is flat and every input is rounded, so a window cell is one value end to end
uniform vec3 uWinColor; uniform float uWinGain; uniform float uBodyGlow; uniform float uDetail; uniform float uTime; uniform float uFlick; uniform float uMat;
float cityHash(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
vec3 hueRgb(float h) { return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0); }
bool isK(float k) { return abs(vKind - k) < 0.5; }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
float hy = vObj.y * vScale.y;                       // height above the building's foot
if (abs(vONrm.y) < 0.5) {
  // the facade's own axis (the grown plan turns buildings, so world x / z would smear the windows on a turned facade)
  float u = (abs(vONrm.x) > 0.5 ? vObj.z * vScale.z : vObj.x * vScale.x);
  bool gable = hy > vScale.y + 0.01;                // the triangle under a pitched roof
  // window rhythm per typology: plaster / brick 1.1 x 1.4, timber 1.3, stone few and small, glass dense
  vec2 cs = isK(7.0) ? vec2(0.8, 1.05) : isK(9.0) ? vec2(2.4, 2.8) : isK(10.0) ? vec2(1.3, 1.7) : isK(3.0) ? vec2(1.7, 1.6) : isK(2.0) ? vec2(1.3, 1.4) : vec2(1.1 + 0.15 * vVar, 1.4);
  vec2 cell = vec2(u / cs.x, hy / cs.y);
  vec2 f = fract(cell);
  vec4 wb = isK(7.0) ? vec4(0.06, 0.94, 0.1, 0.92) : isK(9.0) ? vec4(0.05, 0.95, 0.14, 0.86) : isK(10.0) ? vec4(0.3, 0.7, 0.18, 0.86) : isK(3.0) ? vec4(0.36, 0.64, 0.3, 0.72) : vec4(0.22, 0.78, 0.28, 0.78);
  float win = step(wb.x, f.x) * step(f.x, wb.y) * step(wb.z, f.y) * step(f.y, wb.w);
  // barns and sheds: no rows of windows, only a band of small high ones (they still light with recent work)
  if (isK(5.0) || isK(6.0)) win *= step(vScale.y - 1.3, hy) * step(hy, vScale.y - 0.35) * step(0.3, f.x) * step(f.x, 0.7);
  // galleries: blank walls, one lit band
  if (isK(8.0)) win = step(abs(hy - vScale.y * 0.55), 0.35) * step(0.1, f.x) * step(f.x, 0.9);
  // shops: the ground floor is one wide shop window
  bool shopFloor = isK(4.0) && hy < 1.7;
  if (shopFloor) win = step(0.08, fract(u / 3.2)) * step(fract(u / 3.2), 0.92) * step(0.25, hy) * step(hy, 1.45);
  if (gable) win = step(1.0, vRoofH) * step(abs(u), 0.4) * step(vScale.y + 0.3, hy) * step(hy, vScale.y + vRoofH * 0.55);   // one attic window
  float face = dot(floor(vONrm + 0.5), vec3(1.0, 2.0, 3.0));
  float hc = cityHash(vec3(floor(cell), vSeed * 7.0 + face));
  float on = step(hc, vLit);
  if (shopFloor) on = step(0.15, vLit);              // a shop is lit while it is worked on at all
  // Hangulat: one window in eight follows its own slow clock (someone comes home, someone goes to bed)
  float hk = cityHash(vec3(floor(cell) + 17.0, vSeed * 3.0 + face));
  float tick = floor(uTime / (7.0 + 13.0 * hk) + hk * 9.0);
  float on2 = step(cityHash(vec3(floor(cell), vSeed * 7.0 + face + tick * 13.1)), vLit);
  on = mix(on, on2, uFlick * step(0.875, hk));
  float far = smoothstep(0.25, 0.6, max(fwidth(cell.x), fwidth(cell.y)));
  float near = 1.0 - far;
  win = mix(win, isK(5.0) || isK(6.0) || isK(8.0) ? 0.08 : isK(7.0) ? 0.6 : 0.3, far); on = mix(on, vLit, far);
  // wall materials (seen close; they fade out with distance like the windows)
  float wall = 1.0; vec3 tintM = vec3(1.0);
  if (isK(1.0)) {                                   // brick: courses and staggered joints
    float row = floor(hy / 0.28), jx = fract(u / 0.6 + 0.5 * mod(row, 2.0));
    wall -= near * 0.22 * max(step(0.86, fract(hy / 0.28)), step(0.93, jx));
    tintM = vec3(1.12, 0.86, 0.74);
  } else if (isK(2.0)) {                            // timber framing: dark posts, rails and a brace per bay
    float post = step(fract(u / 1.3 + 0.04), 0.08), rail = step(fract(hy / 1.4 + 0.03), 0.06);
    float brace = step(abs(fract(u / 1.3) - fract(hy / 1.4)), 0.05);
    wall -= near * 0.5 * clamp(post + rail + brace * (1.0 - win), 0.0, 1.0);
    tintM = vec3(1.1, 1.04, 0.9);
  } else if (isK(3.0)) {                            // stone: big blocks, pale
    float row = floor(hy / 0.55), jx = fract(u / 1.1 + 0.5 * mod(row, 2.0));
    wall -= near * 0.16 * max(step(0.9, fract(hy / 0.55)), step(0.95, jx));
    wall *= 0.92 + 0.16 * cityHash(vec3(floor(u / 1.1), row, vSeed));
    tintM = vec3(0.95, 0.97, 1.02) * 1.15;
  } else if (isK(5.0) || isK(6.0)) {                // barns and sheds: vertical planks and a big door
    wall -= near * 0.18 * step(0.88, fract(u / 0.35));
    float door = step(abs(u), isK(5.0) ? 1.1 : 0.45) * step(hy, isK(5.0) ? 2.4 : 1.6) * step(0.5, abs(vONrm.z));
    wall *= 1.0 - 0.55 * door;
    tintM = vec3(1.08, 0.9, 0.78);
  } else if (isK(7.0)) {                            // glass: cool, with a sky gradient in it
    tintM = mix(vec3(0.55, 0.75, 1.0), vec3(0.85, 0.95, 1.1), clamp(hy / max(vScale.y, 1.0), 0.0, 1.0));
  } else if (isK(9.0)) {                            // villas: white render, a dark plinth
    tintM = vec3(1.75, 1.72, 1.62) * (hy < 0.45 ? 0.45 : 1.0);
  } else if (isK(10.0)) {                           // college halls: pale plaster with a stone string course per floor
    wall -= near * 0.12 * step(0.92, fract(hy / 1.7));
    tintM = vec3(1.32, 1.27, 1.12);
  } else if (isK(8.0)) {                            // galleries: smooth panels
    wall -= near * 0.1 * step(0.95, fract(u / 2.4));
    tintM = vec3(1.05);
  }
  diffuseColor.rgb *= wall * mix(vec3(1.0), tintM, uMat * uDetail);
  if (isK(9.0)) diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.66, 0.68, 0.7) * wall * (hy < 0.45 ? 0.4 : 1.0), 0.8 * uMat * uDetail);   // villas: white render (a blend: a tint of a dark lens colour stays dark)
  // patina and ivy: old buildings darken, and ivy climbs from the foot (age since the last change)
  float ivyN = cityHash(vec3(floor(u * 1.6), floor(hy * 1.6), vSeed));
  float ivy = near * step(ivyN * 0.5 + hy / max(4.0, vScale.y) * 1.4, vAge * 1.25 - 0.2);
  diffuseColor.rgb *= 1.0 - (isK(9.0) ? 0.08 : 0.28) * vAge * uDetail;   // villas are kept up
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.05, 0.11, 0.05), ivy * 0.85 * uDetail * (1.0 - win));
  // awning: the main author's colour over the ground floor, on the long sides (shops always, houses now and then)
  if ((isK(4.0) || (vVar > 0.72 && vKind < 2.5)) && abs(vONrm.z) > 0.5 && vOwn >= 0.0) {
    float aw = step(1.75, hy) * step(hy, 2.15) * step(abs(u), vScale.x * 0.42);
    diffuseColor.rgb = mix(diffuseColor.rgb, hueRgb(fract(vOwn * 0.618 + 0.05)) * 0.55, aw * near * uDetail);
  }
  // detail: a darker line at every floor, dark feet (contact shade), a lighter parapet just under a flat roof
  float floorLine = (1.0 - smoothstep(0.0, 0.07, fract(vWPos.y / 1.4))) * near * (isK(7.0) ? 0.4 : 1.0);
  float feet = exp(-hy / 1.1);
  float parapet = smoothstep(0.35, 0.0, vScale.y - hy) * step(2.0, vScale.y) * step(vRoofH, 0.05) * (gable ? 0.0 : 1.0);
  diffuseColor.rgb *= 1.0 - uDetail * (0.16 * floorLine + 0.5 * feet);
  diffuseColor.rgb *= 1.0 + uDetail * 0.35 * parapet;
  diffuseColor.rgb *= mix(1.0, isK(7.0) ? 0.55 : 0.35, win);
  vec3 tint = mix(vec3(1.0), mix(vec3(1.08, 0.92, 0.78), vec3(0.8, 0.95, 1.15), step(0.8, hc)), uDetail * 0.6);
  totalEmissiveRadiance += win * on * uWinColor * tint * uWinGain * (shopFloor ? 1.35 : 1.0);
  // scaffolding: churned in the last week — poles, planks and a brace over the facade
  if (vChurn > 0.0) {
    float pole = step(fract(u / 1.6), 0.05), plank = step(fract(hy / 1.4 + 0.5), 0.06), br = step(abs(fract(u / 1.6) - fract(hy / 1.4)), 0.035);
    float sc = clamp(pole + plank + br * 0.7, 0.0, 1.0) * step(hy, vScale.y) * mix(1.0, near, 0.7);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.62, 0.55, 0.42), sc * min(1.0, vChurn) * 0.9);
  }
} else if (vONrm.y > 0.5) {
  if (vRoofH > 0.05) {
    // a pitched roof: tiles in rows down the slope; terracotta on houses, slate on stone, tar on sheds
    float rows = step(0.82, fract(abs(vObj.z) * vScale.z * 3.2));
    vec3 tile = (isK(3.0) || isK(10.0)) ? vec3(0.55, 0.62, 0.72) : (isK(5.0) || isK(6.0)) ? vec3(0.5, 0.5, 0.48) : isK(2.0) ? vec3(0.95, 0.62, 0.42) : vec3(1.2, 0.58, 0.42);
    diffuseColor.rgb *= mix(vec3(1.0), tile, uMat * uDetail) * (1.0 - 0.18 * rows * uDetail);
    float ridge = 1.0 - smoothstep(0.0, 0.18, abs(vObj.z) * vScale.z);
    diffuseColor.rgb *= 1.0 - 0.25 * ridge * uDetail;
  } else {
    // a flat roof: a lighter parapet ring, a slightly darker, grainy middle, a plant room on the big ones
    float edge = min((0.5 - abs(vObj.x)) * vScale.x, (0.5 - abs(vObj.z)) * vScale.z);
    float rim = 1.0 - smoothstep(0.0, 0.28, edge);
    float grain = cityHash(vec3(floor(vWPos.xz * 2.0), vSeed));
    float plant = step(abs(vObj.x - (vVar - 0.5) * 0.3) * vScale.x, 1.1) * step(abs(vObj.z) * vScale.z, 0.8) * step(5.0, vScale.x * vScale.z);
    diffuseColor.rgb *= 1.0 + uDetail * (0.45 * rim - 0.12 * (1.0 - rim) + 0.06 * (grain - 0.5) + 0.25 * plant);
  }
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
    plates.setColorAt(i, col.setHSL(0.57, 0.3, 0.06 + Math.min(d.depth, 6) * 0.025));
  });

  // every file that ever existed gets an instance (index = file index); 05-replay sizes them,
  // and a file that does not exist at the shown commit is scaled to nothing
  const all = model.city.files;
  const geo = houseGeometry();   // 51-grammar: walls and a gable roof the shader raises per building
  grammarAttrs(geo, all);
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
    new THREE.MeshBasicMaterial({ color: 0x93d3e6, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  beacon.visible = false;
  group.add(plates, buildings, beacon);
  // the grown plan's ground and streets (02-grow.js); the folder plates belong to the treemap plan
  const grow = model.grow ? growMeshes(model, group) : null;
  const grown = !!grow && plan.mode === 'grow';
  plates.visible = !grown;
  if (grow) grow.visible = grown;
  scene.add(group);
  scene.fog = new THREE.Fog(HORIZON, model.side * 1.1, model.side * 3.2);
  world = { group, buildings, plates, grow, fileOf: all, dirOf: dirs, baseColor, beacon };
  moodBuild(model);   // 50-mood: shadows, street lamps, the shining shore, the people and carts
  replayPrepare(model);
  applyTime(replay.last, false);

  if (grown) orbit.target.set(model.grow.centre[0], 0, model.grow.centre[1]);
  else orbit.target.set(0, 0, 0);
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
  // hidden plates (the grown plan) must not be picked: the raycaster ignores visibility
  const hit = ray.intersectObjects(world.plates.visible ? [world.buildings, world.plates] : [world.buildings], false)
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

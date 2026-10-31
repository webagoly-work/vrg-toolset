// 41-hm-island.js — the fixed island of Gépország: terrain, the board's real roads, the complexes and their archetypes, the
// underground slabs, and the water. Coordinates are "concept units" (u, v 0..100, as on docs/city/homeland/concept-sheet);
// hmW turns them into world units. Everything is instanced boxes and a few primitives built in code: our own drawing.
// The water is a real horizontal plane around the island (CITY-D40): a click on it starts a ring in world space, the
// island stands in it and takes no ripple, and it moves only then (Mélyvíz M2, M3), unlike 38-sea's screen-space field.

const HM_K = 3.2, hmW = u => (u - 50) * HM_K;
const HM_COL = { body: 0x56606b, top: 0x74808a, side: 0x3b444c, warm: 0xe8a873, ice: 0x93d3e6, plate: 0x33505f, rim: 0x5d7c8c, road: 0x34505f, lot: 0x26343e, grey: 0x3a4249 };
const HM_SHORE = [[6, 8], [40, 2], [78, 6], [98, 22], [100, 62], [94, 90], [60, 98], [20, 98], [4, 84], [2, 40]];
// roads: the street plan is this board's wiring; RAM and the GPU hang off the CPU, all else behind the junction
const HM_J = [50, 72];
const HM_PATHS = {
  mem: [[58, 31], [64, 31]], gpu: [[37, 31], [30, 31]], main: [[47, 41], [47, 50], [52, 50], [52, 69]],
  C: [HM_J, [66, 73], [66, 60], [69, 60]], H: [HM_J, [66, 73], [66, 69.5], [69, 69.5]], G: [HM_J, [66, 73], [66, 78.5], [69, 78.5]], F: [HM_J, [66, 73], [66, 88], [90, 84], [95, 79]],
  net: [HM_J, [28, 73], [28, 76]],
};
// where programs stand: a plot grid per place, [u0, v0, u1, v1, the plot's size]
const HM_PLACES = { belvaros: [10, 46, 35, 68, 4.4], muhely: [37, 7, 62, 18, 3.4], kulvaros: [85, 24, 97, 58, 2.8], palota: [55, 52, 63, 64, 2.6], laktanya: [34, 83, 47, 94, 3] };

const hmKit = { box: [], plain: [], cyl: [], dome: [], saw: [], roof: [] };
const hmEnts = new Map();
function hmEnt(id, name, tag, src = {}) { const e = Object.assign({ id, name, tag, parts: [] }, src); hmEnts.set(id, e); return e; }
function hmPut(kind, ent, u, v, w, d, h, col, y = 0) {
  const part = { kind, ent, m: new THREE.Matrix4().makeScale(w * HM_K, h, d * HM_K).setPosition(hmW(u + w / 2), y, hmW(v + d / 2)), col, tag: ent ? ent.tag : 'M' };
  hmKit[kind].push(part);
  return part;
}

// ---- the archetypes
function hmHall(i, u, v) {   // a factory hall: a CPU core, two assembly lines on its roof, a sawtooth roof, a chimney
  const e = hmEnt('hall' + i, `Gyárcsarnok ${i + 1}`, 'M', { core: i, parent: 'fab' });
  hmPut('box', e, u, v, 6, 8, 11, HM_COL.body);
  for (let k = 0; k < 3; k++) hmPut('saw', e, u + k * 2, v + 0.3, 2, 7.4, 3.2, HM_COL.top, 11);
  hmPut('cyl', e, u + 4.4, v + 1, 1.1, 1.1, 24, HM_COL.top);
  hmPut('cyl', e, u + 4.4, v + 1, 1.1, 1.1, 1.4, HM_COL.warm, 24);
}
function hmWarehouse(id, name, letter, u, v, w, d, h, roof, fn) {
  const e = hmEnt(id, name, 'M', { disk: letter });
  hmPut('box', e, u, v, w, d, h, HM_COL.body);
  hmPut('plain', e, u - 0.2, v - 0.2, w + 0.4, d + 0.4, 1.2, roof, h);
  if (fn) fn(e);
}
function hmIslandParts() {
  for (let j = 0; j < 2; j++) for (let i = 0; i < 3; i++) hmHall(j * 3 + i, 37 + i * 7.2, 22 + j * 10.6);
  hmEnt('fab', 'Gyárnegyed', 'M', { labelAt: [47, 31, 44] });
  const st = hmEnt('studio', 'Filmgyár', 'M', { labelAt: [20, 29, 36] });
  hmPut('box', st, 12, 24, 12, 10, 17, HM_COL.body); hmPut('roof', st, 12, 24, 12, 10, 5, HM_COL.top, 17);
  hmPut('box', st, 25, 26, 5, 8, 12, HM_COL.body); hmPut('box', st, 13, 36, 9, 5, 9, HM_COL.body);
  hmPut('plain', st, 8, 36, 0.8, 9, 16, HM_COL.grey, 3); hmPut('plain', st, 8.1, 36, 0.3, 9, 0.5, HM_COL.ice, 19);
  const pa = hmEnt('palace', 'Palota', 'M', { labelAt: [46, 58, 62] });
  hmPut('box', pa, 39, 53, 13, 10, 10, HM_COL.body); hmPut('box', pa, 42, 55.5, 7, 5, 16, HM_COL.top);
  hmPut('dome', pa, 42.5, 55.5, 6, 5, 11, HM_COL.ice, 16); hmPut('cyl', pa, 45.2, 57.6, 0.6, 0.6, 9, HM_COL.warm, 26);
  hmPut('box', pa, 37, 53, 1.8, 1.8, 18, HM_COL.body); hmPut('box', pa, 52.2, 53, 1.8, 1.8, 18, HM_COL.body);
  hmPut('box', pa, 37, 61.2, 1.8, 1.8, 18, HM_COL.body); hmPut('box', pa, 52.2, 61.2, 1.8, 1.8, 18, HM_COL.body);
  const ju = hmEnt('junction', 'Rendező', 'K', { labelAt: [50, 72, 18] });
  for (let i = 0; i < 4; i++) hmPut('plain', ju, 41, 69 + i * 2, 17, 0.4, 0.5, HM_COL.warm);
  hmPut('box', ju, 47, 77.5, 7, 3, 6, HM_COL.body); hmPut('roof', ju, 47, 77.5, 7, 3, 2, HM_COL.top, 6);
  hmWarehouse('whC', 'Nagy Logisztikai Központ', 'C:', 69, 56, 16, 8, 20, HM_COL.top);
  hmWarehouse('whH', 'Levéltár', 'H:', 69, 66, 11, 7, 15, HM_COL.warm, e => { hmPut('plain', e, 74, 73, 1, 0.2, 7, HM_COL.ice); });
  hmWarehouse('whG', 'Téglaraktár', 'G:', 69, 75, 13, 7, 10, HM_COL.side, e => { hmPut('box', e, 83, 76, 1, 1, 20, HM_COL.top); hmPut('plain', e, 78, 76, 7, 1, 2, HM_COL.top, 20); });
  const ba = hmEnt('whF', 'Uszályraktár', 'M', { disk: 'F:' });
  hmPut('box', ba, 96, 72, 4, 13, 4, HM_COL.side, -1); hmPut('plain', ba, 96.4, 74, 3.2, 9, 3, HM_COL.top, 3);
  const ha = hmEnt('harbour', 'Tengeri kikötő', 'M', { labelAt: [20, 80, 18] });
  hmPut('plain', ha, 12, 76, 16, 3, 1.4, HM_COL.road); hmPut('plain', ha, 12, 82, 16, 3, 1.4, HM_COL.road);
  hmPut('box', ha, 14, 87, 9, 4, 6, HM_COL.top); hmPut('box', ha, 9, 79, 3, 3, 10, HM_COL.body);
  const mi = hmEnt('barracks', 'Laktanya', 'M', { labelAt: [39, 94, 22] });
  hmPut('box', mi, 34, 95, 9, 2.4, 6, HM_COL.body); hmPut('cyl', mi, 46, 92, 1.4, 1.4, 20, HM_COL.top); hmPut('dome', mi, 45.6, 91.6, 2.2, 2.2, 3, HM_COL.ice, 20);
  hmEnt('empty', 'Üres telek', 'M', { labelAt: [73, 15, 8] });
  hmEnt('market', 'Piac', 'M', { labelAt: [73, 30, 14] });
  hmEnt('downtown', 'Belváros', 'M', { labelAt: [22, 44, 62], area: 'belvaros' });
  hmEnt('workshops', 'Műhelysor', 'M', { labelAt: [49, 12, 26], area: 'muhely' });
  hmEnt('suburbs', 'Külváros', 'M', { labelAt: [91, 22, 20], area: 'kulvaros' });
}

function hmMesh(kind, geo, mat) {
  const list = hmKit[kind];
  const im = new THREE.InstancedMesh(geo, mat, list.length), c = new THREE.Color();
  im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); im.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 700);
  list.forEach((p, i) => { im.setMatrixAt(i, p.m); im.setColorAt(i, c.setHex(p.col)); p.i = i; if (p.ent) p.ent.parts.push(p); });
  im.userData.parts = list;
  hm.group.add(im);
  return im;
}
function hmSawGeo() {
  const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(1, 0); s.lineTo(0, 1); s.closePath();
  return new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false }).translate(-0.5, 0, -0.5);
}
function hmLabel(text, x, y, z, w = 44, col = '#c9d3ee') {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: landLabel(text, col), fog: false, depthWrite: false, depthTest: false, transparent: true }));
  sp.position.set(x, y, z); sp.scale.set(w, w * 96 / 512, 1); sp.renderOrder = 6;
  sp.raycast = () => {};
  return sp;
}

function hmBuild() {
  hm.group = new THREE.Group();
  hm.surface = new THREE.Group(); hm.under = new THREE.Group();
  // terrain: a plug of rock, its top at y = 0, so the layers below have somewhere to be
  const shape = new THREE.Shape(HM_SHORE.map(([u, v]) => new THREE.Vector2(hmW(u), hmW(v))));
  const landGeo = new THREE.ExtrudeGeometry(shape, { depth: 78, bevelEnabled: false }).rotateX(Math.PI / 2);
  hm.landMat = new THREE.MeshLambertMaterial({ color: HM_COL.plate, transparent: true });
  hm.land = new THREE.Mesh(landGeo, hm.landMat);
  hm.group.add(hm.land);
  hm.shore = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(HM_SHORE.map(([u, v]) => new THREE.Vector3(hmW(u), 0.2, hmW(v)))), new THREE.LineBasicMaterial({ color: HM_COL.rim, transparent: true }));
  hm.group.add(hm.shore);
  // the kit
  hmIslandParts();
  for (const [id, pts] of Object.entries(HM_PATHS)) for (let i = 1; i < pts.length; i++) hmRoad(id, pts[i - 1], pts[i]);
  hm.mBody = buildingMaterial();
  hm.mPlain = new THREE.MeshLambertMaterial({ transparent: true });
  const box = unitBox;
  hm.meshBox = hmMesh('box', box.clone(), hm.mBody);
  const n = hmKit.box.length;
  hm.meshBox.geometry.setAttribute('aLit', new THREE.InstancedBufferAttribute(new Float32Array(n), 1).setUsage(THREE.DynamicDrawUsage));
  hm.meshBox.geometry.setAttribute('aFlash', new THREE.InstancedBufferAttribute(new Float32Array(n), 1).setUsage(THREE.DynamicDrawUsage));
  hm.meshes = [hm.meshBox, hmMesh('plain', box, hm.mPlain),
    hmMesh('cyl', new THREE.CylinderGeometry(0.5, 0.56, 1, 12).translate(0, 0.5, 0), hm.mPlain),
    hmMesh('dome', new THREE.SphereGeometry(0.5, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 2, 1), hm.mPlain),
    hmMesh('saw', hmSawGeo(), hm.mPlain),
    hmMesh('roof', new THREE.ConeGeometry(0.72, 1, 4).rotateY(Math.PI / 4).translate(0, 0.5, 0), hm.mPlain)];
  hm.meshes.forEach(m => hm.surface.add(m));
  hmCityBuild();   // 42-hm-city: lots, plots, rooms, vehicles
  // labels: one per complex
  hm.labels = [];
  for (const e of hmEnts.values()) if (e.labelAt) {
    const [u, v, y] = e.labelAt, w = 34 + e.name.length * 1.3, sp = hmLabel(e.name, hmW(u), y, hmW(v), w);
    sp.userData.ent = e; sp.userData.at = [hmW(u), y, hmW(v)]; sp.userData.w = w; hm.labels.push(sp); hm.surface.add(sp);
  }
  // underground: a slab per layer, each with its sign
  const slab = (y, col, op) => { const m = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 1.5, bevelEnabled: false }).rotateX(Math.PI / 2).translate(0, y, 0), new THREE.MeshLambertMaterial({ color: col, transparent: true, opacity: op })); return m; };
  hm.deep = new THREE.Group(); hm.bed = new THREE.Group();
  hm.slabU = slab(-38, 0x152935, 0.9); hm.slabD = slab(-56, 0x102029, 0.92); hm.slabB = slab(-72, 0x3a2d22, 1);
  hm.under.add(hm.slabU); hm.deep.add(hm.slabD); hm.bed.add(hm.slabB);
  hm.uLabel = hmLabel('Alváros', hmW(50), -14, hmW(6), 60); hm.under.add(hm.uLabel);
  hm.dLabel = hmLabel('Mélyút', hmW(50), -32, hmW(6), 60); hm.deep.add(hm.dLabel);
  hm.bedLabel = hmLabel('Alapkő', 0, -46, hmW(30), 96); hm.bed.add(hm.bedLabel);
  hm.stone = new THREE.Mesh(new THREE.BoxGeometry(60, 14, 22).translate(0, 7, 0), new THREE.MeshLambertMaterial({ color: 0x8a7350 }));
  hm.stone.position.set(0, -72, 0); hm.stone.userData.ent = hmEnt('bedrock', 'Alapkő', 'M'); hm.bed.add(hm.stone);
  hm.group.add(hm.surface, hm.under, hm.deep, hm.bed);
  hmWaterBuild();
  hmZonesInit();   // 44-hm-grow: the second plan moves these same parts
  scene.add(hm.group);
  hmTagsApply();
}
function hmRoad(id, a, b) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]), ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
  const m = new THREE.Matrix4().makeRotationY(-ang).scale(new THREE.Vector3(L * HM_K + 3, 0.3, id === 'mem' ? 3.6 : id === 'main' ? 7 : 4.5)).setPosition(hmW((a[0] + b[0]) / 2), 0.05, hmW((a[1] + b[1]) / 2));
  hmKit.plain.push({ kind: 'plain', ent: null, m, col: id === 'mem' ? HM_COL.warm : HM_COL.road, road: id });
}

// the layer you look at is solid; everything above it is a ghost with its links still visible
function hmLayerApply() {
  const l = hm.layer, ghost = l > 0;
  hm.landMat.opacity = ghost ? 0.08 : 1; hm.landMat.depthWrite = !ghost;
  for (const m of [hm.mBody, hm.mPlain]) { m.transparent = ghost; m.opacity = ghost ? 0.1 : 1; m.depthWrite = !ghost; m.needsUpdate = true; }
  hm.dynMat.transparent = ghost; hm.dynMat.opacity = ghost ? 0.12 : 1; hm.dynMat.depthWrite = !ghost; hm.dynMat.needsUpdate = true;
  hm.lotMat.opacity = ghost ? 0.1 : 1; hm.lotMat.transparent = ghost; hm.lotMat.depthWrite = !ghost;
  for (const s of hm.labels) s.visible = !ghost;
  if (hm.grow) hm.grow.visible = !ghost && hm.planK > 0;
  hm.under.visible = l === 1; hm.deep.visible = l === 1 || l === 2; hm.bed.visible = l >= 2; hm.rooms.visible = l >= 1;
  hm.dLabel.visible = l === 2;
  hm.slabU.material.opacity = l > 1 ? 0.15 : 0.9;
  hm.slabD.material.opacity = l > 2 ? 0.15 : 0.92;
  hm.water.material.uniforms.uAlpha.value = ghost ? 0.2 : 1;
  hm.water.material.depthWrite = !ghost;
  hm.shore.visible = true;
  requestRender();
}
// the truth display (CITY-D45): Jelölés paints metaphor grey and marks the approximate; Mérés leaves only the measured
function hmTagsApply() {
  const c = new THREE.Color();
  for (const im of [...hm.meshes, ...(hm.gMeshes || [])]) {
    im.userData.parts.forEach(p => {
      const off = hm.truth && p.tag === 'J', dim = hm.tags && p.tag === 'J', approx = hm.tags && p.tag === 'K';
      c.setHex(p.col); if (dim) c.setHex(HM_COL.grey); if (approx) c.lerp(new THREE.Color(0x8a939b), 0.35);
      if (off) c.multiplyScalar(0.25);
      im.setColorAt(p.i, c);
    });
    im.instanceColor.needsUpdate = true;
  }
  for (const s of hm.labels) { const e = s.userData.ent; s.material.map = landLabel((hm.tags && e.tag === 'K' ? '≈ ' : '') + e.name, hm.tags && e.tag === 'K' ? '#e3be7b' : '#c9d3ee'); s.material.needsUpdate = true; }
}

// ---- the water: a horizontal plane; rings live in world space and stop by themselves
const HM_WAVES = 6;
function hmWaterBuild() {
  const hor = new THREE.Color(HORIZON), srgb = c => { const o = {}; c.getRGB(o, THREE.SRGBColorSpace); return new THREE.Vector3(o.r, o.g, o.b); };
  const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: true,
    uniforms: { uT: { value: 0 }, uD: { value: Array.from({ length: HM_WAVES }, () => new THREE.Vector3(0, 0, -99)) }, uAlpha: { value: 1 }, uHor: { value: srgb(hor) }, uDeep: { value: srgb(hor.clone().multiplyScalar(0.42)) }, uHi: { value: new THREE.Vector3(0.37, 0.56, 0.62) }, uCam: { value: new THREE.Vector3() } },
    vertexShader: `varying vec3 vP;void main(){vec4 w=modelMatrix*vec4(position,1.);vP=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`,
    fragmentShader: `precision highp float;varying vec3 vP;uniform float uT,uAlpha;uniform vec3 uD[${HM_WAVES}],uHor,uDeep,uHi,uCam;
void main(){vec2 p=vP.xz,g=vec2(0.);
for(int i=0;i<${HM_WAVES};i++){float age=uT-uD[i].z;if(age<0.||age>6.)continue;vec2 r=p-uD[i].xy;float d=max(length(r),.001),f=age*70.;
float env=exp(-age*.75)*exp(-abs(d-f)/46.)*smoothstep(0.,14.,d);g+=r/d*cos((d-f)*.34)*env;}
float dist=length(vP-uCam);
vec2 q=(p+g*22.)/44.;vec2 c=abs(fract(q+.5)-.5)*44.;float w=fwidth(p.x)*1.2+.25;float ln=1.-smoothstep(0.,w,min(c.x,c.y));
vec3 col=mix(uDeep,uHor,smoothstep(120.,1400.,dist));
col=mix(col,vec3(.91,.94,.96),ln*.07*(1.-smoothstep(300.,1100.,dist)));
float l=dot(normalize(vec3(g.x,1.,g.y)),normalize(vec3(-.35,.7,.55)));col+=uHi*max(0.,(l-.78))*3.2*length(g);col+=uHi*length(g)*.35;
gl_FragColor=vec4(col,uAlpha);
#include <colorspace_fragment>
gl_FragColor.rgb=col;}`, extensions: {} });
  hm.water = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000).rotateX(-Math.PI / 2), mat);
  hm.water.position.y = -1.2; hm.water.renderOrder = -1;
  hm.water.raycast = () => {};
  hm.group.add(hm.water);
  hm.waveI = 0; hm.waveUntil = 0;
}
function hmWave(x, z) {
  const u = hm.water.material.uniforms, now = performance.now() / 1000;
  u.uT.value = now; u.uD.value[hm.waveI++ % HM_WAVES].set(x, z, now);
  hm.waveUntil = now + (matchMedia('(prefers-reduced-motion: reduce)').matches ? 0.1 : 6);
  hmAnimate();
}
// a point of the water plane under the pointer, or null when the pointer is on the island or above the horizon
function hmWaterAt(e) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const p = ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 1.2), new THREE.Vector3());
  return p && !hmOnIsland(p.x, p.z) ? p : null;
}
function hmOnIsland(x, z) {
  let inside = false;
  for (let i = 0, j = HM_SHORE.length - 1; i < HM_SHORE.length; j = i++) {
    const xi = hmW(HM_SHORE[i][0]), zi = hmW(HM_SHORE[i][1]), xj = hmW(HM_SHORE[j][0]), zj = hmW(HM_SHORE[j][1]);
    if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

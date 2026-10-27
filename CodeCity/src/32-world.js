// 32-world.js — the GitWorld planet (P9, KV-20; report §1.6; CITY-D21 A, D22 A). The repos we took code from
// (CodeCity/world.json, a snapshot of public GitHub metadata, inlined as WORLD — so the planet renders offline) stand
// as foreign cities on a globe. The Land sits on the north pole: the planet is ~12× the Land, so from the Land its
// surface just curves away like a horizon — no morph and no seam, and float32 is still exact at this size; the
// camera's near/far follow the zoom (report M3's rule). Continents are ecosystems (web JS/TS, Python, C/C++, Rust/Go,
// other) in a ring around our Land, because every one of these repos is a dependency of ours (D22 A: "near us");
// a city's height is its stars (log), its colour its licence. Map of GitHub as a faint background is left for later
// (it needs its own data file and attribution).

const wd = { group: null, R: 0 };
const WD_FAMILY = [['web', 'Web (JS, TS, HTML)', /^(JavaScript|TypeScript|HTML|CSS|Elm|PHP|Vue|Svelte)$/, 0x3a5a8a],
  ['py', 'Python', /^Python$/, 0x3a6a4a], ['c', 'C / C++', /^(C|C\+\+|Objective-C)$/, 0x6a4a3a], ['sys', 'Rust / Go', /^(Rust|Go|Zig)$/, 0x5a3a6a], ['other', 'Egyéb', /.*/, 0x4a4a5a]];
const WD_LIC = l => !l ? 0x8b97b5 : /^MIT/.test(l) ? 0x6fe39a : /Apache/.test(l) ? 0x6fa8ff : /^BSD/.test(l) ? 0x4fd1c5 : /GPL/.test(l) ? 0xff6b6b : /MPL/.test(l) ? 0xffb347 : /^CC0|Unlicense/.test(l) ? 0xffffff : 0x8b97b5;
const wdExt = () => { const ps = LAND.places.map(p => landPos(p.slot)); return Math.max(...ps.map(p => Math.hypot(p.x, p.z))) + landR(); };
const wdHash = s => { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0; return h / 4294967296; };
// a point on the planet: lat/lon in degrees (lat 90 = the north pole, where the Land is)
function wdAt(lat, lon, up = 0) {
  const R = wd.R + up, a = (90 - lat) * Math.PI / 180, b = lon * Math.PI / 180;
  return new THREE.Vector3(R * Math.sin(a) * Math.cos(b), -wd.R + R * Math.cos(a), R * Math.sin(a) * Math.sin(b));
}
function worldDraw() {
  if (!world || !LAND || typeof WORLD === 'undefined' || !WORLD) return;
  if (wd.group) { world.group.remove(wd.group); wd.group.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
  wd.group = new THREE.Group();
  wd.R = wdExt() * 12;
  const R = wd.R;
  const sea = new THREE.Mesh(new THREE.SphereGeometry(R, 128, 96), new THREE.MeshLambertMaterial({ color: 0x0b1530 }));
  sea.position.set(0, -R - 0.6 * agScale(), 0);
  const halo = new THREE.Mesh(new THREE.SphereGeometry(R * 1.04, 64, 48), new THREE.MeshBasicMaterial({ color: 0x2a6aff, transparent: true, opacity: 0.08, side: THREE.BackSide, fog: false }));
  halo.position.copy(sea.position);
  if (KV_OVERLAY) sea.visible = halo.visible = false;   // 00-wallpaper: in the overlay the desktop is the sea
  wd.group.add(sea, halo);
  // continents: a ring of ecosystems around the pole, each a cap; its repos inside it
  const fams = WD_FAMILY.map(f => ({ f, repos: WORLD.repos.filter(r => (WD_FAMILY.find(x => x[2].test(r.language || '')) || WD_FAMILY[4])[0] === f[0]) })).filter(x => x.repos.length);
  const k = agScale(), maxStars = Math.max(...WORLD.repos.map(r => r.stars || 0), 10);
  fams.forEach(({ f, repos }, i) => {
    const lon = i * 360 / fams.length, lat = 62, spread = 9 + Math.sqrt(repos.length) * 2.2;
    const cap = new THREE.Mesh(new THREE.SphereGeometry(R * 1.0005, 48, 12, 0, Math.PI * 2, 0, spread * Math.PI / 180),
      new THREE.MeshBasicMaterial({ color: f[3], transparent: true, opacity: 0.75, fog: false, side: THREE.DoubleSide }));
    cap.position.copy(sea.position);
    // a partial sphere is centred on +Y: turn +Y onto the continent's centre
    cap.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), wdAt(lat, lon).sub(sea.position).normalize());
    wd.group.add(cap);
    const lb = new THREE.Sprite(new THREE.SpriteMaterial({ map: landLabel(f[1], '#c9d3ee'), fog: false, depthWrite: false }));
    lb.position.copy(wdAt(lat + spread * 0.55, lon, R * 0.02)); lb.scale.set(R * 0.12, R * 0.022, 1);
    wd.group.add(lb);
    repos.forEach((r, j) => {
      const da = wdHash(r.repo) * Math.PI * 2, dr = Math.sqrt(wdHash(r.repo + '#')) * spread * 0.8;
      const pLat = lat + dr * Math.cos(da), pLon = lon + dr * Math.sin(da) / Math.max(0.2, Math.cos(lat * Math.PI / 180));
      const h = R * 0.004 + R * 0.05 * Math.log10(1 + (r.stars || 0)) / Math.log10(1 + maxStars), base = wdAt(pLat, pLon), up = base.clone().sub(sea.position).normalize();
      const tower = new THREE.Mesh(new THREE.BoxGeometry(R * 0.012, h, R * 0.012).translate(0, h / 2, 0),
        new THREE.MeshBasicMaterial({ color: WD_LIC(r.license), transparent: !!r.archived, opacity: r.archived ? 0.4 : 1, fog: false }));
      tower.position.copy(base);
      tower.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), up);
      wd.group.add(tower);
      if (WORLD.repos.indexOf(r) < 12) {
        const t = new THREE.Sprite(new THREE.SpriteMaterial({ map: landLabel(r.repo.split('/')[1], '#e8eefc'), fog: false, depthWrite: false }));
        t.position.copy(base).add(up.clone().multiplyScalar(h + R * 0.012)); t.scale.set(R * 0.07, R * 0.013, 1);
        wd.group.add(t);
      }
    });
  });
  // our Land, seen from space: a bright ring on the pole (only from space — from the Land it would be a wall)
  const ring = new THREE.Mesh(new THREE.TorusGeometry(wdExt() * 1.1, R * 0.003, 8, 64).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x6fd3ff, fog: false }));
  ring.visible = land.at === 'world';
  wd.ring = ring;
  wd.group.add(ring);
  wd.group.traverse(o => { o.raycast = () => {}; });
  world.group.add(wd.group);
  requestRender();
}
// near/far follow the zoom (M3), so the planet and a single building both draw sharp
function worldCam() {
  const far = Math.max(5000, orbit.r * 6 + (wd.R || 0) * 2.5), near = Math.max(0.5, orbit.r * 0.002);
  if (camera.far !== far || camera.near !== near) { camera.far = far; camera.near = near; camera.updateProjectionMatrix(); }
}
function worldGo(ms = 800) { if (wd.R) flyCamera([0, 0, orbit.theta, 0.35, wd.R * 3.1], window.KV_INSTANT ? 0 : ms); }
function worldPanelHtml() {
  if (typeof WORLD === 'undefined' || !WORLD) return '<p class="dim">Nincs world.json — node CodeCity/world.js</p>';
  return `<h3>GitWorld — ${hu(WORLD.repos.length)} idegen város</h3><p class="dim">Ahonnan kódot hoztunk (vendor-manifest.json); magasság: csillagok, szín: licenc. Pillanatkép: ${esc(WORLD.fetched)} — node CodeCity/world.js frissíti.</p>` +
    WORLD.repos.slice(0, 14).map(r => `<div><b>${esc(r.repo)}</b> <span class="dim">★ ${r.stars !== null ? hu(r.stars) : '?'} · ${esc(r.license || '?')} · ${esc(r.language || '?')}${r.archived ? ' · archivált' : ''}</span></div>`).join('') +
    '<p class="dim"><span style="color:#6fe39a">■</span> MIT <span style="color:#6fa8ff">■</span> Apache <span style="color:#4fd1c5">■</span> BSD <span style="color:#ff6b6b">■</span> GPL <span style="color:#ffb347">■</span> MPL <span style="color:#8b97b5">■</span> egyéb</p>';
}

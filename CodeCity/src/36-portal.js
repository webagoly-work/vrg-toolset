// 36-portal.js — windows on the program constructs and the portal hand-off (P12, KV-26; report §1.5). Only in the overlay
// (#mode=overlay inside CodeCity/shell): the shell sends the capture sources of the open windows (id, handle and a small
// picture — never a title); each construct around Erőmű (33-apps) gets a screen with its program's first window: at most
// 3 (the program in front, Zen, then ring order; the selftest may prefer another) are refreshed every second at 960×600,
// the rest every 3 s, only while the overlay is up. Live WebRTC capture (getUserMedia 'desktop') is refused on this PC:
// Windows.Graphics.Capture CreateForWindow answers E_ACCESSDENIED even in Electron's main process (capture-test.js), so
// the screens are desktopCapturer pictures (GDI) — 1 frame a second, not video. Clicking a screen flies in, asks the segéd (probe-place) to move the real window onto the screen's
// rectangle and hides the overlay; Esc (the shell) brings the overlay back and the window to where it was (probe-unplace).
// Windows 10 draws a yellow border round a captured window (IsBorderRequired needs build 20348+): accepted.

const pt = { prefer: 'zen.exe', srcs: [], screens: new Map(), liveHs: '', keep: false, cur: null, cam: null, ray: new THREE.Raycaster(), ndc: new THREE.Vector2() };
const PT_LIVE_MAX = 3;

function ptSources(list) { pt.srcs = Array.isArray(list) ? list : []; ptSync(); }

// which program shows which window, and which three are live
function ptSync() {
  if (!KV_OVERLAY || !world || !ap.group) return;
  const withSrc = ap.list.map(a => ({ a, it: ap.items.get(a.key), src: pt.srcs.find(s => (a.h || []).includes(s.h)) })).filter(x => x.it && !x.it.gone && x.src);
  const rank = x => (x.a.fg ? 0 : x.a.key === pt.prefer ? 1 : 2) * 100 + x.it.slot;
  const liveKeys = new Set(withSrc.slice().sort((p, q) => rank(p) - rank(q)).slice(0, PT_LIVE_MAX).map(x => x.a.key));
  const keep = new Set();
  for (const x of withSrc) { keep.add(x.a.key); ptScreen(x.it, x.src, liveKeys.has(x.a.key)); }
  for (const [key, sc] of pt.screens) if (!keep.has(key)) { sc.sprite.parent && sc.sprite.parent.remove(sc.sprite); sc.sprite.material.dispose(); pt.screens.delete(key); }
  // tell the shell which windows to refresh every second
  const hs = withSrc.filter(x => liveKeys.has(x.a.key)).map(x => x.src.h), sig = hs.join(',');
  if (sig !== pt.liveHs && window.kvShell && window.kvShell.live) { pt.liveHs = sig; window.kvShell.live(hs); }
  requestRender();
}

function ptScreen(it, src, live) {
  let sc = pt.screens.get(it.key);
  if (!sc) {
    const k = agScale(), sprite = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xffffff, fog: false, depthWrite: false }));
    sprite.renderOrder = 5;
    sprite.position.set(0, 8 * k, 0);
    it.g.add(sprite);
    sc = { sprite, key: it.key, h: 0, img: '' };
    pt.screens.set(it.key, sc);
  }
  sc.h = src.h; sc.live = live;
  const k = agScale(), aspect = src.w && src.hh ? src.w / src.hh : 1.6;
  sc.sprite.scale.set(24 * k, 24 * k / aspect, 1);
  sc.sprite.userData = { key: it.key, h: src.h };
  if (src.img && sc.img !== src.img) {   // a new picture of the window (the shell sends one only when it took one)
    sc.img = src.img;
    const img = new Image();
    img.onload = () => { const t = new THREE.Texture(img); t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true;
      const old = sc.sprite.material.map; sc.sprite.material.map = t; sc.sprite.material.needsUpdate = true; if (old) old.dispose(); requestRender(); };
    img.src = src.img;
  }
}
// the screen under the pointer, if any (00-wallpaper asks for the click-through, the click below for the hand-off)
function ptHit(e) {
  if (!pt.screens.size) return null;
  const r = canvas.getBoundingClientRect();
  pt.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  pt.ray.setFromCamera(pt.ndc, camera);
  const hit = pt.ray.intersectObjects([...pt.screens.values()].map(s => s.sprite), false)[0];
  return hit ? hit.object.userData : null;
}
if (KV_OVERLAY) canvas.addEventListener('click', e => { const h = ptHit(e); if (h) ptPortal(h.key); });

// the screen's rectangle on the monitor, in physical pixels (the probe's SetWindowPos)
function ptRect(sprite) {
  const p = sprite.getWorldPosition(new THREE.Vector3()), s = sprite.getWorldScale(new THREE.Vector3());
  const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0), up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
  const r = canvas.getBoundingClientRect(), xs = [], ys = [];
  for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const v = p.clone().addScaledVector(right, a * s.x / 2).addScaledVector(up, b * s.y / 2).project(camera);
    xs.push(r.left + (v.x + 1) / 2 * r.width); ys.push(r.top + (1 - v.y) / 2 * r.height);
  }
  let l = Math.min(...xs), t = Math.min(...ys), w = Math.max(...xs) - l, h = Math.max(...ys) - t;
  // never smaller than 960×600 CSS px (grown round its centre), never off the monitor
  const g = Math.max(1, 960 / w, 600 / h), cx = l + w / 2, cy = t + h / 2;
  w = Math.min(innerWidth, w * g); h = Math.min(innerHeight, h * g);
  l = Math.max(0, Math.min(innerWidth - w, cx - w / 2)); t = Math.max(0, Math.min(innerHeight - h, cy - h / 2));
  const d = devicePixelRatio;
  return { x: Math.round((screenX + l) * d), y: Math.round((screenY + t) * d), w: Math.round(w * d), hh: Math.round(h * d) };
}

// the hand-off: fly to the screen, put the real window on it, hide the overlay
async function ptPortal(key) {
  const sc = pt.screens.get(key);
  if (!sc || pt.cur || !window.kvShell) return;
  pt.cam = [orbit.target.x, orbit.target.z, orbit.theta, orbit.phi, orbit.r];
  const p = sc.sprite.getWorldPosition(new THREE.Vector3()), hgt = sc.sprite.getWorldScale(new THREE.Vector3()).y;
  document.body.dataset.portal = 'flying';
  // nearly level, close enough that the screen fills ~40 % of the height; the orbit target is on the ground, the screen
  // a little above it, so the window lands just above the middle of the monitor
  if (window.KV_INSTANT) flyCamera([p.x, p.z, orbit.theta, 1.45, hgt / 0.33], 0);
  else { flyCamera([p.x, p.z, orbit.theta, 1.45, hgt / 0.33], 600); await new Promise(r => setTimeout(r, 650)); }
  renderer.render(scene, camera);
  const rect = ptRect(sc.sprite), res = await kvCall('probe-place', Object.assign({ h: sc.h }, rect));
  if (res.status !== 200) { document.body.dataset.portal = 'refused ' + res.status; kvDone(res, ''); flyCamera(pt.cam, 400); return; }
  pt.cur = { key, h: sc.h, rect };
  pt.keep = true;   // 22-live: the stream stays open while the overlay is hidden for the hand-off
  document.body.dataset.portal = 'handoff';
  window.kvShell.handoff();
}
// Esc in the shell: the overlay is back; the window goes back to where it was
async function ptReturn() {
  if (!pt.cur) return;
  const { h } = pt.cur;
  pt.cur = null; pt.keep = false;
  document.body.dataset.portal = 'returning';
  await kvCall('probe-unplace', { h });
  if (pt.cam) flyCamera(pt.cam, window.KV_INSTANT ? 0 : 500);
  document.body.dataset.portal = 'returned';
}
// the probe's answer (22-live 'portal'): where the window really is
function ptEvent(d) { document.body.dataset.portalLast = `${d.t} ${d.ok ? 'ok' : 'no'} ${d.x},${d.y},${d.w},${d.hh}`; }

if (KV_OVERLAY && window.kvShell) {
  window.kvShell.onSources(ptSources);
  window.kvShell.onReturn(ptReturn);
  // the shell's --selftest drives the hand-off through this (overlay mode only)
  window.kvPortalTest = { go: ptPortal, screens: () => [...pt.screens.keys()], live: () => [...pt.screens.values()].filter(x => x.live).map(x => x.key), prefer: key => { pt.prefer = key; ptSync(); } };
}

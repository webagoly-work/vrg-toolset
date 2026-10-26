// 19-select.js — multi-select (live workspace P2, KV-06): Ctrl+click toggles a building, Shift+drag draws a
// box (Ctrl+Shift adds to the selection; a right drag still pans). The selection shows as an accent shell
// over each building and a bar with group actions; "Kérdezd Claude-ot ezekről" pre-fills a Claude Code
// prompt with the paths (claude-cli://open?cwd=…&q=…) — pre-filled, never sent.
// The box tests each live building's centre on screen: for one InstancedMesh that is the answer three.js
// SelectionBox gives, without inlining an addon into the build.

const sel = { set: new Set(), shell: null, rect: null, city: null };
const SEL_Q_MAX = 5000;   // the claude-cli:// q limit

const selFiles = () => [...sel.set].sort((a, b) => a - b).map(i => current.city.files[i]);
// the paths a Claude prompt should name: the selection, else the open file
const selTargets = () => (sel.set.size ? selFiles() : shownFile ? [shownFile] : []).map(f => f.p);
function selPrompt(head, paths = selTargets()) {
  let q = head + (paths.length ? '\n\n' + paths.map(p => '- ' + p).join('\n') : '');
  if (q.length > SEL_Q_MAX) q = q.slice(0, SEL_Q_MAX - 40).replace(/\n[^\n]*$/, '') + '\n- … (a lista rövidítve)';
  return q;
}
const selAskHead = () => 'Nézd meg ezeket a fájlokat a repóban, és mondd el röviden, mit csinálnak és hogyan függenek össze:';
const selCliUrl = q => KV_CLAUDE_CLI + encodeURIComponent(kvAbs('.')) + '&q=' + encodeURIComponent(q);
const selAppUrl = q => 'claude://code/new?q=' + encodeURIComponent(q) + '&folder=' + encodeURIComponent(kvAbs('.'));

// a pre-filled Claude Code prompt in this repo; without the repo's folder the prompt goes to the clipboard
async function selAskClaude(q) {
  await kvReady();
  if (kv.root) { kvLink(selCliUrl(q)); kvToast('Claude Code nyílik, a prompt előtöltve (nem küldi el magától)'); }
  else kvCopy(q, 'A prompt a vágólapon — ' + KV_WHY.root);
}

// a selection belongs to one loaded city: another city.json dropped in starts empty
function selSync() { if (sel.city !== current.city) { sel.set.clear(); sel.city = current.city; } }
function selShellRefresh() {
  if (!world || !current) return;
  selSync();
  if (!sel.shell || sel.shell.parent !== world.group) {
    sel.shell = new THREE.InstancedMesh(unitBox, new THREE.MeshBasicMaterial({ color: 0xffcf5a, transparent: true, opacity: 0.32,
      blending: THREE.AdditiveBlending, depthWrite: false }), world.fileOf.length);
    sel.shell.raycast = () => {};
    world.group.add(sel.shell);
  }
  const m = new THREE.Matrix4(), grow = new THREE.Matrix4().makeScale(1.12, 1.04, 1.12);
  let n = 0;
  for (const i of sel.set) {
    if (replay.cur[i * 3] <= 0) continue;          // not built at the shown commit
    world.buildings.getMatrixAt(i, m);
    sel.shell.setMatrixAt(n++, m.multiply(grow));
  }
  sel.shell.count = n;
  sel.shell.instanceMatrix.needsUpdate = true;
  requestRender();
}

function selChanged() {
  selShellRefresh();
  let bar = $('sel-bar');
  if (!bar) {
    bar = document.createElement('div'); bar.id = 'sel-bar'; bar.setAttribute('role', 'toolbar');
    bar.addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (b && !b.disabled) SEL_ACT[b.dataset.act](); });
    document.body.append(bar);
  }
  bar.hidden = !sel.set.size;
  if (!sel.set.size) return;
  const q = selPrompt(selAskHead());
  bar.dataset.ask = kv.root ? selCliUrl(q) : '';   // test hook: tools/shot.js --dump-dom reads the link
  bar.innerHTML = `<b draggable="true" title="Húzd egy épületre vagy egy ügynökre (Dokk)">${hu(sel.set.size)} kijelölve</b>` +
    '<button class="btn" data-act="ask" title="Claude Code nyílik ebben a repóban, a prompt előtöltve — nem küldi el magától">Kérdezd Claude-ot ezekről</button>' +
    `<button class="btn" data-act="app"${kv.root ? '' : ' disabled title="' + esc(KV_WHY.root) + '"'}>Claude app</button>` +
    '<button class="btn" data-act="copy">Útvonalak másolása</button>' +
    '<button class="btn" data-act="clear" title="Kijelölés törlése (Esc)">×</button>';
}
const SEL_ACT = {
  ask: () => selAskClaude(selPrompt(selAskHead())),
  app: () => { kvLink(selAppUrl(selPrompt(selAskHead()))); kvToast('A Claude app nyílik, a prompt előtöltve'); },
  copy: () => kvCopy(selFiles().map(f => f.p).join('\n'), hu(sel.set.size) + ' útvonal a vágólapon'),
  clear: () => selClear()
};
function selToggle(i) { selSync(); sel.set.has(i) ? sel.set.delete(i) : sel.set.add(i); kvReady().then(selChanged); }
function selClear() { if (!sel.set.size) return; sel.set.clear(); selChanged(); }
function selSetPaths(paths) {
  const by = new Map(current.city.files.map((f, i) => [f.p, i]));
  selSync(); sel.set.clear();
  for (const p of paths) if (by.has(p)) sel.set.add(by.get(p));
  return kvReady().then(selChanged);
}

// ---- the box: a dashed rectangle while dragging, then every live building whose centre falls inside
function selBoxDraw(x0, y0, x1, y1) {
  let r = sel.rect;
  if (!r) { r = sel.rect = document.createElement('div'); r.id = 'sel-rect'; document.body.append(r); }
  Object.assign(r.style, { left: Math.min(x0, x1) + 'px', top: Math.min(y0, y1) + 'px', width: Math.abs(x1 - x0) + 'px', height: Math.abs(y1 - y0) + 'px' });
  r.hidden = false;
}
function selBoxEnd(x0, y0, x1, y1, add) {
  if (sel.rect) sel.rect.hidden = true;
  const cr = canvas.getBoundingClientRect(), m = new THREE.Matrix4(), v = new THREE.Vector3();
  const lx = Math.min(x0, x1), hx = Math.max(x0, x1), ly = Math.min(y0, y1), hy = Math.max(y0, y1);
  selSync();
  if (!add) sel.set.clear();
  camera.updateMatrixWorld();
  for (let i = 0; i < world.fileOf.length; i++) {
    if (replay.cur[i * 3] <= 0) continue;
    world.buildings.getMatrixAt(i, m);
    v.set(0, 0.5, 0).applyMatrix4(m).project(camera);       // unitBox: centred in x/z, base at y=0
    if (v.z > 1) continue;                                   // behind the camera
    const sx = cr.left + (v.x + 1) / 2 * cr.width, sy = cr.top + (1 - v.y) / 2 * cr.height;
    if (sx >= lx && sx <= hx && sy >= ly && sy <= hy) sel.set.add(i);
  }
  kvReady().then(selChanged);
}
addEventListener('keydown', e => { if (e.key === 'Escape' && sel.set.size && !e.target.closest('input, textarea')) selClear(); });

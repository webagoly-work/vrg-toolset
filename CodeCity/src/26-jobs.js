// 26-jobs.js — workshops, gates and the port street (P6, KV-14; report §5.6, README §7.1 #1). The segéd
// supervises START.cmd's local servers plus the builds and tests ('jobs', 'job', 'joblog', 'ports').
// Üzemek: one row per job — start, stop (the whole process tree), its log streaming in. City gates: one
// gate per START.cmd tool on the north wall, numbered as in the menu; it lights when its tool's server
// listens, and a road runs from it to the tool's page when that page is a building. The port street: one
// door per listening port on the east side — lit cyan when it is ours (a job, the segéd), amber for a known
// server started elsewhere, dim for a dev runtime (node, python…). Windows' own listeners are only counted
// (R1: a calm street; the Üzemek panel says how many).

const jb = { list: [], logs: new Map(), ports: [], open: null, el: null, group: null, labels: new Map() };
const JB_CYAN = 0x6fd3ff;
const JB_DEV = /^(node|python|pythonw|java|javaw|deno|bun|php|ruby|dotnet|code|esphome|openmct)(\.exe)?$/i;
const jbStreet = () => jb.ports.filter(p => p.ours || p.job || p.name || JB_DEV.test(p.proc || ''));

function jbLabel(text, color) {
  const key = text + '|' + color;
  if (jb.labels.has(key)) return jb.labels.get(key);
  const c = document.createElement('canvas'); c.width = 128; c.height = 64;
  const g = c.getContext('2d');
  g.font = 'bold 40px Consolas, monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = color; g.fillText(text, 64, 34);
  const t = new THREE.CanvasTexture(c);
  jb.labels.set(key, t);
  return t;
}
function jbDraw() {
  if (!world) return;
  if (jb.group) { world.group.remove(jb.group); jb.group.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
  jb.group = new THREE.Group();
  const s = current.side, k = agScale(), tools = (pal.cat || PAL_EMPTY).tools;
  const listening = new Set(jb.ports.map(p => p.port));
  const byPath = new Map(current.city.files.map((f, i) => [f.p, i]));
  // gates: north wall, one per START.cmd tool
  tools.forEach((t, n) => {
    const x = -s / 2 + s * (n + 1) / (tools.length + 1), z = -s / 2 - s * 0.05, w = 2.4 * k, h = 4 * k;
    const server = jb.list.find(j => j.port && (('/' + t.path) === j.path || (j.script && t.path.split('/')[0] === j.script.split('/')[0] && j.path === '/')));
    const lit = !!(server && listening.has(server.port));
    const mat = new THREE.MeshBasicMaterial({ color: lit ? JB_CYAN : 0x2a3552, fog: false });
    const post = new THREE.BoxGeometry(0.5 * k, h, 0.5 * k);
    const l = new THREE.Mesh(post, mat), r = new THREE.Mesh(post, mat), top = new THREE.Mesh(new THREE.BoxGeometry(w + 0.5 * k, 0.5 * k, 0.5 * k), mat);
    l.position.set(x - w / 2, h / 2, z); r.position.set(x + w / 2, h / 2, z); top.position.set(x, h, z);
    const key = t.n === 10 ? '0' : t.n === 11 ? 'K' : String(t.n);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: jbLabel(key, lit ? '#6fd3ff' : '#8b97b5'), fog: false, depthWrite: false }));
    sp.position.set(x, h + 2 * k, z); sp.scale.set(4 * k, 2 * k, 1);
    jb.group.add(l, r, top, sp);
    // a road from the gate to the tool's page, when the page is a building of this city
    const i = byPath.get(t.path);
    if (i !== undefined) {
      const f = current.city.files[i], to = new THREE.Vector3(f.rect.x + f.rect.w / 2, 0.2, f.rect.z + f.rect.h / 2);
      const road = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x, 0.2, z), to]),
        new THREE.LineDashedMaterial({ color: lit ? JB_CYAN : 0x3a4a78, dashSize: k, gapSize: k * 0.7, fog: false }));
      road.computeLineDistances();
      jb.group.add(road);
    }
  });
  // the port street: east side, one door per listening port
  jbStreet().forEach((p, n) => {
    const x = s / 2 + s * 0.05 + Math.floor(n / 14) * 5 * k, z = -s / 2 + s * 0.04 + (n % 14) * s / 15, h = 2.2 * k;
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.4 * k, h, 2.2 * k).translate(0, h / 2, 0),
      new THREE.MeshBasicMaterial({ color: p.ours ? JB_CYAN : p.job ? 0xffcf5a : 0x4a5578, fog: false }));
    door.position.set(x, 0, z);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: jbLabel(String(p.port), p.ours ? '#6fd3ff' : '#8b97b5'), fog: false, depthWrite: false }));
    sp.position.set(x, h + 1.2 * k, z); sp.scale.set(3.2 * k, 1.6 * k, 1);
    jb.group.add(door, sp);
  });
  jb.group.traverse(o => { o.raycast = () => {}; });
  world.group.add(jb.group);
  requestRender();
}

// ---- Üzemek: the jobs panel
const JB_GROUPS = [['server', 'Szerverek'], ['build', 'Buildek'], ['test', 'Tesztek']];
function jbPanel() {
  const btn = $('jobs-btn');
  const run = jb.list.filter(j => j.state === 'fut').length, bad = jb.list.filter(j => j.state === 'hiba').length;
  btn.hidden = !jb.list.length;
  btn.textContent = 'Üzemek' + (run ? ' ' + run : '') + (bad ? ' · ' + bad + ' hiba' : '');
  btn.classList.toggle('wait', !!bad);
  if (!jb.el || jb.el.hidden) return;
  const row = j => {
    const on = j.state === 'fut', ext = j.state === 'fut (máshonnan)';
    const url = j.port && (on || ext) ? `http://localhost:${j.port}${j.path || '/'}` : '';
    return `<div class="job ${j.state.split(' ')[0]}" data-id="${esc(j.id)}"><span class="dot"></span><span class="nm">${j.key ? `<kbd>${esc(j.key)}</kbd> ` : ''}${esc(j.name)}</span>` +
      `<span class="st">${esc(j.state)}${j.code !== null && j.code !== undefined && !on ? ' (' + j.code + ')' : ''}${j.port ? ' · ' + j.port : ''}</span>` +
      (url ? `<a href="${esc(url)}" target="_blank" rel="noopener">megnyitás</a>` : '') +
      (j.why ? `<span class="dim" title="${esc(j.why)}">START.cmd-ből</span>` : on ? '<button class="btn" data-stop>Leállítás</button>' : ext ? '' : '<button class="btn" data-start>Indítás</button>') +
      `<button class="btn" data-log>Napló</button></div>` +
      (jb.open === j.id ? `<pre class="joblog" data-log-of="${esc(j.id)}">${esc((jb.logs.get(j.id) || []).join('\n')) || '(még üres)'}</pre>` : '');
  };
  const other = jb.ports.length - jbStreet().length;
  jb.el.innerHTML = '<span class="x" title="Bezárás">×</span><h3>Üzemek — szerverek, buildek, tesztek</h3>' +
    `<p class="dim">Kapuk az északi falon (a START.cmd számai), portutca keleten: ${hu(jbStreet().length)} ajtó` +
    (other ? ` · további ${hu(other)} figyelő port a Windowsé, nincs kirajzolva` : '') + '</p>' +
    JB_GROUPS.map(([k, label]) => { const xs = jb.list.filter(j => j.kind === k); return xs.length ? `<h4>${label}</h4>` + xs.map(row).join('') : ''; }).join('');
  const pre = jb.el.querySelector('pre.joblog');
  if (pre) pre.scrollTop = pre.scrollHeight;
}
function jbToggle(force) {
  if (!jb.el) {
    jb.el = document.createElement('aside'); jb.el.id = 'jobs'; jb.el.hidden = true;
    jb.el.addEventListener('click', async e => {
      if (e.target.closest('.x')) return jbToggle(false);
      const row = e.target.closest('[data-id]'), id = row && row.dataset.id;
      if (!id) return;
      if (e.target.closest('[data-start]')) { const r = await kvCall('job-start', { id }); if (r.status !== 200) kvToast(r.json.error || 'Nem indult'); else { jb.open = id; jbJob(r.json); } }
      else if (e.target.closest('[data-stop]')) { const r = await kvCall('job-stop', { id }); if (r.status !== 200) kvToast(r.json.error || 'Nem állt le'); }
      else if (e.target.closest('[data-log]')) { jb.open = jb.open === id ? null : id; jbPanel(); }
    });
    document.body.append(jb.el);
  }
  jb.el.hidden = force === undefined ? !jb.el.hidden : !force;
  if (!jb.el.hidden) jbLoad();
}
async function jbLoad() {
  try {
    const r = await fetch('/api/jobs'); if (!r.ok) return;
    const j = await r.json();
    jb.list = j.list; jb.ports = j.ports || jb.ports;
    for (const [id, lines] of Object.entries(j.logs || {})) jb.logs.set(id, lines);
    jbPanel(); jbDraw();
  } catch (e) { /* the segéd is gone */ }
}
function jbJob(st) { const k = jb.list.findIndex(j => j.id === st.id); if (k >= 0) jb.list[k] = st; else jb.list.push(st); jbPanel(); }
function jobsEvent(d) { jb.list = d.list || []; jbPanel(); jbDraw(); }
function jobEvent(st) { jbJob(st); jbDraw(); }
function joblogEvent(d) {
  const a = jb.logs.get(d.id) || [];
  a.push(...d.lines); if (a.length > 500) a.splice(0, a.length - 500);
  jb.logs.set(d.id, a);
  const pre = jb.el && !jb.el.hidden && jb.el.querySelector(`pre[data-log-of="${CSS.escape(d.id)}"]`);
  if (pre) { pre.textContent = a.join('\n'); pre.scrollTop = pre.scrollHeight; }
}
function portsEvent(d) { jb.ports = d.list || []; jbDraw(); }
$('jobs-btn').onclick = () => jbToggle();

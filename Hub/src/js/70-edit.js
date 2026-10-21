// Editing: operations (not whole files) kept until saved, replayed on GitHub's current copy at save time.
//   {op:'set', id, field, value}   id = program id or 'dept:<ID>'; field may be dotted ('open.repo')
//   {op:'add', parent, node}       parent = 'dept:<ID>' (a program) | 'prog:<id>:folders' | 'prog:<id>:agent'
//   {op:'hide', id}                soft delete; restore with set hidden false
//   {op:'claim', id, claim|null}
//   {op:'replace', topo}           a JSON import
// The access list is never touched here; the editor has no field for it.

const KP_TOPO_PATH = 'Hub/data/topology.json';
const KP_CLAIM_DAYS = 3;
const KP_MSG_IDS = 5;
const KP_EDIT_FIELDS = [
  ['t', 'Név', 'input'], ['d', 'Rövid leírás (HU)', 'input'], ['dEn', 'Rövid leírás (EN)', 'input'],
  ['long', 'Részletes leírás (HU, markdown)', 'textarea'], ['longEn', 'Részletes leírás (EN)', 'textarea']
];

function kpToday(d) {
  const x = d || new Date();
  return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
}
const kpClone = v => JSON.parse(JSON.stringify(v));

function kpFindTarget(t, id) {
  if (String(id).startsWith('dept:')) return (t.departments || []).find(d => d.id === id.slice(5)) || null;
  return (t.programs || []).find(p => p.id === id) || null;
}

function kpSetPath(obj, field, value) {
  const parts = field.split('.');
  let o = obj;
  for (const k of parts.slice(0, -1)) o = o[k] && typeof o[k] === 'object' ? o[k] : (o[k] = {});
  const last = parts[parts.length - 1];
  if (value === '' || value == null) delete o[last]; else o[last] = value;
}

// pure: -> { topo, lost: ['elveszett célpont: <id>'], changed: Set<id> }
function kpApply(topo, ops, opts) {
  const o = opts || {};
  let t = kpClone(topo);
  const lost = [], changed = new Set();
  for (const op of ops || []) {
    if (op.op === 'replace') { t = kpClone(op.topo); continue; }
    if (op.op === 'add') {
      const m = String(op.parent).match(/^prog:(.+):(folders|agent)$/);
      if (String(op.parent).startsWith('dept:')) {
        const dept = op.parent.slice(5);
        if (!(t.departments || []).some(d => d.id === dept)) { lost.push('elveszett célpont: ' + op.parent); continue; }
        if ((t.programs || []).some(p => p.id === op.node.id)) { lost.push('már létező azonosító: ' + op.node.id); continue; }
        t.programs.push(Object.assign({}, op.node, { dept }));
        changed.add(op.node.id);
      } else if (m) {
        const p = kpFindTarget(t, m[1]);
        if (!p) { lost.push('elveszett célpont: ' + m[1]); continue; }
        (p[m[2]] = p[m[2]] || []).push(op.node);
        changed.add(p.id);
      } else lost.push('ismeretlen hely: ' + op.parent);
      continue;
    }
    const target = kpFindTarget(t, op.id);
    if (!target) { lost.push('elveszett célpont: ' + op.id); continue; }
    if (op.op === 'set') kpSetPath(target, op.field, op.value);
    else if (op.op === 'hide') target.hidden = true;
    else if (op.op === 'claim') { if (op.claim) target.claim = op.claim; else delete target.claim; }
    changed.add(op.id);
  }
  if (o.dropExpired) {
    const today = o.today || kpToday();
    for (const p of t.programs || []) if (p.claim && p.claim.until < today) delete p.claim;
  }
  return { topo: t, lost, changed };
}

// what the remote has that our base did not: for "A másik felhasználó közben mentett"
function kpTopoDiff(base, remote) {
  const out = [];
  const bp = new Map((base.programs || []).map(p => [p.id, p])), rp = new Map((remote.programs || []).map(p => [p.id, p]));
  for (const [id, p] of rp) {
    if (!bp.has(id)) out.push('új: ' + p.t);
    else if (kpCanon(bp.get(id)) !== kpCanon(p)) out.push('módosítva: ' + p.t);
  }
  for (const [id, p] of bp) if (!rp.has(id)) out.push('törölve: ' + p.t);
  if (kpCanon(base.departments) !== kpCanon(remote.departments)) out.push('részlegek módosítva');
  return out;
}

const kpOpIds = ops => [...new Set(ops.map(op => op.id || (op.node && op.node.id) || (op.op === 'replace' ? 'import' : op.parent)))];
function kpCommitMsg(login, ops) {
  const ids = kpOpIds(ops);
  return 'Kapu: ' + login + ' — ' + ops.length + ' változás (' + ids.slice(0, KP_MSG_IDS).join(', ') + (ids.length > KP_MSG_IDS ? ', …' : '') + ')';
}

// remote + pending -> the file to write, or the reasons it cannot be written
function kpSavePrep(remote, ops, login, today) {
  const r = kpApply(remote, ops, { dropExpired: true, today });
  const t = r.topo;
  t.rev = (remote.rev || 0) + 1;
  t.updated = today;
  t.updatedBy = login;
  const v = kpValidate(t);
  return { topo: t, lost: r.lost, errors: v.errors, ok: v.ok };
}

function kpB64Utf8(s) {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
const kpUtf8B64 = b64 => new TextDecoder().decode(kpB64Bytes(String(b64).replace(/\s+/g, '')));

// ---- page side: pending ops and the view
const kpPending = () => kpStore.get('pendingOps', []);
function kpPendingSet(ops) {
  kpStore.set('pendingOps', ops);
  kpBoardRender();
  kpRenderStrip();
}
function kpPendingAdd(op) { kpPendingSet(kpPending().concat(op)); }

let kpDirty = new Set();
function kpViewTopology() {
  const ops = kpPending();
  if (!ops.length) { kpDirty = new Set(); return kpData.topology; }
  const r = kpApply(kpData.topology, ops);
  kpDirty = r.changed;
  return r.topo;
}

function kpStripExtras() {
  const out = [];
  const topo = kpViewTopology();
  const today = kpToday();
  const claims = (topo.programs || []).filter(p => p.claim && p.claim.until >= today);
  const logs = typeof kpLogStrip === 'function' ? kpLogStrip() : [];
  if (claims.length || logs.length) out.push(kpEl('span', { class: 'kp-strip-l' }, 'Ki min dolgozik?'),
    ...claims.map(p => kpEl('span', { class: 'kp-claim-s' }, '⚑ ' + p.claim.by + ': ' + p.t + ' (' + p.claim.until.slice(5) + '-ig)')), ...logs, kpEl('span', { class: 'kp-strip-sep' }));
  const n = kpPending().length;
  if (n) out.push(kpEl('span', { class: 'kp-pending' }, '✎ ' + n + ' nem mentett változás'),
    kpEl('button', { class: 'kp-btn kp-primary', onclick: () => kpSave() }, 'Mentés GitHubra'),
    kpEl('button', { class: 'kp-btn', onclick: () => { if (confirm('Elveted a ' + n + ' nem mentett változást?')) kpPendingSet([]); } }, 'Elvetés'),
    kpEl('span', { class: 'kp-strip-sep' }));
  return out;
}

// ---- save
let kpSaving = false;
async function kpSave(confirmed) {
  const ops = kpPending();
  if (!ops.length || kpSaving) return;
  if (!kpCaps.ghWrite) { kpToast(KP_WHY.ghWrite); return; }
  kpSaving = true;
  try {
    const repo = kpData.topology.repo, path = '/repos/' + repo.owner + '/' + repo.name + '/contents/' + KP_TOPO_PATH;
    const g = await kpGhFetch(path + '?ref=main', { nocache: true });
    if (g.status !== 200) { kpToast('A GitHub nem adta ki a térképet (' + (g.status || 'nincs kapcsolat') + ') — semmi nem veszett el, próbáld újra'); return; }
    const remote = JSON.parse(kpUtf8B64(g.json.content));
    const theirs = kpTopoDiff(kpData.topology, remote);
    if (theirs.length && !confirmed) { kpConflictOpen(theirs, remote); return; }
    const prep = kpSavePrep(remote, ops, kpGh.login, kpToday());
    if (!prep.ok) { kpModalOpen('Nem menthető', kpEl('p', {}, 'A térkép így hibás lenne:'), kpEl('ul', {}, ...prep.errors.map(e => kpEl('li', {}, e)))); return; }
    const put = await kpGhFetch(path, { method: 'PUT', body: {
      message: kpCommitMsg(kpGh.login, ops), content: kpB64Utf8(JSON.stringify(prep.topo, null, 2) + '\n'), sha: g.json.sha, branch: 'main' } });
    if (put.status === 409 || put.status === 422) { kpSaving = false; return kpSave(false); }   // someone saved in between: reload, show, ask
    if (put.status !== 200 && put.status !== 201) { kpToast('Mentés sikertelen (' + put.status + ') — a változások megmaradtak'); return; }
    kpData.topology = prep.topo;
    kpStore.set('topoCache', prep.topo);
    kpStore.set('etag.topology', null);
    kpPendingSet([]);
    const sha = ((put.json || {}).commit || {}).sha || '';
    kpToast('Mentve a GitHubra' + (sha ? ' · ' + sha.slice(0, 7) : ''));
    if (prep.lost.length) kpModalOpen('Mentve — néhány változás nem talált célt', kpEl('ul', {}, ...prep.lost.map(l => kpEl('li', {}, l))));
  } finally { kpSaving = false; }
}

function kpConflictOpen(theirs, remote) {
  const lost = kpApply(remote, kpPending()).lost;
  kpModalOpen('A másik felhasználó közben mentett',
    kpEl('p', {}, 'Ezek változtak a GitHubon, mióta betöltötted:'), kpEl('ul', {}, ...theirs.map(t => kpEl('li', {}, t))),
    lost.length ? kpEl('p', { class: 'kp-warn' }, 'A te változásaid közül ezek nem találnak célt: ' + lost.join(', ')) : null,
    kpEl('p', { class: 'kp-muted' }, 'A te változásaidat az ő változataikra teszem rá — semmit nem írok felül vakon.'),
    kpEl('div', { class: 'kp-pop-row' },
      kpEl('button', { class: 'kp-btn kp-primary', onclick: () => { kpModalClose(); kpData.topology = remote; kpSave(true); } }, 'Mentés így'),
      kpEl('button', { class: 'kp-btn', onclick: () => { kpModalClose(); kpData.topology = remote; kpBoardRender(); kpRenderStrip(); } }, 'Előbb megnézem')));
}

// ---- editor
function kpEditorOpen(c) {
  const isDept = c.node.kind === 'dept';
  const id = isDept ? 'dept:' + c.node.dept : c.prog.id;
  const cur = kpFindTarget(kpViewTopology(), id);
  const fields = isDept ? KP_EDIT_FIELDS.filter(f => ['t', 'd', 'dEn'].includes(f[0])) : KP_EDIT_FIELDS;
  const inputs = {};
  const row = (key, label, kind, value, extra) => {
    const el = kind === 'textarea' ? kpEl('textarea', Object.assign({ class: 'kp-in kp-ta', rows: 4 }, extra)) : kind === 'select' ? extra : kpEl('input', Object.assign({ class: 'kp-in' }, extra));
    if (kind !== 'select') el.value = value || '';
    inputs[key] = el;
    return kpEl('label', { class: 'kp-ed-row' }, kpEl('span', { class: 'kp-ed-l' }, label), el);
  };
  const rows = fields.map(([k, l, kind]) => row(k, l, kind, cur[k]));
  if (!isDept) {
    const st = kpEl('select', { class: 'kp-in' }, ...KP_STATUS.map(s => kpEl('option', { value: s, selected: cur.status === s }, KP_STATUS_HU[s])));
    const dp = kpEl('select', { class: 'kp-in' }, ...kpData.topology.departments.map(d => kpEl('option', { value: d.id, selected: cur.dept === d.id }, d.t)));
    rows.push(row('status', 'Állapot', 'select', null, st), row('dept', 'Részleg', 'select', null, dp));
    const open = cur.open || {};
    rows.push(row('open.repo', 'Megnyitás: repó útvonal', 'input', open.repo, { placeholder: 'pl. Planner/projects/…/dist/x.html' }),
      row('open.url', 'Megnyitás: webcím', 'input', open.url, { placeholder: 'https://…' }),
      row('open.local', 'Megnyitás: helyi mappa (VRG-DE-hez képest)', 'input', open.local));
  }
  const apply = () => {
    const ops = [];
    for (const [k, el] of Object.entries(inputs)) {
      const before = k.includes('.') ? (cur[k.split('.')[0]] || {})[k.split('.')[1]] : cur[k];
      if ((el.value || '') !== (before || '')) ops.push({ op: 'set', id, field: k, value: el.value });
    }
    if (ops.length) kpPendingSet(kpPending().concat(ops));
    return ops.length;
  };
  kpModalOpen('Szerkesztés — ' + (cur.t || id), ...rows,
    kpEl('div', { class: 'kp-pop-row' },
      kpEl('button', { class: 'kp-btn kp-primary', onclick: () => { apply(); kpModalClose(); kpSave(); } }, 'Mentés GitHubra'),
      kpEl('button', { class: 'kp-btn', onclick: () => { const n = apply(); kpModalClose(); if (n) kpToast(n + ' változás félretéve — a Mentés GitHubra gombbal küldöd el'); } }, 'Kész, később mentem'),
      isDept ? null : kpEl('button', { class: 'kp-btn kp-danger', onclick: () => { if (confirm('Elrejted: ' + cur.t + '? (Visszaállítható a ☰ menüben)')) { kpModalClose(); kpPendingAdd({ op: 'hide', id }); } } }, 'Törlés'),
      kpEl('button', { class: 'kp-btn', onclick: kpExport }, 'Exportálás JSON')));
}

// where "Új elem ide…" adds: L1 -> a program in the department, L2 -> a folder, L3 -> an AI doc
function kpAddTarget(c) {
  const n = c.node;
  if (n.kind === 'dept' || n.kind === 'slot' || n.kind === 'summary') return { kind: 'program', parent: 'dept:' + n.dept };
  if (n.layer === 'L1' && n.kind === 'program') return { kind: 'program', parent: 'dept:' + n.dept };
  if (n.layer === 'L2' && c.prog) return { kind: 'folder', parent: 'prog:' + c.prog.id + ':folders' };
  if (n.layer === 'L3' && c.prog) return { kind: 'agent', parent: 'prog:' + c.prog.id + ':agent' };
  return null;
}

function kpSlug(s, taken) {
  let b = kpNorm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'uj';
  let id = b, i = 2;
  while (taken.has(id)) id = b + '-' + i++;
  return id;
}

function kpAddOpen(c) {
  const tg = kpAddTarget(c);
  const t = kpEl('input', { class: 'kp-in' }), d = kpEl('input', { class: 'kp-in' }), dEn = kpEl('input', { class: 'kp-in' });
  const link = kpEl('input', { class: 'kp-in', placeholder: tg.kind === 'folder' ? 'OneDrive megosztási link (https://…)' : 'repó útvonal vagy https://…' });
  const label = { program: 'Új program', folder: 'Új megosztott mappa', agent: 'Új AI dokumentum' }[tg.kind];
  kpModalOpen(label,
    kpEl('label', { class: 'kp-ed-row' }, kpEl('span', { class: 'kp-ed-l' }, 'Név'), t),
    kpEl('label', { class: 'kp-ed-row' }, kpEl('span', { class: 'kp-ed-l' }, 'Rövid leírás (HU)'), d),
    kpEl('label', { class: 'kp-ed-row' }, kpEl('span', { class: 'kp-ed-l' }, 'Rövid leírás (EN)'), dEn),
    kpEl('label', { class: 'kp-ed-row' }, kpEl('span', { class: 'kp-ed-l' }, 'Link'), link),
    kpEl('div', { class: 'kp-pop-row' }, kpEl('button', { class: 'kp-btn kp-primary', onclick: () => {
      if (!t.value.trim()) { kpToast('Adj nevet'); return; }
      const lv = link.value.trim(), isUrl = /^https?:\/\//.test(lv);
      let node;
      if (tg.kind === 'program') {
        node = { id: kpSlug(t.value, new Set(kpViewTopology().programs.map(p => p.id))), t: t.value.trim(), status: 'idea', d: d.value.trim(), dEn: dEn.value.trim() };
        if (lv) node.open = isUrl ? { url: lv } : { repo: lv };
      } else {
        node = { t: t.value.trim(), d: d.value.trim() };
        if (dEn.value.trim()) node.dEn = dEn.value.trim();
        if (lv) Object.assign(node, isUrl ? { url: lv } : tg.kind === 'folder' ? { local: lv } : { repo: lv });
        else if (tg.kind === 'folder') node.url = '';
      }
      kpModalClose();
      kpPendingAdd({ op: 'add', parent: tg.parent, node });
      kpToast('Hozzáadva — a Mentés GitHubra gombbal küldöd el');
    } }, 'Hozzáadás')));
  t.focus();
}

// ---- claims
function kpClaimAction(c) {
  const p = kpFindTarget(kpViewTopology(), c.prog.id);
  if (p.claim) { kpPendingAdd({ op: 'claim', id: p.id, claim: null }); kpToast('Foglalás feloldva — mentéskor kerül fel'); return; }
  const until = kpEl('input', { class: 'kp-in', type: 'date', value: kpToday(new Date(Date.now() + KP_CLAIM_DAYS * 864e5)) });
  const note = kpEl('input', { class: 'kp-in', placeholder: 'min dolgozol (nem kötelező)' });
  kpModalOpen('Foglalás — ' + p.t,
    kpEl('p', { class: 'kp-muted' }, 'Jelzés a másiknak (és a Claude munkameneteknek), hogy ezen dolgozol. Nem zár le semmit.'),
    kpEl('label', { class: 'kp-ed-row' }, kpEl('span', { class: 'kp-ed-l' }, 'Ki'), kpEl('b', {}, kpGh.login)),
    kpEl('label', { class: 'kp-ed-row' }, kpEl('span', { class: 'kp-ed-l' }, 'Meddig'), until),
    kpEl('label', { class: 'kp-ed-row' }, kpEl('span', { class: 'kp-ed-l' }, 'Megjegyzés'), note),
    kpEl('div', { class: 'kp-pop-row' }, kpEl('button', { class: 'kp-btn kp-primary', onclick: () => {
      kpModalClose();
      const claim = { by: kpGh.login, until: until.value };
      if (note.value.trim()) claim.note = note.value.trim();
      kpPendingAdd({ op: 'claim', id: p.id, claim });
      kpSave();
    } }, 'Foglalás és mentés')));
}

// ---- export / import / hidden
function kpExport() {
  const blob = new Blob([JSON.stringify(kpViewTopology(), null, 2) + '\n'], { type: 'application/json' });
  const a = kpEl('a', { href: URL.createObjectURL(blob), download: 'topology-' + kpToday() + '.json' });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function kpImport() {
  const inp = kpEl('input', { type: 'file', accept: '.json,application/json' });
  inp.addEventListener('change', async () => {
    const f = inp.files[0];
    if (!f) return;
    let t;
    try { t = JSON.parse(await f.text()); } catch (e) { kpToast('Ez nem JSON fájl'); return; }
    const v = kpValidate(t);
    if (!v.ok) { kpModalOpen('Nem importálható', kpEl('ul', {}, ...v.errors.slice(0, 20).map(e => kpEl('li', {}, e)))); return; }
    kpPendingAdd({ op: 'replace', topo: t });
    kpToast('Importálva — a Mentés GitHubra gombbal küldöd el');
  });
  inp.click();
}

function kpHiddenOpen() {
  const hidden = (kpViewTopology().programs || []).filter(p => p.hidden);
  kpModalOpen('Elrejtett elemek', hidden.length ? kpEl('ul', {}, ...hidden.map(p => kpEl('li', {}, p.t + ' ',
    kpEl('button', { class: 'kp-btn', onclick: () => { kpModalClose(); kpPendingAdd({ op: 'set', id: p.id, field: 'hidden', value: '' }); } }, 'Visszaállítás'))))
    : kpEl('p', { class: 'kp-muted' }, 'Nincs elrejtett elem.'));
}

// ---- Előnézet: GitHub's newest copy of a program in a throw-away tab
async function kpPreview(c) {
  const repo = kpData.topology.repo, p = c.prog.open.repo;
  const w = window.open('', '_blank');
  const r = await kpGhFetch('/repos/' + repo.owner + '/' + repo.name + '/contents/' + p.split('/').map(encodeURIComponent).join('/') + '?ref=main', { raw: true, nocache: true });
  if (r.status !== 200) { if (w) w.close(); kpToast('Az előnézet nem tölthető be (' + r.status + ')'); return; }
  const banner = '<div style="position:fixed;z-index:2147483647;left:0;right:0;top:0;background:#b33f22;color:#fff;font:14px sans-serif;padding:6px 12px;text-align:center">Előnézet — itt ne dolgozz, nem marad meg</div>';
  const html = r.text.replace(/<body[^>]*>/i, m => m + banner);
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  if (w) w.location = url; else kpOpen(url);
}

if (typeof module !== 'undefined') module.exports = { kpApply, kpTopoDiff, kpCommitMsg, kpSavePrep, kpToday };

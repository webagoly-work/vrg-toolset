// Topology model: validation, folder refs, views, links. Pure; shared by the page,
// Hub/test and tools/check-hub.js.

const KP_SCHEMA = 'vrg-hub/1';
const KP_STATUS = ['live', 'dev', 'idea', 'v2'];
const KP_D_MAX = 140;

function kpValidate(topo) {
  const errors = [], warnings = [];
  if (!topo || topo.schema !== KP_SCHEMA) {
    errors.push('schema: expected ' + KP_SCHEMA + ', got ' + (topo && topo.schema));
    return { ok: false, errors, warnings };
  }
  const deps = topo.departments || [], progs = topo.programs || [];
  const folderIds = new Set(((topo.onedrive || {}).folders || []).map(f => f.id));

  const seen = new Set();
  for (const d of deps) {
    if (seen.has(d.id)) errors.push('department: duplicate id "' + d.id + '"');
    seen.add(d.id);
  }
  const depIds = new Set(deps.map(d => d.id));
  const pseen = new Set();
  for (const p of progs) {
    const at = 'program "' + p.id + '"';
    if (pseen.has(p.id)) errors.push('program: duplicate id "' + p.id + '"');
    pseen.add(p.id);
    if (!depIds.has(p.dept)) errors.push(at + ': unknown dept "' + p.dept + '"');
    if (!KP_STATUS.includes(p.status)) errors.push(at + ': bad status "' + p.status + '"');
    for (const f of p.folders || []) {
      if (f.ref != null && !folderIds.has(f.ref)) errors.push(at + ': unknown folder ref "' + f.ref + '"');
      if (f.ref == null && 'url' in f && !f.url && !f.local) warnings.push(at + ': folder "' + (f.t || '?') + '" has no url yet');
    }
    if (p.claim && !/^\d{4}-\d{2}-\d{2}$/.test(p.claim.until || '')) errors.push(at + ': claim.until must be YYYY-MM-DD');
    if (!p.d) warnings.push(at + ': no description (d)');
    else if (p.d.length > KP_D_MAX) warnings.push(at + ': d is ' + p.d.length + ' chars (max ' + KP_D_MAX + ')');
  }
  for (const f of (topo.onedrive || {}).folders || []) {
    if (!f.url) warnings.push('onedrive folder "' + f.id + '" has no share url yet');
  }
  return { ok: errors.length === 0, errors, warnings };
}

// Folder entries with a ref become the referenced shared folder (ref kept, local fields win).
function kpResolveRefs(topo) {
  const byId = new Map(((topo.onedrive || {}).folders || []).map(f => [f.id, f]));
  return Object.assign({}, topo, {
    programs: (topo.programs || []).map(p => !p.folders ? p : Object.assign({}, p, {
      folders: p.folders.map(f => f.ref != null && byId.has(f.ref) ? Object.assign({}, byId.get(f.ref), f) : f)
    }))
  });
}

// 'now' hides the v2 vision; every department stays, in seed order, even when empty.
function kpVisible(topo, view) {
  const progs = (topo.programs || []).filter(p => view === 'vision' || p.status !== 'v2');
  return (topo.departments || []).map(d => ({ dept: d, programs: progs.filter(p => p.dept === d.id) }));
}

// A repo path with an extension in its last segment is a file (blob), otherwise a folder (tree).
function kpLinkFor(node, ctx) {
  const repo = (ctx && ctx.repo) || {};
  const base = 'https://github.com/' + repo.owner + '/' + repo.name;
  const branch = repo.branch || 'main';
  if (node.url) return { href: node.url, kind: 'url' };
  if (node.repo) {
    const p = String(node.repo).replace(/^\/+|\/+$/g, '');
    const isFile = /\.[A-Za-z0-9]+$/.test(p.split('/').pop());
    return { href: base + '/' + (isFile ? 'blob' : 'tree') + '/' + branch + '/' + p.split('/').map(encodeURIComponent).join('/'), kind: isFile ? 'repo-file' : 'repo-dir' };
  }
  if (node.local) {
    const root = (ctx && ctx.localRoot) || '';
    const path = root ? root.replace(/[\\/]+$/, '') + '\\' + node.local.replace(/\//g, '\\') : node.local;
    return { href: null, kind: 'local', path };
  }
  return { href: null, kind: 'none' };
}

if (typeof module !== 'undefined') module.exports = { kpValidate, kpResolveRefs, kpVisible, kpLinkFor, KP_STATUS };

// VRG Stack — V · Látvány (the look), S17 of research/STRINGS-PLAN.md (§5; RULES §6a, by STK-Q5 after Futás, Munkák
// and Eszközök): the design systems, what they are made of, and which look each page wears. RULES §6a: "the look is
// shared across apps and drifts too" — a page's copy of a style that no longer matches its source is a signal.
//
//   read({ repo, files, visualBase }) → { kit, melyviz, logos, looks, base }
//     kit      shared/vrg-ui-kit/manifest.json: its version, its 56 components (with their families) and themes
//     melyviz  shared/melyviz.css, the dev-side style's one source; tools/melyviz-sync.js's TARGETS (read from its
//              text, so the list stays the tool's own) say which pages carry a copy between melyviz:begin / end
//     logos    shared/varler-logo/lockups/lockups.json: the Varler lockups
//     looks    every tracked page (.html, and a built app's src .css) that wears a look: a Mélyvíz copy (current or
//              drifted, compared as the sync tool compares), a <link> to melyviz.css (always current), the UI kit
//              inlined between vk:begin / vk:end (its components and the kit version stamped into it), or a <link>
//              to a kit token file
//     base     the VRG Visual Base outside the repo (H:\VRG\Full\VRG_Visual_Base), its top folders, when present
//   layer(r) → { nodes, edges }   pure
//     V:system.vrg-ui-kit · V:system.melyviz      kind 'design system' / 'style'
//     V:kit.<component> · V:theme.<name>          kind 'component' (lane = its first family) / 'theme'; ← system 'contains'
//     V:logo.<lockup>                             kind 'logo'
//     V:look.<page path>                          kind 'look'; state current / linked / drift / behind / missing;
//                                                 → the system and each kit component it carries 'wears'
//     V:base.<folder>                             kind 'visual base'
//   A node's text names its files, so the join links it to the code (C) and documents (G) it is made of or worn by.
'use strict';

const fs = require('fs');
const path = require('path');

const BEGIN = '/* melyviz:begin */', END = '/* melyviz:end */';
const KIT_MARK = /<!--\s*vk:begin\s+([\s\S]*?)\s*-->([\s\S]*?)<!--\s*vk:end\s*-->/;
const KIT_STAMP = /\/\*\s*vrg-ui-kit\s+(\d+\.\d+\.\d+)\s+—\s+([^*]*?)\s*\*\//;

const readText = f => { try { return fs.readFileSync(f, 'utf8'); } catch { return null; } };
const readJson = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
const vcmp = (a, b) => { const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number); for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); return 0; };

// tools/melyviz-sync.js's TARGETS, read from its text (requiring it would run the sync)
function syncTargets(src) {
  const m = /const TARGETS = \[([\s\S]*?)\];/.exec(src || '');
  return m ? [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]) : [];
}

function read({ repo, files = [], visualBase = '' } = {}) {
  const at = rel => path.join(repo, rel);
  const man = readJson(at('shared/vrg-ui-kit/manifest.json'));
  const kit = man ? { version: man.version, families: man.families || {}, components: (man.components || []).map(c => ({ name: c.name, families: c.families || [], files: c.files || [] })),
    themes: (man.tokens || []).filter(t => /theme-/.test(t)).map(t => ({ name: path.basename(t, '.css').replace(/^theme-/, ''), file: 'shared/vrg-ui-kit/' + t })) } : null;
  const mvSrc = readText(at('shared/melyviz.css'));
  const css = mvSrc == null ? null : mvSrc.replace(/\r\n/g, '\n').trimEnd();
  const targets = syncTargets(readText(at('tools/melyviz-sync.js')));
  const logos = (readJson(at('shared/varler-logo/lockups/lockups.json')) || []).map(l => ({ id: l.id, ratio: l.ratio }));

  const looks = new Map();
  const look = rel => looks.get(rel) || looks.set(rel, { path: rel, melyviz: null, kit: null, kitLink: false }).get(rel);
  const pages = new Set([...files.filter(f => /\.html?$/i.test(f) && !/^(Vendor|Archive\/files)\//.test(f)), ...targets]);
  for (const rel of pages) {
    const text = readText(at(rel));
    const target = targets.includes(rel);
    if (text == null) { if (target) look(rel).melyviz = 'missing'; continue; }
    const a = text.indexOf(BEGIN), b = text.indexOf(END);
    if (a >= 0 && b > a) look(rel).melyviz = css != null && text.slice(a + BEGIN.length, b).replace(/\r\n/g, '\n').trim() === css ? 'current' : 'drift';
    else if (target) look(rel).melyviz = 'no mark';
    else if (/<link[^>]+href=["'][^"']*shared\/melyviz\.css["']/i.test(text)) look(rel).melyviz = 'linked';
    const k = KIT_MARK.exec(text);
    if (k) { const st = KIT_STAMP.exec(k[2]) || []; look(rel).kit = { version: st[1] || '', components: st[2] ? st[2].split(',').map(s => s.trim()).filter(Boolean) : k[1].split(/\s+/).filter(w => w && !w.startsWith('-')) }; }
    if (/<link[^>]+href=["'][^"']*shared\/vrg-ui-kit\/tokens\/[^"']+\.css["']/i.test(text)) look(rel).kitLink = true;
  }
  let base = [];
  try { base = fs.readdirSync(visualBase, { withFileTypes: true }).filter(d => d.isDirectory() && !d.name.startsWith('.')).map(d => {
    let n = 0; const walk = (p, dep) => { let es = []; try { es = fs.readdirSync(p, { withFileTypes: true }); } catch { return; } for (const e of es) { if (e.isDirectory()) { if (dep > 0) walk(path.join(p, e.name), dep - 1); } else n++; } };
    walk(path.join(visualBase, d.name), 4); return { name: d.name, files: n }; }); } catch { base = []; }
  return { kit, melyviz: css != null ? { targets } : null, logos, looks: [...looks.values()].sort((x, y) => (x.path < y.path ? -1 : 1)), base };
}

const slug = s => String(s).replace(/[^A-Za-z0-9._\-/]+/g, '-');

function layer({ kit = null, melyviz = null, logos = [], looks = [], base = [] } = {}) {
  const nodes = [], edges = [];
  const add = n => nodes.push({ layer: 'V', t: '', tier: '', own: [], state: '', lane: n.kind, ...n });
  if (kit) {
    add({ id: 'V:system.vrg-ui-kit', kind: 'design system', title: `VRG UI Kit ${kit.version}`, brief: `${kit.components.length} components in ${Object.keys(kit.families).length} families, ${kit.themes.length} themes`,
      state: kit.version, text: 'shared/vrg-ui-kit/README.md\nshared/vrg-ui-kit/CONVENTIONS.md\nshared/vrg-ui-kit/manifest.json', extra: { version: kit.version } });
    for (const c of kit.components) {
      const fam = c.families.length === 1 ? kit.families[c.families[0]] || '' : c.families.length > 3 ? 'everywhere' : c.families.map(f => kit.families[f]).join(' · ');
      add({ id: 'V:kit.' + c.name, kind: 'component', title: c.name, brief: fam, lane: 'family ' + (c.families.length > 3 ? 'all' : c.families[0] || '?'), text: [c.name, ...c.files.map(f => 'shared/vrg-ui-kit/' + f)].join('\n'), extra: { families: c.families } });
      edges.push({ a: 'V:system.vrg-ui-kit', b: 'V:kit.' + c.name, rel: 'contains' });
    }
    for (const t of kit.themes) { add({ id: 'V:theme.' + t.name, kind: 'theme', title: t.name, brief: t.file, text: t.file }); edges.push({ a: 'V:system.vrg-ui-kit', b: 'V:theme.' + t.name, rel: 'contains' }); }
  }
  if (melyviz) add({ id: 'V:system.melyviz', kind: 'style', title: 'Mélyvíz', brief: `the dev-side style; ${melyviz.targets.length} pages carry a copy (tools/melyviz-sync.js)`, text: 'shared/melyviz.css\ndocs/city/melyviz.md\ntools/melyviz-sync.js', extra: {} });
  for (const l of logos) add({ id: 'V:logo.' + l.id, kind: 'logo', title: 'Varler ' + l.id, brief: 'ratio ' + l.ratio, text: 'shared/varler-logo/lockups/lockups.json\nshared/varler-logo/README.md' });
  const ids = new Set(nodes.map(n => n.id));
  for (const L of looks) {
    if (!L.melyviz && !L.kit && !L.kitLink) continue;
    const behind = L.kit && kit && L.kit.version && vcmp(L.kit.version, kit.version) < 0;
    const state = L.melyviz === 'missing' ? 'missing' : (L.melyviz === 'drift' || L.melyviz === 'no mark') ? 'drift' : behind ? 'behind' : L.melyviz === 'current' || L.kit ? 'current' : 'linked';
    const id = 'V:look.' + slug(L.path);
    add({ id, kind: 'look', title: L.path, lane: L.path.split('/')[0], state,
      brief: [L.melyviz ? 'Mélyvíz ' + L.melyviz : '', L.kit ? `UI Kit ${L.kit.version || '?'} (${L.kit.components.length} components)` : '', L.kitLink ? 'kit tokens linked' : ''].filter(Boolean).join(' · '),
      text: L.path, extra: { path: L.path, melyviz: L.melyviz, kit: L.kit, kitLink: L.kitLink, kitLatest: kit ? kit.version : '' } });
    if (L.melyviz && ids.has('V:system.melyviz')) edges.push({ a: id, b: 'V:system.melyviz', rel: 'wears' });
    if ((L.kit || L.kitLink) && ids.has('V:system.vrg-ui-kit')) edges.push({ a: id, b: 'V:system.vrg-ui-kit', rel: 'wears' });
    for (const c of (L.kit && L.kit.components) || []) if (ids.has('V:kit.' + c)) edges.push({ a: id, b: 'V:kit.' + c, rel: 'wears' });
  }
  for (const b of base) add({ id: 'V:base.' + slug(b.name), kind: 'visual base', title: b.name, brief: `${b.files} file${b.files === 1 ? '' : 's'} (VRG_Visual_Base, outside the repo)`, text: 'VRG_Visual_Base/' + b.name });
  return { nodes, edges };
}

// pages whose look no longer matches its source (DRIFT §17, J look-drift / kit-behind)
const drifted = list => list.filter(n => n.layer === 'V' && n.kind === 'look' && /^(drift|behind|missing)$/.test(n.state));

module.exports = { read, layer, drifted, syncTargets, vcmp };

#!/usr/bin/env node
// publish-stack.js — VRG Mobile, WP M17 (Rétegverem / VRG Stack on the phone): put the stack's 3D pages on
// the `stack-pages` branch, where the phone's feature-stack reads them through the GitHub API with its token.
//
//   node Mobile/stack/publish-stack.js [--push] [--only <ids>] [--stack <dir>] [--repo .] [--remote origin] [--out <dir>]
//
// --only konnektom,holo,retegek,kisokos rebuilds just those pages and keeps every other page exactly as the branch has it
// now (the same blob), so one page can go up without the rest of its data: the Kisokos page needs only the Kisokos/
// sources in the repo, the three Stack pages need out/connectome-data.js, which only the PC can build.
//
// Without --push it is a dry run: it bundles the pages into --out (default: a temp folder), builds the commit in
// the repo's object store and prints what would change, but sends nothing. START → R Rétegverem → T runs it with
// --push.
//
// Why from the PC: the stack (Stack/ in this repo; its out/ is not committed) is built from H: (transcripts, git, the
// notes), which no Actions runner has. So the PC bundles and publishes; GitHub only carries the result.
//
// What it bundles (each page becomes ONE self-contained HTML file; the phone loads nothing else):
//   connectome.html -> stack/konnektom.html     orb.html -> stack/holo.html     layers.html -> stack/retegek.html
//   kisokos.html -> stack/kisokos.html: the K layer's VRG Kisokos 3D, by Stack/lib/kisokos.js's own standalone mode (the
//   cards from Kisokos/, plus each K node's neighbours from out/stack.json when the PC has built it; without it, none)
//   lineage.html -> stack/otletfolyam.html (layer I) and decisions.html -> stack/dontesnaplo.html (layer Q): their data
//   (out/lineage-data.js, out/decisions-data.js, written by `stack.js build` on the PC) and the VRG UI Kit's css, fonts
//   (as data: URIs) and scripts inlined; links between the stack's pages renamed to the phone's file names
//   Archive/files/konnektom-labor.html -> stack/labor.html (START R → K): already one page; its Google Fonts links are
//   dropped (the phone loads nothing from outside), so it falls back to its own font stacks
//   viewer.html (Rétegverem, the byte-particle Stack Viewer, STK-Q25) -> stack/retegek.html in place of layers.html when the
//   PC has out/layertext: the layer text as byte classes only (16 bytes a particle), never the text itself
//   metro.html -> vonalak.html (L), control.html -> vezerloterem.html (A), runs.html -> futasnaplo.html (U), commits.html ->
//   commitok.html (R): like the two above; erintesnyom.html -> erintesnyom.html (Érintésnyom, replay only, the newest
//   recorded sessions inlined; SL4). The phone opens these from its ◢ dial (Mobile D-191)
// The pages after the first three are optional on the phone. In a full publish, an optional page whose data is missing
// here keeps the copy the branch already has (with a warning) instead of stopping the publish.
//   inlined: shared/melyviz.css, brain.js, touch.js, earth-land.js (Holo), out/connectome-data.js (the data),
//   plus `window.STACK_BUNDLE = true`, which makes the pages skip the data reload and hide the server buttons.
//   The data is node ids, titles, kinds, sizes, times and links; never a file's content. The repo is private.
//
// The layout of stack-pages (kit-core Stack.kt reads exactly this):
//   README.md
//   stack/konnektom.html   stack/holo.html   stack/retegek.html   (optional on the phone:) stack/kisokos.html
//   stack/otletfolyam.html   stack/dontesnaplo.html   stack/vonalak.html   stack/vezerloterem.html   stack/futasnaplo.html
//   stack/commitok.html   stack/erintesnyom.html   stack/labor.html
//   stack/meta.json        {kind:'vrg-stack-meta', generated, published, nodes, points, lines, files:{name:bytes}, kisokos?}
//
// How it writes: git plumbing only (hash-object, mktree, commit-tree); the working tree, the index, HEAD and every
// local branch stay as they were. Each publish is ONE root commit (no history of megabyte pages), pushed with
// --force-with-lease on refs/heads/stack-pages alone, against the tip it read: the same rule as city-pages (M5).
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), { execFileSync } = require('child_process');

const BRANCH = 'stack-pages';
const README = `# stack-pages: the VRG Stack on the phone (VRG Mobile, WP M17)

Generated on the PC by \`Mobile/stack/publish-stack.js --push\` (START → R Rétegverem → T). Do not commit here by
hand; the branch is replaced (one commit, no history) on every publish.

- \`stack/konnektom.html\`: the Konnektóm (the stack as a brain, by function), one self-contained page.
- \`stack/holo.html\`: the Holo page (Polip, Gömb, Föld, Mag, the Őrség lock), one self-contained page.
- \`stack/retegek.html\`: the Rétegek page (the layers as an exploded isometric stack), one self-contained page.
- \`stack/kisokos.html\`: the VRG Kisokos 3D page (the Stack's K layer, the offline work handbook), one self-contained page.
- \`stack/otletfolyam.html\`: Ötletfolyam (layer I, the ideas and their lineage), one self-contained page.
- \`stack/dontesnaplo.html\`: Döntésnapló (layer Q, the decision log), one self-contained page.
- \`stack/vonalak.html\`, \`stack/vezerloterem.html\`, \`stack/futasnaplo.html\`, \`stack/commitok.html\`: Vonalak (L), Vezérlőterem (A),
  Futásnapló (U), Commitok (R), one self-contained page each; the phone opens them from its ◢ dial.
- \`stack/erintesnyom.html\`: Érintésnyom, replay only, the newest recorded sessions inlined.
- \`stack/retegek.html\` is the byte-particle Stack Viewer when the PC has the layer text (byte classes only, never the text).
- \`stack/labor.html\`: the Konnektóm-labor (fly brain, Stack brain, Holo, layers, empty memory net), one self-contained page.
- \`stack/meta.json\`: when the data was built and published, the sizes.

The source lives in \`Stack/\` on main; the data is titles, kinds, sizes, times and
links, never file contents.
`;

// The pages, in the order the phone's chips show them (kit-core Stack.kt StackPages.PAGES uses the same files).
const PAGES = [
  { id: 'konnektom', file: 'konnektom.html', src: 'connectome.html' },
  { id: 'holo', file: 'holo.html', src: 'orb.html' },
  { id: 'retegek', file: 'retegek.html', src: 'layers.html' },
  { id: 'kisokos', file: 'kisokos.html', kisokos: true, optional: true },
  { id: 'otletfolyam', file: 'otletfolyam.html', local: 'lineage.html', data: 'out/lineage-data.js', optional: true },
  { id: 'dontesnaplo', file: 'dontesnaplo.html', local: 'decisions.html', data: 'out/decisions-data.js', optional: true },
  { id: 'vonalak', file: 'vonalak.html', local: 'metro.html', data: 'out/metro-data.js', optional: true },
  { id: 'vezerloterem', file: 'vezerloterem.html', local: 'control.html', data: 'out/control-data.js', optional: true },
  { id: 'futasnaplo', file: 'futasnaplo.html', local: 'runs.html', data: 'out/runs-data.js', optional: true },
  { id: 'commitok', file: 'commitok.html', local: 'commits.html', data: 'out/commits-data.js', optional: true },
  { id: 'erintesnyom', file: 'erintesnyom.html', touch: true, data: 'out/replay/index.js', optional: true },
  { id: 'labor', file: 'labor.html', archive: 'Archive/files/konnektom-labor.html', optional: true },
];

// A link from one stack page to another, by the phone's file names; a page the phone does not get is unlinked.
const LINKS = { 'connectome.html': 'konnektom.html', 'orb.html': 'holo.html', 'layers.html': 'retegek.html', 'kisokos.html': 'kisokos.html',
  'lineage.html': 'otletfolyam.html', 'decisions.html': 'dontesnaplo.html', 'metro.html': 'vonalak.html', 'control.html': 'vezerloterem.html',
  'runs.html': 'futasnaplo.html', 'commits.html': 'commitok.html', 'erintesnyom.html': 'erintesnyom.html', 'viewer.html': 'retegek.html' };

function args(argv) {
  const a = { push: false, repo: path.resolve(__dirname, '..', '..'), remote: 'origin', stack: null, out: null, only: null };
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--push') a.push = true;
    else if (k === '--repo') a.repo = path.resolve(argv[++i]);
    else if (k === '--remote') a.remote = argv[++i];
    else if (k === '--stack') a.stack = path.resolve(argv[++i]);
    else if (k === '--out') a.out = path.resolve(argv[++i]);
    else if (k === '--only') {
      a.only = String(argv[++i] || '').split(',').map(x => x.trim()).filter(Boolean);
      const bad = a.only.filter(id => !PAGES.some(p => p.id === id));
      if (!a.only.length || bad.length) throw new Error('--only takes page ids: ' + PAGES.map(p => p.id).join(', ') + (bad.length ? ' (not: ' + bad.join(', ') + ')' : ''));
    }
    else throw new Error('unknown argument: ' + k);
  }
  a.stack = a.stack || path.join(a.repo, 'Stack');
  return a;
}

// `</` inside an inlined script would end the <script> element early; `<\/` is the same text to JavaScript
// (in strings, template literals and regexes alike).
const js = s => s.replace(/<\/(script)/gi, '<\\/$1');
const css = s => s.replace(/<\/(style)/gi, '<\\/$1');

function bundle(stack, repo, page) {
  const read = f => fs.readFileSync(path.join(stack, f), 'utf8');
  let html = read(page);
  const sheet = fs.readFileSync(path.join(repo, 'shared', 'melyviz.css'), 'utf8');
  const link = /<link rel="stylesheet" href="[^"]*melyviz\.css">/;
  if (!link.test(html)) throw new Error(page + ': the melyviz.css link was not found');
  html = html.replace(link, () => `<style>\n${css(sheet)}\n</style>`);
  const data = read(path.join('out', 'connectome-data.js'));
  if (!/window\.CONNECTOME\s*=/.test(data)) throw new Error('out/connectome-data.js is not connectome data (run: node stack.js connectome)');
  let first = true;
  html = html.replace(/<script src="([a-z-]+\.js)"><\/script>/g, (m, f) => {
    const pre = first ? `<script>window.STACK_BUNDLE = true;\n${js(data)}</script>\n` : '';
    first = false;
    return `${pre}<script>/* ${f} */\n${js(read(f))}</script>`;
  });
  if (first) throw new Error(page + ': no <script src> to inline');
  if (/<script src=|<link [^>]*href=/.test(html)) throw new Error(page + ': something external is still linked');
  return { html, data };
}

function git(repo, argv, input) {
  return execFileSync('git', argv, { cwd: repo, input, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }).trim();
}

// One page made self-contained from its own folder: local stylesheets (their woff2 fonts as data: URIs) and scripts
// inlined, outside stylesheets (web fonts) dropped, the bundle flag set before the first script, the links between the
// stack's pages renamed. Throws if anything outside is still linked.
function bundleLocal(file) {
  const dir = path.dirname(file);
  let html = fs.readFileSync(file, 'utf8');
  html = html.replace(/<link rel="preconnect"[^>]*>\n?/g, '');
  html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g, (m, href) => {
    if (/^(https?:)?\/\//.test(href)) return '';
    const f = path.resolve(dir, href);
    const sheet = fs.readFileSync(f, 'utf8').replace(/url\("?([^")]+\.woff2)"?\)/g, (mm, u) => /^(data:|https?:)/.test(u) ? mm
      : `url(data:font/woff2;base64,${fs.readFileSync(path.resolve(path.dirname(f), u)).toString('base64')})`);
    return `<style>/* ${href} */\n${css(sheet)}\n</style>`;
  });
  let first = true;
  html = html.replace(/<script src="([^"]+)"><\/script>/g, (m, src) => {
    if (/^(https?:)?\/\//.test(src)) throw new Error(path.basename(file) + ': an outside script (' + src + ')');
    const pre = first ? '<script>window.STACK_BUNDLE = true;</script>\n' : '';
    first = false;
    return `${pre}<script>/* ${src} */\n${js(fs.readFileSync(path.resolve(dir, src), 'utf8'))}</script>`;
  });
  html = html.replace(/href="([a-z-]+\.html)/g, (m, f) => LINKS[f] ? `href="${LINKS[f]}` : 'href="#pc-only-' + f.replace('.html', ''));
  if (/<script src=|<link [^>]*href=/.test(html)) throw new Error(path.basename(file) + ': something external is still linked');
  return html;
}

// The Kisokos page through Stack/lib/kisokos.js's own standalone writer (it also refreshes out/kisokos-data.js).
// The Érintésnyom and Rétegverem pages need more than bundleLocal: missing parts are reported, not thrown, and their own
// data (the sessions, the layer text as byte classes) goes in before the page's script.
const MIME = { '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.svg': 'image/svg+xml', '.png': 'image/png' };

function bundleLayer(stack, page) {
  const at = f => path.resolve(stack, f);
  let html = fs.readFileSync(at(page), 'utf8');
  const missing = [];
  html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g, (m, href) => {
    const f = at(href);
    if (!fs.existsSync(f)) { missing.push(href); return m; }
    const sheet = fs.readFileSync(f, 'utf8').replace(/url\(\s*["']?([^"')]+)["']?\s*\)/g, (u, ref) => {
      if (/^(data:|https?:|#)/.test(ref)) return u;
      const rf = path.resolve(path.dirname(f), ref);
      if (!fs.existsSync(rf)) return u;
      return `url("data:${MIME[path.extname(rf).toLowerCase()] || 'application/octet-stream'};base64,${fs.readFileSync(rf).toString('base64')}")`;
    });
    return `<style>/* ${href} */\n${css(sheet)}\n</style>`;
  });
  let first = true;
  html = html.replace(/<script src="([^"]+)"><\/script>/g, (m, src) => {
    const f = at(src);
    if (!fs.existsSync(f)) { missing.push(src); return m; }
    const pre = first ? '<script>window.STACK_BUNDLE = true;</script>\n' : '';
    first = false;
    return `${pre}<script>/* ${src} */\n${js(fs.readFileSync(f, 'utf8'))}</script>`;
  });
  // links between stack pages point at the names the phone keeps them under
  html = html.replace(/href="([a-z-]+\.html)((?:#|\?)[^"]*)?"/g, (m, f, rest) => LINKS[f] ? `href="${LINKS[f]}${rest || ''}"` : m);
  if (missing.length) return { missing };
  if (/<script src=|<link rel="stylesheet"/.test(html)) throw new Error(page + ': something external is still linked');
  return { html };
}

// Érintésnyom on the phone (SL4, read-only): the page with the stack, the lens and forecast indexes inlined like the layer
// pages, plus the newest recorded sessions as window.REPLAY_BUNDLE (their out/replay/<sid8>.js files, which call
// REPLAY_LOAD, collected before the page's own script runs).
const TOUCH_SESSIONS = 12, TOUCH_BYTES = 4 * 1024 * 1024;
function bundleTouch(stack) {
  const b = bundleLayer(stack, 'erintesnyom.html');
  if (b.missing) return b;
  const idx = path.join(stack, 'out', 'replay', 'index.js');
  let rows = [];
  try { const box = { window: {} }; require('vm').runInNewContext(fs.readFileSync(idx, 'utf8'), box); rows = box.window.REPLAY_INDEX || []; } catch { rows = []; }
  let size = 0; const parts = [];
  for (const r of rows.slice(0, TOUCH_SESSIONS)) {
    const f = path.join(stack, 'out', 'replay', r.sid + '.js');
    if (!fs.existsSync(f)) continue;
    const s = fs.readFileSync(f, 'utf8');
    if (size + s.length > TOUCH_BYTES) break;
    size += s.length; parts.push(`<script>/* out/replay/${r.sid}.js */\n${js(s)}</script>`);
  }
  const collect = '<script>window.REPLAY_BUNDLE = {}; window.REPLAY_LOAD = function (sid, d) { window.REPLAY_BUNDLE[sid] = d; };</script>\n' + parts.join('\n') + '\n';
  const at = b.html.lastIndexOf('<script>\n(function () {');
  if (at < 0) throw new Error('erintesnyom.html: the page script was not found');
  return { html: b.html.slice(0, at) + collect + b.html.slice(at), sessions: parts.length };
}

// Rétegverem on the phone: the Viewer with the stack and the layer text inlined. The text itself never leaves the PC:
// each byte becomes its class (lib/viewer-layout.js byteClass), 16 of them one particle (Normál, the phone's default,
// STK-Q22), so a layer of 8 MB is 500 KB of classes. Node ranges are given in particles.
const VIEW_K = 16;
function layerClasses(stack) {
  const dir = path.join(stack, 'out', 'layertext');
  let ix = null;
  try { const box = { window: {} }; require('vm').runInNewContext(fs.readFileSync(path.join(dir, 'index.js'), 'utf8'), box); ix = box.window.LAYERTEXT_INDEX; } catch { ix = null; }
  if (!ix) return null;
  const VL = require(path.resolve(stack, 'lib', 'viewer-layout.js'));
  const layers = {};
  for (const L of Object.keys(ix.layers)) {
    const idx = JSON.parse(fs.readFileSync(path.join(dir, L + '.idx'), 'utf8')).nodes, src = fs.readFileSync(path.join(dir, L + '.bin'));
    const cls = new Uint8Array(src.length); for (let i = 0; i < src.length; i++) cls[i] = VL.byteClass(src[i]);
    const ag = VL.aggregate(cls, idx.map(r => [r[1], r[2]]), VIEW_K, true);
    layers[L] = { nodes: idx.map((r, i) => [r[0], ag.starts[i], ag.starts[i + 1]]), data: Buffer.from(ag.data).toString('base64') };
  }
  // the time scrubber's births and pulses (ids and day numbers only)
  let time = null;
  try { const box = { window: {} }; require('vm').runInNewContext(fs.readFileSync(path.join(dir, 'time.js'), 'utf8'), box); time = box.window.LAYERTEXT_TIME || null; } catch { time = null; }
  return { k0: VIEW_K, index: { generated: ix.generated, layers: ix.layers, diff: ix.diff || {} }, layers, time };
}
function bundleViewer(stack) {
  const b = bundleLayer(stack, 'viewer.html');
  if (b.missing) return b;
  const data = path.join(stack, 'out', 'stack-data.js'), lt = layerClasses(stack), missing = [];
  if (!fs.existsSync(data)) missing.push('out/stack-data.js');
  if (!lt) missing.push('out/layertext');
  if (missing.length) return { missing };
  const pre = `<script>/* out/stack-data.js */\n${js(fs.readFileSync(data, 'utf8'))}</script>\n` +
    `<script>/* out/layertext: byte classes only, ${VIEW_K} bytes a particle */\nwindow.LAYERTEXT_BUNDLE = ${js(JSON.stringify(lt))};</script>\n`;
  const at = b.html.lastIndexOf("<script>\n'use strict';\n(function () {");
  if (at < 0) throw new Error('viewer.html: the page script was not found');
  return { html: b.html.slice(0, at) + pre + b.html.slice(at), layers: Object.keys(lt.layers).length };
}

function kisokosPage(stack, out) {
  const file = path.join(out, 'kisokos.html');
  require(path.join(stack, 'lib', 'kisokos.js')).write({ standalone: file });
  const html = fs.readFileSync(file, 'utf8');
  if (!/window\.KISOKOS\s*=/.test(html)) throw new Error('kisokos.html: the Kisokos data was not inlined');
  if (/<script src=|<link [^>]*href=/.test(html)) throw new Error('kisokos.html: something external is still linked');
  const m = html.match(/window\.KISOKOS = \{"about":(?:"[^"]*"|null),"generated":"([^"]*)"/);
  const cards = (html.match(/"stats":\{"cards":(\d+)/) || [])[1];
  return { html, generated: m ? m[1] : '', cards: cards ? +cards : 0 };
}

function main() {
  const a = args(process.argv);
  const only = a.only || PAGES.map(p => p.id);
  const stackPages = PAGES.filter(p => p.src && only.includes(p.id));   // the three connectome-data pages
  if (stackPages.length && !fs.existsSync(path.join(a.stack, 'connectome.html'))) throw new Error('no stack at ' + a.stack);
  const out = a.out || fs.mkdtempSync(path.join(os.tmpdir(), 'vrg-stack-'));
  fs.mkdirSync(out, { recursive: true });

  // the pages rebuilt here
  const files = {};
  let D = null, K = null;
  for (const p of stackPages) {
    const b = bundle(a.stack, a.repo, p.src);
    files[p.file] = b.html;
    if (!D) D = JSON.parse(b.data.slice(b.data.indexOf('=') + 1).trim().replace(/;\s*$/, ''));
  }
  if (only.includes('retegek') && files['retegek.html']) {   // the Stack Viewer in place of the old graph view, when the PC has its layer text
    const view = bundleViewer(a.stack);
    if (view.missing) console.log(`viewer.html: left out, retegek.html stays the graph view (missing ${view.missing.join(', ')}; run: node stack.js build)`);
    else { files['retegek.html'] = view.html; console.log(`viewer.html -> retegek.html: ${view.layers} layers as byte classes`); }
  }
  if (only.includes('kisokos')) { K = kisokosPage(a.stack, out); files['kisokos.html'] = K.html; }
  const missing = [];
  for (const p of PAGES.filter(x => (x.local || x.archive || x.touch) && only.includes(x.id))) {
    if (p.touch) {   // Érintésnyom: the page and the newest recorded sessions
      const t = bundleTouch(a.stack);
      if (t.missing) {
        if (a.only) throw new Error(`${p.id}: ${t.missing.join(', ')} missing (on the PC: node Stack/stack.js build)`);
        missing.push(p); console.log(`warning: ${p.id}: ${t.missing.join(', ')} missing; the branch's copy is kept`); continue;
      }
      files[p.file] = t.html; console.log(`erintesnyom.html: ${t.sessions} sessions inlined`); continue;
    }
    const need = p.local ? path.join(a.stack, p.data) : path.join(a.repo, p.archive);
    if (!fs.existsSync(need)) {
      if (a.only) throw new Error(`${p.id}: ${path.relative(a.repo, need)} is missing (on the PC: node Stack/stack.js build)`);
      missing.push(p);
      console.log(`warning: ${p.id}: ${path.relative(a.repo, need)} is missing; the branch's copy is kept`);
      continue;
    }
    files[p.file] = bundleLocal(p.local ? path.join(a.stack, p.local) : need);
  }

  // with --only, every other page stays exactly as the branch has it (its blob is reused), and so does its metadata
  let tip = null, base = null;
  const kept = {};
  if (a.only || missing.length) {
    git(a.repo, ['fetch', '--quiet', a.remote, 'refs/heads/' + BRANCH]);
    tip = git(a.repo, ['rev-parse', 'FETCH_HEAD']);
    base = JSON.parse(git(a.repo, ['show', tip + ':stack/meta.json']));
    for (const p of PAGES.filter(x => !only.includes(x.id) || missing.includes(x))) {
      let blob = '';
      try { blob = git(a.repo, ['rev-parse', '--verify', '--quiet', tip + ':stack/' + p.file]); } catch (e) { blob = ''; }
      if (!blob) { if (p.optional) continue; throw new Error(`stack-pages has no stack/${p.file} to keep: publish it too (--only)`); }
      kept[p.file] = { blob, bytes: +git(a.repo, ['cat-file', '-s', blob]) };
    }
  }

  const src = D || base;
  const sizes = { ...Object.fromEntries(Object.entries(kept).map(([k, v]) => [k, v.bytes])),
    ...Object.fromEntries(Object.entries(files).map(([k, v]) => [k, Buffer.byteLength(v, 'utf8')])) };
  const meta = {
    kind: 'vrg-stack-meta', generated: src.generated, stackGenerated: src.stackGenerated, published: new Date().toISOString(),
    nodes: D ? D.nodes.length : base.nodes, points: D ? D.neurons : base.points, lines: D ? (D.lines || []).length : base.lines,
    files: Object.fromEntries(PAGES.filter(p => sizes[p.file]).map(p => [p.file, sizes[p.file]])),
  };
  const kis = K ? { generated: K.generated, cards: K.cards } : base && base.kisokos;
  if (kis && meta.files['kisokos.html']) meta.kisokos = kis;
  for (const [k, v] of Object.entries(files)) fs.writeFileSync(path.join(out, k), v);
  fs.writeFileSync(path.join(out, 'meta.json'), JSON.stringify(meta, null, 2) + '\n');
  fs.writeFileSync(path.join(out, 'README.md'), README);

  // the commit: README.md + stack/{the pages, meta.json}
  const blob = f => git(a.repo, ['hash-object', '-w', '--', f]);
  const entries = Object.keys(meta.files).map(f => [f, kept[f] ? kept[f].blob : blob(path.join(out, f))]);
  entries.push(['meta.json', blob(path.join(out, 'meta.json'))]);
  const sub = git(a.repo, ['mktree'], entries.sort((x, y) => x[0] < y[0] ? -1 : 1).map(([f, b]) => `100644 blob ${b}\t${f}`).join('\n') + '\n');
  const root = git(a.repo, ['mktree'], `100644 blob ${blob(path.join(out, 'README.md'))}\tREADME.md\n040000 tree ${sub}\tstack\n`);
  const env = { ...process.env, GIT_AUTHOR_NAME: 'VRG Stack', GIT_AUTHOR_EMAIL: 'stack@vrg.local', GIT_COMMITTER_NAME: 'VRG Stack', GIT_COMMITTER_EMAIL: 'stack@vrg.local' };
  const what = a.only ? ` (rebuilt: ${only.join(', ')}; kept: ${Object.keys(kept).join(', ') || 'none'})` : '';
  const commit = execFileSync('git', ['commit-tree', root, '-m', `stack-pages: ${meta.nodes} nodes, data ${meta.generated}${what}`], { cwd: a.repo, env, encoding: 'utf8' }).trim();
  const kb = Object.entries(meta.files).map(([k, v]) => `${k} ${(v / 1024).toFixed(0)} KB${kept[k] ? ' (kept)' : ''}`).join(', ');
  console.log(`stack-pages: ${meta.nodes} nodes, ${meta.points} points; ${kb}; commit ${commit.slice(0, 10)}; files in ${out}`);
  if (K) console.log(`kisokos.html: ${K.cards} cards, data ${K.generated}`);
  if (!a.push) { console.log('dry run (no --push): nothing sent'); return; }

  // the lease: the tip as the remote has it now ('' = the branch must not exist yet); with --only, the tip the kept pages came from
  if (tip === null) { const ls = git(a.repo, ['ls-remote', a.remote, 'refs/heads/' + BRANCH]); tip = ls ? ls.split(/\s+/)[0] : ''; }
  git(a.repo, ['push', '--force-with-lease=refs/heads/' + BRANCH + ':' + tip, a.remote, commit + ':refs/heads/' + BRANCH]);
  console.log(`pushed to ${a.remote}/${BRANCH} (was ${tip ? tip.slice(0, 10) : 'absent'})`);
}

if (require.main === module) {
  try { main(); } catch (e) { console.error('publish-stack: ' + e.message); process.exit(1); }
}
module.exports = { bundle, bundleLocal, bundleLayer, bundleTouch, bundleViewer, layerClasses, js, PAGES, LINKS, kisokosPage };

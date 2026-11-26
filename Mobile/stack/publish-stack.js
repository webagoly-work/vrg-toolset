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
//   inlined: shared/melyviz.css, brain.js, touch.js, earth-land.js (Holo), out/connectome-data.js (the data),
//   plus `window.STACK_BUNDLE = true`, which makes the pages skip the data reload and hide the server buttons.
//   The data is node ids, titles, kinds, sizes, times and links; never a file's content. The repo is private.
//
// The layout of stack-pages (kit-core Stack.kt reads exactly this):
//   README.md
//   stack/konnektom.html   stack/holo.html   stack/retegek.html   stack/kisokos.html (optional on the phone)
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
- \`stack/meta.json\`: when the data was built and published, the sizes.

The source lives in \`Stack/\` on main; the data is titles, kinds, sizes, times and
links, never file contents.
`;

// The pages, in the order the phone's chips show them (kit-core Stack.kt StackPages.PAGES uses the same files).
const PAGES = [
  { id: 'konnektom', file: 'konnektom.html', src: 'connectome.html' },
  { id: 'holo', file: 'holo.html', src: 'orb.html' },
  { id: 'retegek', file: 'retegek.html', src: 'layers.html' },
  { id: 'kisokos', file: 'kisokos.html', kisokos: true },
];

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

// The Kisokos page through Stack/lib/kisokos.js's own standalone writer (it also refreshes out/kisokos-data.js).
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
  const stackPages = PAGES.filter(p => !p.kisokos && only.includes(p.id));
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
  if (only.includes('kisokos')) { K = kisokosPage(a.stack, out); files['kisokos.html'] = K.html; }

  // with --only, every other page stays exactly as the branch has it (its blob is reused), and so does its metadata
  let tip = null, base = null;
  const kept = {};
  if (a.only) {
    git(a.repo, ['fetch', '--quiet', a.remote, 'refs/heads/' + BRANCH]);
    tip = git(a.repo, ['rev-parse', 'FETCH_HEAD']);
    base = JSON.parse(git(a.repo, ['show', tip + ':stack/meta.json']));
    for (const p of PAGES.filter(x => !only.includes(x.id))) {
      let blob = '';
      try { blob = git(a.repo, ['rev-parse', '--verify', '--quiet', tip + ':stack/' + p.file]); } catch (e) { blob = ''; }
      if (!blob) { if (p.kisokos) continue; throw new Error(`stack-pages has no stack/${p.file} to keep: publish it too (--only)`); }
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
module.exports = { bundle, js, PAGES, kisokosPage };

#!/usr/bin/env node
// publish-stack.js — VRG Mobile, WP M17 (Rétegverem / VRG Stack on the phone): put the stack's two 3D pages on
// the `stack-pages` branch, where the phone's feature-stack reads them through the GitHub API with its token.
//
//   node Mobile/stack/publish-stack.js [--push] [--stack <dir>] [--repo .] [--remote origin] [--out <dir>]
//
// Without --push it is a dry run: it bundles the pages into --out (default: a temp folder), builds the commit in
// the repo's object store and prints what would change, but sends nothing. START → R Rétegverem → T runs it with
// --push.
//
// Why from the PC: the stack (H:\VRG\Full\notes\stack, outside the repo) is built from H: (transcripts, git, the
// notes), which no Actions runner has. So the PC bundles and publishes; GitHub only carries the result.
//
// What it bundles (each page becomes ONE self-contained HTML file; the phone loads nothing else):
//   connectome.html -> stack/konnektom.html     orb.html -> stack/holo.html
//   inlined: shared/melyviz.css, brain.js, touch.js, earth-land.js (Holo), out/connectome-data.js (the data),
//   plus `window.STACK_BUNDLE = true`, which makes the pages skip the data reload and hide the server buttons.
//   The data is node ids, titles, kinds, sizes, times and links; never a file's content. The repo is private.
//
// The layout of stack-pages (kit-core Stack.kt reads exactly this):
//   README.md
//   stack/konnektom.html   stack/holo.html
//   stack/meta.json        {kind:'vrg-stack-meta', generated, published, nodes, points, neurons?, files:{name:bytes}}
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
- \`stack/meta.json\`: when the data was built and published, the sizes.

The source lives in \`H:\\VRG\\Full\\notes\\stack\` (outside the repo); the data is titles, kinds, sizes, times and
links, never file contents.
`;

function args(argv) {
  const a = { push: false, repo: path.resolve(__dirname, '..', '..'), remote: 'origin', stack: null, out: null };
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--push') a.push = true;
    else if (k === '--repo') a.repo = path.resolve(argv[++i]);
    else if (k === '--remote') a.remote = argv[++i];
    else if (k === '--stack') a.stack = path.resolve(argv[++i]);
    else if (k === '--out') a.out = path.resolve(argv[++i]);
    else throw new Error('unknown argument: ' + k);
  }
  a.stack = a.stack || path.join(path.dirname(a.repo), 'notes', 'stack');
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

function main() {
  const a = args(process.argv);
  if (!fs.existsSync(path.join(a.stack, 'connectome.html'))) throw new Error('no stack at ' + a.stack);
  const out = a.out || fs.mkdtempSync(path.join(os.tmpdir(), 'vrg-stack-'));
  fs.mkdirSync(out, { recursive: true });
  const kon = bundle(a.stack, a.repo, 'connectome.html'), holo = bundle(a.stack, a.repo, 'orb.html');
  const D = JSON.parse(kon.data.slice(kon.data.indexOf('=') + 1).trim().replace(/;\s*$/, ''));
  const files = { 'konnektom.html': kon.html, 'holo.html': holo.html };
  const meta = {
    kind: 'vrg-stack-meta', generated: D.generated, stackGenerated: D.stackGenerated, published: new Date().toISOString(),
    nodes: D.nodes.length, points: D.neurons, lines: (D.lines || []).length,
    files: Object.fromEntries(Object.entries(files).map(([k, v]) => [k, Buffer.byteLength(v, 'utf8')])),
  };
  for (const [k, v] of Object.entries(files)) fs.writeFileSync(path.join(out, k), v);
  fs.writeFileSync(path.join(out, 'meta.json'), JSON.stringify(meta, null, 2) + '\n');
  fs.writeFileSync(path.join(out, 'README.md'), README);

  // the commit: README.md + stack/{konnektom.html, holo.html, meta.json}
  const blob = f => git(a.repo, ['hash-object', '-w', '--', f]);
  const sub = git(a.repo, ['mktree'], ['holo.html', 'konnektom.html', 'meta.json'].map(f => `100644 blob ${blob(path.join(out, f))}\t${f}`).join('\n') + '\n');
  const root = git(a.repo, ['mktree'], `100644 blob ${blob(path.join(out, 'README.md'))}\tREADME.md\n040000 tree ${sub}\tstack\n`);
  const env = { ...process.env, GIT_AUTHOR_NAME: 'VRG Stack', GIT_AUTHOR_EMAIL: 'stack@vrg.local', GIT_COMMITTER_NAME: 'VRG Stack', GIT_COMMITTER_EMAIL: 'stack@vrg.local' };
  const commit = execFileSync('git', ['commit-tree', root, '-m', `stack-pages: ${meta.nodes} nodes, data ${meta.generated}`], { cwd: a.repo, env, encoding: 'utf8' }).trim();
  const kb = Object.entries(meta.files).map(([k, v]) => `${k} ${(v / 1024).toFixed(0)} KB`).join(', ');
  console.log(`stack-pages: ${meta.nodes} nodes, ${meta.points} points; ${kb}; commit ${commit.slice(0, 10)}; files in ${out}`);
  if (!a.push) { console.log('dry run (no --push): nothing sent'); return; }

  // the lease: the tip as the remote has it now ('' = the branch must not exist yet)
  const ls = git(a.repo, ['ls-remote', a.remote, 'refs/heads/' + BRANCH]);
  const tip = ls ? ls.split(/\s+/)[0] : '';
  git(a.repo, ['push', '--force-with-lease=refs/heads/' + BRANCH + ':' + tip, a.remote, commit + ':refs/heads/' + BRANCH]);
  console.log(`pushed to ${a.remote}/${BRANCH} (was ${tip ? tip.slice(0, 10) : 'absent'})`);
}

if (require.main === module) {
  try { main(); } catch (e) { console.error('publish-stack: ' + e.message); process.exit(1); }
}
module.exports = { bundle, js };

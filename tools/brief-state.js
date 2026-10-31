#!/usr/bin/env node
// ---------------------------------------------------------------------------
// brief-state.js — keeps the agent briefs in docs/hub/agents honest. They went
// stale because they were hand-copied snapshots with nothing checking them, so
// the changing part now comes from git: the owner line under the title and the
// "- git" lines in §6. The rest of a brief stays hand-written.
//
//   node tools/brief-state.js           rewrite the owner line and the git lines
//   node tools/brief-state.js --check   report stale state, dead names, missing paths
//
// Exit code 1 from --check when anything is wrong, so it can gate a commit.
// ---------------------------------------------------------------------------

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const REPO = path.resolve(__dirname, '..');
const AGENTS = path.join(REPO, 'docs', 'hub', 'agents');
const KIT = path.join(path.dirname(REPO), 'Varler_Workflow_Kit');
const JOBS = path.join(path.dirname(REPO), 'jobs');

const ARNOLD = 'Arnold, Design Division', CHARLOTTE = 'Charlotte, Finance and Contracts', ELSIE = 'Elsie, Behaviour Lab';

// who answers for each brief, the GO file that drives it, and the folders whose history is its state
const BRIEFS = {
  planner: { who: ARNOLD, go: 'GO PLANNER', paths: ['Planner/projects/varler-planner'] },
  routing: { who: ARNOLD, go: 'GO ROUTE', paths: ['GO-ROUTE.md', 'Planner/projects/varler-planner/docs/topology'] },
  'client-preview': { who: ARNOLD, paths: ['Planner/projects/client-preview'] },
  'client-look': { who: ARNOLD, paths: ['docs/client-look'] },
  mindmap: { who: ARNOLD, paths: ['MindMap'] },
  valena: { who: ARNOLD, paths: ['Toolbox/valena-life-szerelvenytervezo.html'] },
  'workflow-kit': { who: CHARLOTTE, root: KIT, paths: [] },
  jobs: { who: CHARLOTTE, go: 'GO TNT, after its merge', root: JOBS, paths: [] },
  inventory: { who: CHARLOTTE, paths: ['Inventory'] },
  buildtree: { who: CHARLOTTE, paths: ['Modder'] },
  'calc-panel': { who: CHARLOTTE, paths: ['Calculator/panel_anyagar_kalkulator.html'] },
  'calc-general': { who: CHARLOTTE, paths: ['Calculator/Altalanos_Villanyszerelui_Kalkulator.html'] },
  'calc-led': { who: CHARLOTTE, paths: ['Calculator/led_arkalkulator.html'] },
  licences: { who: CHARLOTTE, paths: ['vendor-manifest.json'] },
  bridge: { who: ELSIE, paths: ['BRIDGE'] },
  'media-wall': { who: ELSIE, paths: ['BRIDGE/10_media-wall'] },
  'sh-catalogue': { who: ELSIE, paths: ['BRIDGE/09_catalogue'] },
  'planner-cyd': { who: ELSIE, paths: ['Firmware/planner-cyd'], also: ['Planner/projects/varler-planner'] },
  knobpad: { who: ELSIE, paths: ['Firmware/knobpad'] },
  'board-console': { who: ELSIE, paths: ['Firmware/board-console'] },
  kapu: { who: ELSIE, go: 'GO HUB', paths: ['Hub', 'docs/hub/README.md'] },
  mobile: { who: ELSIE, go: 'GO MOBILE', paths: ['Mobile', 'docs/mobile'] },
  kodvaros: { who: ELSIE, go: 'GO CITY', paths: ['CodeCity', 'docs/city'] },
  launchers: { who: ELSIE, go: 'GO MAIN', paths: ['launcher'] },
  backups: { who: ELSIE, go: 'GO MAIN', paths: ['launcher/backup.ps1', 'launcher/test/backup-selftest.ps1'] },
  repo: { who: ELSIE, go: 'GO MAIN', paths: ['CLAUDE.md', 'GO-MAIN.md', '.gitignore'] },
  prompts: { who: ELSIE, paths: ['tools/prompts'] },
  research: { who: ELSIE, paths: ['docs/research'] },
  coreref: { who: ELSIE, paths: ['CoreRef'] },
  vendor: { who: ELSIE, paths: ['vrg-vendor.html', 'tools/fetch-vendor.js'] },
  toolbox: { who: ELSIE, paths: ['toolbox.html'] },
};

// names that no longer resolve (root CLAUDE.md, Drive layout); finding one means the brief is out of date
const DEAD = [/Planner\/START\.cmd/, /VRG-DE/, /wt-planner-stack/, /H:\\_desktop/, /Dev-VRG/, /cwebuser/, /\bsecacc\b/i, /Only in the main checkout/, /GO-R1018/];

// path-shaped names a brief may use that are not files here: branches, GitHub, gitignored or personal folders, other branches' files
const NOT_LOCAL = new Set(['docs/go-tnt', 'tools/capsule.js', 'webagoly-work/vrg-toolset', 'github.com/morluto/rea', 'Planner/apps/', 'legacy/build/pdf.mjs',
  '../_refmirror', 'OneDrive\\TNT', 'Varler\\Programok\\vscode\\data']);

const git = args => execFileSync('git', args, { cwd: REPO, encoding: 'utf8' }).trim();
const ownerLine = b => `**Felelős:** ${b.who}${b.go ? ` · **Indító:** ${b.go}` : ''}`;
const gitLines = b => b.paths.length
  ? git(['log', '-3', '--no-merges', '--date=short', '--format=- git %ad %h %s', '--', ...b.paths]).split('\n').filter(Boolean).map(l => l.slice(0, 110))
  : [];

function rewrite(id, b) {
  const file = path.join(AGENTS, id + '.md');
  const lines = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n').split('\n').filter(l => !l.startsWith('**Felelős:**') && !l.startsWith('- git '));
  lines.splice(2, 0, ownerLine(b));
  lines.splice(lines.findIndex(l => l.startsWith('## 6. ')) + 1, 0, ...gitLines(b));
  fs.writeFileSync(file, lines.join('\n'));
}

// A brief names paths relative to the repo, its own program folder, or its root outside Git.
function pathExists(p, b) {
  const clean = p.replace(/\\/g, '/').replace(/\/$/, '');
  const bases = [REPO, b.root, ...[...b.paths, ...(b.also || [])].map(q => path.join(REPO, q))].filter(Boolean);
  return bases.some(base => fs.existsSync(path.join(base, clean)));
}

function check(id, b) {
  const text = fs.readFileSync(path.join(AGENTS, id + '.md'), 'utf8').replace(/\r\n/g, '\n');
  const lines = text.split('\n'), out = [];
  if (lines[2] !== ownerLine(b)) out.push('owner line differs');
  const now = gitLines(b)[0], had = lines.find(l => l.startsWith('- git '));
  if (now && (had || '').slice(0, 25) !== now.slice(0, 25)) out.push('state stale, newest is ' + now.slice(6, 25));
  const written = lines.filter(l => !l.startsWith('- git ')).join('\n');   // old commit subjects may keep old names
  for (const rx of DEAD) if (rx.test(written)) out.push('dead name ' + rx.source);
  for (const m of text.matchAll(/`([\w.-]+(?:[/\\][\w.-]+)+[/\\]?)`/g)) {
    if (!NOT_LOCAL.has(m[1]) && !pathExists(m[1], b)) out.push('missing path ' + m[1]);
  }
  return out;
}

const docs = fs.readdirSync(AGENTS).filter(f => f.endsWith('.md') && !['README.md', 'SESSIONS.md'].includes(f)).map(f => f.slice(0, -3));
const unknown = docs.filter(id => !BRIEFS[id]), absent = Object.keys(BRIEFS).filter(id => !docs.includes(id));

if (process.argv.includes('--check')) {
  let bad = 0;
  for (const id of unknown) { bad++; console.log(`  HIBA  ${id}: not in BRIEFS`); }
  for (const id of absent) { bad++; console.log(`  HIBA  ${id}: no brief file`); }
  for (const id of docs.filter(d => BRIEFS[d])) for (const p of check(id, BRIEFS[id])) { bad++; console.log(`  HIBA  ${id}: ${p}`); }
  console.log(bad ? `\n${bad} problem(s). Run node tools/brief-state.js for stale state.` : `${docs.length} briefs current.`);
  process.exit(bad ? 1 : 0);
}
for (const id of docs.filter(d => BRIEFS[d])) rewrite(id, BRIEFS[id]);
console.log(`${docs.filter(d => BRIEFS[d]).length} briefs updated.` + (unknown.length ? ` Not in BRIEFS: ${unknown.join(', ')}` : ''));

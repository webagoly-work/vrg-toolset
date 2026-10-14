'use strict';
// Personal reading mirror for the licence-restricted documentation sources.
//
//   node CoreRef/tools/mirror-docs.js            # show what it would do
//   node CoreRef/tools/mirror-docs.js --run      # shallow clone / update
//
// These three repositories are CC-BY-NC-SA 4.0. They are mirrored for reading and
// study ONLY, into a folder outside the git repo, and are never bundled, committed or
// shipped. The client side keeps the canonical URL instead. The guard below refuses to
// write anywhere inside the repo, so the rule cannot be broken by a wrong path.
//
// Console output is ASCII only.

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const REPO = path.resolve(ROOT, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'coreref-sources.json'), 'utf8'));
const DEST = path.resolve(REPO, manifest.destinations.personal.path);
const RUN = process.argv.includes('--run');

if (DEST === REPO || DEST.startsWith(REPO + path.sep)) {
  console.error('REFUSED: the personal mirror resolves inside the repo (' + DEST + ').');
  console.error('Restricted sources must never land in version control. Fix destinations.personal.');
  process.exit(1);
}

const restricted = manifest.sources.filter((s) => s.class === 'restricted');

console.log('Personal reading mirror (NOT for shipping, NOT for the repo)');
console.log('destination : ' + DEST);
console.log('repo        : ' + REPO + '   (guard passed: destination is outside it)');
console.log('');
for (const s of restricted) {
  console.log('  ' + s.id.padEnd(14) + s.licence + '   ' + s.repo);
  console.log('  ' + ''.padEnd(14) + 'online: ' + s.canonical_base);
}
console.log('');

if (!RUN) {
  console.log('Dry run. Pass --run to shallow clone or update these into the mirror.');
  console.log('Expect a few hundred MB: the docs repos carry their images.');
  process.exit(0);
}

fs.mkdirSync(DEST, { recursive: true });
const notice = [
  'PERSONAL READING MIRROR - DO NOT SHIP, DO NOT COMMIT',
  '',
  'Every repository below is licensed CC-BY-NC-SA 4.0. It is here so it can be read',
  'and studied offline. It is not part of any product, is never bundled with a BRIDGE',
  'installation, and is never copied into the git repo. Hungarian reference text written',
  'from it is our own work and may ship; the upstream prose may not.',
  '',
].concat(restricted.map((s) => '  ' + s.id + '  ' + s.licence + '  ' + s.licence_url));
fs.writeFileSync(path.join(DEST, 'README-LICENCE.txt'), notice.join('\n') + '\n');

for (const s of restricted) {
  const dir = path.join(DEST, s.id);
  const url = 'https://github.com/' + s.repo + '.git';
  try {
    if (fs.existsSync(path.join(dir, '.git'))) {
      console.log('[' + s.id + '] updating...');
      execFileSync('git', ['-C', dir, 'pull', '--depth', '1', '--ff-only'], { stdio: 'inherit' });
    } else {
      console.log('[' + s.id + '] cloning (shallow)...');
      execFileSync('git', ['clone', '--depth', '1', url, dir], { stdio: 'inherit' });
    }
  } catch (err) {
    console.error('[' + s.id + '] FAILED: ' + (err && err.message || err));
  }
}
console.log('');
console.log('done. Read from here; link from the client.');

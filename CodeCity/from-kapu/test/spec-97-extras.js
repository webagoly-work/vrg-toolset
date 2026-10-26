'use strict';

const assert = require('assert');
const path = require('path');
const { kpLoad } = require('./load');

const GLOSS = require(path.join(__dirname, '..', 'data', 'glossary.json')).entries;
const SEED = require(path.join(__dirname, '..', 'data', 'topology.json'));
const m = kpLoad(['00-core.js', '42-md.js', '97-extras.js']);

module.exports = [
  { name: 'glossary: 25 unique ids, each with t, d, dEn; d at most 120 chars', fn() {
    assert.strictEqual(GLOSS.length, 25);
    assert.strictEqual(new Set(GLOSS.map(e => e.id)).size, 25);
    for (const e of GLOSS) {
      assert.ok(e.t && e.d && e.dEn, e.id);
      assert.ok(e.d.length <= 120, e.id + ' d is ' + e.d.length);
    }
  } },
  { name: 'Planner long text: the build entry is marked once, at its first occurrence', fn() {
    const html = m.kpGlossMark(m.kpMd(SEED.programs.find(p => p.id === 'planner').long), GLOSS);
    const build = GLOSS.find(e => e.id === 'build');
    const marks = html.split('title="' + m.kpEsc(build.d) + '"').length - 1;
    assert.strictEqual(marks, 1);
    const firstWord = html.match(/<abbr class="kp-gl" title="[^"]*">([^<]+)<\/abbr>/g).find(a => a.includes(m.kpEsc(build.d)));
    assert.ok(/>(Építés|build)</.test(firstWord), firstWord);
  } },
  { name: 'marking never touches links or tag attributes; Hungarian suffixes still match', fn() {
    const html = m.kpGlossMark('<a href="https://x.test/commit">commit</a> a commitot és a repóban', GLOSS);
    assert.ok(html.startsWith('<a href="https://x.test/commit">commit</a>'));
    assert.ok(html.includes('>commit</abbr>ot'));
    assert.ok(html.includes('>repó</abbr>ban'));
  } },
  { name: 'link refs: empty shared-folder links are reported, repo paths listed', fn() {
    const refs = m.kpLinkRefs(SEED);
    assert.ok(refs.some(r => r.kind === 'empty'));
    assert.ok(refs.some(r => r.kind === 'repo' && r.path === 'Planner/projects/varler-planner/dist/varler_planner.html'));
  } }
];

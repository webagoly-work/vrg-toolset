'use strict';
// The VRG UI Kit is inlined into Hub/src/index.html between <!-- vk:begin … --> and <!-- vk:end -->
// (shared/vrg-ui-kit/inline.js --sync-app). The page must carry exactly what the kit builds today.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const REPO = path.resolve(__dirname, '..', '..');
const INDEX = path.join(REPO, 'Hub', 'src', 'index.html');
const DIST = path.join(REPO, 'Hub', 'dist', 'vrg-kapu.html');

module.exports = [
  { name: 'kit: the inlined region matches the kit (node shared/vrg-ui-kit/inline.js --sync-app Hub/src/index.html)', fn() {
    let out = '';
    try { out = execFileSync('node', [path.join(REPO, 'shared', 'vrg-ui-kit', 'inline.js'), '--check-app', INDEX], { stdio: 'pipe' }).toString(); }
    catch (e) { assert.fail('kit region drifted: ' + String(e.stderr || e.message).trim()); }
    void out;
  } },
  { name: 'kit: the built page carries the kit, its sprite and fonts, and loads nothing from the network', fn() {
    const html = fs.readFileSync(DIST, 'utf8');
    assert.ok(/<!-- vk:begin [^>]*palette[^>]*-->/.test(html), 'kit marker with its component list');
    assert.ok(html.includes('data-vk-sprite'), 'icon sprite');
    assert.ok(html.includes('data:font/woff2;base64,'), 'fonts inlined (decision 6B)');
    assert.ok(!/<(script|link|img)\b[^>]*\s(src|href)=["']https?:/i.test(html), 'no external script, stylesheet or image');
  } }
];

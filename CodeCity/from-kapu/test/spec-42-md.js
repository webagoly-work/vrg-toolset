'use strict';

const assert = require('assert');
const { kpLoad } = require('./load');

const { kpMd } = kpLoad(['00-core.js', '42-md.js']);

module.exports = [
  { name: 'escapes HTML, keeps bold', fn() {
    assert.strictEqual(kpMd('**a** <b>x</b>'), '<strong>a</strong> &lt;b&gt;x&lt;/b&gt;');
  } },
  { name: 'code, italics, links (http only)', fn() {
    assert.strictEqual(kpMd('`src/` és *dőlt*'), '<code>src/</code> és <em>dőlt</em>');
    assert.strictEqual(kpMd('[GitHub](https://github.com)'), '<a href="https://github.com" target="_blank" rel="noopener">GitHub</a>');
    assert.ok(!kpMd('[x](javascript:alert(1))').includes('<a'));
  } },
  { name: 'blocks: heading, list, paragraphs', fn() {
    assert.strictEqual(kpMd('# Cím\n\n- egy\n- kettő\n\nszöveg'), '<h3>Cím</h3><ul><li>egy</li><li>kettő</li></ul><p>szöveg</p>');
  } },
  { name: 'code keeps its content literal', fn() {
    assert.strictEqual(kpMd('`**nem félkövér**`'), '<code>**nem félkövér**</code>');
  } }
];

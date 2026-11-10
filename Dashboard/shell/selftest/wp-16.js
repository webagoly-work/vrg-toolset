// WP-16 probe (real Electron, real node-pty): with VRG_CLAUDE_BIN = test/fixtures/fake-claude.js, the meta of `go:HUB` from the real
// acts.lookup() goes through lib/claudeterm.js into a real pty, and the output holds `FAKE_CLAUDE GO HUB`; the frame gets the
// layout.open event. This probe builds its own pty manager: main.js (not part of this WP) does not hand claudeterm to createActs yet.
'use strict';
const path = require('path');
module.exports = async function probe({ win, C, lookup }) {
  const errors = [];
  const ptyLib = require('../lib/pty.js');
  const { createClaudeTerm, withBinOverride } = require('../lib/claudeterm.js');
  const bin = path.join(__dirname, '..', '..', 'test', 'fixtures', 'fake-claude.js');
  const env = { ...process.env, VRG_CLAUDE_BIN: bin };
  let mgr = null;
  try {
    const hit = lookup('go:HUB');
    if (!hit || !hit.claude || hit.claude.prompt !== 'GO HUB') { errors.push('lookup(go:HUB) has no claude meta with the prompt GO HUB'); return { ok: false, errors }; }
    const full = process.env.VRG_FULL || 'H:\\VRG\\Full';
    const expand = s => C.expand(s);
    mgr = ptyLib.createPty({
      profiles: withBinOverride(ptyLib.readProfiles(path.join(__dirname, '..', '..', 'config', 'profiles.json')), env, expand),
      expand, env,
      spawn: ptyLib.nodePtySpawn(ptyLib.loadNodePty(path.join(full, 'tools', 'js-libs', 'node-pty'))),
    });
    let out = '';
    mgr.on('data', m => { out += m.data; });
    const events = [];
    const ct = createClaudeTerm({ pty: mgr, emit: (ns, type, d) => events.push({ ns, type, d }), env, expand });
    const r = ct.open({ account: 'B', cwd: hit.claude.cwd, firstPrompt: hit.claude.prompt });
    if (!r.term) errors.push('claudeterm.open failed: ' + JSON.stringify(r));
    else {
      const end = Date.now() + 10000;
      while (Date.now() < end && !/FAKE_CLAUDE GO HUB/.test(out)) await new Promise(res => setTimeout(res, 100));
      if (!/FAKE_CLAUDE GO HUB/.test(out)) errors.push('output has no "FAKE_CLAUDE GO HUB": ' + JSON.stringify(out.slice(0, 200)));
      if (!/CLAUDE_CONFIG_DIR=\S*claude-account-b/.test(out)) errors.push('account B did not set CLAUDE_CONFIG_DIR');
      if (events.length !== 1 || events[0].d.kind !== 'term' || events[0].d.term !== r.term) errors.push('no layout.open event for the term');
    }
    const has = await win.desk.frame.webContents.executeJavaScript('typeof window.VRGFrame === "object"');
    if (!has) errors.push('the frame page has no VRGFrame');
  } catch (e) { errors.push('probe error: ' + e.message); }
  finally { if (mgr) mgr.killAll(); }
  return { ok: !errors.length, errors };
};

// WP-22 probe (real Electron, real node-pty, real stack — skipped when the stack is absent): E:dashboard grown on layers F,L gives >= 3 nodes,
// the pack stays within the budget, and "send to term-A" with VRG_CLAUDE_BIN = fake-claude puts `Read the context pack at` into the term buffer.
// Own pty manager and a temp VRG_DESK_HOME (CONTRACT §4.9); the IPC door is checked for refusals only.
'use strict';
const fs = require('fs'), os = require('os'), path = require('path');

module.exports = async function probe({ win }) {
  const errors = [], notes = [];
  const full = process.env.VRG_FULL || 'H:\\VRG\\Full';
  const stackDir = path.join(full, 'notes', 'stack');
  const oldHome = process.env.VRG_DESK_HOME;
  let mgr = null, home = '';
  try {
    // the IPC door: refusals only, no side effect
    const wc = win.desk.frame.webContents;
    const bad = await wc.executeJavaScript(`window.vrg.ctx.expand(['not an id'], 'F', 1)`, true);
    if (!bad || bad.ok !== false) errors.push('expand with a bad id must be refused: ' + JSON.stringify(bad).slice(0, 200));
    const unknown = await wc.executeJavaScript(`window.vrg.ctx.sendToClaude('pnone', 'term-A')`, true);
    if (!unknown || unknown.ok !== false) errors.push('sendToClaude with an unknown packId must be refused: ' + JSON.stringify(unknown).slice(0, 200));

    if (!fs.existsSync(path.join(stackDir, 'out', 'stack.json'))) { notes.push('stack absent: real-stack part skipped'); return { ok: !errors.length, errors, notes }; }

    fs.mkdirSync(path.join(os.tmpdir(), 'VRG'), { recursive: true });
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'VRG', 'desk-test-'));
    process.env.VRG_DESK_HOME = home;
    const paths = require('../lib/paths.js');
    const ptyLib = require('../lib/pty.js');
    const { createClaudeTerm, withBinOverride } = require('../lib/claudeterm.js');
    const { createCtx } = require('../lib/ctx.js');
    const bin = path.join(__dirname, '..', '..', 'test', 'fixtures', 'fake-claude.js');
    const env = { ...process.env, VRG_CLAUDE_BIN: bin };
    const nodeExe = path.join(full, 'tools', 'node', 'node.exe');
    const node = fs.existsSync(nodeExe) ? nodeExe : 'node';
    const expand = s => String(s).replace('{node}', node);
    mgr = ptyLib.createPty({
      profiles: withBinOverride(ptyLib.readProfiles(path.join(__dirname, '..', '..', 'config', 'profiles.json')), env, expand),
      expand, env,
      spawn: ptyLib.nodePtySpawn(ptyLib.loadNodePty(path.join(full, 'tools', 'js-libs', 'node-pty'))),
    });
    let out = '';
    mgr.on('data', m => { out += m.data; });
    const ct = createClaudeTerm({ pty: mgr, emit: () => {}, env, expand });
    const ctx = createCtx({ execFile: require('child_process').execFile, node, stackDir, paths, claudeterm: ct, repo: path.resolve(__dirname, '..', '..', '..') });

    const ex = await ctx.expand(['E:dashboard'], 'FL', 1);
    if (!ex.ok) errors.push('expand: ' + JSON.stringify(ex).slice(0, 300));
    else {
      if (ex.nodes.length < 3) errors.push('expand E:dashboard on F,L gave ' + ex.nodes.length + ' nodes, wanted >= 3');
      const budget = 4000;
      const pk = await ctx.pack(ex.nodes.map(n => n.id).slice(0, 40), { budget });
      if (!pk.ok) errors.push('pack: ' + JSON.stringify(pk).slice(0, 300));
      else {
        if (pk.tokens > budget) errors.push('pack ' + pk.tokens + ' tokens > budget ' + budget);
        if (!fs.readdirSync(paths.packs()).some(n => /^\d{8}-\d{6}-.*\.md$/.test(n))) errors.push('no pack file under packs\\');
        const s = ctx.sendToClaude(pk.packId, 'term-A');
        if (!s.ok) errors.push('sendToClaude: ' + JSON.stringify(s));
        else {
          const end = Date.now() + 10000;
          while (Date.now() < end && !/Read the context pack at/.test(out)) await new Promise(res => setTimeout(res, 100));
          if (!/Read the context pack at/.test(out)) errors.push('term buffer has no "Read the context pack at": ' + JSON.stringify(out.slice(0, 200)));
          notes.push('nodes: ' + ex.nodes.length + ', pack tokens: ' + pk.tokens);
        }
      }
    }
  } catch (e) { errors.push('probe error: ' + e.stack); }
  finally {
    if (mgr) mgr.killAll();
    if (oldHome === undefined) delete process.env.VRG_DESK_HOME; else process.env.VRG_DESK_HOME = oldHome;
    if (home) { try { fs.rmSync(home, { recursive: true, force: true }); } catch (e) {} }
  }
  return { ok: !errors.length, errors, notes };
};

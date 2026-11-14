// srvhost.js — registry servers run inside the VRG Asztal (WP-48): no console window. Each server is a hidden pty session owned by
// main (the pty manager of WP-14, hidden profiles srv-node / srv-cmd). Its output is kept (the last `cap` characters), so a console
// pane can open at any time and show what happened before it; closing that pane leaves the server running. Quitting the shell stops
// the servers it started (the pty manager's killAll on before-quit).
//   const sh = createServerHost({ pty: () => ptyManager, emit, log, cap });
//   sh.plan(s, extra, { expand, exists, repo }) → { prof, args, cwd } | { err }       how a registry server entry starts (pure)
//   sh.start(s, plan) → { ok:true, term, already? } | { ok:false, hu }
//   sh.console(id) → { ok:true, term } and emit('layout','open',{ kind:'term', term, prof:'srv', server, title, replay }) | { ok:false, hu, replay? }
//   sh.stop(id) → { ok } · sh.list() → [{ id, name, port, running, since, code }] · sh.output(id) → the kept text
'use strict';
const path = require('path');

function createServerHost({ pty, emit = () => {}, log = () => {}, cap = 65536 }) {
  const byId = new Map();                                       // server id → { id, name, port, term, buf, running, since, code }
  const byTerm = new Map();                                     // term id → server id
  let hooked = null;

  function hook() {
    const p = pty();
    if (hooked === p) return p;
    hooked = p;
    p.on('data', m => { const id = byTerm.get(m.term); const r = id && byId.get(id); if (r) r.buf = (r.buf + m.data).slice(-cap); });
    p.on('exit', m => {
      const id = byTerm.get(m.term); byTerm.delete(m.term);
      const r = id && byId.get(id);
      if (r && r.term === m.term) { r.running = false; r.code = m.code; r.term = null; log('server exit', id, m.code); }
    });
    return p;
  }

  // a registry server entry ({ id, port, js, args, cwd } or { bat }) as a pty start; `extra` = the act's serverArgs
  function plan(s, extra, { expand, exists, repo }) {
    const cwd = s.cwd ? expand(s.cwd) : repo;
    if (s.bat) {
      const f = expand(s.bat);
      if (!exists(f)) return { err: 'missing', path: f };
      return { prof: 'srv-cmd', args: ['/d', '/c', f], cwd: path.dirname(f) };
    }
    const js = expand(s.js);
    if (!exists(js)) return { err: 'missing', path: js };
    return { prof: 'srv-node', args: [js, ...(s.args || []).map(expand), ...(extra || []).map(expand)], cwd };
  }

  function start(s, how) {
    const p = hook();
    const cur = byId.get(s.id);
    if (cur && cur.running) return { ok: true, term: cur.term, already: true };
    const r = p.open(how.prof, how.cwd, { args: how.args });
    if (!r || !r.term) { log('server refused', s.id, r && r.err); return { ok: false, hu: (r && r.hu) || 'A szerver nem indult el.' }; }
    byId.set(s.id, { id: s.id, name: s.name || s.id, port: s.port, term: r.term, buf: '', running: true, since: Date.now(), code: null });
    byTerm.set(r.term, s.id);
    log('server start', s.id, r.term);
    return { ok: true, term: r.term };
  }

  function consoleFor(id) {
    const r = byId.get(id);
    if (!r) return { ok: false, err: 'not-found', hu: 'Ez a szerver nem az Asztalból indult, a kimenete itt nem látszik.' };
    if (!r.running) return { ok: false, err: 'stopped', hu: 'A szerver leállt (kód: ' + r.code + ').', replay: r.buf };
    emit('layout', 'open', { kind: 'term', term: r.term, prof: 'srv', server: id, title: r.name + ' :' + r.port, replay: r.buf });
    return { ok: true, term: r.term };
  }

  function stop(id) {
    const r = byId.get(id);
    if (!r || !r.running) return { ok: false, err: 'not-found', hu: 'Nem fut.' };
    return { ok: !!pty().kill(r.term) };
  }

  const list = () => [...byId.values()].map(r => ({ id: r.id, name: r.name, port: r.port, running: r.running, since: r.since, code: r.code }));
  const output = id => (byId.get(id) || {}).buf || '';
  const owns = term => byTerm.has(term);

  return { plan, start, console: consoleFor, stop, list, output, owns };
}

module.exports = { createServerHost };

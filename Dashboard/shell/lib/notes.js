// notes.js — dev notes (WP-25): the one store is the Divergence outbox; tools/divergence.js `jot` writes it, Divergence's Push carries it.
//   createNotes({ execFile, node, repo, dir? }) → { topics(), save(n) }
//   topics()  → { topics: [id] }  the kinds' topics in Divergence/config.json plus the topics seen in data/outbox.jsonl, unique
//   save(n)   → { ok, where:'outbox' } | { ok:false, err, hu }   n = { topic, title, text, source?:{ kind, ref } }
// The page sends words only; the script path, the node binary and the arguments are main's. The text goes on stdin, never into the command line.
'use strict';
const fs = require('fs'), path = require('path');

const TOPIC_RE = /^[a-z0-9-]{1,40}$/;
const SOURCE_KINDS = ['url', 'file', 'node', 'term', 'chat'];
const bad = hu => ({ ok: false, err: 'bad-request', hu });

function createNotes({ execFile, node, repo, dir }) {
  const divDir = () => dir || process.env.VRG_DIVERGENCE_DIR || path.join(repo, 'Divergence');
  const readJson = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } };

  function topics() {
    const seen = new Set();
    const cfg = readJson(path.join(divDir(), 'config.json'));
    for (const k of Object.values((cfg && cfg.kinds) || {})) if (k && TOPIC_RE.test(String(k.topic))) seen.add(k.topic);
    try {
      for (const l of fs.readFileSync(path.join(divDir(), 'data', 'outbox.jsonl'), 'utf8').split('\n')) {
        if (!l) continue;
        try { const t = JSON.parse(l).topic; if (typeof t === 'string' && TOPIC_RE.test(t)) seen.add(t); } catch (e) {}
      }
    } catch (e) {}
    return { topics: [...seen] };
  }

  function save(n) {
    n = n && typeof n === 'object' ? n : {};
    const topic = String(n.topic == null ? '' : n.topic), title = String(n.title == null ? '' : n.title).trim(), text = String(n.text == null ? '' : n.text);
    if (!TOPIC_RE.test(topic)) return bad('Érvénytelen téma.');
    if (!text.trim()) return bad('A jegyzet szövege üres.');
    const args = [path.join(repo, 'tools', 'divergence.js'), 'jot', '--topic', topic, '--title', title.slice(0, 120) || 'Jegyzet'];
    const s = n.source;
    if (s && SOURCE_KINDS.includes(s.kind)) args.push('--source', (s.kind + ':' + String(s.ref == null ? '' : s.ref)).slice(0, 500));
    return new Promise(resolve => {
      const env = dir ? { ...process.env, VRG_DIVERGENCE_DIR: dir } : process.env;
      const child = execFile(node, args, { cwd: repo, env, windowsHide: true, timeout: 20000 }, (err, stdout, stderr) => {
        if (err) return resolve({ ok: false, err: 'error', hu: 'A jegyzet nem mentődött: ' + String(stderr || err.message || '').trim().split('\n')[0].slice(0, 200) });
        resolve({ ok: true, where: 'outbox' });
      });
      if (child && child.stdin) { child.stdin.on('error', () => {}); child.stdin.end(text.slice(0, 65536)); }
    });
  }

  return { topics, save };
}

module.exports = { createNotes, TOPIC_RE, SOURCE_KINDS };

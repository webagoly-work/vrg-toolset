// watch.js — Figyelés (T6): the VRG Böngésző adds and removes page watches in the VRG Asztal's own feed registry,
// <userDir>/presets.json (Dashboard/shell/lib/presets.js reads it on every run and never writes it). A watch is a preset of
// kind `page-watch`: the Asztal fetches the page on its timer, compares its readable text with the last run, shows the change
// in the Hírek pane and rings the phone through the relay. Its host goes into the file's allowHosts (the preset rule: network
// kinds reach allowed hosts only) — the user's own action is the consent; a host the browser added leaves with its last watch.
//   const w = createWatch({ dir, check }); w.list() · w.add({ url, hu, every }) · w.remove(id)
// dir = <userDir>; check = lib/netguard.js check (public http(s) addresses only). Results come from <userDir>/cache/presets.json.
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MIN_EVERY = 60, MAX_EVERY = 7 * 24 * 60, DEFAULT_EVERY = 360, MAX_WATCHES = 100;
const clean = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, n);

function createWatch(o) {
  const dir = o.dir;
  const file = () => path.join(dir, 'presets.json');
  const cacheFile = () => path.join(dir, 'cache', 'presets.json');
  const read = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } };
  function doc() {
    const j = read(file());
    if (Array.isArray(j)) return { allowHosts: [], presets: j };                 // the registry's older array shape
    return Object.assign({ allowHosts: [], presets: [] }, j && typeof j === 'object' ? j : {});
  }
  function save(d) {
    fs.mkdirSync(dir, { recursive: true });
    const t = file() + '.tmp';
    fs.writeFileSync(t, JSON.stringify(d, null, 1) + '\n');
    fs.renameSync(t, file());
  }
  const available = () => !!dir && fs.existsSync(dir);

  function list() {
    if (!available()) return { ok: false, code: 'no-desk', hu: 'Ezen a gépen nincs VRG Asztal adatmappa: a figyelést az Asztal futtatja.' };
    const cache = read(cacheFile()) || {};
    const watches = (doc().presets || []).filter(p => p && p.kind === 'page-watch').map(p => {
      const r = cache[p.id];
      const it = r && r.items && r.items[0];
      return { id: p.id, hu: clean(p.hu, 120), url: p.url, every: p.every || DEFAULT_EVERY, enabled: p.enabled !== false,
        last: r ? { at: r.at || 0, hu: it ? clean(it.hu, 300) : '', detail: it ? clean(it.detail, 600) : '', error: r.error ? clean(r.error, 200) : '', changedAt: (r.state && r.state.changedAt) || 0 } : null };
    });
    return { ok: true, watches };
  }

  function add(w) {
    if (!available()) return list();
    const url = String((w && w.url) || '');
    const c = o.check ? o.check(url) : { ok: /^https?:\/\//.test(url) };
    if (!c.ok) return { ok: false, code: c.code || 'bad-url', hu: c.hu || 'Csak nyilvános http(s) oldal figyelhető.' };
    const u = new URL(url);
    const d = doc();
    const id = 'watch-' + crypto.createHash('sha1').update(u.href).digest('hex').slice(0, 10);
    const every = Math.min(MAX_EVERY, Math.max(MIN_EVERY, Math.floor(Number(w.every) || DEFAULT_EVERY)));
    const entry = { id, hu: clean(w.hu, 120) || u.hostname, kind: 'page-watch', url: u.href, every };
    const others = (d.presets || []).filter(p => !(p && p.id === id));
    if (others.filter(p => p && p.kind === 'page-watch').length >= MAX_WATCHES) return { ok: false, code: 'limit', hu: 'Legfeljebb ' + MAX_WATCHES + ' oldal figyelhető.' };
    d.presets = others.concat(entry);
    const host = u.hostname.toLowerCase();
    if (!(d.allowHosts || []).includes(host)) {                      // a host the browser allows is marked as its own
      d.allowHosts = (d.allowHosts || []).concat(host);
      d['x-bongeszo-hosts'] = [...new Set((d['x-bongeszo-hosts'] || []).concat(host))];
    }
    save(d);
    return Object.assign(list(), { added: id, hu: 'Figyelés: ' + entry.hu + ' (' + Math.round(every / 60) + ' óránként). Az Asztal futtatja, a változást a Hírekben és a telefonon jelzi.' });
  }

  function remove(id) {
    if (!available()) return list();
    const d = doc();
    const p = (d.presets || []).find(x => x && x.id === id && x.kind === 'page-watch');
    if (!p) return { ok: false, code: 'not-found', hu: 'Nincs ilyen figyelés.' };
    d.presets = d.presets.filter(x => x !== p);
    const host = new URL(p.url).hostname.toLowerCase();
    const mine = d['x-bongeszo-hosts'] || [];
    const used = d.presets.some(x => x && x.url && (() => { try { return new URL(x.url).hostname.toLowerCase() === host; } catch (e) { return false; } })());
    if (mine.includes(host) && !used) { d.allowHosts = (d.allowHosts || []).filter(h => h !== host); d['x-bongeszo-hosts'] = mine.filter(h => h !== host); }
    save(d);
    return Object.assign(list(), { removed: id });
  }

  return { list, add, remove, available };
}

module.exports = { createWatch, MIN_EVERY, MAX_EVERY, DEFAULT_EVERY };

// HungaroMet radar composite images (odp.met.hu) for the VRG Térkép radar loop — OFF by default
// (sources.json enabled: false): the research could not open the folder, so its file names and the image's
// geographic box are config (`fileRe`, `bounds`), confirmed with `doctor --live` before switching it on.
//
// The folder listing is read, the newest `keep` frames that match `fileRe` (whose first capture group is the time,
// YYYYMMDDhhmm UTC) are downloaded to data/radar/<source>/ and listed in radar_frame with their box. Older frames
// and their files are removed. The page cross-fades them in time order.
'use strict';
const fs = require('fs');
const path = require('path');
const HTTP = require('../http');
const { DATA } = require('../common');
const { iso } = require('../db');

const stamp = s => { const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(s); return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}Z` : null; };

module.exports = {
  scope: 'grid',
  ext: 'png',
  listFrames(html, src) {
    const re = new RegExp(src.fileRe, 'i'), out = new Map();
    for (const m of html.matchAll(/href="([^"]+)"/gi)) {
      const name = m[1].split('/').pop(), x = re.exec(name);
      if (x && stamp(x[1])) out.set(name, stamp(x[1]));
    }
    return [...out].map(([name, at]) => ({ name, at })).sort((a, b) => (a.at < b.at ? -1 : 1));
  },
  async run(ctx, src, opts = {}) {
    const dir = path.join(DATA, 'radar', src.id);
    fs.mkdirSync(dir, { recursive: true });
    const l = await HTTP.get(ctx, { source: src, place: 'list', url: src.url, ext: 'html', force: true });
    if (!l.ok) return [{ source: src.id, place: 'radar', status: l.cached ? 'cached' : 'error', error: l.error }];
    const frames = module.exports.listFrames(l.body.toString('utf8'), src).slice(-(src.keep || 12));
    if (!frames.length) return [{ source: src.id, place: 'radar', status: 'parse', error: 'nincs ' + src.fileRe + ' a listában' }];
    const [w, s, e, n] = src.bounds;
    let added = 0;
    for (const f of frames) {
      if (ctx.db.get('SELECT 1 FROM radar_frame WHERE source_id = ? AND at = ?', src.id, f.at)) continue;
      const r = await HTTP.get(ctx, { source: src, place: f.name, url: new URL(f.name, src.url).toString(), ext: 'png', force: true });
      if (!r.ok || r.body[0] !== 0x89 || r.body[1] !== 0x50) continue;   // PNG only
      fs.writeFileSync(path.join(dir, f.name), r.body);
      ctx.db.run('INSERT OR REPLACE INTO radar_frame (source_id, at, file, west, south, east, north) VALUES (?, ?, ?, ?, ?, ?, ?)', src.id, f.at, f.name, w, s, e, n);
      added++;
    }
    // keep only the newest `keep` frames
    const keepFrom = frames[0].at;
    for (const old of ctx.db.all('SELECT file FROM radar_frame WHERE source_id = ? AND at < ?', src.id, keepFrom)) { try { fs.unlinkSync(path.join(dir, old.file)); } catch {} }
    ctx.db.run('DELETE FROM radar_frame WHERE source_id = ? AND at < ?', src.id, keepFrom);
    return [{ source: src.id, place: 'radar', status: 'ok', rows: added, newest: iso(frames[frames.length - 1].at) }];
  },
};

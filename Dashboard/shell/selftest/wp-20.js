// WP-20 probe (real Electron): vrg.search.inner({q:'Kapu'}) through the IPC door gives >= 1 stack hit (E:kapu or F:f8); the code part may be no-index
// (allowed, reported). Bad input is refused, and openHit with nothing searched is not-found. Nothing here starts a server or opens a window.
'use strict';

module.exports = async function probe({ win }) {
  const errors = [], notes = [];
  const { frame } = win.desk;
  try {
    const wc = frame.webContents;
    const r = await wc.executeJavaScript(`window.vrg.search.inner('Kapu')`, true);
    if (!r || r.ok === false || !Array.isArray(r.stack) || !Array.isArray(r.code)) errors.push('inner answer: ' + JSON.stringify(r).slice(0, 300));
    else {
      const ids = r.stack.map(h => h.id);
      if (!ids.includes('E:kapu') && !ids.includes('F:f8')) errors.push('no E:kapu / F:f8 in the stack hits: ' + JSON.stringify(ids));
      if (r.codeErr) notes.push('code part: ' + r.codeErr);
      else notes.push('code hits: ' + r.code.length);
    }
    const lay = await wc.executeJavaScript(`window.vrg.search.inner('Kapu', { layers: 'EF' })`, true);
    if (!lay || lay.ok === false || !lay.stack.every(h => h.layer === 'E' || h.layer === 'F')) errors.push('layer filter: ' + JSON.stringify(lay).slice(0, 300));
    const bad = await wc.executeJavaScript(`window.vrg.search.inner('Kapu', { layers: 'Z' })`, true);
    if (!bad || bad.ok !== false) errors.push('layers "Z" must be refused: ' + JSON.stringify(bad).slice(0, 200));
    const long = await wc.executeJavaScript(`window.vrg.search.inner('x'.repeat(301))`, true);
    if (!long || long.ok !== false || long.err !== 'bad-request') errors.push('a 301-char query must be bad-request: ' + JSON.stringify(long).slice(0, 200));
    const hit = await wc.executeJavaScript(`window.vrg.search.openHit('code', 199)`, true);
    if (!hit || hit.ok !== false) errors.push('openHit beyond the last reply must fail: ' + JSON.stringify(hit).slice(0, 200));
    const evil = await wc.executeJavaScript(`window.vrg.search.node('--all')`, true);
    if (!evil || evil.ok !== false) errors.push('node("--all") must be refused: ' + JSON.stringify(evil).slice(0, 200));
    const card = await wc.executeJavaScript(`window.vrg.search.node('E:kapu')`, true);
    if (!card || card.ok === false || !/E:kapu/.test(card.text || '')) errors.push('node card: ' + JSON.stringify(card).slice(0, 200));
  } catch (e) { errors.push('probe error: ' + e.stack); }
  return { ok: !errors.length, errors, notes };
};

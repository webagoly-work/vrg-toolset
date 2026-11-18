// MeteoAlarm — the Hungarian CAP warnings (issued by HungaroMet), https://feeds.meteoalarm.org
// Two shapes are read:
//   JSON  /api/v1/warnings/feeds-hungary   { warnings: [ { alert: { identifier, sent, msgType, info: [ { language,
//         event, headline, description, onset, expires, severity, certainty, urgency,
//         parameter: [{ valueName: 'awareness_level', value: '2; yellow; Moderate' }, { valueName: 'awareness_type', value: '1; Wind' }],
//         area: [{ areaDesc, geocode: [{ valueName: 'EMMA_ID', value }] }] } ] } } ] }
//   Atom  /feeds/meteoalarm-legacy-atom-hungary   <entry> with cap:areaDesc, cap:event, cap:onset, cap:expires,
//         cap:severity, cap:certainty, cap:urgency, cap:awareness_level, cap:awareness_type, cap:identifier
// One CAP alert can name several areas: one row per area, id = identifier#n.
'use strict';
const { iso } = require('../db');

const TYPE_HU = { 1: 'szél', 2: 'hó, ónos eső', 3: 'zivatar', 4: 'köd', 5: 'hőség', 6: 'hideg', 7: 'part menti esemény', 8: 'erdőtűz', 9: 'lavina', 10: 'eső', 12: 'árvíz', 13: 'eső-árvíz' };
const LEVEL_HU = { 1: 'zöld', 2: 'sárga', 3: 'narancs', 4: 'piros' };

const levelOf = s => { const m = /^(\d)/.exec(String(s || '')); return m ? +m[1] : null; };
const typeOf = s => { const m = /^(\d+)\s*;\s*(.*)$/.exec(String(s || '')); return m ? { n: +m[1], en: m[2].trim() } : null; };

function fromJson(j, src) {
  const out = [];
  for (const w of j.warnings || []) {
    const a = w.alert || w;
    if (a.msgType === 'Cancel') continue;
    const infos = a.info || [];
    const info = infos.find(i => /^hu/i.test(i.language || '')) || infos.find(i => /^en/i.test(i.language || '')) || infos[0];
    if (!info) continue;
    const param = n => ((info.parameter || []).find(p => p.valueName === n) || {}).value;
    const t = typeOf(param('awareness_type'));
    (info.area || []).forEach((ar, k) => {
      const geo = (ar.geocode || []).find(g => g.valueName === 'EMMA_ID') || (ar.geocode || [])[0] || {};
      out.push({
        id: `${a.identifier}#${k}`, source: src.id, area: ar.areaDesc, areaCode: geo.value || null,
        event: info.event, type: t ? (TYPE_HU[t.n] || t.en) : null, level: levelOf(param('awareness_level')),
        severity: info.severity, certainty: info.certainty, urgency: info.urgency,
        onset: iso(info.onset || info.effective || a.sent), expires: iso(info.expires), sent: iso(a.sent),
        headline: info.headline || null, description: info.description || null, lang: info.language || null,
      });
    });
  }
  return out;
}

function fromAtom(xml, src) {
  const out = [];
  const g = (s, n) => { const m = new RegExp(`<${n}[^>]*>([\\s\\S]*?)</${n}>`).exec(s); return m ? m[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : null; };
  let k = 0;
  for (const m of xml.matchAll(/<entry[\s>][\s\S]*?<\/entry>/g)) {
    const e = m[0];
    if (/Cancel/i.test(g(e, 'cap:message_type') || '')) continue;
    const t = typeOf(g(e, 'cap:awareness_type'));
    const id = g(e, 'cap:identifier') || g(e, 'id') || 'atom-' + (k++);
    out.push({
      id: id + '#0', source: src.id, area: g(e, 'cap:areaDesc'), areaCode: g(e, 'value'),
      event: g(e, 'cap:event'), type: t ? (TYPE_HU[t.n] || t.en) : null, level: levelOf(g(e, 'cap:awareness_level')),
      severity: g(e, 'cap:severity'), certainty: g(e, 'cap:certainty'), urgency: g(e, 'cap:urgency'),
      onset: iso(g(e, 'cap:onset') || g(e, 'cap:effective')), expires: iso(g(e, 'cap:expires')), sent: iso(g(e, 'cap:sent') || g(e, 'updated')),
      headline: g(e, 'title'), description: null, lang: null,
    });
  }
  return out;
}

module.exports = {
  scope: 'global',
  ext: 'json',
  LEVEL_HU,
  url: src => src.url,
  parse(buf, src) {
    const s = buf.toString('utf8').trim();
    const warnings = (s[0] === '<' ? fromAtom(s, src) : fromJson(JSON.parse(s), src)).filter(w => w.onset && w.expires && w.area);
    return { warnings };
  },
};

// pack.js — the approval items of a baseline run as a BRIDGE Tuner question pack (BRIDGE/_tuner/bridge-tuner.html)
// Format: {pack, title, rev, date, sections:[{id, title, note, questions:[{id, q, why, rec, opts:[{k, t, d}]}]}]}.
// Tuner ids allow no dash. Answers come back as "ID=key ~ note" lines — paste them back to the engine's author.
'use strict';
const fs = require('fs'), geom = require('./geom');

function build(ctx) {
  const { R, E } = ctx, S = [];
  const nm = id => { const e = E.find(x => x.id === id); return e ? (e.ref || e.id) : id; };
  const sws = E.filter(e => e.role === 'sys:MAINS' && e.code === 'SWI' && e.v !== 'shu');
  const ID = (p, n) => p + String(n).padStart(2, '0');

  // ---- L: lamps → switches (only the inferred ones) ----
  const L = []; let n = 0;
  const k13pre = sws.find(s => s.ref === 'K13'), k3pre = sws.find(s => s.ref === 'K3');
  R.L.units.forEach(u => { const why = [...new Set(u.lamps.map(l => R.L.why[l]))];
    if (why.every(w => /ctl a vázlatból/.test(w))) return;
    if (k13pre && k3pre && u.switches.includes(k13pre.id)) return;                 // asked as the two-way question below
    const lamps = u.lamps.map(id => E.find(e => e.id === id)).filter(Boolean), cx = lamps.reduce((a, e) => a + e.x, 0) / lamps.length, cy = lamps.reduce((a, e) => a + e.y, 0) / lamps.length;
    const lr = lamps[0].room, near = new Set([lr, lr === 'R03' ? 'R03L' : lr === 'R03L' ? 'R03' : lr]);
    ctx.G.D.openings.filter(o => o.type === 'door').forEach(o => { const rs = geom.roomsAround(ctx.G, o.x, o.y); if (rs.includes(lr)) rs.forEach(r => near.add(r)); });
    const alt = sws.filter(s => !u.switches.includes(s.id) && !s.ctx.bed && near.has(s.room))
      .sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy)).slice(0, 2);
    const opts = [{ k: 'A', t: `${u.switches.map(nm).join(' + ')}${u.switches.length > 1 ? ' (váltó)' : ''}`, d: 'Ahogy a motor javasolja.' }];
    alt.forEach((s, k) => opts.push({ k: String.fromCharCode(66 + k), t: `${nm(s.id)} kapcsolja`, d: `${s.room}, ${s.portal ? 'portál ' + s.portal : 'fali'} — ${Math.round(s.h)} mm` }));
    opts.push({ k: 'X', t: 'Másképp', d: 'A megjegyzésbe írd: melyik kapcsoló, váltó-e.' });
    L.push({ id: ID('L', ++n), q: `${lamps.map(e => e.ref || e.id).join(', ')} (${lamps[0].room}) — melyik kapcsoló?`, why: why.join('; '), rec: 'A', opts }); });
  // two-way and leftovers
  const k13 = sws.find(s => s.ref === 'K13'), k3 = sws.find(s => s.ref === 'K3');
  if (k13 && k3) L.push({ id: ID('L', ++n), q: 'Nappali: a K13 (B103 mellett) csak az L26-ot kapcsolja, vagy váltó a K3-mal?', why: 'A nappalinak két ajtaja van (B103, B171). Most K3 kapcsolja az L1–L3, L15, L16 csoportot, K13 egyedül az L26-ot.',
    rec: 'A', opts: [{ k: 'A', t: 'K13 → L26 marad', d: 'Két külön kapcsolás.' }, { k: 'B', t: 'K3 + K13 váltó az L1–L3 + L26 mennyezeti csoportra', d: 'Mindkét ajtónál felkapcsolható a fő fény; az L15/L16 fali lámpák K3-on maradnak.' },
      { k: 'C', t: 'K3 + K13 váltó minden nappali lámpára', d: 'Egy csoport, két helyről.' }] });
  R.warn.filter(w => /kapcsolóhoz nem tartozik lámpa/.test(w.msg)).forEach(w => { const ref = (w.msg.match(/ (K\d+) /) || [])[1] || '?';
    L.push({ id: ID('L', ++n), q: `${ref}: a rajzon nincs hozzá lámpa. Mi legyen vele?`, why: w.msg, rec: 'A',
      opts: [{ k: 'A', t: 'Új mennyezeti lámpa a helyiségben', d: 'A kapcsoló mögötti helyiség (pl. kamra) kap egy lámpát; a motor beköti.' },
        { k: 'B', t: 'Váltó egy közeli lámpacsoporttal', d: 'Pl. a lépcső lámpája (L23) két helyről.' }, { k: 'C', t: 'Törlés', d: 'A kapcsoló nem kell.' }] }); });
  if (L.length) S.push({ id: 'L', title: 'Lámpák és kapcsolók', note: 'A motor következtetése ott, ahol a vázlatban nem volt ctl. A ctl-lel megadott párok (K1, K2, K3) nem szerepelnek itt.', questions: L });

  // ---- C: circuits ----
  const C = []; n = 0;
  R.C.list.filter(c => /javaslat/.test(c.src)).forEach(c => C.push({ id: ID('C', ++n), q: `${c.ref} — ${c.name}: ${c.members.length} tag, ${c.mcb || ''}`,
    why: `Tagok: ${c.members.map(e => e.ref || e.id).join(', ')}`, rec: 'A',
    opts: [{ k: 'A', t: 'Elfogadom', d: 'Ahogy a javaslat.' }, { k: 'B', t: 'Bontsuk két körre', d: 'A megjegyzésbe: melyik tagok kerüljenek az új körbe.' }, { k: 'X', t: 'Másképp', d: 'A megjegyzésbe írd.' }] }));
  C.push({ id: ID('C', ++n), q: 'Redőnymotorok: melyik körön legyenek?', why: 'Nem dedikált (2026-10-11). Most a zóna világítási körén (V1 / V2) vannak, fali fel/le kapcsolóval.', rec: 'A',
    opts: [{ k: 'A', t: 'A zóna világítási körén (V1 / V2)', d: 'Nincs külön kismegszakító.' }, { k: 'B', t: 'Egy közös redőnykör (R1, B10)', d: 'Egy plusz modul, a világítás független marad.' },
      { k: 'C', t: 'A helyiség dugaljkörén', d: 'A szobai körrel együtt.' }] });
  S.push({ id: 'C', title: 'Áramkörök', note: 'A vázlat A2–A12 köreit megtartottam; az új és bővített körök jóváhagyásra.', questions: C });

  // ---- W: runs on unmarked walls ----
  const W = []; n = 0;
  const byRoom = {}; R.warn.filter(w => /jelöletlen falon/.test(w.msg)).forEach(w => { const m = w.msg.match(/: (\S+) (\S+) —/); if (m) (byRoom[m[1]] = byRoom[m[1]] || []).push(m[2]); });
  const RN = { R03L: 'lépcső (L23 lámpa, D25 dugalj) — a lépcsőházi falak mentén körbe', R08: 'fürdő alsó fala (mosógép D282)' };
  Object.entries(byRoom).forEach(([room, ws]) => W.push({ id: ID('W', ++n), q: `${room}: ${RN[room] || 'leágazó'} — jelöletlen fal: ${[...new Set(ws)].join(', ')}`, why: 'A vázlat ezt a falszakaszt nem jelölte; a motor csak itt érte el a végpontot.', rec: 'A',
    opts: [{ k: 'A', t: 'Jóváhagyom ezt a falat', d: 'A szakasz maradhat; a következő futás jelöltként kezeli.' }, { k: 'B', t: 'Berajzolom a vázlatba', d: 'Te jelölöd, a motor újrafut.' },
      { k: 'C', t: 'Más út kell', d: 'A megjegyzésbe: merre (pl. mennyezeten át, másik szervizpontról).' }] }));
  if (W.length) S.push({ id: 'W', title: 'Jelöletlen falszakaszok', note: 'Ahol a pálya a vázlat vonalain kívül fut.', questions: W });

  // ---- H: flagged heights ----
  const H = []; n = 0;
  const flag = E.filter(e => /⚑/.test(e.hRule || ''));
  const groups = {}; flag.forEach(e => (groups[e.hRule] = groups[e.hRule] || []).push(e));
  Object.entries(groups).forEach(([rule, es]) => { const h = Math.round(es[0].h);
    const alt = /sütőtorony/.test(rule) ? [['B', '2000 — a sütő fölött, a toronyszekrényben'], ['C', '600 — a sütő alatt, fiókszekrényben']]
      : /sziget/.test(rule) ? [['B', '1050 — a munkalap fölött, kiemelhető (pop-up) aljzat'], ['C', '300 — a sziget lábazata fölött']]
      : /vizes/.test(rule) ? [['B', '1200'], ['C', '1000']] : [['B', 'Más magasság (megjegyzésbe)']];
    H.push({ id: ID('H', ++n), q: `${es.map(e => e.ref || e.id).join(', ')}: ${h} mm jó?`, why: rule, rec: 'A',
      opts: [{ k: 'A', t: `${h} mm`, d: 'Ahogy a szabály.' }].concat(alt.map(([k, t]) => ({ k, t, d: '' }))) }); });
  H.push({ id: ID('H', ++n), q: 'Fővezeték (mérő → Elosztó)?', why: 'K32: háromfázisra kész szekrény. A szolgáltatói méretezés dönt.', rec: 'A',
    opts: [{ k: 'A', t: 'NYM-J 5×10', d: '3 fázis, 25–32 A.' }, { k: 'B', t: 'NYM-J 5×16', d: 'Nagyobb tartalék.' }, { k: 'C', t: 'NYM-J 3×10', d: 'Egyfázis.' }] });
  S.push({ id: 'H', title: 'Ellenőrizendő magasságok és méretek', note: '⚑ jelölésű szabályok.', questions: H });

  // ---- G: general rules ----
  S.push({ id: 'G', title: 'Általános szabályok', note: 'Ezek a következő rétegekre is érvényesek.', questions: [
    { id: 'G01', q: 'Hány kábel mehet egy gégecsőbe?', why: 'Most legfeljebb 2 (a leágazón egy cső = egy áramkör). Ettől függ a csőméret és a horony szélessége.', rec: 'A',
      opts: [{ k: 'A', t: '2', d: 'M25–M32 csövek.' }, { k: 'B', t: '1', d: 'Csak M20, sok cső egymás mellett.' }, { k: 'C', t: '3', d: 'Kevesebb cső, M32–M40.' }] },
    { id: 'G02', q: 'Sarokdoboz minden sarokba, ahová pálya ér?', why: `Most ${R.boxes.filter(b => b.kind === 'corner').length} sarok- és ${R.boxes.filter(b => b.kind === 'end').length} pályavég-tartalékdoboz van.`, rec: 'A',
      opts: [{ k: 'A', t: 'Igen, mindenhol', d: 'A későbbi rétegek ide is tehetnek hardvert.' }, { k: 'B', t: 'Csak ahol a pálya befordul', d: 'Az egyenesen átmenő sarkoknál nem.' }, { k: 'C', t: 'Csak a pályavégeken', d: '' }] },
    { id: 'G03', q: 'Gerinc 2600 / leágazó 2450 — marad?', why: 'A DIN 18015-3 felső sávja (mennyezet alatt 150–450).', rec: 'A',
      opts: [{ k: 'A', t: 'Marad', d: '' }, { k: 'B', t: 'Gerinc 2450 / leágazó 2300', d: '' }] }] });

  return { pack: 'CLABASEQ001', title: 'CLA — Erősáram alapréteg: jóváhagyás', rev: 'r1', date: new Date().toISOString().slice(0, 10), sections: S };
}
function write(ctx, file) { fs.writeFileSync(file, JSON.stringify(build(ctx), null, 1)); }
module.exports = { build, write };

// ---- round 2: only what the answers left open (⚑ in the switching groups / edits, overfull boxes, new soft walls) ----
function buildOpen(ctx) {
  const { R, cfg } = ctx, Q = []; let n = 0; const ID = () => 'N' + String(++n).padStart(2, '0'), ok = k => (cfg.approved || []).includes(k);
  const g = w => (cfg.switchGroups || []).find(x => x.why.includes(w));
  if (g('L15 + L16') && !ok('L15L16')) Q.push({ id: ID(), q: 'L15 + L16 (nappali fali lámpák): hogyan kapcsoljuk?', why: 'A válasz (L11) nem említette őket. Most külön egyszerű kapcsoló (K3c) a B171-nél — ott így hármas keret lesz.', rec: 'A',
    opts: [{ k: 'A', t: 'K3c külön, a B171-nél', d: 'Hármas keret: L1+L2 váltó, L26 váltó, L15+L16.' }, { k: 'B', t: 'Az L1 + L2 váltócsoporttal együtt', d: 'Nincs külön kapcsoló; kettes keret marad.' },
      { k: 'C', t: 'Az L26 váltócsoporttal együtt', d: '' }, { k: 'X', t: 'Másképp', d: 'Megjegyzésbe.' }] });
  if (g('lépcsőlámpa') && !ok('L23')) Q.push({ id: ID(), q: 'L23 (lépcsőlámpa): kapcsolója a B104-nél (harmadik gang) jó?', why: 'A válasz (W01) a vezetést adta meg, a kapcsolót nem. Az emeleti felállás mellett később váltó lehet.', rec: 'A',
    opts: [{ k: 'A', t: 'K9c a B104-nél, később váltó az emeleti ponttal', d: 'Most egyszerű; a felállásban tartalék cső van a váltóhoz.' }, { k: 'B', t: 'Már most váltó: a második kapcsoló a lépcső tetején (emelet)', d: 'A felálláson megy fel a váltó-összekötés.' },
      { k: 'C', t: 'Mozgásérzékelős (nincs kapcsoló)', d: 'A lámpa a szervizpontról kapcsolt; a SENSOR rétegre tartozik.' }, { k: 'X', t: 'Másképp', d: '' }] });
  if (!ok('EV1')) Q.push({ id: ID(), q: 'EV1 (elszívó) a fürdő mennyezetén: hol legyen?', why: 'A válasz szerint a mennyezetre kerül (L02). Most a régi fali hely fölött, 370 mm-re a faltól (3677, 7900).', rec: 'A',
    opts: [{ k: 'A', t: 'A régi fali hely fölött', d: '' }, { k: 'B', t: 'A zuhany / kád fölött', d: 'A pára forrásánál — a megjegyzésbe írd, melyik sarok.' }, { k: 'X', t: 'Másképp', d: '' }] });
  if (!ok('MF')) Q.push({ id: ID(), q: 'Munkafények (MF1, MF2) betápja: a felső szekrénysor alján 1450 mm-en, ahogy elhelyeztem?', why: 'L07: a K5 csillárkapcsoló két munkafényt kapcsol. MF1 a W9 pultsor közepén, MF2 a W17 oldalon.', rec: 'A',
    opts: [{ k: 'A', t: 'Igen, ezeken a helyeken', d: '' }, { k: 'B', t: 'A szekrénysorok végén (a sarkoknál)', d: 'Rövidebb vezeték, a LED-profil a szekrényen belül fut tovább.' }, { k: 'C', t: 'Egy közös betáp, két kör a szekrényben', d: '' }, { k: 'X', t: 'Másképp', d: '' }] });
  R.warn.filter(w => /cső fut be/.test(w.msg) && !ok('box')).forEach(w => Q.push({ id: ID(), q: w.msg.replace(/ — 2 szerelvényesnél.*/, '') + ' — mi legyen?', why: w.msg, rec: 'A',
    opts: [{ k: 'A', t: 'Két 2 szerelvényes doboz egymás mellett', d: 'Az egyik a kapcsolóké, a másik az átmenő kábeleké.' }, { k: 'B', t: 'Egy nagy kötődoboz (pl. 150 × 150)', d: '' },
      { k: 'C', t: 'A váltó-összekötések a mennyezeten át', d: 'Kevesebb cső a falban.' }] }));
  if ((cfg.edits || []).some(e => /hármas keret/.test(e.note)) && !ok('frame')) Q.push({ id: ID(), q: 'Fürdő függőleges hármas keret: kapcsoló 1171 · dugalj 1100 · dugalj 1029 mm — jó?', why: 'L02: a K12 és a D14 + D15 egy keretben, a keret közepe 1100-on.', rec: 'A',
    opts: [{ k: 'A', t: 'Jó', d: '' }, { k: 'B', t: 'Az egész keret feljebb: közép 1200', d: 'Kapcsoló 1271, dugaljak 1200 / 1129.' }, { k: 'X', t: 'Másképp', d: '' }] });
  R.warn.filter(w => /jelöletlen falon/.test(w.msg)).forEach(w => Q.push({ id: ID(), q: w.msg.replace(/ — rajzold be.*/, ''), why: 'Új jelöletlen falszakasz a válaszok beépítése után.', rec: 'A',
    opts: [{ k: 'A', t: 'Jóváhagyom', d: '' }, { k: 'B', t: 'Berajzolom', d: '' }, { k: 'C', t: 'Más út', d: 'Megjegyzésbe.' }] }));
  return { pack: 'CLABASEQ002', title: 'CLA — Erősáram alapréteg: 2. kör (nyitott pontok)', rev: 'r1', date: new Date().toISOString().slice(0, 10),
    sections: [{ id: 'N', title: 'Nyitott pontok az első kör után', note: 'Az első kör válaszai beépültek (lásd ALAPRETEG.md). Ezek maradtak.', questions: Q }] };
}
module.exports.buildOpen = buildOpen;
module.exports.writeOpen = (ctx, file) => fs.writeFileSync(file, JSON.stringify(buildOpen(ctx), null, 1));

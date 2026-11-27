// VRG Stack — W · Szereplők (people and roles), S19 of research/STRINGS-PLAN.md (§5; RULES §6a, the last of its
// layers): who may do what, and who owns which part of the work. RULES §6a: "account mix-ups already cost a day".
//
//   read({ repo }) → { people, signed, accounts, seats, owns, units }
//     people    Hub/data/access.json: each person by ROLE (owner, member) and the Kapu layers they may enter; the list
//               is checked against Hub/src/access-pubkey.json with the Kapu's own canonical form (kpCanon), as the
//               page and tools/hub-sign.js --verify check it
//     accounts  Dashboard/config/profiles.json: the Claude Code accounts (A, B with its own CLAUDE_CONFIG_DIR)
//     seats     docs/council/ROSTER.md: the Board and the Heads (a vacant seat says so)
//     owns      ROSTER.md "Which department owns what": each program or line and the Head who owns it
//     units     docs/hub/hub-seed.json: the business units (departments) and how many programs each holds
//   layer(r) → { nodes, edges }   pure
//     W:person.<role>[.<n>]   kind 'person'; title "Founder (owner)" / "colleague (member)"; never a name, an email or a login
//     W:account.<A|B>         kind 'account'
//     W:seat.<head>           kind 'seat' (state 'vacant' for an empty one); → A:agent.<head> 'played-by'
//     W:owns.<head>.<slug>    kind 'ownership'; title = the program's own name, so that program's pillar takes it in and
//                             the pillar's string reaches the Head who owns it; ← W:seat.<head> 'owns'
//     W:unit.<ID>             kind 'business unit'
//   The agents themselves are A nodes (A:agent.*): W says which seat they play, it does not repeat them.
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const readText = f => { try { return fs.readFileSync(f, 'utf8'); } catch { return null; } };
const readJson = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
const slug = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const cells = line => line.split('|').slice(1, -1).map(c => c.trim());
const plain = s => String(s || '').replace(/[*_`]/g, '').trim();

// a markdown table under the heading that matches rx: its rows as arrays of cells (header and rule left out)
function table(md, rx) {
  const lines = String(md || '').split(/\r?\n/), at = lines.findIndex(l => /^#+\s/.test(l) && rx.test(l));
  if (at < 0) return [];
  const out = [];
  for (let i = at + 1; i < lines.length && !/^#+\s/.test(lines[i]); i++) if (/^\|/.test(lines[i])) out.push(cells(lines[i]));
  return out.slice(2);
}

function verifyAccess(access, pub, kpCanon) {
  if (!access || !access.sig || !pub || !kpCanon) return { checked: false, ok: false, why: !access ? 'no access list' : !access.sig ? 'not signed' : 'no public key' };
  try {
    const key = crypto.createPublicKey({ key: pub, format: 'jwk' });
    const ok = crypto.verify('sha256', Buffer.from(kpCanon(access.body)), { key, dsaEncoding: 'ieee-p1363' }, Buffer.from(access.sig, 'base64'));
    return { checked: true, ok, why: ok ? '' : 'the signature does not match the list' };
  } catch (e) { return { checked: true, ok: false, why: String(e.message || e).split('\n')[0] }; }
}

function read({ repo } = {}) {
  const at = rel => path.join(repo, rel);
  const access = readJson(at('Hub/data/access.json'));
  let kpCanon = null; try { kpCanon = require(at('Hub/src/js/60-access.js')).kpCanon; } catch { kpCanon = null; }
  const signed = verifyAccess(access, readJson(at('Hub/src/access-pubkey.json')), kpCanon);
  const count = {};
  const people = ((access && access.body && access.body.people) || []).map(p => {
    const role = String(p.role || 'member'); count[role] = (count[role] || 0) + 1;
    return { role, n: count[role], layers: (p.layers || []).slice(), emails: (p.emails || []).length, github: !!p.github };   // counts only, never the values
  });
  const accounts = (readJson(at('Dashboard/config/profiles.json')) || []).filter(p => p && p.account).map(p => ({ account: String(p.account), name: p.hu || p.id, ownConfig: !!(p.env && p.env.CLAUDE_CONFIG_DIR) }));
  const roster = readText(at('docs/council/ROSTER.md')) || '';
  const seats = table(roster, /Board and the Heads/i).map(c => ({ head: plain(c[0]), title: plain(c[1]), where: plain(c[2]), vacant: /vacant/i.test(c[3] || '') || /^\*[^*]/.test(c[0] || '') }))
    .filter(s => s.head);
  const owns = [];
  for (const c of table(roster, /owns what/i)) { const head = plain(c[1]); for (const prog of String(c[0]).split(',').map(plain).filter(Boolean)) owns.push({ head, program: prog }); }
  const seed = readJson(at('docs/hub/hub-seed.json'));
  const units = ((seed && seed.departments) || []).map(d => ({ id: d.id, t: d.t, en: d.tEn || '', programs: ((seed.programs || []).filter(p => p.dept === d.id)).length }));
  return { people, signed, accounts, seats, owns, units };
}

function layer({ people = [], signed = { checked: false }, accounts = [], seats = [], owns = [], units = [] } = {}) {
  const nodes = [], edges = [];
  const add = n => nodes.push({ layer: 'W', t: '', tier: '', own: [], state: '', lane: n.kind, ...n });
  const label = { owner: 'Founder', member: 'colleague' };
  for (const p of people) {
    const id = 'W:person.' + p.role + (p.n > 1 ? '.' + p.n : '');
    add({ id, kind: 'person', title: `${label[p.role] || p.role}${p.n > 1 ? ' ' + p.n : ''} (${p.role})`, state: p.role,
      brief: `Kapu layers ${p.layers.join(', ') || 'none'}${p.github ? ' · GitHub sign-in' : ''}${p.emails ? ` · ${p.emails} email${p.emails > 1 ? 's' : ''} on the list` : ''} · Hub/data/access.json ${signed.ok ? '(signed)' : '(signature NOT valid)'}`,
      text: 'Hub/data/access.json', extra: { role: p.role, layers: p.layers, signed: !!signed.ok } });
  }
  for (const a of accounts) add({ id: 'W:account.' + a.account, kind: 'account', title: `Claude account ${a.account}`, brief: `${a.name}${a.ownConfig ? ' · its own CLAUDE_CONFIG_DIR, so its sign-in never mixes with the other' : ' · the default config'}`,
    state: a.account === 'A' ? 'primary' : 'secondary', text: 'Dashboard/config/profiles.json\nSECACC.md', extra: { ownConfig: a.ownConfig } });
  for (const s of seats) {
    const id = 'W:seat.' + slug(s.head);
    add({ id, kind: 'seat', title: `${s.head} · ${s.title}`, brief: s.vacant ? 'vacant (ROSTER.md)' : s.where, state: s.vacant ? 'vacant' : 'held', lane: 'council', text: 'docs/council/ROSTER.md', extra: { head: s.head, vacant: s.vacant } });
    if (!s.vacant) edges.push({ a: id, b: 'A:agent.' + slug(s.head), rel: 'played-by' });
  }
  const seatIds = new Set(nodes.filter(n => n.kind === 'seat').map(n => n.id));
  for (const o of owns) {
    const head = 'W:seat.' + slug(o.head), id = `W:owns.${slug(o.head)}.${slug(o.program)}`;
    add({ id, kind: 'ownership', title: o.program, brief: `owned by ${o.head} (ROSTER.md)`, lane: 'owned by ' + o.head, text: o.program, extra: { head: o.head } });
    if (seatIds.has(head)) edges.push({ a: head, b: id, rel: 'owns' });
  }
  for (const u of units) add({ id: 'W:unit.' + u.id, kind: 'business unit', title: `${u.t}`, brief: `${u.en} · ${u.programs} program${u.programs === 1 ? '' : 's'} in the Kapu`, text: 'docs/hub/02_BUSINESS-TOPOLOGY.md', extra: { programs: u.programs } });
  return { nodes, edges };
}

// pillars with code that no Head owns (DRIFT §19). A pillar is owned when a W node is its member (the roster names
// it in its own words), when a roster line names it more loosely ("calculators" for the Calculators pillar, "Kapu" for
// VRG Kapu), or when its area is owned (SUI's area is the Planner, which Arnold owns)
function unowned(graph) {
  const fold = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const titles = graph.nodes.filter(n => n.layer === 'W' && n.kind === 'ownership').map(n => fold(n.title)).filter(t => t.length >= 3);
  const words = p => [p.id, p.name, ...(p.words || [])].map(fold).flatMap(s => [s, ...s.split(/[^a-z0-9]+/).filter(w => w.length >= 4)]);
  const near = (a, b) => a === b || (a.length >= 4 && b.startsWith(a)) || (b.length >= 4 && a.startsWith(b));
  const named = p => (p.members || []).some(m => m.startsWith('W:')) || titles.some(t => words(p).some(w => near(w, t) || t.split(/[^a-z0-9]+/).some(x => x.length >= 4 && near(w, x))));
  const owned = new Set((graph.entities || []).filter(named).map(p => p.id));
  const ownedArea = a => !!a && (titles.some(t => near(fold(a), t) || fold(a).split(/[^a-z0-9]+/).some(x => x.length >= 4 && near(x, t)))
    || (graph.entities || []).some(p => owned.has(p.id) && words(p).some(w => near(w, fold(a)))));
  return (graph.entities || []).filter(p => (p.per || {}).C && !owned.has(p.id) && !ownedArea(p.area));
}

module.exports = { read, layer, table, verifyAccess, unowned };

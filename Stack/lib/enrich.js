// VRG Stack — tags derived from what the nodes already say. Nothing here is typed by hand.
//
//   para(n)   STK-Q16 = A: Projects · Areas · Resources · Archives (Tiago Forte's PARA), derived
//             from states, so the stack can be read the way a second brain is organised:
//               P  work with an end that is moving now    (an active / waiting line, a feature in
//                  development, an open decision, a session or run from the last 14 days)
//               A  ongoing responsibilities              (an app in use, a recurring line, house
//                  rules, agents, briefs, live codephrases, scheduled tasks, pillars)
//               R  reference material                    (documents, code, memory, ideas, tools)
//               X  archive: done, absorbed, parked, dormant, answered, history (commits, old sessions)
//   actor(n)  who does the work this node stands for: 'agent' (a model), 'script' (a program
//             that runs the same way every time), 'person', or '' — the RPA-vs-agent line.
'use strict';

const RECENT_DAYS = 14;

function para(n, today) {
  const age = n.t ? (Date.parse(today) - Date.parse(n.t.slice(0, 10))) / 864e5 : Infinity;
  const s = String(n.state || '');
  switch (n.layer) {
    case 'F': return n.tier === 3 || n.tier === 4 ? 'P' : n.tier === 1 || n.tier === 2 ? 'A' : 'R';
    case 'I': return n.kind === 'dormant' ? 'X' : n.kind === 'question' ? 'P' : 'R';
    case 'Q': return n.kind === 'decision' ? (s.startsWith('open') ? 'P' : 'X') : 'R';
    case 'L':
      if (n.kind === 'line') return ['active', 'waiting'].includes(s) ? 'P' : s === 'recurring' ? 'A' : s === 'personal' ? 'A' : 'X';
      return age <= RECENT_DAYS ? 'P' : 'X';
    case 'A':
      if (/^memory\/(reference|user)/.test(n.kind)) return 'R';
      if (n.kind === 'codephrase (archived)') return 'X';
      if (/^(agent|brief|codephrase \(live\)|house rules|scheduled task|council doc|workflow kit)/.test(n.kind)) return 'A';
      return 'R';
    case 'U': return age <= RECENT_DAYS ? 'P' : 'X';
    case 'R': return 'X';
    case 'C': case 'G': return n.kind.startsWith('signal/') ? (s === 'ruled' ? 'X' : 'P') : 'R';
    case 'E': return 'A';
    default: return 'R';
  }
}

function actor(n) {
  if (n.layer === 'U' || (n.layer === 'L' && n.kind === 'session')) return 'agent';
  if (n.layer !== 'A') return '';
  if (n.kind === 'agent tool' || n.kind === 'generator') return 'script'; // before /^agent/
  if (/^(agent|brief|codephrase|council doc|scheduled task|workflow kit)/.test(n.kind)) return 'agent';
  if (/^memory\/(user|feedback)/.test(n.kind)) return 'person';
  return '';
}

module.exports = { para, actor };

#!/usr/bin/env node
// ---------------------------------------------------------------------------
// tools/anon-check.js — the sanitiser check for the anonymous system briefs
// (docs/brief/, fork F10, 2026-11-21). Exit 1 on any hit, so it can gate a commit.
//
//   node tools/anon-check.js                 check every hand-out file in docs/brief/
//   node tools/anon-check.js --a <file>...   check files as version A (personal data only)
//   node tools/anon-check.js --b <file>...   check files as version B (personal data + the trade)
//   node tools/anon-check.js --list          print the rule names and how many patterns each has
//
// Two rule sets:
//   personal  (A and B)  e-mails, phone numbers, private IPs, local paths, session / artifact / repo URLs,
//                        our own brand and product nicknames, the agent persona names, the account names,
//                        third-party brands we would rather not name, street addresses
//   trade     (B only)   electrical vocabulary in Hungarian and English, units, standards codes, and any
//                        Hungarian accented letter (version B keeps its locale vague, so it has no Hungarian)
//
// Anything truly personal (client names, real people, addresses, device codes) is NOT written in this
// file: it would be the leak. Put those, one per line (plain text, or /regex/flags), in a deny-list kept
// outside Git and point at it:
//   ANON_DENY=/path/to/deny.txt node tools/anon-check.js
// Without ANON_DENY the script also reads ~/.config/vrg/anon-deny.txt and the gitignored
// tools/anon-check.deny.txt when they exist, and the client codes of tools/anonymise.map.json (gitignored)
// when that is present. Lines starting with # are comments. Every source it read is listed in the output.
// ---------------------------------------------------------------------------
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');

const REPO = path.resolve(__dirname, '..');
const BRIEF = path.join(REPO, 'docs', 'brief');

// ---- personal data and our own names: both versions ----------------------------------------------
const W = s => new RegExp('(?<![\\p{L}\\p{N}_])(?:' + s + ')(?![\\p{L}\\p{N}_])', 'gu');      // whole word
const WI = s => new RegExp('(?<![\\p{L}\\p{N}_])(?:' + s + ')(?![\\p{L}\\p{N}_])', 'giu');    // whole word, any case
const STEM = s => new RegExp('(?<![\\p{L}\\p{N}_])(?:' + s + ')', 'giu');                     // word start, suffixes allowed

const PERSONAL = [
  ['e-mail', /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g],
  ['phone', /(?:\+36|\b06)[ \-/]?\d{1,2}[ \-/]?\d{3}[ \-]?\d{3,4}\b|\+\d{2,3}(?:[ \-]?\d){8,12}\b/g],
  ['private IP', /\b(?:192\.168|10\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01]))\.\d{1,3}\.\d{1,3}\b/g],
  ['MAC address', /\b(?:[0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}\b/g],
  ['local path', /\b[A-Za-z]:[\\/][^\s]*|\/home\/[^\s]+|\/Users\/[^\s]+|\\\\[A-Za-z0-9_.-]+\\/g],
  ['user folder', WI('OneDrive|AppData|Desktop\\\\|webag\\w*')],
  ['account', STEM('webagoly')],
  ['URL: session / artifact / repo', /claude\.ai\/[^\s)]*|github\.com\/[^\s)]*|instagram\.com\/[^\s)]*|\bsession_[A-Za-z0-9]{8,}/g],
  ['repo name', WI('vrg-toolset|Planner_VRG_U100')],
  ['brand: ours', /(?<![\p{L}\p{N}_])(?:VRG|Varler)|vrg[-_.]|varler/giu],
  ['product nickname', WI('Kódváros|Kodvaros|Légegér|Legeger|Csipogó|Csipogo|Mélyvíz|Melyviz|Rétegverem|Retegverem|Rajztár|Solomon|Delos|Divergence|CoreRef|ServiceKit|ServiceKitCYD|BuildTree|Valena|Workflow Kit|Title Card|Papír|Papir|BRIDGE|Kapu|Asztal|Irányítópult|Sketcher|Modder|SessionCanvas|Lumen|Látótér|Latoter')],
  ['agent persona', W('Bernard|Arnold|Charlotte|Elsie|Felix|Teddy|Theresa|Abernathy|Akecheta|Armistice|Caleb|Clementine|Sylvester|Stubbs|Dolores|Maeve|Ford|Hale|Logan|Lee Sizemore|Westworld')],
  ['codephrase', /\bGO (?:MAIN|PLANNER|ROUTE|CLA|HUB|CITY|MOBILE|LOGO|VARIANT|OPENWRT)\b|\bGO-[A-Z]+\.md\b/g],
  ['internal ids', /\b(?:D-|DESKU-Q|HUB-Q|CITY-D|KV-|WP-)\d{1,3}\b|\bM\d{1,2}\b(?=[ ,.;:)])/g],
  ['third-party brand', WI('Claude|Anthropic|GitHub|Cloudflare|Samsung|Xiaomi|Huawei|Google Drive|Instagram|TP-Link|OpenWrt|Opera GX|Avast')],
  ['street address', /\b[A-ZÁÉÍÓÖŐÚÜŰ][a-záéíóöőúüű]+(?:[ -][A-ZÁÉÍÓÖŐÚÜŰ]?[a-záéíóöőúüű]+)? (?:utca|út|útja|tér|tere|körút|krt\.|köz|sor|fasor|sétány|u\.)\s*\d+/gu],
  ['Android model code', /\b(?:SM-[A-Z]\d{3}|Pixel \d|Redmi)\b/g],
];

// ---- the trade: version B only ---------------------------------------------------------------------
const TRADE = [
  ['HU accented letter (B keeps its locale vague)', /[áéíóöőúüűÁÉÍÓÖŐÚÜŰ]/g],
  ['HU trade word', STEM('villany|villamos|elektr|eloszt|kismegszakít|kismegszakit|áramvéd|aramved|aljzat|dugalj|konnektor|lámp|lamp[aá]|kábel|kabel|vezeték|vezetek|fázis|fazis|mérőhely|merohely|mérőóra|meroora|földel|foldel|napelem|kötődoboz|kotodoboz|védőcső|vedocso|feszültség|feszultseg|áramkör|aramkor|biztosíték|biztositek|kapcsol|villanyszerel|égett|eget[t]?')],
  ['HU trade abbreviation', W('FI|ÁVK|AVK|MSZ|HD 60364|EPH')],
  ['EN trade word', STEM('electric|electrician|electro|breaker|socket|outlet|wiring|wire|cable|cabling|voltage|ampere|amperage|earthing|grounding|ground fault|conduit|junction box|switchboard|switchgear|consumer unit|panelboard|distribution board|fuse|luminaire|lamp|light switch|light fitting|lighting|photovoltaic|solar|inverter|heat pump|wallbox|charger|charging|kilowatt|watt|megger|insulation resist|residual current|overcurrent|short circuit|three-phase|single-phase|live wire|neutral wire|busbar|terminal block|rcd|rcbo|mcb')],
  ['EN trade word (whole)', WI('circuit|circuits|meter|meters|volt|volts|amp|amps|phase|phases|power point|EV|PV|kW|kWh|kVA|mA|IP\\d\\d|CEE|DIN rail|Schuko|NYM|MT|MBCu|FTP|UTP|ESP32|ESP|Arduino|smart home|smart-home|intercom|doorbell|antenna')],
  ['trade giveaway phrase', WI('installer of|installation work|installation trade|burnt|scorched|sparks?|shock')],
];

const args = process.argv.slice(2);
if (args.includes('--list')) {
  for (const [set, rules] of [['personal', PERSONAL], ['trade', TRADE]]) for (const [n] of rules) console.log(set + '\t' + n);
  process.exit(0);
}

// ---- the deny-list from outside Git ----------------------------------------------------------------
const sources = [];
const DENY = [];
function readDeny(file) {
  if (!file || !fs.existsSync(file)) return;
  sources.push(file.startsWith(REPO) ? path.relative(REPO, file) : '(outside the repo) ' + path.basename(file));
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = /^\/(.+)\/([a-z]*)$/.exec(line);
    try {
      DENY.push(m ? new RegExp(m[1], m[2].includes('g') ? m[2] : m[2] + 'g')
                  : new RegExp(line.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'));
    } catch (e) { console.error('anon-check: bad deny line skipped: ' + e.message); }
  }
}
readDeny(process.env.ANON_DENY);
if (!process.env.ANON_DENY) {
  readDeny(path.join(os.homedir(), '.config', 'vrg', 'anon-deny.txt'));
  readDeny(path.join(__dirname, 'anon-check.deny.txt'));
}
const MAP = path.join(__dirname, 'anonymise.map.json');
if (fs.existsSync(MAP)) {
  try {
    const map = JSON.parse(fs.readFileSync(MAP, 'utf8'));
    for (const c of map.codes || []) if (c.from && !/^</.test(c.from)) DENY.push(new RegExp(c.from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'));
    for (const c of map.literals || []) if (c.from && !/^</.test(c.from)) DENY.push(new RegExp(c.from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'));
    sources.push('tools/anonymise.map.json');
  } catch (e) { console.error('anon-check: tools/anonymise.map.json unreadable: ' + e.message); }
}

// ---- which files ----------------------------------------------------------------------------------
let jobs = [];
if (args.includes('--a') || args.includes('--b')) {
  let mode = null;
  for (const a of args) {
    if (a === '--a' || a === '--b') { mode = a.slice(2).toUpperCase(); continue; }
    jobs.push({ file: path.resolve(a), ver: mode });
  }
} else {
  for (const f of ['SYSTEM-A.md', 'BRIEF-A.md', 'PACK-A.md']) jobs.push({ file: path.join(BRIEF, f), ver: 'A' });
  for (const f of ['SYSTEM-B.md', 'BRIEF-B.md', 'PACK-B.md']) jobs.push({ file: path.join(BRIEF, f), ver: 'B' });
}

// Matches inside a fenced block marked ```anon-allow are skipped (none are used in the hand-outs today).
function scan(text, rules) {
  const hits = [];
  const lines = text.split(/\r?\n/);
  let allow = false;
  lines.forEach((line, i) => {
    if (/^```anon-allow/.test(line)) { allow = true; return; }
    if (allow && /^```/.test(line)) { allow = false; return; }
    if (allow) return;
    for (const [name, re] of rules) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(line))) {
        hits.push({ line: i + 1, col: m.index + 1, rule: name, text: m[0] });
        if (!re.global) break;
        if (m[0] === '') re.lastIndex++;
      }
    }
  });
  return hits;
}

let total = 0, missing = 0;
for (const { file, ver } of jobs) {
  const rel = path.relative(REPO, file);
  if (!fs.existsSync(file)) { console.log('MISSING ' + rel); missing++; continue; }
  const text = fs.readFileSync(file, 'utf8');
  const rules = PERSONAL.concat(DENY.map((re, i) => ['deny-list #' + (i + 1), re]), ver === 'B' ? TRADE : []);
  const hits = scan(text, rules);
  total += hits.length;
  if (!hits.length) { console.log('ok   ' + rel + ' (' + ver + ')'); continue; }
  console.log('HIT  ' + rel + ' (' + ver + '): ' + hits.length);
  for (const h of hits.slice(0, 200)) console.log('     ' + h.line + ':' + h.col + '  [' + h.rule + ']  ' + JSON.stringify(h.text));
  if (hits.length > 200) console.log('     … ' + (hits.length - 200) + ' more');
}
console.log('deny-list sources: ' + (sources.length ? sources.join(', ') : 'none (set ANON_DENY to add one)'));
if (total || missing) { console.log('anon-check: FAIL (' + total + ' hits, ' + missing + ' missing)'); process.exit(1); }
console.log('anon-check: clean');

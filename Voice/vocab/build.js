// build.js — the speech model's bias list: the names our own work uses, so "Rétegverem", "GO MOBILE" or "Kódváros" come out spelled
// right. Whisper takes it as the initial prompt (≈ 224 tokens at most; we stay well under: `maxChars`), comma-separated, the most
// useful names first. Sources: Voice/vocab/extra.txt (hand-written), the GO codephrases, the catalog titles, the voice command phrases
// (Voice/command/commands.json → "phrases", written by the command layer, WP-55; after the names, at most 20), the catalog titles,
// the START tool names; job codes
// only when `withJobs` (client-related: the result then goes only into Voice/.cache, gitignored, never into the repo).
//   const v = buildVocab({ repo, full?, index?, maxChars?, withJobs? }) → { prompt, words, stats }
//   node Voice/vocab/build.js [--jobs] [--json]      prints it (and writes Voice/.cache/vocab.json)
'use strict';
const fs = require('fs'), path = require('path');

const HERE = __dirname, REPO_DEFAULT = path.resolve(HERE, '..', '..');
const readLines = f => { try { return fs.readFileSync(f, 'utf8').split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#')); } catch (e) { return []; } };
const clean = s => String(s || '').replace(/[\u0000-\u001f,]+/g, ' ').replace(/\s+/g, ' ').trim();

// a ranked list → the prompt: unique (case-insensitive), each ≤ 40 chars, the total ≤ maxChars
function assemble(list, maxChars) {
  const seen = new Set(), words = [];
  let len = 0;
  for (const raw of list) {
    const w = clean(raw);
    if (!w || w.length > 40 || /^[\d\W]+$/u.test(w)) continue;
    const k = w.toLowerCase();
    if (seen.has(k)) continue;
    if (len + w.length + 2 > maxChars) break;
    seen.add(k); words.push(w); len += w.length + 2;
  }
  return { words, prompt: words.join(', ') };
}

function buildVocab({ repo = REPO_DEFAULT, full, index, maxChars = 600, withJobs = false } = {}) {
  let idx = index;
  if (!idx) {
    try { idx = require(path.join(repo, 'Prefilter', 'prefilter.js')).loadIndex({ repo, full: full || path.dirname(repo) }); } catch (e) { idx = null; }
  }
  const extra = readLines(path.join(repo, 'Voice', 'vocab', 'extra.txt'));
  const codephrases = idx ? (idx.codephrases || []).map(c => c.phrase) : [];
  let commands = [];
  try { const c = JSON.parse(fs.readFileSync(path.join(repo, 'Voice', 'command', 'commands.json'), 'utf8')); commands = Array.isArray(c.phrases) ? c.phrases : []; } catch (e) {}
  const ents = idx ? idx.entities || [] : [];
  const catalog = ents.filter(e => e.kind === 'catalog').map(e => e.title);
  const tools = ents.filter(e => e.kind !== 'catalog').map(e => e.title);
  const jobs = withJobs && idx ? (idx.jobs || []) : [];
  // the order is the rank: what is most often misheard and most specific to us first
  // command phrases are mostly plain verbs Whisper already spells: after the names, and only the first 20
  const ranked = [...extra, ...codephrases, ...catalog, ...jobs, ...commands.slice(0, 20), ...tools];
  const { words, prompt } = assemble(ranked, maxChars);
  return { prompt, words, stats: { extra: extra.length, codephrases: codephrases.length, commands: commands.length, catalog: catalog.length, tools: tools.length, jobs: jobs.length, kept: words.length, chars: prompt.length } };
}

module.exports = { buildVocab, assemble };

if (require.main === module) {
  const argv = process.argv.slice(2);
  const v = buildVocab({ withJobs: argv.includes('--jobs') });
  const dir = path.join(HERE, '..', '.cache');
  try { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, 'vocab.json'), JSON.stringify(v, null, 1)); } catch (e) {}
  if (argv.includes('--json')) console.log(JSON.stringify(v, null, 1));
  else { console.log(JSON.stringify(v.stats)); console.log(v.prompt); }
}

// VRG Stack — the source map (S5, research/STRINGS-PLAN.md §3.2): which layer owns a changed file, so serve.js can
// rebuild only that layer (pipeline.runLayers) a moment after a hand edit, a gateway edit or a session's edit.
//
//   layersFor(file) → ['Q'] · ['L'] · ['E'] … or [] (not a live source: the next full build picks it up)
//   roots()         → [{ dir, recursive }]   what serve.js watches
//
// Live (hand-kept maps, edited one file at a time): F features, I ideas, Q DECISIONS files, L lines and sessions,
// A memory and the repo's agent files, R the DevRepo notes, E the pillar list and the Thread Board threads.
// Not live, on purpose: code and documents (C, G: a session edits them every few seconds), commits and recordings
// (R from git, U from transcripts): these follow on the next full build (START R → B, a session, the gateway's rebuild).
// Our own output (Stack/out, Stack/data) is never a source, or a build would trigger itself.
'use strict';

const CFG = require('../config');

const norm = p => String(p || '').replace(/\\/g, '/').replace(/\/+$/, '');
const low = p => norm(p).toLowerCase();

function rules(S = CFG.sources, extra) {
  const notes = low(S.notes), repo = low(S.repo), memory = low(S.memory), hist = S.jobs ? low(S.jobs) + '/_elozmenyek/' : null;
  const extras = (extra || require('./layers').DECISION_FILES_EXTRA || []).map(low);
  const inRepo = f => f.startsWith(repo + '/') ? f.slice(repo.length + 1) : null;
  return f => {
    if (f === low(S.repo) + '/stack/data/probes.jsonl') return ['P'];   // a recorded test run (S12)
    // the Board Console's devices and library (S16): a flash, a backup or a new firmware rebuilds D
    if (/\/firmware\/board-console\/data\/(devices\.json|library\/[^/]+\/[^/]+\/manifest\.json)$/.test(f)) return ['D'];
    if (hist && f.startsWith(hist)) return /^(regiszter\.md|osszegek\.csv)$/.test(f.slice(hist.length)) ? ['M'] : [];   // the job register (S15)
    if (/\/(stack\/out|stack\/data|node_modules|\.git)(\/|$)/.test(f) || /\.(tmp\d*|swp|lock)$|~$/.test(f)) return [];
    if (f.startsWith(notes + '/')) {
      const r = f.slice(notes.length + 1);
      if (r.startsWith('features/')) return ['F'];
      if (r.startsWith('idea-timeline/')) return ['I'];
      if (r === 'devlog/threads.js') return ['E', 'T'];
      if (r === 'devlog/lines.js') return ['L', 'T'];
      if (r === 'devlog/sessions.json') return ['L'];
      if (r === 'devrep/notes.js') return ['R'];
      return [];
    }
    if (f.startsWith(memory + '/')) return /^[^/]+\.md$/.test(f.slice(memory.length + 1)) && !/\/memory\.md$/.test(f) ? ['A'] : [];
    if (extras.includes(f)) return ['Q'];
    const r = inRepo(f); if (r == null) return [];
    if (r === 'stack/entities.json') return ['E'];
    if (r === 'launcher/vrg-menu.json' || r === 'launcher/vrg-catalog.json' || r === 'mobile/android/kit-core/src/main/kotlin/hu/vrg/mobile/core/feature.kt') return ['N'];
    if (/(^|\/)roadmap[^/]*\.md$/.test(r)) return ['T'];
    // outside (S18): the vendor manifest, a package.json or its lockfile, the Claude settings (MCP servers)
    if (r === 'vendor-manifest.json' || /(^|\/)package(-lock)?\.json$/.test(r) && !/(^|\/)node_modules\//.test(r) || /^\.claude\/settings(\.local)?\.json$/.test(r)) return ['O'];
    // the look (S17): a page or a style sheet (its copy of Mélyvíz, its inlined kit), the kit's manifest, the sync list
    if (/\.(html?|css)$/.test(r) && !/^(vendor|archive\/files)\//.test(r) || r === 'shared/vrg-ui-kit/manifest.json' || r === 'shared/varler-logo/lockups/lockups.json' || r === 'tools/melyviz-sync.js') return ['V'];
    if (/decisions/.test(r) && r.endsWith(".md")) return ["Q"];
    if (/^\.claude\/agents\/[^/]+\.md$|^docs\/hub\/agents\/[^/]+\.md$|^go-[a-z0-9]+\.md$|^docs\/go-archive\/go-[a-z0-9-]+\.md$|(^|\/)claude\.md$|^docs\/council\/[^/]+\.md$|^docs\/workflow\/[^/]+\.md$|^\.claude\/(skills|commands)\//.test(r)) return ['A'];
    return [];
  };
}

let ruleFn = null;
function layersFor(file) { ruleFn = ruleFn || rules(); return ruleFn(low(file)); }

function roots(S = CFG.sources) {
  const r = [{ dir: norm(S.notes), recursive: true }, { dir: norm(S.memory), recursive: false }, { dir: norm(S.repo), recursive: true }];
  if (S.jobs) r.push({ dir: norm(S.jobs + '/_elozmenyek'), recursive: false });   // the register and the totals (S15); a Kit folder follows the next full build
  return r;
}

module.exports = { layersFor, rules, roots };

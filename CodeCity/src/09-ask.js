// 09-ask.js — the query language: questions over the data already loaded, no AI, no network
// (God's Eye View's analyst engine: a pure query function returns stable ids, and the surfaces —
// result list, brackets — only draw them). Hungarian words, combined with AND:
//   Planner, Inventory/src     path or name contains
//   html, javascript, nyelv:md language
//   csak claude / ügynök       agent-assisted (all / some commits) · ember: no agent record
//   forró                      heavy recent churn
//   régi 30 nap · friss 2 hét  untouched for / touched within (nap, hét, hónap, év)
//   >500 sor · <20 sor · >5 commit
//   legnagyobb · legaktívabb · legimportáltabb · legrégebbi   sort (default: lines)
//   top 5 / 5                  how many
// No DOM, no THREE: CodeCity/core.js loads this file in Node too, so the MCP server and the page
// answer the same question the same way.

const UNIT_DAYS = { nap: 1, napja: 1, hét: 7, het: 7, hete: 7, hónap: 30, honap: 30, hó: 30, hónapja: 30, év: 365, ev: 365, éve: 365 };
const SORTS = {
  legnagyobb: ['loc', 'sorok'], legtöbb: ['loc', 'sorok'], legaktívabb: ['n', 'commitok'],
  legimportáltabb: ['imp', 'importálók'], központi: ['imp', 'importálók'], legrégebbi: ['age', 'kor'], legfrissebb: ['fresh', 'frissesség'],
};

function runQuery(text) {
  const files = current.city.files, c = current.city.commits, T = replay.T;
  const words = text.toLowerCase().replace(/[„”"]/g, ' ').split(/\s+/).filter(Boolean);
  const tests = [], said = [];
  let sort = ['loc', 'sorok'], limit = 12;
  const heat = heatCounts(), maxHeat = Math.max(1, ...heat);
  const lastTouch = i => { const k = countUpTo(replay.touch[i], T); return k ? c[replay.touch[i][k - 1]][0] : -Infinity; };
  const nowT = c.length ? c[T][0] : Date.now() / 1000;
  const langs = new Set(files.map(f => f.lang.toLowerCase()));
  const ext = { js: 'javascript', ts: 'typescript', md: 'markdown', py: 'python', css: 'css', html: 'html', json: 'json' };

  for (let w = 0; w < words.length; w++) {
    const word = words[w], next = words[w + 1], unit = words[w + 2];
    let m;
    if (word === 'top' && /^\d+$/.test(next || '')) { limit = +next; w++; }
    else if (/^\d+$/.test(word) && !(next && (UNIT_DAYS[next] || /^(sor|commit)/.test(next)))) limit = +word;
    else if ((m = /^([<>])(\d+)$/.exec(word)) && /^(sor|commit)/.test(next || '')) {
      const key = next.startsWith('sor') ? 'loc' : 'n', v = +m[2], gt = m[1] === '>';
      tests.push(i => { const val = key === 'loc' ? (fileAtT(files[i]) || [0, files[i].loc])[1] : (fileAtT(files[i]) || [files[i].n])[0]; return gt ? val > v : val < v; });
      said.push(`${m[1]}${v} ${next}`); w++;
    } else if ((word === 'régi' || word === 'regi' || word === 'érintetlen') && /^\d+$/.test(next || '') && UNIT_DAYS[unit]) {
      const s = +next * UNIT_DAYS[unit] * 86400; tests.push(i => nowT - lastTouch(i) > s); said.push(`${next} ${unit} óta érintetlen`); w += 2;
    } else if (word === 'friss' && /^\d+$/.test(next || '') && UNIT_DAYS[unit]) {
      const s = +next * UNIT_DAYS[unit] * 86400; tests.push(i => nowT - lastTouch(i) <= s); said.push(`${next} ${unit} alatt érintve`); w += 2;
    } else if (word === 'nem' && next === 'nyúlt') { words[w + 1] = 'régi'; }
    else if (word === 'forró') { tests.push(i => heat[i] >= Math.max(2, maxHeat * 0.5)); said.push('forró'); }
    else if (word === 'csak' && next) { const ag = next; tests.push(i => agentShareOf(i) === 1 && files[i].n > 0 && current.city.agents.some(a => a.toLowerCase() === ag)); said.push(`csak ${next}`); w++; }
    else if (word === 'ügynök' || word === 'ugynok') { tests.push(i => agentShareOf(i) > 0); said.push('ügynökkel'); }
    else if (word === 'ember') { tests.push(i => countUpTo(replay.touch[i], T) > 0 && agentShareOf(i) === 0); said.push('ügynök nélkül'); }
    else if (SORTS[word]) sort = SORTS[word];
    else if ((m = /^nyelv:(.+)$/.exec(word)) || langs.has(word) || ext[word]) {
      const l = m ? (ext[m[1]] || m[1]) : (ext[word] || word); tests.push(i => files[i].lang.toLowerCase() === l); said.push(l);
    } else if (/^(sor|sorok|commit|commitok|és|a|az|fájl|fájlok|mappában|ban|ben)$/.test(word)) { /* filler */ }
    else { tests.push(i => files[i].p.toLowerCase().includes(word)); said.push(`„${word}”`); }
  }

  const alive = files.map((f, i) => i).filter(i => stateAt(files[i], i, T)[0] > 0);
  const hits = alive.filter(i => tests.every(t => t(i)));
  const key = {
    loc: i => (fileAtT(files[i]) || [0, files[i].loc])[1], n: i => countUpTo(replay.touch[i], T),
    imp: i => roads.importers[i].length, age: i => -lastTouch(i), fresh: i => lastTouch(i),
  }[sort[0]];
  hits.sort((a, b) => key(b) - key(a));
  const items = hits.slice(0, Math.max(1, Math.min(200, limit)));
  const summary = `${hu(hits.length)} találat ${hu(alive.length)} fájlból` + (said.length ? ` · ${said.join(' · ')}` : '') + ` · rendezés: ${sort[1]}`
    + (hits.length > items.length ? ` · első ${items.length}` : '');
  return { items, summary, metric: i => `${hu(key(i) < 0 ? 0 : sort[0] === 'age' || sort[0] === 'fresh' ? Math.round((nowT - lastTouch(i)) / 86400) : key(i))}${sort[0] === 'loc' ? ' sor' : sort[0] === 'n' ? ' commit' : sort[0] === 'imp' ? ' importáló' : ' napja'}` };
}

// files changed together with file i up to the shown commit: [[j, together, share of i's commits]]
const COCHANGE_MAX_FILES = 30;      // a commit touching more files is a sweep, not a relation
function neighboursOf(i) {
  const c = current.city.commits, count = new Map();
  let mine = 0;
  for (const ci of replay.touch[i]) {
    if (ci > replay.T) break;
    const ch = c[ci][5];
    if (ch.length / 3 > COCHANGE_MAX_FILES) continue;
    mine++;
    for (let k = 0; k < ch.length; k += 3) if (ch[k] !== i) count.set(ch[k], (count.get(ch[k]) || 0) + 1);
  }
  return [...count].filter(([, n]) => n >= 2).map(([j, n]) => [j, n, n / Math.max(1, mine)])
    .sort((a, b) => b[1] - a[1] || b[2] - a[2]).slice(0, 8);
}

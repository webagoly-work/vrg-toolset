// 10-query.js — the query bar: questions over the data already loaded, no AI, no network
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
// Brackets (God's Eye View's detection overlay) mark the results that are on screen.

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

// ---- surfaces: the result list and the brackets
const query = { items: [], text: '' };
function showQuery(text) {
  query.text = text.trim();
  const box = $('qres');
  if (!query.text || !current) { query.items = []; box.hidden = true; requestRender(); writeHashSoon(); return; }
  const r = runQuery(query.text), files = current.city.files;
  query.items = r.items;
  box.innerHTML = `<div class="sum">${esc(r.summary)}</div><ol>${r.items.map(i =>
    `<li data-i="${i}" title="${esc(files[i].p)}"><span>${esc(files[i].p)}</span><b>${r.metric(i)}</b></li>`).join('')}</ol>`;
  box.hidden = false;
  requestRender();
  writeHashSoon();
}
$('q').addEventListener('input', e => showQuery(e.target.value));
$('q').addEventListener('keydown', e => {
  if (e.key === 'Escape') { e.target.value = ''; showQuery(''); e.target.blur(); }
  if (e.key === 'Enter' && query.items.length) pickResult(query.items[0]);
});
// the list steps aside when you go back to the city; the brackets stay until the query is cleared
$('q').addEventListener('focus', () => { if (query.items.length || query.text) $('qres').hidden = false; });
$('q').addEventListener('blur', () => setTimeout(() => { if (document.activeElement !== $('q')) $('qres').hidden = true; }, 200));
$('qres').addEventListener('mousedown', e => e.preventDefault());   // a click in the list must not blur the box first
$('qres').addEventListener('click', e => { const li = e.target.closest('li[data-i]'); if (li) pickResult(+li.dataset.i); });
function pickResult(i) { const f = current.city.files[i]; showFile(f); flyTo(f); }
addEventListener('keydown', e => {
  if (e.key === '/' && current && document.activeElement !== $('q')) { e.preventDefault(); $('q').focus(); $('q').select(); }
});

// brackets: corner marks around each result's on-screen box, numbered like the list
const brk = $('brk'), bctx = brk.getContext('2d'), _v = new THREE.Vector3();
function drawBrackets() {
  const r = brk.parentElement.getBoundingClientRect(), dpr = Math.min(devicePixelRatio, 2);
  if (brk.width !== Math.round(r.width * dpr) || brk.height !== Math.round(r.height * dpr)) { brk.width = Math.round(r.width * dpr); brk.height = Math.round(r.height * dpr); }
  bctx.clearRect(0, 0, brk.width, brk.height);
  if (!query.items.length || !current) return;
  bctx.lineWidth = 1.5 * dpr; bctx.strokeStyle = '#ffcf5a'; bctx.fillStyle = '#ffcf5a'; bctx.font = `${11 * dpr}px ui-monospace, Consolas, monospace`;
  query.items.slice(0, 40).forEach((i, n) => {
    const f = current.city.files[i], [h, s] = stateAt(f, i, replay.T);
    if (h <= 0) return;
    const { x, z, w, h: d } = f.rect, cx = x + w / 2, cz = z + d / 2, hw = w * s / 2, hd = d * s / 2;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, behind = false;
    for (const [dx, dy, dz] of [[-1, 0, -1], [1, 0, -1], [-1, 0, 1], [1, 0, 1], [-1, 1, -1], [1, 1, -1], [-1, 1, 1], [1, 1, 1]]) {
      _v.set(cx + dx * hw, f.base + dy * h, cz + dz * hd).project(camera);
      if (_v.z > 1) behind = true;
      const px = (_v.x + 1) / 2 * brk.width, py = (1 - _v.y) / 2 * brk.height;
      x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
    }
    if (behind || x1 < 0 || y1 < 0 || x0 > brk.width || y0 > brk.height) return;
    const pad = 3 * dpr, L = Math.max(4 * dpr, Math.min(12 * dpr, (x1 - x0) / 3));
    x0 -= pad; y0 -= pad; x1 += pad; y1 += pad;
    bctx.beginPath();
    for (const [px, py, sx, sy] of [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]]) {
      bctx.moveTo(px + sx * L, py); bctx.lineTo(px, py); bctx.lineTo(px, py + sy * L);
    }
    bctx.stroke();
    bctx.fillText(String(n + 1), x1 + 3 * dpr, y0 + 9 * dpr);
  });
}

// 48-hm-pages.js — the physical page map (CITY-D44 B), opened from the market. Every frame of RAM, folded by address into 64 × 64
// cells, each cell the most common state there. It answers "what is in RAM by address", and 03-truth §3.3 says why that looks
// like noise: placement is arbitrary. The query is undocumented, so each reading is checked against the live counters.

const HM_PAGE_LISTS = [['Nullázott', '#3f6f8f'], ['Szabad', '#7fb7d6'], ['Készenlét', '#2f8f83'], ['Módosított', '#d9a441'], ['Módosított, nem írandó', '#b98532'], ['Hibás', '#d9534f'], ['Aktív', '#e8eef2'], ['Átmeneti', '#8a6fb0']];
const HM_PAGE_USES = [['Program saját', '#e8eef2'], ['Fájl', '#2f8f83'], ['Lapfájl-alapú', '#7fb7d6'], ['Laptábla', '#8a6fb0'], ['Lapozható pool', '#d9a441'], ['Nem lapozható pool', '#b98532'], ['Rendszer-PTE', '#6a7f8c'], ['Munkamenet', '#3f6f8f'], ['Metafájl', '#57a773'], ['AWE', '#c77dba'], ['Driver-zárolt', '#d9534f'], ['Kernelverem', '#9aa7b0']];
const HM_PAGE_WHY = { off: 'Az ETW-segéd nem fut.', old: 'A telepített ETW-segéd még a régi: a frissítés lépései a 04-data-feed.md §4.7-ben vannak.', ranges: 'A Windows nem adta meg a memóriatartományokat.', layout: 'A válasz szerkezete nem a várt: ez a Windows-verzió mást használ.' };

function hmPagesOpen() { hm.pageBy = hm.pageBy || 0; hmShow({ pages: true }); hmPagesAsk(); }
async function hmPagesAsk() {
  hm.pageErr = ''; hm.pageWait = true; hmPagesPaint();
  if (hm.fixture) { hm.pages = hmPagesFixture(); hm.pageWait = false; return hmPagesPaint(); }
  const r = await kvCall('hm-pages', {});
  hm.pageWait = false;
  if (r.status === 200 && r.json.pages) hm.pages = r.json.pages;
  else hm.pageErr = HM_PAGE_WHY[r.json && r.json.why] || `A lekérdezés nem sikerült (${esc(String((r.json && r.json.why) || r.status))}).`;
  hmPagesPaint();
}
// the reading against the feed's own counters: pages per list, in bytes, must land near the page-list counters
function hmPagesCheck(p, m) {
  const page = 4096, pairs = [[p.lists[2], m.standby], [p.lists[3] + p.lists[4], m.modified], [p.lists[0] + p.lists[1], m.free]];
  const off = pairs.reduce((a, [got, want]) => a + Math.abs(got * page - want), 0) / m.total;
  return { off, good: off < 0.1 && Math.abs(p.seen * page - m.total) / m.total < 0.1 };
}
function hmPagesPaint() {
  if (!hm.sel || !hm.sel.pages) return;
  const p = hm.pages, table = hm.pageBy ? HM_PAGE_USES : HM_PAGE_LISTS, counts = p && (hm.pageBy ? p.uses : p.lists);
  const rows = p ? table.map(([n, c], i) => [`<i class="hm-swatch" style="background:${c}"></i>${esc(n)}`, hmMB(counts[i] * 4096)]).filter((_, i) => counts[i] > 0) : [];
  const check = p && !hm.fixture && hm.ev ? hmPagesCheck(p, hm.ev.mem) : null, tag = !check || check.good ? 'M' : 'K';
  const warn = check && !check.good ? `<p class="warn">A térkép ${Math.round(check.off * 100)} %-kal eltér a mért laplistáktól: ne vedd pontosnak.</p>` : '';
  const when = p ? `<p class="dim">Mérve ${new Date(p.at).toLocaleTimeString('hu-HU')}, ${hu(p.ms)} ms alatt. Egy cella ${hmMB(p.gran * 4096)}, a legtöbb lap állapota ott.</p>` : '';
  openPanel('Piac · fizikai lapok', rows, (hm.pageErr ? `<p class="warn">${hm.pageErr}</p>` : '') + (hm.pageWait ? '<p class="dim">Lapok számolása…</p>' : '') +
    (p ? '<canvas id="hm-pagemap" width="64" height="64" role="img" aria-label="A fizikai memória térképe cím szerint"></canvas>' : '') + when + warn +
    `<p><button class="btn" data-pg="by">${hm.pageBy ? 'Lista szerint' : 'Használat szerint'}</button> <button class="btn" data-pg="again">Újra</button> <button class="btn" data-pg="back">Vissza</button></p>` +
    '<p class="dim">A hely véletlenszerű: a Windows szétszórja a lapokat, a mintázat nem jelent semmit. Program- és fájlnév nincs benne.</p>' + hmFooter(tag, 'SystemSuperfetchInformation (nem dokumentált), ETW-segéd · kérésre'));
  const box = $('panel');
  box.querySelectorAll('[data-pg]').forEach(b => { b.onclick = () => (b.dataset.pg === 'by' ? (hm.pageBy = hm.pageBy ? 0 : 1, hmPagesPaint()) : b.dataset.pg === 'again' ? hmPagesAsk() : hmShow({ id: 'market' })); });
  const cv = $('hm-pagemap');
  if (!cv) return;
  const g = cv.getContext('2d'), cells = hm.pageBy ? p.u : p.l;
  g.fillStyle = '#10181e'; g.fillRect(0, 0, 64, 64);
  for (let i = 0; i < cells.length; i++) {
    if (cells[i] === '.') continue;
    g.fillStyle = table[parseInt(cells[i], 16)][1];
    g.fillRect(i % 64, i >> 6, 1, 1);
  }
}
// the panel's wiring for the disks: who reads and writes this one, by ETW
function hmDiskEvent(d) { if (vw.id === 'homeland') { hm.diskIo = d; hm.etwOn = true; } }
function hmDiskTop(id) {
  const d = hm.diskIo;
  if (hm.scrub != null || !d || Date.now() - d.at > 5000) return [];
  return d.list.filter(x => x.disk === id).sort((a, b) => b.r + b.w - a.r - a.w).slice(0, 5);
}
function hmDiskOf(key) {
  const d = hm.diskIo;
  if (hm.scrub != null || !d || Date.now() - d.at > 5000) return null;
  const rows = d.list.filter(x => hmExeKey(x.exe) === key);
  return rows.length ? { r: rows.reduce((a, x) => a + x.r, 0), w: rows.reduce((a, x) => a + x.w, 0) } : null;
}
function hmPagesFixture() {
  let l = '', u = '';
  for (let i = 0; i < 4096; i++) { l += i < 40 ? '.' : '0126663266'[(i * 7 + (i >> 3)) % 10]; u += i < 40 ? '.' : '0121456701'[(i * 5 + (i >> 4)) % 10]; }
  const n = c => [...l].filter(x => x === c).length * 1024, m = c => [...u].filter(x => x === c).length * 1024;
  return { at: Date.now(), ms: 30, gran: 1024, seen: 4056 * 1024, lists: [...'01234567'].map(n), uses: [...'0123456789ab'].map(m), l, u };
}

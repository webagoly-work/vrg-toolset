// 10-query.js — the query bar's surfaces: the result list and the brackets around results on screen.
// The parser itself (runQuery) is in 09-ask.js, shared with the MCP server (core.js).

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
  bctx.lineWidth = 1.5 * dpr; bctx.strokeStyle = '#93d3e6'; bctx.fillStyle = '#93d3e6'; bctx.font = `${11 * dpr}px ui-monospace, Consolas, monospace`;
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

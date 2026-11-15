/* ================= the switchboard: tabs, hash links, keys, the frame loop */
const VIEWS = [Fly, Mine, Holo, Layers, Empty];
const App = {
  cur: null, ready: new Set(), labels: true,
  async show(key) {
    const v = VIEWS.find(x => x.key === key) || VIEWS[0];
    document.querySelectorAll('#tabs button').forEach(b => { const on = b.dataset.k === v.key; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    if (location.hash.slice(1) !== v.key) history.replaceState(null, '', '#' + v.key);
    UI.info.hidden = true; UI.showTip(0, 0, '');
    if (!this.ready.has(v.key)) {
      $('load').hidden = false; $('load-t').textContent = `${v.name} épül…`;
      await new Promise(r => setTimeout(r, 30));
      try { if (v === Empty && !this.ready.has('fly')) { $('load-t').textContent = 'Előbb a muslica-agy töltődik be…'; await Fly.init(); this.ready.add('fly'); }
        await v.init(); this.ready.add(v.key); }
      catch (e) { $('load-t').textContent = 'Hiba: ' + e.message; console.error(e); return; }
      $('load').hidden = true;
    }
    if (this.cur && this.cur.leave) this.cur.leave();
    this.cur = v; v.enter(); $('panel').scrollTop = 0; $('vt').textContent = v.name; this.peekKey = ''; Sheet.peek(true); $('rot').setAttribute('aria-pressed', !!R.cam.auto);
    if (Sheet.phone && R.cam.W < R.cam.H) R.cam.dist *= v === Mine || v === Empty ? 1.7 : 1.4;
    if (Sheet.phone && Sheet.state === 'full') Sheet.snap('half');
  },
};
/* ---------- phone layout: the panel is a bottom sheet with three heights; the view's key readout sits in its peek row */
const Sheet = {
  phone: false, state: 'peek',
  detect() {
    const w = innerWidth, coarse = matchMedia('(pointer: coarse)').matches, ph = w <= 760 || (coarse && w <= 1024);
    if (ph !== this.phone) {
      this.phone = ph; document.body.classList.toggle('phone', ph);
      if (ph) { App.labels = false; R.cam.pxMul = 0.8; } else { App.labels = true; R.cam.pxMul = 1; $('side').style.removeProperty('--sheet'); document.body.style.removeProperty('--sheet'); }
      $('lab').setAttribute('aria-pressed', App.labels);
    }
    if (ph) this.snap(this.state, true);
    R.resize();
  },
  heights() { const top = 52, tab = $('tabs').offsetHeight, avail = innerHeight - top - tab; return { peek: 92, half: Math.round(avail * 0.5), full: Math.round(avail - 8) }; },
  snap(st, quiet) {
    this.state = st; const h = this.heights()[st]; document.body.style.setProperty('--sheet', h + 'px'); $('side').style.setProperty('--sheet', h + 'px');
    $('grab').setAttribute('aria-expanded', st !== 'peek'); $('panel').hidden = st === 'peek';
    if (!quiet) setTimeout(() => R.resize(), 240); else R.resize();
  },
  peek(force) {
    if (!this.phone || !App.cur) return; const v = App.cur, p = v.peek ? v.peek() : { text: `<b>${esc(v.name)}</b>` };
    const key = p.text + '|' + (p.acts || []).map(a => a[0]).join(); if (!force && key === App.peekKey) return; App.peekKey = key;
    $('peek').innerHTML = `<div class="pt">${p.text}</div><div class="pa">${(p.acts || []).map((a, i) => `<button type="button" data-i="${i}" class="${a[2] ? 'pri' : ''}">${esc(a[0])}</button>`).join('')}</div>`;
    $('peek').onclick = e => { const b = e.target.closest('button[data-i]'); if (b) { p.acts[+b.dataset.i][1](); this.peek(true); } };
  },
};
(() => {
  const g = $('grab'); let y0 = 0, h0 = 0, moved = false;
  g.addEventListener('pointerdown', e => { g.setPointerCapture(e.pointerId); y0 = e.clientY; h0 = $('side').offsetHeight; moved = false; $('side').classList.add('drag'); });
  g.addEventListener('pointermove', e => { if (!g.hasPointerCapture(e.pointerId)) return; const d = y0 - e.clientY; if (Math.abs(d) > 6) moved = true; const H = Sheet.heights(), h = clamp(h0 + d, H.peek, H.full); document.body.style.setProperty('--sheet', h + 'px'); $('side').style.setProperty('--sheet', h + 'px'); $('panel').hidden = h < 120; });
  g.addEventListener('pointerup', e => {
    $('side').classList.remove('drag'); const H = Sheet.heights(), h = $('side').offsetHeight;
    if (!moved) return Sheet.snap(Sheet.state === 'peek' ? 'half' : 'peek');
    const st = ['peek', 'half', 'full'].reduce((b, k) => Math.abs(H[k] - h) < Math.abs(H[b] - h) ? k : b, 'peek'); Sheet.snap(st);
  });
  g.addEventListener('keydown', e => { if (e.key === 'ArrowUp') Sheet.snap(Sheet.state === 'peek' ? 'half' : 'full'); if (e.key === 'ArrowDown') Sheet.snap(Sheet.state === 'full' ? 'half' : 'peek'); });
})();
Input.onTap = (x, y, e) => App.cur && App.cur.tap && App.cur.tap(x, y, e);
Input.onHover = (x, y, e) => !Sheet.phone && App.cur && App.cur.hover && App.cur.hover(x, y, e);
Input.onDouble = () => App.cur && App.cur.enter && Object.assign(R.cam, { tgt: [0, 0, 0] });
document.getElementById('tabs').addEventListener('click', e => { const b = e.target.closest('button[data-k]'); if (b) App.show(b.dataset.k); });
window.addEventListener('hashchange', () => { const k = location.hash.slice(1); if (VIEWS.some(v => v.key === k) && (!App.cur || App.cur.key !== k)) App.show(k); });
window.addEventListener('keydown', e => {
  if (e.target.closest('input, textarea, select')) return;
  const n = +e.key; if (n >= 1 && n <= VIEWS.length) { App.show(VIEWS[n - 1].key); return; }
  const k = e.key.toLowerCase();
  if (App.cur === Holo && Holo.onKey(k)) return;
  if (k === 't') { App.labels = !App.labels; $('lab').setAttribute('aria-pressed', App.labels); }
  if (k === 'r') { R.cam.auto = R.cam.auto ? 0 : 0.06; $('rot').setAttribute('aria-pressed', !!R.cam.auto); }
  if (k === 'escape') UI.info.hidden = true;
});
$('lab').onclick = () => { App.labels = !App.labels; $('lab').setAttribute('aria-pressed', App.labels); };
$('rot').onclick = () => { R.cam.auto = R.cam.auto ? 0 : 0.06; $('rot').setAttribute('aria-pressed', !!R.cam.auto); };
$('fold').onclick = () => { const s = document.body.classList.toggle('folded'); $('fold').setAttribute('aria-expanded', !s); $('fold').textContent = s ? 'Vezérlők' : 'Elrejt'; R.resize(); };
Fly.showLabels = true;
window.addEventListener('resize', () => Sheet.detect());
Sheet.detect();
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now; const t = now / 1000, v = App.cur;
  if (v) {
    if (R.cam.auto && !reduce.matches) R.cam.yaw += R.cam.auto * dt * 4;
    v.frame(dt, t); R.draw(v, t);
    const c = R.ctx; c.clearRect(0, 0, R.ov.width, R.ov.height); if (App.labels && v.overlay) v.overlay(c);
    if ((App._pk = (App._pk || 0) + dt) > 0.4) { App._pk = 0; Sheet.peek(); }
  }
  requestAnimationFrame(loop);
}
if (!R.gl) { $('load-t').textContent = 'Ez a böngésző nem támogatja a WebGL-t, ezért a 3D nézetek nem jelennek meg.'; }
else { if (reduce.matches) { R.cam.auto = 0; $('rot').setAttribute('aria-pressed', false); } App.show((location.hash || '#fly').slice(1)); requestAnimationFrame(loop); }

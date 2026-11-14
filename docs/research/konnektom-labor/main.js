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
    this.cur = v; v.enter(); $('panel').scrollTop = 0;
  },
};
Input.onTap = (x, y, e) => App.cur && App.cur.tap && App.cur.tap(x, y, e);
Input.onHover = (x, y, e) => App.cur && App.cur.hover && App.cur.hover(x, y, e);
Input.onDouble = () => App.cur && App.cur.enter && Object.assign(R.cam, { tgt: [0, 0, 0] });
document.getElementById('tabs').addEventListener('click', e => { const b = e.target.closest('button[data-k]'); if (b) App.show(b.dataset.k); });
window.addEventListener('hashchange', () => { const k = location.hash.slice(1); if (VIEWS.some(v => v.key === k) && (!App.cur || App.cur.key !== k)) App.show(k); });
window.addEventListener('keydown', e => {
  if (e.target.closest('input, textarea, select')) return;
  const n = +e.key; if (n >= 1 && n <= VIEWS.length) { App.show(VIEWS[n - 1].key); return; }
  const k = e.key.toLowerCase();
  if (App.cur === Holo && Holo.onKey(k)) return;
  if (k === 't') { App.labels = !App.labels; $('lab').setAttribute('aria-pressed', App.labels); }
  if (k === 'r') R.cam.auto = R.cam.auto ? 0 : 0.06;
  if (k === 'escape') UI.info.hidden = true;
});
$('lab').onclick = () => { App.labels = !App.labels; $('lab').setAttribute('aria-pressed', App.labels); };
$('rot').onclick = () => { R.cam.auto = R.cam.auto ? 0 : 0.06; $('rot').setAttribute('aria-pressed', !!R.cam.auto); };
$('fold').onclick = () => { const s = document.body.classList.toggle('folded'); $('fold').setAttribute('aria-expanded', !s); $('fold').textContent = s ? 'Vezérlők' : 'Elrejt'; R.resize(); };
Fly.showLabels = true;
window.addEventListener('resize', () => R.resize());
R.resize();
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now; const t = now / 1000, v = App.cur;
  if (v) {
    if (R.cam.auto && !reduce.matches) R.cam.yaw += R.cam.auto * dt * 4;
    v.frame(dt, t); R.draw(v, t);
    const c = R.ctx; c.clearRect(0, 0, R.ov.width, R.ov.height); if (App.labels && v.overlay) v.overlay(c);
  }
  requestAnimationFrame(loop);
}
if (!R.gl) { $('load-t').textContent = 'Ez a böngésző nem támogatja a WebGL-t, ezért a 3D nézetek nem jelennek meg.'; }
else { App.show((location.hash || '#fly').slice(1)); requestAnimationFrame(loop); }

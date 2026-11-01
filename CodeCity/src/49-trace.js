// 49-trace.js — the Varler Console agent trace inside the city. A window on the relay's page (Console/tools/trace-relay.js,
// 127.0.0.1:8134): the graph, approvals and replay live there, redaction included, and nothing crosses into the city.
// Touched files already light their buildings through the Kódváros hook and the beams (23-agents).

const KV_TRACE_URL = 'http://127.0.0.1:8134/';
const kvTrace = { el: null, open: false };

function kvTraceBuild() {
  const box = document.createElement('aside');
  box.id = 'trace-win';
  box.hidden = true;
  const head = document.createElement('header');
  const name = document.createElement('b');
  name.textContent = 'Ügynöknyom';
  const close = document.createElement('button');
  close.className = 'btn';
  close.textContent = 'Bezárás';
  close.onclick = () => kvTraceToggle(false);
  head.append(name, close);
  const body = document.createElement('div');
  body.className = 'trace-body';
  box.append(head, body);
  document.getElementById('stage').append(box);
  kvTrace.el = box;
  kvTrace.body = body;
}

async function kvTraceToggle(on) {
  if (!kvTrace.el) kvTraceBuild();
  kvTrace.open = on;
  kvTrace.el.hidden = !on;
  if (!on) { kvTrace.body.replaceChildren(); return; }
  try {
    await fetch(KV_TRACE_URL, { mode: 'no-cors', cache: 'no-store' });
    const f = document.createElement('iframe');
    f.src = KV_TRACE_URL;
    f.title = 'Ügynöknyom';
    kvTrace.body.replaceChildren(f);
  } catch (e) {
    const p = document.createElement('p');
    p.textContent = 'A közvetítő nem fut. Indítsd: START → O → R (Ügynöknyom közvetítő).';
    kvTrace.body.replaceChildren(p);
  }
}

(function kvTraceButton() {
  const before = document.getElementById('dock-btn');
  if (!before) return;
  const b = document.createElement('button');
  b.id = 'trace-btn';
  b.className = 'btn';
  b.textContent = 'Ügynöknyom';
  b.title = 'Az ügynökök hívásai gráfként: élőben vagy visszajátszva (Varler Console)';
  b.onclick = () => kvTraceToggle(!kvTrace.open);
  before.before(b);
})();

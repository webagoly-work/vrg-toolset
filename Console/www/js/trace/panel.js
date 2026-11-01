/* The whole trace screen; the Console page and the standalone build both mount this.
   host: { get(key), set(key, value), names(), storage?, code? } */
import { t } from '../core/i18n.js';
import { formatDateTime, formatNumber, formatUnit } from '../core/format.js';
import { h } from '../ui/dom.js';
import { parseJsonl } from './events.js';
import { apply, createTrace, fold, METRICS, visible } from './model.js';
import { emptyCounts, scrubEvent } from './privacy.js';
import { SAMPLE_EVENTS } from './sample.js';
import { hookSource, managedSource } from './sources.js';
import { createTraceView, labelOf } from './view.js';

const MAX_EVENTS = 20000;
const DRAW_MS = 250;
const TICK_MS = 2000;
const STEP_MS = 160;
const SPEEDS = [1, 4, 16];
const WINDOWS = [0, 5, 15, 60];
const TYPES = ['agent', 'skill', 'mcp', 'tool', 'file'];
const KEEP = [1, 7, 14, 30];
const LIST_MAX = 14;

const field = (label, control) => h('label.field', {}, h('span.k', { text: label }), control);
const select = (label, options, value, onchange) => field(label, h('select.input', { onchange: (e) => onchange(e.target.value) },
  options.map((o) => h('option', { value: o.value, text: o.label, selected: String(o.value) === String(value) }))));
const button = (label, onclick, extra = '') => h('button.btn' + extra, { type: 'button', text: label, onclick });

export function mountTrace(root, host) {
  const S = {
    sourceId: host.get('source') ?? 'replay', source: null, status: 'off', sessions: new Map(), sid: null, paused: false, playing: false, speed: 4,
    metric: host.get('metric') ?? 'calls', agent: '', type: '', windowMs: 0, selected: null, zoom: 1, tally: emptyCounts(), keepDays: host.get('keepDays') ?? 14, saved: [],
  };
  let drawTimer = null;
  let playTimer = null;
  let saveTimer = null;
  let view = null;

  const session = (sid) => {
    if (!S.sessions.has(sid)) S.sessions.set(sid, { sid, events: [], upto: 0, trace: createTrace() });
    return S.sessions.get(sid);
  };
  const current = () => S.sessions.get(S.sid) ?? null;

  /* everything enters here, scrubbed before it is kept or drawn */
  function ingest(ev, { live = false } = {}) {
    const clean = scrubEvent(ev, host.names(), S.tally);
    const s = session(clean.sid || '-');
    if (s.events.length >= MAX_EVENTS) return;
    s.events.push(clean);
    S.sid ??= s.sid;
    if (live && !S.paused) {
      s.upto = s.events.length;
      apply(s.trace, clean);
    }
    if (live) saveSoon(s);
    drawSoon();
  }

  function saveSoon(s) {
    if (!host.storage) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => host.storage.save(s.sid, s.events), 1000);
  }

  function seek(n) {
    const s = current();
    if (!s) return;
    const to = Math.max(0, Math.min(s.events.length, n));
    if (to < s.upto) {
      s.trace = fold(s.events, to);
    } else {
      for (let i = s.upto; i < to; i++) apply(s.trace, s.events[i]);
    }
    s.upto = to;
    drawSoon();
  }

  function setPlaying(on) {
    S.playing = on;
    clearInterval(playTimer);
    if (on) {
      const s = current();
      if (s && s.upto >= s.events.length) seek(0);
      playTimer = setInterval(() => {
        const c = current();
        if (!c || c.upto >= c.events.length) { setPlaying(false); return; }
        seek(c.upto + S.speed);
      }, STEP_MS);
    }
    paint();
  }

  function setPaused(on) {
    S.paused = on;
    if (!on) seek(current()?.events.length ?? 0);
    paint();
  }

  function connect(code) {
    S.source?.stop();
    const hostName = host.get('host') ?? '127.0.0.1';
    const port = host.get('port') ?? '8134';
    S.source = S.sourceId === 'managed' ? managedSource() : hookSource({ host: hostName, port, code });
    S.source.start((ev) => ingest(ev, { live: true }), (status) => {
      S.status = status;
      if (status === 'on') refreshSaved();
      paint();
    });
  }

  function disconnect() {
    S.source?.stop();
    S.source = null;
    S.status = 'off';
    paint();
  }

  async function refreshSaved() {
    const local = (await host.storage?.list()) ?? [];
    const remote = S.status === 'on' ? await S.source.sessions().catch(() => []) : [];
    S.saved = [...local.map((x) => ({ ...x, from: 'local' })), ...remote.map((x) => ({ ...x, from: 'relay' }))];
    paint();
  }

  function loadEvents(events) {
    if (!events.length) return false;
    S.sessions.delete(events[0].sid);
    S.sid = null;
    for (const ev of events) ingest(ev);
    S.sid = events[0].sid;
    S.selected = null;
    setPlaying(true);
    return true;
  }

  async function openSaved(item) {
    if (item.from === 'relay') loadEvents(parseJsonl(await S.source.load(item.id)));
    else loadEvents(await host.storage.load(item.id));
  }

  function setRetention(days) {
    S.keepDays = Number(days);
    host.set('keepDays', S.keepDays);
    host.storage?.prune(S.keepDays).then(refreshSaved);
    if (S.status === 'on') S.source.retention(S.keepDays).catch(() => {});
  }

  /* ---- the fixed parts of the screen ---- */
  const status = h('span.chip', { role: 'status' });
  const redacted = h('p.hint', { role: 'status' });
  const sourceBox = h('div');
  const replayBox = h('div');
  const notice = h('p.attn', { role: 'alert' });
  const pendingBox = h('div');
  const graph = h('div.trace-graph');
  const position = h('p.hint');
  const scrubber = h('input.range', { type: 'range', min: 0, max: 0, value: 0, 'aria-label': t('trace.timeline'), oninput: (e) => { setPlaying(false); if (S.source) S.paused = true; seek(Number(e.target.value)); } });
  const playButton = button(t('trace.play'), () => setPlaying(!S.playing));
  const pauseButton = button(t('trace.pause'), () => setPaused(!S.paused));
  const sessionBox = h('div');
  const agentBox = h('div');
  const listBox = h('div');
  const detailBox = h('div');
  const promptBox = h('div');
  const fileInput = h('input', {
    type: 'file', accept: '.jsonl,.json,text/plain', hidden: true,
    onchange: async (e) => {
      const f = e.target.files[0];
      e.target.value = '';
      if (f && !loadEvents(parseJsonl(await f.text()))) notice.textContent = t('trace.badFile');
    },
  });

  function paintSource() {
    const live = S.sourceId === 'hooks';
    const on = S.status === 'on';
    const code = h('input.input', { type: 'password', autocomplete: 'off', value: host.code ?? '' });
    const hostField = h('input.input', { type: 'text', value: host.get('host') ?? '127.0.0.1', onchange: (e) => host.set('host', e.target.value.trim()) });
    const portField = h('input.input', { type: 'text', inputMode: 'numeric', value: host.get('port') ?? '8134', onchange: (e) => host.set('port', e.target.value.trim()) });
    const sources = ['hooks', 'managed', 'replay'].map((value) => ({ value, label: t('trace.src.' + value) }));
    sourceBox.replaceChildren(
      select(t('trace.source'), sources, S.sourceId, (v) => {
        S.sourceId = v;
        host.set('source', v);
        disconnect();
        if (v === 'managed') connect('');
      }),
      S.sourceId === 'managed' ? h('p.hint', { text: t('trace.managedHint') }) : '',
      live && !on ? h('div.form', {}, field(t('trace.host'), hostField), field(t('trace.port'), portField), field(t('trace.code'), code), h('p.hint', { text: t('trace.codeHint') })) : '',
      live ? button(t(on ? 'trace.disconnect' : 'trace.connect'), () => (on ? disconnect() : connect(code.value.trim())), '.primary') : '',
    );
    replayBox.replaceChildren(
      h('div.btn-row', {}, button(t('trace.loadFile'), () => fileInput.click()), button(t('trace.sample'), () => loadEvents(SAMPLE_EVENTS))),
      S.saved.length ? h('div', {}, h('span.k', { text: t('trace.loadSaved') }), S.saved.slice(0, 10).map((x) => button(`${x.id} · ${formatDateTime(x.updatedAt)}`, () => openSaved(x)))) : '',
    );
  }

  function paintPending(s) {
    const items = s ? [...s.trace.pending.values()] : [];
    const canAnswer = S.status === 'on' && S.source?.can.answer;
    pendingBox.replaceChildren(...(items.length ? [h('section.panel', {}, h('div.ph', {}, h('h2', { text: t('trace.pending') })), h('div.pb', {},
      items.map((p) => {
        const note = h('textarea.input', { rows: 2, 'aria-label': t('trace.answer'), placeholder: t('trace.answer') });
        const reply = (decision) => S.source.answer(p.callId, decision, note.value.trim()).catch(() => { notice.textContent = t('trace.sendFailed'); });
        return h('div.pend', {},
          h('b', { text: p.tool }), h('code', { text: p.text ?? '' }),
          canAnswer ? note : '',
          canAnswer ? h('div.btn-row', {}, button(t('trace.approve'), () => reply('allow'), '.primary'), button(t('trace.deny'), () => reply('deny'), '.danger')) : '');
      }),
      h('p.hint', { text: t('trace.answerHint') })))] : []));
  }

  function paintDetail(s) {
    const n = s && S.selected ? s.trace.nodes.get(S.selected) : null;
    if (!n) { detailBox.replaceChildren(); return; }
    const row = (k, v) => h('div.result', {}, h('span.k', { text: k }), h('b', { text: v }));
    detailBox.replaceChildren(h('section.panel', {}, h('div.ph', {}, h('h2', { text: labelOf(n) })), h('div.pb', {},
      row(t('trace.calls'), formatNumber(n.calls)),
      row(t('trace.tokens'), formatNumber(n.tokens)),
      row(t('trace.time'), formatUnit(n.ms / 1000, 's', 1)),
      row(t('trace.errors'), formatNumber(n.errors)),
      row(t('trace.first'), formatDateTime(n.firstAt)),
      h('span.k', { text: t('trace.io') }),
      n.io.length ? n.io.slice().reverse().map((io) => h('div.pend', {},
        io.text ? h('p', {}, h('b', { text: t('trace.in') + ' ' }), io.text) : '',
        io.output ? h('p', {}, h('b', { text: t('trace.out') + ' ' }), io.output) : '',
        io.error ? h('p.attn', { text: io.error }) : '')) : h('p.hint', { text: t('trace.noIo') }),
      button(t('trace.close'), () => pick(null)))));
  }

  function pick(id) {
    S.selected = id;
    paint();
  }

  function paintList(s, picture, warmth) {
    if (!s) { listBox.replaceChildren(); return; }
    const rows = picture.nodes.filter((n) => n.id !== 'root').sort((a, b) => (warmth.get(b.id) ?? 0) - (warmth.get(a.id) ?? 0) || b.calls - a.calls).slice(0, LIST_MAX);
    listBox.replaceChildren(...(rows.length ? rows.map((n) => h('div.lrow', {}, h('button.lmain', { type: 'button', onclick: () => pick(n.id) },
      h('b', { text: labelOf(n) }),
      h('small', { text: t('trace.nodeSub', { type: t('trace.t.' + n.type), calls: formatNumber(n.calls) }) })),
    n.errors ? h('span.chip.st-warn', { text: formatNumber(n.errors) }) : '')) : [h('p.hint', { text: t('trace.noMatch') })]));
  }

  function draw() {
    drawTimer = null;
    const s = current();
    const now = s?.trace.clock ?? 0;
    const opts = { agent: S.agent, type: S.type, windowMs: S.windowMs };
    const picture = s ? visible(s.trace, opts, now) : { nodes: [], edges: [] };
    const pending = s ? [...s.trace.pending.values()] : [];
    view.setZoom(S.zoom);
    const warmth = view.render({ ...picture, metric: S.metric, now, selected: S.selected, pending });
    if (s) {
      scrubber.max = s.events.length;
      scrubber.value = s.upto;
      position.textContent = t('trace.position', { n: formatNumber(s.upto), total: formatNumber(s.events.length) })
        + (S.paused && s.upto < s.events.length ? ' · ' + t('trace.buffered', { n: formatNumber(s.events.length - s.upto) }) : '');
    } else position.textContent = t('trace.noSession');
    notice.textContent = s?.trace.notice ? t('trace.notice', { text: s.trace.notice.text ?? '' }) : '';
    const c = S.tally;
    redacted.textContent = t('trace.redacted', { names: formatNumber(c.names), contact: formatNumber(c.contact), address: formatNumber(c.address), secret: formatNumber(c.secret), path: formatNumber(c.path) });
    paintPending(s);
    paintList(s, picture, warmth);
    paintDetail(s);
    /* agent options depend on the data */
    const agents = s ? [...s.trace.agents] : [];
    const key = agents.join();
    if (agentBox.dataset.key !== key) {
      agentBox.dataset.key = key;
      agentBox.replaceChildren(select(t('trace.filter.agent'), [{ value: '', label: t('trace.all') }, ...agents.map((a) => ({ value: a, label: s.trace.nodes.get(a).label }))], S.agent, (v) => { S.agent = v; drawSoon(); }));
    }
    const sids = [...S.sessions.keys()];
    if (sessionBox.dataset.key !== sids.join()) {
      sessionBox.dataset.key = sids.join();
      sessionBox.replaceChildren(sids.length > 1 ? select(t('trace.session'), sids.map((v) => ({ value: v, label: v })), S.sid, (v) => { S.sid = v; S.selected = null; drawSoon(); }) : '');
    }
  }

  function drawSoon() {
    drawTimer ??= setTimeout(draw, DRAW_MS);
  }

  function paint() {
    status.textContent = t('trace.st.' + S.status);
    status.classList.toggle('on', S.status === 'on');
    playButton.textContent = t(S.playing ? 'trace.pause' : 'trace.play');
    pauseButton.textContent = t(S.paused ? 'trace.resume' : 'trace.pause');
    pauseButton.hidden = S.status !== 'on';
    const canPrompt = S.status === 'on' && S.source?.can.prompt && current();
    promptBox.hidden = !canPrompt;
    paintSource();
    drawSoon();
  }

  /* ---- build ---- */
  const typeOptions = [{ value: '', label: t('trace.all') }, ...TYPES.map((value) => ({ value, label: t('trace.t.' + value) }))];
  const windowOptions = WINDOWS.map((value) => ({ value, label: value ? t('trace.minutes', { n: formatNumber(value) }) : t('trace.all') }));
  const metricOptions = METRICS.map((value) => ({ value, label: t('trace.m.' + value) }));
  const promptText = h('textarea.input', { rows: 2, 'aria-label': t('trace.prompt'), placeholder: t('trace.prompt') });
  const promptNote = h('p.hint', { role: 'status' });
  promptBox.append(h('section.panel', {}, h('div.ph', {}, h('h2', { text: t('trace.prompt') })), h('div.pb', {}, promptText, promptNote,
    button(t('trace.send'), async () => {
      const text = promptText.value.trim();
      if (!text) { promptText.focus(); return; }
      const r = await S.source.prompt(S.sid, text).catch(() => null);
      if (r?.ok) promptText.value = '';
      promptNote.textContent = t(r?.ok ? 'trace.sent' : 'trace.sendFailed');
    }, '.primary'))));

  root.append(h('div.wrap', {},
    h('section.panel', {}, h('div.ph', {}, h('h2', { text: t('trace.title') }), status), h('div.pb', {}, sourceBox, replayBox, fileInput, sessionBox,
      h('p', {}, h('span.chip.on', { text: t('trace.redaction') })), redacted, h('p.hint', { text: t('trace.redactionHint') }))),
    notice, pendingBox,
    h('section.panel', {}, h('div.pb', {}, graph,
      h('div.btn-row', {}, button(t('trace.zoomOut'), () => { S.zoom = Math.max(1, S.zoom / 1.5); drawSoon(); }), button(t('trace.zoomIn'), () => { S.zoom = Math.min(5, S.zoom * 1.5); drawSoon(); })),
      field(t('trace.timeline'), scrubber), position,
      h('div.btn-row', {}, playButton, pauseButton),
      select(t('trace.speed'), SPEEDS.map((v) => ({ value: v, label: t('trace.times', { n: formatNumber(v) }) })), S.speed, (v) => { S.speed = Number(v); }))),
    h('section.panel', {}, h('div.ph', {}, h('h2', { text: t('trace.nodes') })), h('div.pb', {},
      select(t('trace.metric'), metricOptions, S.metric, (v) => { S.metric = v; host.set('metric', v); drawSoon(); }),
      agentBox,
      select(t('trace.filter.type'), typeOptions, '', (v) => { S.type = v; drawSoon(); }),
      select(t('trace.filter.window'), windowOptions, 0, (v) => { S.windowMs = Number(v) * 60000; drawSoon(); }),
      listBox)),
    detailBox, promptBox,
    h('section.panel', {}, h('div.pb', {}, select(t('trace.retention'), KEEP.map((v) => ({ value: v, label: t('trace.days', { n: formatNumber(v) }) })), S.keepDays, setRetention)))));

  view = createTraceView(graph, { onPick: pick });
  paint();
  refreshSaved();
  host.storage?.prune(S.keepDays);
  if (S.sourceId === 'managed') connect('');
  if (S.sourceId === 'hooks' && host.code) connect(host.code);
  const tick = setInterval(() => { if (S.status === 'on') drawSoon(); }, TICK_MS);

  return () => {
    clearInterval(tick);
    clearInterval(playTimer);
    clearTimeout(drawTimer);
    clearTimeout(saveTimer);
    S.source?.stop();
  };
}

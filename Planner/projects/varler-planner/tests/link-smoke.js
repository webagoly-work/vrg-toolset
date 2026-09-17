// link-smoke.js — protocol engine harness for src/07a-link.js
//
//   node tests/link-smoke.js
//
// Not wired into tests/run.js — this stubs a socket and the globals 07a-link
// reads (state, TOOLKEYS, HINTS, PLANNER_CAM) rather than booting the app.
// Everything here is jsdom-free on purpose.

const path = require('path');
const fs = require('fs');

const SRC = path.join(__dirname, '..', 'src', '07a-link.js');

global.window = {};
global.VERSION = '2.0.0';

const evts = [];
global.document = { dispatchEvent: e => evts.push(e), addEventListener() {} };
global.KeyboardEvent = function (t, o) { Object.assign(this, o, { type: t }); };

global.state = {
  mode: 'select', active: 'ground', freeHeight: 1200,
  pathType: 20, cableType: '3x1.5', side: 0, flat: false
};
global.TOOLKEYS = ['select', 'grab', 'device', 'cable', 'wall', 'build', 'object', 'floor', 'roof', 'format'];
global.HINTS = {
  select: 'Select…', grab: 'Grab…', device: 'Device…', cable: 'Cable…', wall: 'Wall…',
  build: 'Build…', object: 'Object…', floor: 'Floor…', roof: 'Roof…', format: 'Format…',
  path: 'Path…', measure: 'Measure…', note: 'Note…'
};

let sent = [];
global.WebSocket = function (u) {
  this.url = u; this.readyState = 1;
  global.__ws = this;
  this.send = s => sent.push(JSON.parse(s));
  this.close = () => {};
  setTimeout(() => this.onopen && this.onopen(), 0);
};

eval(fs.readFileSync(SRC, 'utf8'));
const L = global.window.PLANNER_LINK;

const A = [];
const t = (name, cond) => A.push((cond ? 'PASS  ' : 'FAIL  ') + name);
const feed = raw => global.__ws.onmessage({ data: raw });

// ---- tool table -----------------------------------------------------------
const tt = L.toolTable();
t('tool table covers all 13 modes', tt.length === 13);
t('numbered tools keep their key', tt.find(x => x.mode === 'device').key === '3');
t('format has no key (10th slot)', tt.find(x => x.mode === 'format').key === null);
t('path present with no key', tt.find(x => x.mode === 'path') && tt.find(x => x.mode === 'path').key === null);

L.connect('ws://test');

setTimeout(() => {
  const hello = sent.find(m => m.type === 'hello');
  t('sends hello on open', !!hello);
  t('hello declares role planner', hello.payload.role === 'planner');
  t('hello carries caps', hello.payload.caps.indexOf('state') >= 0);
  t('hello carries tool table', hello.payload.tools.length === 13);
  t('envelope has v/from/seq/t', hello.v === 1 && hello.from === 'planner' && hello.seq > 0 && hello.t > 0);

  // ---- echo guard ---------------------------------------------------------
  global.window.PLANNER_CAM = { undo() { throw new Error('undo ran on our own echo'); } };
  let echoed = false;
  try { feed(JSON.stringify({ v: 1, from: 'planner', type: 'cmd', payload: { id: 'edit.undo' } })); }
  catch (e) { echoed = true; }
  t('ignores its own echo', !echoed);

  // ---- legacy one-way client: no hello, bare message ----------------------
  sent = [];
  let got = null;
  L.on('orientation', p => { got = p; });
  feed(JSON.stringify({ type: 'orientation', pitch: 41, yaw: 101 }));
  t('legacy bare message reaches handlers', got && got.pitch === 41);
  t('no state pushed to a peer that never said hello', !sent.some(m => m.type === 'state'));

  // ---- phone says hello with the state capability -------------------------
  sent = [];
  feed(JSON.stringify({ v: 1, from: 'phone', type: 'hello', payload: { role: 'phone', app: '2.0', caps: ['state', 'cmd'] } }));
  t('peer capabilities recorded', L.peerWants('state') === true);

  setTimeout(() => {
    t('full snapshot sent on handshake', sent.some(m => m.type === 'state' && m.payload.mode === 'select'));

    // ---- semantic command -------------------------------------------------
    sent = [];
    let picked = null;
    global.window.PLANNER_CAM = { selectTool: (i, k) => { picked = [i, k]; return true; } };
    feed(JSON.stringify({ v: 1, from: 'phone', type: 'cmd', payload: { id: 'tool.select', index: 4, key: '5' } }));
    t('semantic command dispatched', picked && picked[0] === 4);
    t('acked ok', sent.some(m => m.type === 'ack' && m.payload.ok === true));

    sent = [];
    feed(JSON.stringify({ v: 1, from: 'phone', type: 'cmd', payload: { id: 'nope.nothing' } }));
    t('unknown command nacked', sent.some(m => m.type === 'ack' && m.payload.ok === false));

    // ---- keystroke escape hatch -------------------------------------------
    evts.length = 0;
    feed(JSON.stringify({ v: 1, from: 'phone', type: 'keys', payload: { key: 'z', ctrl: true } }));
    t('keys escape hatch dispatches', evts.length === 1 && evts[0].key === 'z' && evts[0].ctrlKey === true);

    // ---- state only on change, coalesced ----------------------------------
    sent = [];
    L.pushState(false); L.pushState(false); L.pushState(false);
    setTimeout(() => {
      t('unchanged state sends nothing', sent.filter(m => m.type === 'state').length === 0);
      state.mode = 'wall';
      L.pushState(false); L.pushState(false); L.pushState(false);
      setTimeout(() => {
        const st = sent.filter(m => m.type === 'state');
        t('changed state sends exactly once (coalesced)', st.length === 1);
        t('snapshot reflects new mode', st[0].payload.mode === 'wall');

        // ---- state.request ---------------------------------------------------
        sent = [];
        feed(JSON.stringify({ v: 1, from: 'phone', type: 'state.request', payload: {} }));
        setTimeout(() => {
          t('state.request answered', sent.some(m => m.type === 'state'));

          console.log(A.join('\n'));
          const pass = A.filter(x => x[0] === 'P').length;
          console.log('\n' + pass + '/' + A.length + ' passed');
          process.exit(pass === A.length ? 0 : 1);
        }, 200);
      }, 260);
    }, 160);
  }, 30);
}, 20);

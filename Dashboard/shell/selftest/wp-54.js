// WP-54 probe (real Electron, the fake engine via VRG_VOICE_ENGINE=fake, the real microphone path where the machine has one):
// voice.js is loaded, F9 is the key, the 🎤 button sits on the Vezérlő; simulate() writes into the Vezérlő's box and fires its input
// event; Shift = command; the IPC door refuses a bad session id and an over-long chunk; with the fake engine a real start → chunk → stop
// round trip gives the script text. Written by a cloud session without Electron: it has not run yet (handoff, step on WP-54).
// The real-microphone checks (warm mic, capture = 'worklet' or 'script', key-down → first audio sent < 500 ms) are reported in `info`,
// not failed, because a CI machine may have no microphone.
'use strict';

module.exports = async function probe({ win }) {
  const errors = [], info = {};
  const W = win.desk.frame.webContents;
  const js = code => W.executeJavaScript(code, true);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const wait = async (f, ms = 8000) => { const end = Date.now() + ms; while (Date.now() < end) { try { if (await f()) return true; } catch (e) {} await sleep(100); } return false; };
  const old = process.env.VRG_VOICE_ENGINE;
  process.env.VRG_VOICE_ENGINE = 'fake';
  try {
    if (!(await wait(() => js(`!!(window.VRGDesk && window.VRGDesk.state().ready && window.VRGVoice)`), 12000))) return { ok: false, errors: ['VRGVoice is not on the frame page'] };
    const st = await js(`window.VRGVoice.state()`);
    if (st.key !== 'F9') errors.push('key: ' + st.key);
    // the Vezérlő with its 🎤
    await js(`window.VRGDesk.setLevel('dev'); window.VRGDesk.setView('desktop'); true`);
    const id = await js(`window.VRGFrame.open('controller', {})`);
    if (!(await wait(() => js(`!!document.querySelector('[data-pane][data-kind="controller"] [data-role="mic"]')`), 8000))) errors.push('no 🎤 on the Vezérlő');
    // simulate into the box: the words arrive, the pane's input handler sees them (its draft state follows)
    await js(`(() => { const t = document.querySelector('[data-pane][data-kind="controller"] [data-role="text"]'); t.value = ''; t.focus(); window.__ev = []; for (const k of ['start','partial','final','stop']) VRGVoice.on(k, d => __ev.push(k + ':' + d.mode)); return true; })()`);
    await js(`VRGVoice.simulate('GO MOBILE hol tartunk', 'dictate')`);
    const v = await js(`document.querySelector('[data-pane][data-kind="controller"] [data-role="text"]').value`);
    if (v !== 'GO MOBILE hol tartunk') errors.push('simulate wrote: ' + JSON.stringify(v));
    const draft = await js(`(window.VRGFrame.pane(${JSON.stringify(id)}) || {}).st && window.VRGFrame.pane(${JSON.stringify(id)}).st.draft`);
    if (draft !== 'GO MOBILE hol tartunk') errors.push('the Vezérlő did not see the input event: ' + JSON.stringify(draft));
    const ev = await js(`[...new Set(__ev)].join(',')`);
    if (ev !== 'start:dictate,partial:dictate,final:dictate,stop:dictate') errors.push('events: ' + ev);
    // the door
    const bad = await js(`window.vrg.call('voice', 'chunk', { id: '../x', data: 'AAAA' })`);
    if (!bad || bad.err !== 'bad-request') errors.push('bad id accepted: ' + JSON.stringify(bad));
    // a real round trip through main with the fake engine
    await js(`window.vrg.voice.enable(true)`);
    const s = await js(`window.vrg.voice.start('dictate', 'hu')`);
    if (!s || !/^v\d+$/.test(s.id)) errors.push('start: ' + JSON.stringify(s));
    else {
      const chunk = Buffer.alloc(3200 * 2).toString('base64');          // 200 ms of silence
      for (let i = 0; i < 6; i++) await js(`window.vrg.voice.chunk(${JSON.stringify(s.id)}, ${JSON.stringify(chunk)})`);
      const big = await js(`window.vrg.voice.chunk(${JSON.stringify(s.id)}, ${JSON.stringify(Buffer.alloc(70000).toString('base64'))})`);
      if (!big || big.ok !== false) errors.push('an over-long chunk was accepted');
      const f = await js(`window.vrg.voice.stop(${JSON.stringify(s.id)})`);
      if (!f || f.text !== 'Szia VRG, nyisd meg a Plannert') errors.push('stop: ' + JSON.stringify(f));
    }
    // the real microphone, reported only
    info.mic = await js(`(async () => { await VRGVoice.refresh(); await new Promise(r => setTimeout(r, 1500)); return VRGVoice.state(); })()`);
    await js(`window.vrg.voice.enable(false)`);
  } catch (e) { errors.push('probe error: ' + e.stack); }
  finally { if (old === undefined) delete process.env.VRG_VOICE_ENGINE; else process.env.VRG_VOICE_ENGINE = old; }
  return { ok: !errors.length, errors, info };
};

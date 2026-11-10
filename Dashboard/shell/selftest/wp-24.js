// WP-24 probe (real Electron, fake-claude, real node-pty): the chat pane opens; "Szia" gives 3 deltas, a tool line, then done with the cost line;
// a follow-up resumes the same session; the selection menu pick opens a thread with a chip and sends nothing until Enter; a hostile answer renders
// without onerror / script / javascript: links and a link click never navigates the frame; "Folytatás terminálban" starts fake-claude with
// `--resume|<session>` in a term pane. VRG_CLAUDE_BIN and FAKE_CLAUDE_LOG are set here only; the log lives under %TEMP%\VRG\desk-test-* (CONTRACT §4.9).
'use strict';
const fs = require('fs'), os = require('os'), path = require('path');

module.exports = async function probe({ win }) {
  const errors = [];
  const { frame, selMenu, web } = win.desk;
  const wc = frame.webContents;
  const js = code => wc.executeJavaScript(code, true);
  const wait = async (fn, ms) => {
    const end = Date.now() + ms;
    while (Date.now() < end) { if (await fn()) return true; await new Promise(r => setTimeout(r, 100)); }
    return false;
  };
  const oldBin = process.env.VRG_CLAUDE_BIN, oldLog = process.env.FAKE_CLAUDE_LOG;
  fs.mkdirSync(path.join(os.tmpdir(), 'VRG'), { recursive: true });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'VRG', 'desk-test-'));
  const logFile = path.join(tmp, 'claude.json');
  process.env.VRG_CLAUDE_BIN = path.join(__dirname, '..', '..', 'test', 'fixtures', 'fake-claude.js');
  process.env.FAKE_CLAUDE_LOG = logFile;
  const readLog = () => { try { return JSON.parse(fs.readFileSync(logFile, 'utf8')); } catch (e) { return null; } };

  const Q = `document.querySelector('[data-kind="chat"]')`;
  const asst = `[...${Q}.querySelectorAll('[data-role="msg"][data-who="assistant"]')]`;
  // type text into the input and press Enter
  const type = text => js(`(() => { const i = ${Q}.querySelector('[data-role="input"]'); i.value = ${JSON.stringify(text)};
    i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })); return true; })()`);
  const shape = () => js(`${asst}.map(m => m.dataset.deltas + '/' + !!m.querySelector('[data-role="cost"]')).join(',') + ' ' +
    JSON.stringify([...window.VRGFrame.pane(window.VRGFrame.panes().find(p => /^chat-/.test(p))).threads.values()].filter(t => t.msgs.length).map(t => t.msgs.map(m => m.parts || m.text)))`);
  const lastDone = n => js(`(() => { const a = ${asst}; const m = a[a.length - 1]; return !!m && m.dataset.deltas === '3' && !!m.querySelector('[data-role="cost"]') && a.length === ${n}; })()`);

  try {
    // ---- open the pane (the selftest home keeps the layout and chats.json between runs: close old chat panes, count old threads)
    await js(`window.VRGFrame.panes().filter(p => /^chat-/.test(p)).forEach(p => window.VRGFrame.close(p))`);
    await wait(() => js(`!document.querySelector('[data-kind="chat"]')`), 3000);
    const base = ((await js(`window.vrg.chat.list()`)) || { chats: [] }).chats.length;
    const id = await js(`window.VRGFrame.open('chat', {})`);
    if (!/^chat-\d+$/.test(id)) errors.push('chat pane id: ' + JSON.stringify(id));
    if (!(await wait(() => js(`!!${Q} && !!${Q}.querySelector('[data-role="input"]')`), 8000))) { errors.push('chat pane did not mount'); return { ok: false, errors }; }
    const libsOk = await wait(() => js(`!!(window.DOMPurify && window.markdownit)`), 8000);
    if (!libsOk) errors.push('markdown-it / DOMPurify did not load');
    const labels = await js(`[...${Q}.querySelectorAll('button')].map(b => b.textContent).join('|')`);
    for (const l of ['Új beszélgetés', 'Küldés', 'Megállítás', 'Másolás', 'Folytatás terminálban', 'csak olvasás']) if (!labels.includes(l)) errors.push('missing button text: ' + l + ' in ' + labels);

    // ---- "Szia": 3 deltas, a tool line, done + cost
    await type('Szia');
    if (!(await wait(() => lastDone(1), 15000))) errors.push('no answer with 3 deltas and a cost line: ' + await shape());
    else {
      const txt = await js(`${asst}[0].innerText`);
      if (!/Szia/.test(txt) || !/second chunk\./.test(txt) || !/third chunk\./.test(txt)) errors.push('answer text: ' + JSON.stringify(txt));
      if (!/Read: demo.txt/.test(txt)) errors.push("no tool line \"Read: demo.txt\" (DESK-Q64 B: the target): " + JSON.stringify(txt));
      if (!/Költség: \$0\.0123/.test(txt)) errors.push('no cost line: ' + JSON.stringify(txt));
    }
    const list1 = await js(`window.vrg.chat.list()`);
    const t1 = list1 && list1.chats && list1.chats[0];
    if (!t1 || t1.session !== 'sess-demo-1') errors.push('thread session after the first answer: ' + JSON.stringify(t1));
    const termEnabled = await js(`!${Q}.querySelector('[data-role="to-term"]').disabled`);
    if (!termEnabled) errors.push('"Folytatás terminálban" is not enabled after done');

    // ---- follow-up: same session, --resume on the command line
    await type('Mi újság?');
    if (!(await wait(() => lastDone(2), 15000))) errors.push('no second answer: ' + await js(`${Q}.innerText.slice(0, 400)`));
    const log2 = readLog();
    const ri = log2 ? log2.argv.indexOf('--resume') : -1;
    if (ri < 0 || log2.argv[ri + 1] !== 'sess-demo-1') errors.push('follow-up argv has no --resume sess-demo-1: ' + JSON.stringify(log2 && log2.argv));
    if (log2 && !/^Mi újság\?$/.test(log2.stdin)) errors.push('follow-up stdin: ' + JSON.stringify(log2.stdin));
    const list2 = await js(`window.vrg.chat.list()`);
    if (!list2 || list2.chats.length !== base + 1 || list2.chats[0].session !== 'sess-demo-1') errors.push('follow-up made a new thread or changed the session: ' + JSON.stringify(list2));

    // ---- selection menu → new thread with a chip, nothing sent until Enter
    selMenu.pick('chat', 'Demo kijelölés');
    if (!(await wait(() => js(`!!${Q}.querySelector('[data-role="chips"] [data-kind="sel"]')`), 8000))) errors.push('no selection chip after sel.pick chat');
    else {
      const focused = await js(`document.activeElement === ${Q}.querySelector('[data-role="input"]')`);
      if (!focused) errors.push('the input is not focused after sel.pick chat');
      await new Promise(r => setTimeout(r, 400));
      const l = await js(`window.vrg.chat.list()`);
      if (l.chats.length !== base + 1) errors.push('sel.pick chat sent something: ' + l.chats.length + ' threads, wanted ' + (base + 1));
      const empty = await js(`${asst}.length === 0`);
      if (!empty) errors.push('the draft thread still shows the old messages');
      await type('Kérdés');
      if (!(await wait(() => lastDone(1), 15000))) errors.push('no answer for the selection thread');
      const lg = readLog();
      if (!lg || !String(lg.stdin).startsWith('<selection>Demo kijelölés</selection>')) errors.push('stdin has no selection first: ' + JSON.stringify(lg && lg.stdin));
      const chipsLeft = await js(`${Q}.querySelectorAll('[data-role="chips"] [data-kind]').length`);
      if (chipsLeft !== 0) errors.push('chips stay after sending: ' + chipsLeft);
    }

    // ---- a hostile answer: the echo is the first 20 chars of the prompt, so the "delta" is  <img src=x onerror=1
    await js(`${Q}.querySelector('[data-role="new"]').click()`);
    await type('<img src=x onerror=1');
    if (!(await wait(() => lastDone(1), 15000))) errors.push('no answer for the hostile prompt');
    else {
      const bad = await js(`${Q}.querySelectorAll('[onerror], img, script, iframe').length`);
      if (bad) errors.push('hostile delta left ' + bad + ' dangerous elements');
      const shown = await js(`${asst}[0].innerText`);
      if (!/onerror=1/.test(shown)) errors.push('the hostile text is not shown as text: ' + JSON.stringify(shown));
    }
    // the real sanitizer on 6 hostile snippets with the pane's config, and the full render path with a link
    const r = await js(`(() => {
      const cfg = window.VRGPanes.chat.helpers.SANITIZE_CONFIG;
      const snippets = ['<img src=x onerror=alert(1)>', '<script>window.__x=1</script>', '<iframe src="https://example.com"></iframe>',
        '<a href="javascript:alert(1)" onclick="window.__x=2">k</a>', '<svg onload=alert(1)><circle/></svg>', '<p onmouseover="alert(1)" style="x:y">t</p><form action="x"><input></form>'];
      const out = snippets.map(s => window.DOMPurify.sanitize(s, cfg));
      const inst = window.VRGFrame.pane('chat-1');
      const box = document.createElement('div'); box.dataset.role = 'probe-render';
      inst.render('<img src=x onerror=alert(1)>\\n\\n[bad](javascript:alert(1)) [ok](http://127.0.0.1:9/x)', box);
      inst.msgs.append(box);
      return { out, rendered: box.innerHTML, x: window.__x === undefined };
    })()`);
    for (const o of r.out) if (/<script|<iframe|<img|<svg|<form|<input|on[a-z]+\s*=|javascript:|style=/i.test(o)) errors.push('sanitizer left: ' + o);
    if (!r.x) errors.push('a hostile snippet ran script');
    if (/onerror\s*=\s*alert[^&]*>|<img/i.test(r.rendered) || /href="javascript/i.test(r.rendered)) errors.push('render path: ' + r.rendered);
    if (!/<a href="http:\/\/127\.0\.0\.1:9\/x"/.test(r.rendered)) errors.push('render path lost the http link: ' + r.rendered);

    // ---- a click on a link never navigates the frame
    const click = await js(`(() => {
      const before = location.href;
      const a = document.querySelector('[data-role="probe-render"] a');
      const notCancelled = a.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      return { cancelled: !notCancelled, same: location.href === before };
    })()`);
    if (!click.cancelled || !click.same) errors.push('link click: ' + JSON.stringify(click));
    await js(`document.querySelector('[data-role="probe-render"]').remove()`);

    // ---- IPC door: a bad chat id or an unknown thread is refused
    const b1 = await js(`window.vrg.chat.toTerminal('not an id')`);
    if (!b1 || b1.ok !== false) errors.push('toTerminal with a bad id must be refused: ' + JSON.stringify(b1));
    const b2 = await js(`window.vrg.chat.toTerminal('cnone')`);
    if (!b2 || b2.ok !== false || b2.err !== 'not-found') errors.push('toTerminal with an unknown thread: ' + JSON.stringify(b2));

    // ---- "Folytatás terminálban" → a term pane whose fake-claude argv has --resume|<session>
    await js(`window.__term = ''; window.vrg.on('term', 'data', m => { window.__term += m.data; }); true`);
    await js(`${Q}.querySelector('[data-role="to-term"]').click()`);
    const got = await wait(() => js(`/FAKE_CLAUDE --resume\\|sess-demo-1/.test(window.__term)`), 15000);
    if (!got) errors.push('no "FAKE_CLAUDE --resume|sess-demo-1" in the term output: ' + JSON.stringify(await js(`window.__term.slice(0, 300)`)));
    const termPane = await wait(() => js(`window.VRGFrame.panes().some(p => /^term-/.test(p))`), 8000);
    if (!termPane) errors.push('no term pane opened');
  } catch (e) { errors.push('probe error: ' + e.stack); }
  finally {
    try { web.closeAll(); } catch (e) {}
    if (oldBin === undefined) delete process.env.VRG_CLAUDE_BIN; else process.env.VRG_CLAUDE_BIN = oldBin;
    if (oldLog === undefined) delete process.env.FAKE_CLAUDE_LOG; else process.env.FAKE_CLAUDE_LOG = oldLog;
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {}
  }
  return { ok: !errors.length, errors };
};

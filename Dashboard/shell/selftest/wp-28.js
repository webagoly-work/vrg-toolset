// WP-28 probe (real Electron, mock-google on 127.0.0.1, a pre-stored mock token): the Mail pane lists 3 mails; the <script> mail opens in the
// read view with no script, no remote image until "Képek betöltése", and no window.vrg; the PDF attachment is saved only after the job's question
// is answered, with the right byte count, into the selftest's temp downloads root. The token goes into secrets.bin under the selftest's temp
// VRG_DESK_HOME (main's secrets object: safeStorage can't be swapped from here), and is removed at the end. No real Google endpoint is called.
'use strict';
const fs = require('fs'), os = require('os'), path = require('path');

module.exports = async function probe({ win }) {
  const errors = [];
  const { frame, views, jobs, mail } = win.desk;
  const wc = frame.webContents;
  const js = async code => { try { return await wc.executeJavaScript(code, true); } catch (e) { throw new Error('frame script failed: ' + code.trim().slice(0, 100)); } };
  const wait = async (fn, ms) => {
    const end = Date.now() + ms;
    while (Date.now() < end) { if (await fn()) return true; await new Promise(r => setTimeout(r, 100)); }
    return false;
  };
  const { createMock } = require(path.join(__dirname, '..', '..', 'test', 'fixtures', 'mock-google.js'));
  const mime = require(path.join(__dirname, '..', 'lib', 'mime.js'));
  const mock = createMock();
  const downloads = path.join(os.tmpdir(), 'VRG', 'desk-test-downloads');
  const SECRET = 'oauth:google:gmail-api';
  const savedGoogle = mail.providers.google;
  const Q = `document.querySelector('[data-kind="mail"]')`;
  const rows = `[...${Q}.querySelectorAll('[data-role="mail-item"]')]`;
  const viewWc = () => { const v = views.get('mailview'); return v && !v.webContents.isDestroyed() ? v.webContents : null; };
  // The read view runs no script at all (executeJavaScript is refused too), so it is inspected through the DevTools protocol's DOM domain:
  // { html: outerHTML, scripts: <script> elements, csp: the policy in the meta tag, images: <img> elements }
  const snapshot = async () => {
    const w = viewWc();
    if (!w) return null;
    const d = w.debugger;
    d.attach('1.3');
    try {
      await d.sendCommand('DOM.enable');
      const { root } = await d.sendCommand('DOM.getDocument', { depth: -1 });
      const count = async sel => (await d.sendCommand('DOM.querySelectorAll', { nodeId: root.nodeId, selector: sel })).nodeIds.length;
      const { outerHTML } = await d.sendCommand('DOM.getOuterHTML', { nodeId: root.nodeId });
      const meta = await d.sendCommand('DOM.querySelector', { nodeId: root.nodeId, selector: 'meta[http-equiv="Content-Security-Policy"]' });
      let csp = '';
      if (meta.nodeId) { const a = (await d.sendCommand('DOM.getAttributes', { nodeId: meta.nodeId })).attributes; csp = a[a.indexOf('content') + 1]; }
      return { html: outerHTML, scripts: await count('script'), images: await count('img'), csp };
    } finally { try { d.detach(); } catch (e) {} }
  };
  const viewLoaded = () => { const w = viewWc(); return !!w && !w.isLoading() && /^data:/.test(w.getURL()); };

  try {
    await mock.start();
    mail.providers.google = mock.providers().google;
    mock.current = 'MOCK_ACCESS_PROBE';
    mail.secrets.put(SECRET, JSON.stringify({ access: mock.current, refresh: '', expiry: Date.now() + 3600e3, scope: '', email: 'demo@example.test' }));
    mail.test.loopback = true;                                           // the CSP of "images on" also admits the mock's http://127.0.0.1

    // ---- open the pane: 3 mails
    await js(`window.VRGFrame.panes().filter(p => /^mail-/.test(p)).forEach(p => window.VRGFrame.close(p))`);
    await wait(() => js(`!document.querySelector('[data-kind="mail"]')`), 3000);
    const id = await js(`window.VRGFrame.open('mail', {})`);
    if (!/^mail-\d+$/.test(id)) errors.push('mail pane id: ' + JSON.stringify(id));
    if (!(await wait(() => js(`${rows}.length === 3`), 10000))) { errors.push('the pane did not list 3 mails: ' + await js(`${Q} && ${Q}.innerText.slice(0, 300)`)); return { ok: false, errors }; }
    const ids = await js(`${rows}.map(r => r.dataset.msg).join(',')`);
    if (ids !== 'latin2-pdf,multipart-html,plain-hu') errors.push('mail ids: ' + ids);
    const unread = await js(`${rows}.filter(r => r.dataset.unread === '1').map(r => r.dataset.msg).join(',')`);
    if (unread !== 'plain-hu') errors.push('unread marks: ' + unread);
    const labels = await js(`[...${Q}.querySelectorAll('button')].map(b => b.textContent).join('|')`);
    for (const l of ['Kijelentkezés', 'Keresés']) if (!labels.includes(l)) errors.push('missing button text: ' + l + ' in ' + labels);
    const accs = await js(`[...${Q}.querySelectorAll('[data-role="mail-account"]')].map(a => a.dataset.acc + ':' + a.dataset.signedIn).join(',')`);
    if (!/^gmail-api:1/.test(accs)) errors.push('accounts: ' + accs);
    if (viewWc()) errors.push('a read view exists before any mail is opened');

    // ---- the <script> mail
    await js(`${rows}.find(r => r.dataset.msg === 'multipart-html').click()`);
    if (!(await wait(viewLoaded, 10000))) { errors.push('the read view did not load'); return { ok: false, errors }; }
    await new Promise(r => setTimeout(r, 600));
    const s = await snapshot();
    if (!s) errors.push('could not look into the read view');
    else {
      if (s.scripts !== 0) errors.push('<script> elements in the read view: ' + s.scripts);
      if (/<script/i.test(s.html)) errors.push('<script> found in the read view HTML');
      if (!/<p>Hello <b>világ<\/b><\/p>/.test(s.html)) errors.push('read view text: ' + s.html.slice(s.html.indexOf('<main'), s.html.indexOf('<main') + 200));
      if (s.images !== 1) errors.push('read view images: ' + s.images);
      if (s.csp !== "default-src 'none'; img-src data: cid:; style-src 'unsafe-inline'") errors.push('CSP (images off): ' + s.csp);
    }
    if (mock.hits !== 0) errors.push('the remote image loaded before "Képek betöltése": ' + mock.hits + ' request(s)');
    // typeof window.vrg === 'undefined': the view has no preload (webPreferences), and with JavaScript off it has no script context at all
    const prefs = viewWc().getLastWebPreferences ? viewWc().getLastWebPreferences() : null;
    if (!prefs) errors.push('no webPreferences to check');
    else if (prefs.javascript !== false || prefs.sandbox !== true || prefs.contextIsolation !== true || prefs.nodeIntegration !== false || prefs.preload) {
      errors.push('read view webPreferences: ' + JSON.stringify({ js: prefs.javascript, sb: prefs.sandbox, ci: prefs.contextIsolation, ni: prefs.nodeIntegration, pre: prefs.preload }));
    }
    const noScript = await viewWc().executeJavaScript('typeof window.vrg', true).then(() => 'ran', () => 'blocked');
    if (noScript !== 'blocked') errors.push('script ran inside the read view: ' + noScript);

    // ---- a link in the message never navigates the view
    const before = viewWc().getURL();
    viewWc().emit('will-navigate', { preventDefault() {} }, 'javascript:alert(1)');
    await new Promise(r => setTimeout(r, 200));
    if (viewWc().getURL() !== before) errors.push('the read view navigated');

    // ---- "Képek betöltése": the request reaches the mock
    const imgBtn = await js(`!${Q}.querySelector('[data-role="mail-images"]').hidden`);
    if (!imgBtn) errors.push('"Képek betöltése" is not shown for a mail with a remote image');
    else {
      await js(`${Q}.querySelector('[data-role="mail-images"]').click()`);
      if (!(await wait(() => mock.hits >= 1, 8000))) errors.push('no request reached /img after "Képek betöltése"');
      await wait(viewLoaded, 5000);
      const s2 = await snapshot();
      if (!s2 || !/img-src https: http:\/\/127\.0\.0\.1:\* data: cid:;/.test(s2.csp)) errors.push('CSP (images on): ' + (s2 && s2.csp));
      else if (s2.scripts !== 0 || /<script/i.test(s2.html)) errors.push('after loading images: script in the view');
    }

    // ---- the PDF attachment: asked first, then saved
    const raw = fs.readFileSync(path.join(__dirname, '..', '..', 'test', 'fixtures', 'mails', 'latin2-pdf.eml'), 'utf8').replace(/\r?\n/g, '\r\n');
    const pdf = mime.parse(Buffer.from(raw, 'utf8')).attachments[0];
    fs.rmSync(downloads, { recursive: true, force: true });
    await js(`window.__ask = null; window.vrg.on('jobs', 'ask', m => { window.__ask = m; }); true`);
    await js(`${rows}.find(r => r.dataset.msg === 'latin2-pdf').click()`);
    if (!(await wait(() => js(`!!${Q}.querySelector('[data-role="mail-att-save"]')`), 8000))) errors.push('no "Mentés…" button for the PDF');
    else {
      const label = await js(`${Q}.querySelector('[data-role="mail-att-save"]').textContent`);
      if (label !== 'Mentés…') errors.push('save button label: ' + label);
      await js(`${Q}.querySelector('[data-role="mail-att-save"]').click()`);
      if (!(await wait(() => js(`!!window.__ask`), 8000))) errors.push('the save job did not ask');
      else {
        const ask = await js(`window.__ask`);
        if (fs.existsSync(downloads) && fs.readdirSync(downloads).length) errors.push('a file was written before the answer: ' + fs.readdirSync(downloads));
        const ans = jobs.answer(ask.job, 'yes');
        if (!ans.ok) errors.push('answer refused: ' + JSON.stringify(ans));
        const done = await wait(() => { const j = jobs.get(ask.job); return !!j && j.state === 'done'; }, 8000);
        if (!done) errors.push('the save job did not finish: ' + JSON.stringify(jobs.get(ask.job)));
        const files = fs.existsSync(downloads) ? fs.readdirSync(downloads) : [];
        if (files.length !== 1) errors.push('downloads root: ' + JSON.stringify(files));
        else if (fs.statSync(path.join(downloads, files[0])).size !== pdf.data.length) errors.push('saved ' + fs.statSync(path.join(downloads, files[0])).size + ' bytes, wanted ' + pdf.data.length);
        else if (!/\.pdf$/.test(files[0])) errors.push('saved name: ' + files[0]);
      }
    }

    // ---- the IPC door: bad ids and a non-existing mail are refused
    const b1 = await js(`window.vrg.mail.render('gmail-api', 'not an id', false)`);
    if (!b1 || b1.ok !== false) errors.push('render with a bad id must be refused: ' + JSON.stringify(b1));
    const b2 = await js(`window.vrg.mail.saveAttachment('gmail-api', 'nope', 'a1')`);
    if (!b2 || b2.ok !== false || b2.err !== 'not-found') errors.push('saveAttachment for an unknown mail: ' + JSON.stringify(b2));

    // ---- closing the pane removes the read view
    await js(`window.VRGFrame.close(${JSON.stringify(id)})`);
    if (!(await wait(() => !views.has('mailview'), 5000))) errors.push('the read view stays after the pane closed');
  } catch (e) { errors.push('probe error: ' + e.stack); }
  finally {
    try { mail.test.loopback = false; } catch (e) {}
    try { mail.providers.google = savedGoogle; } catch (e) {}
    try { mail.secrets.del(SECRET); } catch (e) {}
    try { views.destroy('mailview'); } catch (e) {}
    try { await mock.stop(); } catch (e) {}
    try { fs.rmSync(downloads, { recursive: true, force: true }); } catch (e) {}
  }
  return { ok: !errors.length, errors };
};

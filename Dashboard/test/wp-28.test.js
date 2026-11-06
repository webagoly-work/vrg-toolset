// WP-28: Mail pane — the CSP builder, the link policy, the read-view document, the page-side cleaner (WP-35a), the read-view guards and the
// attachment job, with fakes only (no Electron, no network). The real DOMPurify / read view / mock-google run in selftest/wp-28.js.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path'), os = require('os');
const { EventEmitter } = require('events');

const mailLib = require('../shell/lib/mail.js');
const { createMail, cspFor, linkPolicy, renderDoc, hasRemoteImages, SANITIZE } = mailLib;
const mailClean = require('../shell/lib/mailclean.js');
const { createViews } = require('../shell/lib/views.js');
const { createJobs } = require('../shell/lib/jobs.js');
const pane = require('../page/panes/mail.js');

const TEMPLATE = fs.readFileSync(path.join(__dirname, '..', 'page', 'mailview.html'), 'utf8');
const base = path.join(os.tmpdir(), 'VRG');
fs.mkdirSync(base, { recursive: true });
const TMP = fs.mkdtempSync(path.join(base, 'desk-test-'));
test.after(() => fs.rmSync(TMP, { recursive: true, force: true }));

test('cspFor: images off and on', () => {
  assert.equal(cspFor(), "default-src 'none'; img-src data: cid:; style-src 'unsafe-inline'");
  assert.equal(cspFor({ images: false }), "default-src 'none'; img-src data: cid:; style-src 'unsafe-inline'");
  assert.equal(cspFor({ images: true }), "default-src 'none'; img-src https: data: cid:; style-src 'unsafe-inline'");
  assert.equal(cspFor({ images: false, loopback: true }), "default-src 'none'; img-src data: cid:; style-src 'unsafe-inline'");   // loopback only with images on
  assert.equal(cspFor({ images: true, loopback: true }), "default-src 'none'; img-src https: http://127.0.0.1:* data: cid:; style-src 'unsafe-inline'");
});

test('linkPolicy: the table', () => {
  assert.deepEqual(linkPolicy('http://example.test/a?b=1'), { ok: true, action: 'web', url: 'http://example.test/a?b=1' });
  assert.deepEqual(linkPolicy('https://example.test/'), { ok: true, action: 'web', url: 'https://example.test/' });
  assert.deepEqual(linkPolicy('mailto:bela@example.test?subject=x'), { ok: false, action: 'refuse', offer: 'copy-address', address: 'bela@example.test', hu: 'Cím másolása' });
  assert.deepEqual(linkPolicy('mailto:b%C3%A9la@example.test'), { ok: false, action: 'refuse', offer: 'copy-address', address: 'béla@example.test', hu: 'Cím másolása' });
  assert.deepEqual(linkPolicy('mailto:not an address'), { ok: false, action: 'refuse' });
  assert.deepEqual(linkPolicy('javascript:alert(1)'), { ok: false, action: 'refuse' });
  assert.deepEqual(linkPolicy('cid:logo@demo'), { ok: false, action: 'inline-only' });
  for (const u of ['file:///C:/x', 'data:text/html,hi', 'chrome://settings', 'vbscript:x', '', 'not a url', 'ftp://example.test/']) assert.deepEqual(linkPolicy(u), { ok: false, action: 'refuse' }, u);
});

test('renderDoc fills the template once and escapes headers', () => {
  const t = TEMPLATE;
  for (const slot of ['{{csp}}', '{{head}}', '{{body}}']) assert.equal(t.split(slot).length, 2, slot + ' must appear exactly once in mailview.html');
  const doc = renderDoc(t, { csp: cspFor(), headers: { from: 'A <a@x.test>', subject: 'S & "q"', date: 'd' }, html: '<p>$& hi</p>' });
  // the quotes in the policy are entity-escaped inside the attribute; the browser decodes them back to the exact policy
  assert.ok(doc.includes('<meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; img-src data: cid:; style-src &#39;unsafe-inline&#39;">'));
  assert.ok(doc.includes('<div data-role="mail-from">A &lt;a@x.test&gt;</div>'));
  assert.ok(doc.includes('<div data-role="mail-subject">S &amp; &quot;q&quot;</div>'));
  assert.ok(doc.includes('<p>$& hi</p>'));
  assert.ok(!doc.includes('{{'));
  const plain = renderDoc(t, { csp: cspFor(), text: '<b>x</b>' });
  assert.ok(plain.includes('<pre data-role="mail-text">&lt;b&gt;x&lt;/b&gt;</pre>'));
  const big = renderDoc(t, { csp: cspFor(), html: 'x'.repeat(2000000) });
  assert.ok(big.length < 1600000);
});

test('hasRemoteImages', () => {
  assert.equal(hasRemoteImages('<p><img src="https://x.test/a.png"></p>'), true);
  assert.equal(hasRemoteImages('<img width=1 src=http://x.test/a.png>'), true);
  assert.equal(hasRemoteImages('<img src="data:image/png;base64,AAAA">'), false);
  assert.equal(hasRemoteImages('<p>no images</p>'), false);
});

test('the page-side cleaner: forbid lists, URI rule, fail closed (DESK-Q73 B)', () => {
  assert.equal(SANITIZE, mailClean.SANITIZE);                                   // one list for main and the page
  for (const t of ['script', 'iframe', 'object', 'embed', 'form', 'svg', 'meta', 'base', 'link']) assert.ok(SANITIZE.forbidTags.includes(t), t);
  assert.ok(SANITIZE.forbidAttr.includes('srcdoc'));
  const re = new RegExp(SANITIZE.uri, 'i');
  for (const ok of ['http://a', 'https://a', 'mailto:a@b', 'cid:x', 'data:image/png;base64,AA']) assert.ok(re.test(ok), ok);
  for (const bad of ['javascript:alert(1)', 'data:text/html,x', 'file:///x', 'vbscript:x']) assert.ok(!re.test(bad), bad);
  const seen = [];
  const fake = { sanitize: (h, c) => { seen.push({ h, c }); return '<p>clean</p>'; } };
  assert.equal(mailClean.clean(fake, '<script>1</script><p>a</p>'), '<p>clean</p>');
  assert.deepEqual(seen[0].c.FORBID_TAGS, SANITIZE.forbidTags.slice());
  assert.equal(seen[0].c.ALLOW_UNKNOWN_PROTOCOLS, false);
  assert.ok(seen[0].c.ALLOWED_URI_REGEXP instanceof RegExp);
  assert.equal(mailClean.clean(null, '<p>a</p>'), '', 'no DOMPurify → no HTML');
  assert.equal(mailClean.clean({ sanitize: () => { throw new Error('x'); } }, '<p>a</p>'), '', 'a throwing DOMPurify → no HTML');
  assert.equal(mailClean.clean({ sanitize: () => ({ not: 'a string' }) }, '<p>a</p>'), '');
  assert.equal(mailClean.clean(fake, ''), '');
  const big = []; mailClean.clean({ sanitize: h => { big.push(h.length); return 'x'; } }, 'y'.repeat(mailClean.HTML_MAX + 10));
  assert.equal(big[0], mailClean.HTML_MAX);
});

// ---- createMail with fakes
const GMAIL = {
  get: async (acc, msg) => (msg === 'nope' ? { ok: false, err: 'not-found', hu: 'Nincs ilyen levél.' }
    : { ok: true, headers: { from: 'Bela <b@x.test>', subject: 'Demo', date: 'd' }, text: 'plain', html: '<script>1</script><p>a</p>',
      attachments: [{ att: 'a1', name: 'szamla.pdf', size: 8, type: 'application/pdf', data: Buffer.from('%PDF-1.4\n') }] }),
  attachment: async () => ({ ok: true, data: Buffer.from('%PDF-1.4\n'), size: 9 }),
  list: async () => ({ ok: true, items: [] }),
};
const OAUTH = { signedIn: () => true };

test('get: the HTML comes back as sent; the pane cleans it (DESK-Q73 B)', async () => {
  const mail = createMail({ oauth: OAUTH, gmail: GMAIL });
  const r = await mail.get('gmail-api', 'm1');
  assert.equal(r.ok, true);
  assert.equal(r.html, '<script>1</script><p>a</p>');
  assert.equal((await mail.get('gmail-api', 'nope')).err, 'not-found');
  assert.equal((await mail.get('web:gmail', 'm1')).err, 'not-found');             // no presets here → unknown account
});

test('render hands the read view a finished document with the right CSP', async () => {
  const shown = [];
  const mail = createMail({
    oauth: OAUTH, gmail: GMAIL, template: TEMPLATE, loopback: () => false,
    readView: { show: (doc, o) => shown.push({ doc, o }), hide: () => shown.push('hide') },
  });
  const CLEAN = '<p>a</p><img src="https://x.test/i.png">';
  const r1 = await mail.render('gmail-api', 'm1', false, CLEAN);
  assert.deepEqual(r1, { ok: true, view: 'mailview', remote: true, images: false });
  assert.ok(shown[0].doc.includes(CLEAN), 'the cleaned HTML from the pane is the body');
  assert.match(shown[0].doc, /img-src data: cid:; style-src/);
  assert.ok(!shown[0].doc.includes('<script'));
  const r2 = await mail.render('gmail-api', 'm1', true, CLEAN);
  assert.equal(r2.images, true);
  assert.match(shown[1].doc, /img-src https: data: cid:; style-src/);
  assert.deepEqual(mail.closeView(), { ok: true });
  assert.equal(shown[2], 'hide');
  await mail.render('gmail-api', 'm1', false);                                     // no cleaned HTML → the text part, never the raw HTML
  assert.ok(!shown[3].doc.includes('<script') && shown[3].doc.includes('plain'));
  assert.equal((await createMail({ oauth: OAUTH, gmail: GMAIL }).render('gmail-api', 'm1', false)).err, 'unavailable');
});

// ---- the attachment job
function jobsWith(choice) {
  let jobs;
  const asked = [];
  jobs = createJobs({ emit: (type, d) => { if (type === 'ask') { asked.push(d); setImmediate(() => jobs.answer(d.job, choice)); } } });
  return { jobs, asked };
}

test('saveAttachment: asks first, then writes the bytes under a free name in the downloads root', async () => {
  const dir = path.join(TMP, 'downloads');
  const { jobs, asked } = jobsWith('yes');
  const mail = createMail({ oauth: OAUTH, gmail: GMAIL, jobs, downloadsDir: () => dir });
  const r = await mail.saveAttachment('gmail-api', 'm1', 'a1');
  assert.equal(r.ok, true);
  const fin = await jobs.whenDone(r.job);
  assert.equal(fin.state, 'done');
  assert.equal(asked.length, 1);
  assert.deepEqual(asked[0].choices, ['yes', 'cancel']);
  assert.match(asked[0].question, /szamla\.pdf/);
  assert.equal(fs.readFileSync(path.join(dir, 'szamla.pdf')).length, 9);
  const r2 = await mail.saveAttachment('gmail-api', 'm1', 'a1');                  // a second save never overwrites
  assert.equal((await jobs.whenDone(r2.job)).state, 'done');
  assert.deepEqual(fs.readdirSync(dir).sort(), ['szamla (2).pdf', 'szamla.pdf']);
});

test('saveAttachment: "cancel" writes nothing; bad ids and web accounts are refused', async () => {
  const dir = path.join(TMP, 'downloads-cancel');
  const { jobs } = jobsWith('cancel');
  const mail = createMail({ oauth: OAUTH, gmail: GMAIL, jobs, downloadsDir: () => dir });
  const r = await mail.saveAttachment('gmail-api', 'm1', 'a1');
  assert.equal((await jobs.whenDone(r.job)).state, 'cancelled');
  assert.equal(fs.existsSync(dir), false);
  assert.equal((await mail.saveAttachment('gmail-api', 'm1', 'a9')).err, 'not-found');
  assert.equal((await mail.saveAttachment('gmail-api', 'nope', 'a1')).err, 'not-found');
  assert.equal((await mail.saveAttachment('nobody', 'm1', 'a1')).err, 'not-found');
});

// ---- createMailView with fakes
function fakeElectron() {
  const made = [];
  class WebContentsView {
    constructor(o) {
      this.opts = o; this.visible = null; this.bounds = null;
      const wc = new EventEmitter();
      wc.handler = null; wc.loaded = null; wc.destroyed = false;
      wc.setWindowOpenHandler = f => { wc.handler = f; };
      wc.loadURL = async u => { wc.loaded = u; };
      wc.isDestroyed = () => wc.destroyed;
      wc.close = () => { wc.destroyed = true; };
      this.webContents = wc;
      this.setVisible = v => { this.visible = v; };
      this.setBounds = b => { this.bounds = b; };
      made.push(this);
    }
  }
  const win = { isDestroyed: () => false, contentView: { addChildView() {}, removeChildView() {} } };
  return { WebContentsView, win, made };
}

test('createMailView: no preload, sandbox, JavaScript off; every navigation is cancelled and reported', () => {
  const { WebContentsView, win, made } = fakeElectron();
  const views = createViews({ WebContentsView, win, preload: 'p.js', homePage: 'h.html' });
  const links = [];
  const out = views.createMailView('<p>hi</p>', { onLink: u => links.push(u) });
  assert.equal(out.id, 'mailview');
  const o = made[0].opts.webPreferences;
  assert.equal(o.javascript, false);
  assert.equal(o.sandbox, true);
  assert.equal(o.contextIsolation, true);
  assert.equal(o.nodeIntegration, false);
  assert.equal(o.preload, undefined);
  assert.equal(o.partition, 'vrg-mailview');
  const wc = made[0].webContents;
  assert.equal(wc.loaded, 'data:text/html;charset=utf-8,' + encodeURIComponent('<p>hi</p>'));
  let prevented = 0;
  wc.emit('will-navigate', { preventDefault: () => prevented++ }, 'https://example.test/x');
  wc.emit('will-redirect', { preventDefault: () => prevented++ }, 'https://example.test/y');
  assert.equal(prevented, 2);
  assert.deepEqual(wc.handler({ url: 'mailto:a@b.test' }), { action: 'deny' });
  assert.deepEqual(links, ['https://example.test/x', 'mailto:a@b.test']);
});

test('createMailView: re-creating replaces the view and keeps the rect the frame sent', () => {
  const { WebContentsView, win, made } = fakeElectron();
  const views = createViews({ WebContentsView, win, preload: 'p.js', homePage: 'h.html' });
  views.createMailView('<p>1</p>');
  assert.equal(views.setBounds('mailview', { x: 10, y: 20, w: 300, h: 200 }), true);
  views.createMailView('<p>2</p>');
  assert.equal(made.length, 2);
  assert.equal(made[0].webContents.destroyed, true);
  assert.deepEqual(made[1].bounds, { x: 10, y: 20, width: 300, height: 200 });
  assert.equal(made[1].visible, true);
  assert.deepEqual(views.ids(), ['mailview']);
});

// ---- pane helpers
test('pane helpers', () => {
  assert.equal(pane.senderName('Nagy Béla <bela@example.test>'), 'Nagy Béla');
  assert.equal(pane.senderName('"Nagy, Béla" <bela@example.test>'), 'Nagy, Béla');
  assert.equal(pane.senderName('<bela@example.test>'), 'bela@example.test');
  assert.equal(pane.senderName('bela@example.test'), 'bela@example.test');
  assert.equal(pane.sizeText(0), '0 B');
  assert.equal(pane.sizeText(2048), '2.0 KB');
  assert.equal(pane.sizeText(3 * 1048576), '3.0 MB');
  assert.equal(pane.clip('  a   b  ', 10), 'a b');
  assert.equal(pane.clip('x'.repeat(200), 5), 'xxxxx…');
});

test('mail.js has no raw-HTML sink in the page', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'page', 'panes', 'mail.js'), 'utf8');
  assert.ok(!/innerHTML\s*=\s*[^'"\s]/.test(src.replace(/root\.innerHTML = ''/g, '').replace(/innerHTML = ''/g, '')), 'innerHTML is only ever cleared');
  assert.ok(!/insertAdjacentHTML|outerHTML|document\.write/.test(src));
});

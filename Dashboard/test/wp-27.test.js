// WP-27: OAuth (PKCE, loopback) + read-only Gmail client, against the local mock only (127.0.0.1, no Google).
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path'), os = require('os');

const base = path.join(os.tmpdir(), 'VRG');
fs.mkdirSync(base, { recursive: true });
const HOME = fs.mkdtempSync(path.join(base, 'desk-test-'));
process.env.VRG_DESK_HOME = HOME;

const paths = require('../shell/lib/paths.js');
const { createSecrets } = require('../shell/lib/secrets.js');
const { createAudit } = require('../shell/lib/audit.js');
const { createOAuth, NO_CLIENT } = require('../shell/lib/oauth.js');
const { createGmail } = require('../shell/lib/gmail.js');
const { createMail } = require('../shell/lib/mail.js');
const mime = require('../shell/lib/mime.js');
const { createMock } = require('./fixtures/mock-google.js');

const MAILS = path.join(__dirname, 'fixtures', 'mails');
const CLIENTS = path.join(HOME, 'oauth-clients.json');
const SUBJECT_1 = 'Árajánlat – próba', SUBJECT_3 = 'Számla érkezett: őszi tűz';

const cipher = () => ({
  isEncryptionAvailable: () => true,
  encryptString: s => Buffer.from(Buffer.from(s, 'utf8').map(b => b ^ 0x5a)),
  decryptString: b => Buffer.from(b.map(x => x ^ 0x5a)).toString('utf8'),
});

const mock = createMock();
const secrets = createSecrets({ safeStorage: cipher() });
const audit = createAudit({ dir: path.join(HOME, 'audit') });
let offset = 0, opened = [], sleeps = [];
// the "browser": follows the mock's consent redirect, which lands on our loopback server
const opener = async url => {
  opened.push(url);
  const r = await fetch(url, { redirect: 'manual' });
  const loc = r.headers.get('location');
  if (loc) await fetch(loc);
};
let oauth, gmail, mail;

test.before(async () => {
  await mock.start();
  const providers = mock.providers();
  oauth = createOAuth({ secrets, audit, providers, opener, now: () => Date.now() + offset, timeoutMs: 4000 });
  gmail = createGmail({ oauth, providers, sleep: async ms => { sleeps.push(ms); } });
  mail = createMail({ oauth, gmail, presets: () => JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config', 'web.json'), 'utf8')) });
});
test.after(async () => { await mock.stop(); fs.rmSync(HOME, { recursive: true, force: true }); });

const writeClient = () => fs.writeFileSync(CLIENTS, JSON.stringify({ google: { client_id: 'demo-client', client_secret: 'demo-secret' } }));
const secretsBin = () => fs.readFileSync(path.join(paths.userDir(), 'secrets.bin'));

test('config/oauth-providers.json holds the Google endpoints', () => {
  const j = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config', 'oauth-providers.json'), 'utf8'));
  assert.deepEqual(j, { google: {
    auth: 'https://accounts.google.com/o/oauth2/v2/auth', token: 'https://oauth2.googleapis.com/token', revoke: 'https://oauth2.googleapis.com/revoke',
    scopes: ['https://www.googleapis.com/auth/gmail.readonly'], api: 'https://gmail.googleapis.com/gmail/v1',
  } });
});

test('mime: Hungarian UTF-8 text, quoted-printable, encoded words', () => {
  const p = mime.parse(fs.readFileSync(path.join(MAILS, 'plain-hu.eml')));
  assert.equal(p.headers.subject, SUBJECT_1);
  assert.equal(p.headers.from, 'Nagy Béla <bela@example.test>');
  assert.match(p.text, /árvíztűrő tükörfúrógép/);
  assert.equal(p.html, '');
  assert.deepEqual(p.attachments, []);
  const crlf = mime.parse(fs.readFileSync(path.join(MAILS, 'plain-hu.eml'), 'utf8').replace(/\n/g, '\r\n'));
  assert.equal(crlf.text.replace(/\r/g, ''), p.text.replace(/\r/g, ''));
});

test('mime: multipart/alternative keeps the raw html, ISO-8859-2 and RFC 2231 names decode', () => {
  const m = mime.parse(fs.readFileSync(path.join(MAILS, 'multipart-html.eml')));
  assert.match(m.html, /<script>window\.__demo = 1;<\/script>/);
  assert.match(m.html, /<img src="http:\/\/127\.0\.0\.1:\{port\}\/img"/);
  assert.equal(m.text, 'Hello! Ez a szöveges változat, a hosszú sort egyben tartjuk.');
  const l = mime.parse(fs.readFileSync(path.join(MAILS, 'latin2-pdf.eml')));
  assert.equal(l.headers.subject, SUBJECT_3);
  assert.equal(l.headers.from, 'Kovács Anna <anna@example.test>');
  assert.equal(l.text.trim(), 'A számla csatolva.');
  assert.deepEqual(l.attachments, [{ att: 'a1', name: 'számla.pdf', size: 13, type: 'application/pdf' }]);
  assert.equal(l.attachments[0].data.toString('latin1'), '%PDF-1.4 fake');
});

test('sign-in without a client file → no-client, nothing opened', async () => {
  const r = await oauth.signIn('gmail-api');
  assert.deepEqual(r, { ok: false, err: 'no-client', hu: 'Nincs OAuth kliens beállítva (oauth-clients.json).' });
  assert.deepEqual(r, NO_CLIENT);
  assert.equal(opened.length, 0);
  assert.equal(oauth.signedIn('gmail-api'), false);
});

test('wrong state → refused, nothing stored', async () => {
  writeClient();
  mock.mode = 'badstate';
  const r = await oauth.signIn('gmail-api');
  mock.mode = 'ok';
  assert.equal(r.ok, false);
  assert.equal(r.err, 'state');
  assert.equal(mock.tokenRequests, 0);
  assert.equal(oauth.signedIn('gmail-api'), false);
  assert.equal(fs.existsSync(path.join(paths.userDir(), 'secrets.bin')), false);
});

test('PKCE mismatch → the mock answers 400 → refused, nothing stored', async () => {
  mock.tamper = true;
  const r = await oauth.signIn('gmail-api');
  mock.tamper = false;
  assert.equal(r.ok, false);
  assert.equal(r.err, 'token');
  assert.equal(mock.tokenRequests, 1);
  assert.equal(oauth.signedIn('gmail-api'), false);
});

test('full sign-in: PKCE S256, loopback, secret store holds the tokens encrypted', async () => {
  opened = [];
  const r = await oauth.signIn('gmail-api');
  assert.deepEqual(r, { ok: true, email: 'demo@example.test' });
  assert.equal(oauth.signedIn('gmail-api'), true);
  assert.equal(secrets.has('oauth:google:gmail-api'), true);
  const stored = JSON.parse(secrets.get('oauth:google:gmail-api'));
  assert.equal(stored.access, 'MOCK_ACCESS_1');
  assert.equal(stored.refresh, 'MOCK_REFRESH');
  assert.equal(stored.email, 'demo@example.test');
  const bytes = secretsBin();
  assert.equal(bytes.includes(Buffer.from('MOCK_ACCESS')), false);
  assert.equal(bytes.includes(Buffer.from('MOCK_REFRESH')), false);
  // the request the browser got
  assert.equal(opened.length, 1);
  const u = new URL(opened[0]);
  assert.equal(u.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(u.searchParams.get('response_type'), 'code');
  assert.equal(u.searchParams.get('scope'), 'https://www.googleapis.com/auth/gmail.readonly');
  assert.equal(u.searchParams.get('client_id'), 'demo-client');
  const redirect = u.searchParams.get('redirect_uri');
  assert.match(redirect, /^http:\/\/127\.0\.0\.1:\d+\/cb$/);
  // the token request
  const v = mock.last.code_verifier;
  assert.ok(v.length >= 43 && v.length <= 128 && /^[A-Za-z0-9_-]+$/.test(v));
  assert.equal(mock.last.client_secret, 'demo-secret');
  assert.equal(mock.last.redirect_uri, redirect);
  // the one-shot server is closed
  await assert.rejects(fetch(redirect));
});

test('an expired token is refreshed once', async () => {
  assert.equal(mock.refreshes, 0);
  assert.deepEqual(await oauth.token('gmail-api'), { ok: true, access: 'MOCK_ACCESS_1' });
  offset = 3600 * 1000 - 30 * 1000;                                       // < 60 s left
  assert.deepEqual(await oauth.token('gmail-api'), { ok: true, access: 'MOCK_ACCESS_2' });
  assert.deepEqual(await oauth.token('gmail-api'), { ok: true, access: 'MOCK_ACCESS_2' });
  assert.equal(mock.refreshes, 1);
  offset = 0;
});

test('gmail.list: 3 items with decoded subjects', async () => {
  const r = await gmail.list('gmail-api', 'in:inbox');
  assert.equal(r.ok, true);
  assert.deepEqual(r.items.map(i => i.subject), [SUBJECT_3, 'Multipart demo', SUBJECT_1]);
  assert.deepEqual(r.items.map(i => i.msg), ['latin2-pdf', 'multipart-html', 'plain-hu']);
  assert.deepEqual(r.items.map(i => i.unread), [false, false, true]);
  assert.equal(r.items[2].from, 'Nagy Béla <bela@example.test>');
  assert.equal(r.items[2].date, 'Tue, 03 Nov 2026 09:15:00 +0100');
  assert.equal(r.next, undefined);
});

test('gmail.get: html keeps <script> (the pane sanitizes), attachments list the PDF', async () => {
  const h = await gmail.get('gmail-api', 'multipart-html');
  assert.equal(h.ok, true);
  assert.match(h.html, /<script>/);
  assert.ok(h.html.includes('http://127.0.0.1:' + mock.port + '/img'));
  assert.equal(h.headers.subject, 'Multipart demo');
  const p = await gmail.get('gmail-api', 'latin2-pdf');
  assert.deepEqual(p.attachments, [{ att: 'a1', name: 'számla.pdf', size: 13, type: 'application/pdf' }]);
  const plain = await gmail.get('gmail-api', 'plain-hu');
  assert.match(plain.text, /Kedves Demo!/);
  assert.equal(mock.hits, 0);                                              // nothing fetched the remote image
  assert.equal((await gmail.get('gmail-api', 'nope')).err, 'not-found');
});

test('gmail.attachment: our own id (from get) and a Gmail-style id give the same bytes', async () => {
  const own = await gmail.attachment('gmail-api', 'latin2-pdf', 'a1');
  const gm = await gmail.attachment('gmail-api', 'latin2-pdf', 'ATT1');
  assert.equal(own.data.toString('latin1'), '%PDF-1.4 fake');
  assert.equal(gm.data.toString('latin1'), '%PDF-1.4 fake');
  assert.equal(gm.size, 13);
  assert.equal((await gmail.attachment('gmail-api', 'latin2-pdf', 'a9')).err, 'not-found');
});

test('401 → one refresh and a retry', async () => {
  const before = mock.refreshes;
  mock.invalidate();
  const r = await gmail.list('gmail-api', '');
  assert.equal(r.ok, true);
  assert.equal(r.items.length, 3);
  assert.equal(mock.refreshes, before + 1);
});

test('429 / 5xx → backoff 1 s, 2 s, 4 s, then gives up', async () => {
  sleeps = []; mock.failNext = [429, 503];
  assert.equal((await gmail.list('gmail-api', '')).ok, true);
  assert.deepEqual(sleeps, [1000, 2000]);
  sleeps = []; mock.failNext = [500, 500, 500, 500];
  const r = await gmail.list('gmail-api', '');
  assert.deepEqual(sleeps, [1000, 2000, 4000]);
  assert.equal(r.ok, false);
  assert.equal(r.err, 'server');
  mock.failNext = [];
});

test('mail.js: accounts merge the API account and the webmail presets, never a token', async () => {
  const acc = mail.accounts();
  assert.deepEqual(acc.map(a => [a.acc, a.kind, a.signedIn]), [['gmail-api', 'gmail', true], ['web:gmail', 'web', false], ['web:outlook', 'web', false]]);
  assert.equal(JSON.stringify(acc).includes('MOCK_'), false);
  assert.equal((await mail.list('gmail-api', '', '')).items.length, 3);
  assert.equal((await mail.get('gmail-api', 'plain-hu')).ok, true);
  assert.equal((await mail.list('web:gmail')).err, 'bad-request');
  assert.equal((await mail.signIn('web:gmail')).err, 'bad-request');
  assert.equal((await mail.list('nope')).err, 'not-found');
});

test('sign-in timeout closes the server and stores nothing', async () => {
  const quiet = createOAuth({ secrets, audit, providers: mock.providers(), opener: async () => {}, timeoutMs: 100 });
  const r = await quiet.signIn('other');
  assert.equal(r.err, 'timeout');
  assert.equal(quiet.signedIn('other'), false);
});

test('signOut: revoke called, secret gone', async () => {
  const r = await mail.signOut('gmail-api');
  assert.deepEqual(r, { ok: true, revoked: true });
  assert.deepEqual(mock.revoked, ['MOCK_REFRESH']);
  assert.equal(secrets.has('oauth:google:gmail-api'), false);
  assert.equal(mail.accounts()[0].signedIn, false);
  assert.equal((await gmail.list('gmail-api', '')).err, 'not-signed-in');
});

test('no audit line holds a token or the client secret', () => {
  const dir = path.join(HOME, 'audit');
  const text = fs.readdirSync(dir).map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
  assert.ok(text.includes('"ch":"oauth.signIn"'));
  assert.ok(text.includes('"ch":"oauth.signOut"'));
  assert.equal(text.includes('MOCK_'), false);
  assert.equal(text.includes('demo-secret'), false);
});

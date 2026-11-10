// mock-google.js — a local stand-in for Google's OAuth and Gmail endpoints (WP-27, used by WP-28 too). 127.0.0.1 only.
//   const mock = createMock();  await mock.start();  mock.providers() → config for lib/oauth.js / gmail.js;  await mock.stop();
// Switches: mock.mode = 'ok' | 'badstate' (auth redirects back with a wrong state), mock.tamper = true (the stored PKCE challenge is wrong),
//           mock.expiresIn (seconds), mock.failNext = [429, 503, …] (consumed by the next message-list calls), mock.invalidate() (the access token stops working).
// Observers: mock.hits (GET /img), mock.revoked, mock.refreshes, mock.tokenRequests, mock.last (the last token request's form).
'use strict';
const http = require('http'), crypto = require('crypto'), fs = require('fs'), path = require('path');
const mime = require('../../shell/lib/mime.js');

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const b64u = b => Buffer.from(b).toString('base64url');

function createMock({ mailsDir = path.join(__dirname, 'mails') } = {}) {
  const mock = {
    mode: 'ok', tamper: false, expiresIn: 3600, failNext: [], hits: 0, revoked: [], refreshes: 0, tokenRequests: 0, last: null,
    port: 0, url: '', current: null, email: 'demo@example.test',
  };
  const codes = new Map();
  let n = 0, server = null;

  const mails = () => fs.readdirSync(mailsDir).filter(f => f.endsWith('.eml')).sort().map(f => ({
    id: f.replace(/\.eml$/, ''),
    raw: fs.readFileSync(path.join(mailsDir, f), 'utf8').replace(/\{port\}/g, String(mock.port)).replace(/\r?\n/g, '\r\n'),
  }));
  const unfolded = raw => raw.split('\r\n\r\n')[0].replace(/\r\n[ \t]+/g, ' ');
  const header = (raw, name) => { const m = new RegExp('^' + name + ':[ \\t]*(.*)$', 'im').exec(unfolded(raw)); return m ? m[1].trim() : ''; };

  const send = (res, code, body, type = 'application/json') => {
    res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store', connection: 'close' });
    res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
  };
  const readBody = req => new Promise(r => { const c = []; req.on('data', d => c.push(d)); req.on('end', () => r(Buffer.concat(c).toString('utf8'))); });

  async function handle(req, res) {
    const u = new URL(req.url, 'http://127.0.0.1');
    const p = u.pathname;

    if (req.method === 'GET' && p === '/auth') {
      const q = u.searchParams, redirect = q.get('redirect_uri') || '';
      if (q.get('response_type') !== 'code' || q.get('code_challenge_method') !== 'S256' || !q.get('code_challenge') || !q.get('client_id') || !q.get('state')) return send(res, 400, { error: 'invalid_request' });
      if (!/^http:\/\/127\.0\.0\.1:\d+\/cb$/.test(redirect)) return send(res, 400, { error: 'invalid_redirect' });
      const code = 'MOCK_CODE_' + b64u(crypto.randomBytes(9));
      codes.set(code, { challenge: mock.tamper ? 'tampered' : q.get('code_challenge'), redirect });
      const back = new URL(redirect);
      back.searchParams.set('code', code);
      back.searchParams.set('state', mock.mode === 'badstate' ? 'WRONG' : q.get('state'));
      res.writeHead(302, { location: back.href, connection: 'close' });
      return res.end();
    }

    if (req.method === 'POST' && p === '/token') {
      mock.tokenRequests++;
      const f = new URLSearchParams(await readBody(req));
      mock.last = Object.fromEntries(f);
      if (f.get('grant_type') === 'authorization_code') {
        const c = codes.get(f.get('code'));
        codes.delete(f.get('code'));
        if (!c || c.redirect !== f.get('redirect_uri')) return send(res, 400, { error: 'invalid_grant' });
        const v = f.get('code_verifier') || '';
        if (b64u(crypto.createHash('sha256').update(v).digest()) !== c.challenge) return send(res, 400, { error: 'invalid_grant', error_description: 'PKCE' });
        mock.current = 'MOCK_ACCESS_' + (++n);
        return send(res, 200, { access_token: mock.current, refresh_token: 'MOCK_REFRESH', expires_in: mock.expiresIn, scope: 'https://www.googleapis.com/auth/gmail.readonly', token_type: 'Bearer' });
      }
      if (f.get('grant_type') === 'refresh_token' && f.get('refresh_token') === 'MOCK_REFRESH') {
        mock.refreshes++;
        mock.current = 'MOCK_ACCESS_' + (++n);
        return send(res, 200, { access_token: mock.current, expires_in: mock.expiresIn, scope: 'https://www.googleapis.com/auth/gmail.readonly', token_type: 'Bearer' });
      }
      return send(res, 400, { error: 'unsupported_grant_type' });
    }

    if (req.method === 'POST' && p === '/revoke') {
      mock.revoked.push(new URLSearchParams(await readBody(req)).get('token'));
      return send(res, 200, {});
    }

    if (p === '/img') { mock.hits++; return send(res, 200, PNG, 'image/png'); }
    if (p === '/hits') return send(res, 200, { n: mock.hits });

    if (p.startsWith('/gmail/v1/users/me/')) {
      if (!mock.current || req.headers.authorization !== 'Bearer ' + mock.current) return send(res, 401, { error: { code: 401, status: 'UNAUTHENTICATED' } });
      const rest = p.slice('/gmail/v1/users/me/'.length);
      if (rest === 'profile') return send(res, 200, { emailAddress: mock.email });
      if (rest === 'messages') {
        if (mock.failNext.length) return send(res, mock.failNext.shift(), { error: { code: 'injected' } });
        return send(res, 200, { messages: mails().map(m => ({ id: m.id, threadId: m.id })), resultSizeEstimate: 3 });
      }
      let m = /^messages\/([\w-]+)$/.exec(rest);
      if (m) {
        const mail = mails().find(x => x.id === m[1]);
        if (!mail) return send(res, 404, { error: { code: 404 } });
        if (u.searchParams.get('format') === 'raw') return send(res, 200, { id: mail.id, raw: b64u(mail.raw) });
        const body = mail.raw.split('\r\n\r\n').slice(1).join('\r\n\r\n');
        return send(res, 200, {
          id: mail.id, snippet: body.replace(/\s+/g, ' ').slice(0, 80), labelIds: mail.id === 'plain-hu' ? ['INBOX', 'UNREAD'] : ['INBOX'],
          payload: { headers: ['From', 'Subject', 'Date'].map(name => ({ name, value: header(mail.raw, name) })) },
        });
      }
      m = /^messages\/([\w-]+)\/attachments\/ATT(\d+)$/.exec(rest);              // a Gmail-style attachment id: ATT<n> = the n-th attachment
      if (m) {
        const mail = mails().find(x => x.id === m[1]);
        const a = mail && mime.parse(Buffer.from(mail.raw, 'utf8')).attachments[Number(m[2]) - 1];
        return a ? send(res, 200, { size: a.data.length, data: b64u(a.data) }) : send(res, 404, { error: { code: 404 } });
      }
    }
    send(res, 404, { error: 'not found' });
  }

  mock.invalidate = () => { mock.current = null; };
  mock.providers = () => ({
    google: {
      auth: mock.url + '/auth', token: mock.url + '/token', revoke: mock.url + '/revoke',
      scopes: ['https://www.googleapis.com/auth/gmail.readonly'], api: mock.url + '/gmail/v1',
    },
  });
  mock.start = () => new Promise((ok, fail) => {
    server = http.createServer((req, res) => { handle(req, res).catch(() => { try { send(res, 500, { error: 'mock' }); } catch (e) {} }); });
    server.once('error', fail);
    server.listen(0, '127.0.0.1', () => { mock.port = server.address().port; mock.url = 'http://127.0.0.1:' + mock.port; ok(mock); });
  });
  mock.stop = () => new Promise(ok => { if (!server) return ok(); server.close(() => ok()); if (server.closeAllConnections) server.closeAllConnections(); });
  return mock;
}

module.exports = { createMock };

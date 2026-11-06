// mail.js — the vrg.mail surface (WP-27): Gmail API accounts (OAuth) and the webmail presets (WP-26, kind 'web') in one list.
//   const mail = createMail({ oauth, gmail, presets: () => [...config/web.json] });
//   accounts() · signIn(acc) · signOut(acc) · list(acc, q, page) · get(acc, msg)
// A token never leaves main: the page sees ids and the bool signedIn. Web accounts sign in inside their own pane.
'use strict';

const API_ACCOUNTS = [{ acc: 'gmail-api', hu: 'Gmail (API)', provider: 'google' }];
const WEB_ONLY = { ok: false, err: 'bad-request', hu: 'Ez a fiók a böngészőpanelben jelentkezik be.' };
const UNKNOWN = { ok: false, err: 'not-found', hu: 'Nincs ilyen fiók.' };

function createMail({ oauth, gmail, presets = () => [] }) {
  const web = () => (presets() || []).filter(p => p && p.mail === true && /^[a-z0-9_-]{1,40}$/.test(String(p.id)))
    .map(p => ({ acc: 'web:' + p.id, kind: 'web', hu: String(p.hu || p.id), signedIn: false }));
  const api = acc => API_ACCOUNTS.find(a => a.acc === acc) || null;
  const guard = acc => api(acc) ? null : (String(acc).startsWith('web:') && web().some(w => w.acc === acc) ? { ...WEB_ONLY } : { ...UNKNOWN });

  return {
    accounts: () => [
      ...API_ACCOUNTS.map(a => ({ acc: a.acc, kind: 'gmail', hu: a.hu, signedIn: oauth.signedIn(a.acc, a.provider) })),
      ...web(),
    ],
    signIn: async acc => { const g = guard(acc); if (g) return g; const r = await oauth.signIn(acc, api(acc).provider); return r.ok ? { ok: true } : r; },
    signOut: async acc => { const g = guard(acc); if (g) return g; return oauth.signOut(acc, api(acc).provider); },
    list: async (acc, q, page) => { const g = guard(acc); return g || gmail.list(acc, q || '', page || ''); },
    get: async (acc, msg) => { const g = guard(acc); return g || gmail.get(acc, msg); },
  };
}

module.exports = { createMail, API_ACCOUNTS };

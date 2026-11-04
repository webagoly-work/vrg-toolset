// WP-06 probe (real Electron, temp home set by main.js): safeStorage secrets round-trip, nothing plain on disk; app.setting over IPC.
'use strict';
const fs = require('fs'), path = require('path');
module.exports = async function probe({ win }) {
  const errors = [];
  const { safeStorage } = require('electron');
  const paths = require('../lib/paths.js');
  const { createSecrets } = require('../lib/secrets.js');
  if (!/desk-test-/.test(paths.home())) return { ok: false, errors: ['home is not a temp folder: ' + paths.home()] };

  const s = createSecrets({ safeStorage });
  try {
    s.put('probe', 'VRG_SECRET_PROBE');
    const bytes = fs.readFileSync(path.join(paths.userDir(), 'secrets.bin'));
    if (bytes.includes(Buffer.from('VRG_SECRET_PROBE'))) errors.push('secrets.bin holds the plain value');
    if (s.get('probe') !== 'VRG_SECRET_PROBE') errors.push('get did not return the value');
    if (!s.del('probe') || s.has('probe')) errors.push('del did not remove the value');
  } catch (e) { errors.push('secrets: ' + e.message); }

  const js = code => win.webContents.executeJavaScript(code);
  let r = await js(`window.vrg.app.setting('ui.lang', 'en')`);
  if (!r || r.ok !== true || r.v !== 'en') errors.push('setting set: ' + JSON.stringify(r));
  r = await js(`window.vrg.app.setting('ui.lang')`);
  if (!r || r.ok !== true || r.v !== 'en') errors.push('setting get: ' + JSON.stringify(r));
  r = await js(`window.vrg.app.setting('no.such.key')`);
  if (!r || r.ok !== false || r.err !== 'bad-request') errors.push('unknown key: ' + JSON.stringify(r));
  r = await js(`window.vrg.app.setting('ui.lang', 'xx')`);
  if (!r || r.ok !== false) errors.push('bad value accepted: ' + JSON.stringify(r));
  if (await js(`typeof window.vrg.secrets`) !== 'undefined') errors.push('page can see secrets');
  await js(`window.vrg.app.setting('ui.lang', 'hu')`);
  return { ok: !errors.length, errors };
};
